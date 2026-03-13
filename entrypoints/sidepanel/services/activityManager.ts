import { createStore } from "solid-js/store";
import {
  BehaviorSubject,
  Subscription,
  from,
  fromEventPattern,
  interval,
  merge,
  of,
} from "rxjs";
import {
  catchError,
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  skip,
  startWith,
  switchMap,
} from "rxjs/operators";
import {
  ActivityNotificationSound,
  type ActivityItem,
  type ActivityActor,
  type ActivityStore,
  type ActivityType,
  type DriveActivity,
  type ActivitySettings,
} from "./activityTypes";
import { getFileWithUserInfo } from "./driveApi";
import {
  MESSAGE_ACTIVITY_SYNC_NOW,
  type ActivitySyncNowMessage,
  type ActivitySyncNowResponse,
} from "../../shared/activityNotifications";
import { translateCurrentLocale } from "../../shared/i18n/runtime";

type CachedUserProfile = {
  displayName: string;
  email?: string;
  photoLink?: string;
  cachedAt: number;
};

// In-memory кэш профилей: по файлу и по identity пользователя.
const userProfileCache = new Map<string, CachedUserProfile>();
const actorProfileCache = new Map<string, CachedUserProfile>();
const unavailableUserProfileFileIds = new Set<string>();
let actorProfileCacheHydrated = false;

const ACTOR_PROFILE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACTOR_PROFILE_CACHE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const DEFAULT_SETTINGS: ActivitySettings = {
  enabledTypes: [
    "comment",
    "reply",
    "mention",
    "share",
    "edit",
    "create",
    "permission_change",
  ],
  notificationsEnabled: true,
  syncIntervalMinutes: 5,
  autoCleanupDays: 30,
  playSound: false,
  notificationSound: ActivityNotificationSound.Chime,
};

const STORAGE_KEYS = {
  ACTIVITIES: "activities",
  READ_IDS: "readActivityIds",
  LAST_SYNC: "lastSyncTime",
  ACTOR_PROFILE_CACHE: "activityActorProfileCache",
};

const ACTIVITY_STORAGE_KEY_SET = new Set<string>([
  STORAGE_KEYS.ACTIVITIES,
  STORAGE_KEYS.READ_IDS,
  STORAGE_KEYS.LAST_SYNC,
]);

const INITIAL_ACTIVITY_STORE: ActivityStore = {
  items: [],
  unreadCount: 0,
  lastSyncTime: null,
  isLoading: false,
  error: null,
};

// Глобальное хранилище активности
export const [activityStore, setActivityStore] = createStore<ActivityStore>({
  ...INITIAL_ACTIVITY_STORE,
});

const activityStateSubject = new BehaviorSubject<ActivityStore>({
  ...INITIAL_ACTIVITY_STORE,
});
const reloadToken$ = new BehaviorSubject<number>(0);
let activityStreamSubscription: Subscription | null = null;

export const activityState$ = activityStateSubject
  .asObservable()
  .pipe(shareReplay({ bufferSize: 1, refCount: true }));

export const activityUnreadCount$ = activityState$.pipe(
  map((state) => state.unreadCount),
  distinctUntilChanged(),
  shareReplay({ bufferSize: 1, refCount: true }),
);

async function readActivitySnapshotFromStorage(): Promise<{
  items: ActivityItem[];
  unreadCount: number;
  lastSyncTime: string | null;
}> {
  await hydrateActorProfileCache();

  const storage = await browser.storage.local.get([
    STORAGE_KEYS.ACTIVITIES,
    STORAGE_KEYS.READ_IDS,
    STORAGE_KEYS.LAST_SYNC,
  ]);

  const activities = (storage[STORAGE_KEYS.ACTIVITIES] as ActivityItem[]) || [];
  const readIds = new Set((storage[STORAGE_KEYS.READ_IDS] as string[]) || []);
  const lastSyncTime = (storage[STORAGE_KEYS.LAST_SYNC] as string) || null;

  const items = activities.map((item) => {
    const profile = resolveCachedProfileForItem(item);

    return {
      ...item,
      isRead: readIds.has(item.id),
      actor: profile
        ? {
            ...item.actor,
            displayName: profile.displayName || item.actor.displayName,
            email: profile.email || item.actor.email,
            photoUrl: profile.photoLink || item.actor.photoUrl,
          }
        : item.actor,
    };
  });

  return {
    items,
    unreadCount: items.filter((item) => !item.isRead).length,
    lastSyncTime,
  };
}

function getActorIdentityKey(actor: ActivityActor | undefined): string | null {
  if (!actor) {
    return null;
  }

  if (actor.identityKey) {
    return actor.identityKey;
  }

  if (actor.email) {
    return `email:${actor.email.toLowerCase()}`;
  }

  return null;
}

function resolveCachedProfileForItem(
  item: ActivityItem,
): CachedUserProfile | null {
  const actorKey = getActorIdentityKey(item.actor);
  if (actorKey) {
    const byActor = actorProfileCache.get(actorKey);
    if (byActor && isCachedProfileFresh(byActor)) {
      return byActor;
    }
  }

  if (!item.target.fileId) {
    return null;
  }

  const byFile = userProfileCache.get(item.target.fileId);
  if (byFile && isCachedProfileFresh(byFile)) {
    return byFile;
  }

  return null;
}

function isCachedProfileFresh(profile: CachedUserProfile): boolean {
  return Date.now() - profile.cachedAt <= ACTOR_PROFILE_CACHE_TTL_MS;
}

async function pruneActorProfileCacheByTtl(): Promise<boolean> {
  await hydrateActorProfileCache();

  let changed = false;

  for (const [key, profile] of actorProfileCache.entries()) {
    if (!isCachedProfileFresh(profile)) {
      actorProfileCache.delete(key);
      changed = true;
    }
  }

  for (const [key, profile] of userProfileCache.entries()) {
    if (!isCachedProfileFresh(profile)) {
      userProfileCache.delete(key);
      changed = true;
    }
  }

  if (changed) {
    await persistActorProfileCache();
  }

  return changed;
}

async function hydrateActorProfileCache(): Promise<void> {
  if (actorProfileCacheHydrated) {
    return;
  }

  actorProfileCacheHydrated = true;

  const storage = await browser.storage.local.get(
    STORAGE_KEYS.ACTOR_PROFILE_CACHE,
  );
  const raw = storage[STORAGE_KEYS.ACTOR_PROFILE_CACHE];
  if (!raw || typeof raw !== "object") {
    return;
  }

  const record = raw as Record<string, CachedUserProfile>;
  let pruned = false;

  Object.entries(record).forEach(([key, profile]) => {
    if (
      !profile ||
      typeof profile.displayName !== "string" ||
      typeof profile.cachedAt !== "number"
    ) {
      pruned = true;
      return;
    }

    if (!isCachedProfileFresh(profile)) {
      pruned = true;
      return;
    }

    actorProfileCache.set(key, {
      displayName: profile.displayName,
      email: profile.email,
      photoLink: profile.photoLink,
      cachedAt: profile.cachedAt,
    });
  });

  if (pruned) {
    await persistActorProfileCache();
  }
}

async function persistActorProfileCache(): Promise<void> {
  const entries = Array.from(actorProfileCache.entries());
  const limited = entries
    .sort((left, right) => left[1].cachedAt - right[1].cachedAt)
    .slice(Math.max(0, entries.length - 800));
  const payload: Record<string, CachedUserProfile> = {};

  limited.forEach(([key, profile]) => {
    payload[key] = profile;
  });

  await browser.storage.local.set({
    [STORAGE_KEYS.ACTOR_PROFILE_CACHE]: payload,
  });
}

function publishActivityState(state: ActivityStore): void {
  activityStateSubject.next(state);
  setActivityStore(state);
}

function ensureActivityStreamInitialized(): void {
  if (activityStreamSubscription) {
    return;
  }

  const storageChanges$ = fromEventPattern<
    [Record<string, Browser.storage.StorageChange>, string]
  >(
    (handler) =>
      browser.storage.onChanged.addListener(
        handler as Parameters<typeof browser.storage.onChanged.addListener>[0],
      ),
    (handler) =>
      browser.storage.onChanged.removeListener(
        handler as Parameters<
          typeof browser.storage.onChanged.removeListener
        >[0],
      ),
  ).pipe(
    filter(([changes, areaName]) => {
      if (areaName !== "local") {
        return false;
      }

      return Object.keys(changes).some((key) =>
        ACTIVITY_STORAGE_KEY_SET.has(key),
      );
    }),
    map(() => reloadToken$.value + 1),
  );

  const cacheMaintenance$ = interval(
    ACTOR_PROFILE_CACHE_CLEANUP_INTERVAL_MS,
  ).pipe(
    startWith(0),
    switchMap(() =>
      from(pruneActorProfileCacheByTtl()).pipe(
        map(() => reloadToken$.value + 1),
        catchError(() => of(reloadToken$.value + 1)),
      ),
    ),
  );

  activityStreamSubscription = merge(
    of(0),
    reloadToken$.pipe(skip(1)),
    storageChanges$,
    cacheMaintenance$,
  )
    .pipe(
      switchMap(() => {
        const current = activityStateSubject.value;
        publishActivityState({
          ...current,
          isLoading: true,
          error: null,
        });

        return from(readActivitySnapshotFromStorage()).pipe(
          map(
            (snapshot) =>
              ({
                items: snapshot.items,
                unreadCount: snapshot.unreadCount,
                lastSyncTime: snapshot.lastSyncTime,
                isLoading: false,
                error: null,
              }) as ActivityStore,
          ),
          catchError((error: unknown) => {
            const nextState: ActivityStore = {
              ...activityStateSubject.value,
              isLoading: false,
              error: error instanceof Error ? error.message : "Unknown error",
            };

            return of(nextState);
          }),
        );
      }),
    )
    .subscribe((state) => {
      publishActivityState(state);
      void loadUserProfiles(state.items);
    });
}

function triggerActivityReload(): void {
  ensureActivityStreamInitialized();
  reloadToken$.next(reloadToken$.value + 1);
}

export function subscribeActivityState(
  listener: (state: ActivityStore) => void,
): Subscription {
  ensureActivityStreamInitialized();
  return activityState$.subscribe(listener);
}

export function startActivityStreams(): void {
  triggerActivityReload();
}

export function disposeActivityStreams(): void {
  activityStreamSubscription?.unsubscribe();
  activityStreamSubscription = null;
}

/**
 * Загрузить активность из фонового сервис-воркера (browser.storage)
 * Фоновый процесс синхронизирует активности каждые 5 минут
 */
export async function loadActivitiesFromBackground(): Promise<void> {
  console.log("[loadActivitiesFromBackground] Trigger activity stream reload");
  triggerActivityReload();
}

export async function requestActivitySyncNow(): Promise<void> {
  const message: ActivitySyncNowMessage = {
    type: MESSAGE_ACTIVITY_SYNC_NOW,
  };

  const response = (await browser.runtime.sendMessage(message)) as
    | ActivitySyncNowResponse
    | undefined;

  if (!response?.ok) {
    throw new Error(
      translateCurrentLocale("service.error.backgroundSyncIncomplete"),
    );
  }
}

/**
 * Загрузить профили пользователей для активностей через Drive API
 */
async function loadUserProfiles(items: ActivityItem[]): Promise<void> {
  await hydrateActorProfileCache();

  // Собрать все fileId которые нужно загрузить
  const fileIds = new Set<string>();

  items.forEach((item) => {
    const cachedProfile = resolveCachedProfileForItem(item);
    if (cachedProfile) {
      return;
    }

    if (
      item.target.fileId &&
      !userProfileCache.has(item.target.fileId) &&
      !unavailableUserProfileFileIds.has(item.target.fileId)
    ) {
      fileIds.add(item.target.fileId);
    }
  });

  console.log(`[loadUserProfiles] Processing ${items.length} items...`);

  if (fileIds.size === 0) {
    console.log("[loadUserProfiles] No user profiles to load");
    return;
  }

  console.log(
    `[loadUserProfiles] Loading user info for ${fileIds.size} files...`,
  );

  // Загружаем информацию о файлах параллельно
  const promises = Array.from(fileIds).map(async (fileId) => {
    console.log(`[loadUserProfiles] Fetching info for file ${fileId}...`);
    const fileInfo = await getFileWithUserInfo(fileId);

    console.log(`[loadUserProfiles] File ${fileId} info:`, fileInfo);
    if (!fileInfo) {
      unavailableUserProfileFileIds.add(fileId);
      console.warn(`[loadUserProfiles] ✗ No file info for file ${fileId}`);
      return;
    }

    const resolvedUser = fileInfo.lastModifyingUser ?? fileInfo.owners?.[0];

    if (
      !resolvedUser ||
      (!resolvedUser.displayName && !resolvedUser.emailAddress)
    ) {
      console.warn(
        `[loadUserProfiles] ✗ No usable user data for file ${fileId}`,
      );
      return;
    }

    const displayName =
      resolvedUser.displayName ||
      resolvedUser.emailAddress ||
      translateCurrentLocale("activity.runtime.user");

    const cachedProfile: CachedUserProfile = {
      displayName,
      email: resolvedUser.emailAddress,
      photoLink: resolvedUser.photoLink,
      cachedAt: Date.now(),
    };

    userProfileCache.set(fileId, {
      ...cachedProfile,
    });

    const actorKeyFromItems = items.find(
      (item) => item.target.fileId === fileId,
    )?.actor.identityKey;

    const actorKey =
      actorKeyFromItems ||
      (resolvedUser.emailAddress
        ? `email:${resolvedUser.emailAddress.toLowerCase()}`
        : null);

    if (actorKey) {
      actorProfileCache.set(actorKey, cachedProfile);
      void persistActorProfileCache();
    }

    unavailableUserProfileFileIds.delete(fileId);

    console.log(
      `[loadUserProfiles] ✓ Cached user for file ${fileId}: ${displayName}`,
    );

    // Обновляем активности с новым именем
    console.log(`[loadUserProfiles] Updating activities for file ${fileId}...`);
    setActivityStore("items", (prevItems: typeof activityStore.items) =>
      prevItems.map((item) => {
        const sameActor =
          actorKey !== null && item.actor.identityKey === actorKey;

        if (item.target.fileId === fileId || sameActor) {
          console.log(`[loadUserProfiles] Updating item: ${item.id}`);
          return {
            ...item,
            actor: {
              ...item.actor,
              displayName: displayName || item.actor.displayName,
              email: resolvedUser.emailAddress || item.actor.email,
              photoUrl: resolvedUser.photoLink || item.actor.photoUrl,
            },
          };
        }
        return item;
      }),
    );
  });

  await Promise.all(promises);
  console.log("[loadUserProfiles] Finished loading user profiles");
}

/**
 * Парсинг DriveActivity в ActivityItem
 * Экспортируется для использования в background.ts
 */
export function parseActivities(activities: DriveActivity[]): ActivityItem[] {
  return activities
    .map((activity): ActivityItem | null => {
      const detail = activity.primaryActionDetail;
      const actor = activity.actors?.[0];
      const target = activity.targets?.[0];
      const timestamp = activity.timestamp || activity.timeRange?.endTime || "";

      if (!target?.driveItem || !timestamp) {
        return null;
      }

      // Определить тип активности
      let type: ActivityType;
      let details: ActivityItem["details"] = {};

      if (detail.comment) {
        type = detail.comment.post ? "comment" : "reply";
        // TODO: извлечь текст комментария через Comments API
      } else if (detail.edit) {
        type = "edit";
      } else if (detail.create) {
        type = "create";
      } else if (detail.move) {
        type = "move";
        details.oldParentName = detail.move.removedParents?.[0]?.title;
        details.newParentName = detail.move.addedParents?.[0]?.title;
      } else if (detail.rename) {
        type = "rename";
        details.oldName = detail.rename.oldTitle;
        details.newName = detail.rename.newTitle;
      } else if (detail.delete) {
        type = "delete";
      } else if (detail.restore) {
        type = "restore";
      } else if (detail.permissionChange) {
        type = "permission_change";
        const added = detail.permissionChange.addedPermissions?.[0];
        if (added) {
          details.sharedRole = mapRole(added.role);
        }
      } else {
        return null; // Неизвестный тип
      }

      // Извлечь целевой файл
      let fileId = "";
      const driveItem = target.driveItem as any;

      console.log(`[Parser] driveItem structure:`, driveItem);

      if (driveItem) {
        // Drive Activity API может возвращать:
        // - name: "items/1abc123..." (формат для shared drive items)
        // - driveFile.name: "items/1abc123..."
        // - title: "My Document"

        const itemName = driveItem.name || driveItem.driveFile?.name || "";

        // Если формат "items/{fileId}", извлекаем ID
        if (itemName.startsWith("items/")) {
          fileId = itemName.substring(6); // удалить "items/"
        } else {
          fileId = driveItem.id || driveItem.resourceId || itemName;
        }
      }

      console.log(
        `[Parser] Extracted FileID: ${fileId || "NOT FOUND"} from ${target.driveItem?.name || "unknown"}`,
      );

      // Извлечь актора
      let actorDisplayName = translateCurrentLocale("activity.runtime.loading");
      let actorEmail = "";

      const user = actor?.user as any;

      // Попытка получить начальные данные из Activity API
      if (user && typeof user === "object") {
        if (user.emailAddress) {
          actorEmail = user.emailAddress;
          actorDisplayName = user.emailAddress.split("@")[0];
        } else if (user.displayName) {
          actorDisplayName = user.displayName;
        } else if (user.knownUser?.personName) {
          // personName это "people/123" - покажем временное имя
          const personName = user.knownUser.personName;
          if (
            typeof personName === "string" &&
            personName.startsWith("people/")
          ) {
            const shortId = personName
              .substring(personName.lastIndexOf("/") + 1)
              .substring(0, 8);
            actorDisplayName = `ID ${shortId}`;
          }
        }
      }

      const actorIdentityKey =
        user && typeof user === "object"
          ? typeof user.emailAddress === "string" && user.emailAddress
            ? `email:${user.emailAddress.toLowerCase()}`
            : typeof user.knownUser?.personName === "string" &&
                user.knownUser.personName
              ? `person:${user.knownUser.personName}`
              : null
          : null;

      // Проверяем кэш по fileId (будет заполнен асинхронно)
      if (fileId) {
        const cached = userProfileCache.get(fileId);
        if (cached) {
          actorDisplayName = cached.displayName;
          actorEmail = cached.email || actorEmail;
        }
      }

      const actorData = actor?.user
        ? {
            type: "user" as const,
            isCurrentUser:
              user && typeof user === "object"
                ? user.knownUser?.isCurrentUser === true
                : false,
            identityKey: actorIdentityKey || undefined,
            displayName: actorDisplayName,
            email: actorEmail || undefined,
          }
        : actor?.system
          ? { type: "system" as const }
          : { type: "anonymous" as const };

      const targetData = {
        fileId,
        fileName:
          target.driveItem.title ||
          target.driveItem.driveFile?.title ||
          (typeof target.driveItem.name === "string" &&
          !target.driveItem.name.startsWith("items/")
            ? target.driveItem.name
            : translateCurrentLocale("activity.runtime.untitled")),
        mimeType: target.driveItem.mimeType || "application/octet-stream",
      };

      return {
        id: `${timestamp}_${type}_${fileId || targetData.fileName}`,
        type,
        timestamp,
        actor: actorData,
        target: targetData,
        details,
        isRead: false,
      };
    })
    .filter((item): item is ActivityItem => item !== null);
}

/**
 * Объединить старые и новые активности (убрать дубликаты)
 */
function mergeActivities(
  existing: ActivityItem[],
  fresh: ActivityItem[],
): ActivityItem[] {
  const map = new Map<string, ActivityItem>();

  // Сначала добавляем старые (только валидные с fileId)
  existing.forEach((item) => {
    // Пропускаем старые записи с невалидными fileId
    if (item.target.fileId && !item.target.fileId.startsWith("items/")) {
      map.set(item.id, item);
    }
  });

  // Перезаписываем/добавляем новые
  fresh.forEach((item) => map.set(item.id, item));

  const result = Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  console.log(
    `[mergeActivities] Merged: ${existing.length} existing + ${fresh.length} fresh = ${result.length} total`,
  );

  return result;
}

/**
 * Отметить активность как прочитанную
 */
export async function markAsRead(activityIds: string[]): Promise<void> {
  ensureActivityStreamInitialized();

  // Обновить локальное состояние UI
  const updated = activityStore.items.map((item) =>
    activityIds.includes(item.id) ? { ...item, isRead: true } : item,
  );

  publishActivityState({
    ...activityStateSubject.value,
    items: updated,
    unreadCount: updated.filter((item) => !item.isRead).length,
  });

  // Сохранить в storage для синхронизации с background
  const storage = await browser.storage.local.get(STORAGE_KEYS.READ_IDS);
  const readIds = new Set((storage[STORAGE_KEYS.READ_IDS] as string[]) || []);

  activityIds.forEach((id) => readIds.add(id));
  await browser.storage.local.set({
    [STORAGE_KEYS.READ_IDS]: Array.from(readIds),
  });

  triggerActivityReload();

  console.log(`[markAsRead] Marked ${activityIds.length} activities as read`);
}

/**
 * Отметить все как прочитанные
 */
export async function markAllAsRead(): Promise<void> {
  const allIds = activityStateSubject.value.items.map((item) => item.id);
  await markAsRead(allIds);
}

/**
 * Очистить старые активности
 */
export async function cleanOldActivities(): Promise<void> {
  ensureActivityStreamInitialized();

  const settings = await getSettings();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - settings.autoCleanupDays);

  const filtered = activityStateSubject.value.items.filter(
    (item) => new Date(item.timestamp) > cutoffDate,
  );

  publishActivityState({
    ...activityStateSubject.value,
    items: filtered,
    unreadCount: filtered.filter((item) => !item.isRead).length,
  });

  // Обновить в storage
  await browser.storage.local.set({
    [STORAGE_KEYS.ACTIVITIES]: filtered,
  });

  triggerActivityReload();

  console.log(`[cleanOldActivities] Cleaned up old activities`);
}

/**
 * Очистить кэш активностей (удалить все сохраненные данные)
 */
export async function clearActivityCache(): Promise<void> {
  ensureActivityStreamInitialized();

  await browser.storage.local.remove([
    STORAGE_KEYS.ACTIVITIES,
    STORAGE_KEYS.READ_IDS,
    STORAGE_KEYS.LAST_SYNC,
    STORAGE_KEYS.ACTOR_PROFILE_CACHE,
  ]);
  publishActivityState({
    ...INITIAL_ACTIVITY_STORE,
  });
  userProfileCache.clear();
  actorProfileCache.clear();
  unavailableUserProfileFileIds.clear();
  actorProfileCacheHydrated = false;
  triggerActivityReload();
  console.log("[clearActivityCache] Cache cleared");
}

export async function getSettings(): Promise<ActivitySettings> {
  return new Promise((resolve) => {
    browser.storage.local.get(["activity_settings"], (result) => {
      const settings = result.activity_settings as
        | Partial<ActivitySettings>
        | undefined;
      resolve({ ...DEFAULT_SETTINGS, ...(settings || {}) });
    });
  });
}

export async function saveSettings(
  settings: Partial<ActivitySettings>,
): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  return new Promise((resolve) => {
    browser.storage.local.set({ activity_settings: updated }, resolve);
  });
}

// --- Helpers ---

function mapRole(role: string): "reader" | "writer" | "commenter" | "owner" {
  if (role.includes("WRITER") || role.includes("EDITOR")) return "writer";
  if (role.includes("COMMENTER")) return "commenter";
  if (role.includes("OWNER")) return "owner";
  return "reader";
}
