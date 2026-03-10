import { createStore } from "solid-js/store";
import {
  type ActivityItem,
  type ActivityStore,
  type ActivityType,
  type DriveActivity,
  type ActivitySettings,
} from "./activityTypes";
import { getFileWithUserInfo } from "./driveApi";

// Кэш профилей пользователей (fileId -> lastModifyingUser)
const userProfileCache = new Map<
  string,
  { displayName: string; email?: string; photoLink?: string }
>();

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
  notificationSound: "chime",
};

const STORAGE_KEYS = {
  ACTIVITIES: "activities",
  READ_IDS: "readActivityIds",
  LAST_SYNC: "lastSyncTime",
};

// Глобальное хранилище активности
export const [activityStore, setActivityStore] = createStore<ActivityStore>({
  items: [],
  unreadCount: 0,
  lastSyncTime: null,
  isLoading: false,
  error: null,
});

/**
 * Загрузить активность из фонового сервис-воркера (browser.storage)
 * Фоновый процесс синхронизирует активности каждые 5 минут
 */
export async function loadActivitiesFromBackground(): Promise<void> {
  console.log("[loadActivitiesFromBackground] Loading activities from storage...");
  setActivityStore("isLoading", true);
  setActivityStore("error", null);

  try {
    // Получить活动 и список прочитанных из storage
    const storage = await browser.storage.local.get([
      STORAGE_KEYS.ACTIVITIES,
      STORAGE_KEYS.READ_IDS,
      STORAGE_KEYS.LAST_SYNC,
    ]);

    const activities = (storage[STORAGE_KEYS.ACTIVITIES] as ActivityItem[]) || [];
    const readIds = new Set(
      (storage[STORAGE_KEYS.READ_IDS] as string[]) || [],
    );
    const lastSyncTime = (storage[STORAGE_KEYS.LAST_SYNC] as string) || null;

    // Обновить флаги isRead на основе readIds
    const itemsWithReadStatus = activities.map((item) => ({
      ...item,
      isRead: readIds.has(item.id),
    }));

    setActivityStore("items", itemsWithReadStatus);
    setActivityStore(
      "unreadCount",
      itemsWithReadStatus.filter((a) => !a.isRead).length,
    );
    setActivityStore("lastSyncTime", lastSyncTime);

    console.log(
      `[loadActivitiesFromBackground] Loaded ${itemsWithReadStatus.length} activities (${itemsWithReadStatus.filter((a) => !a.isRead).length} unread)`,
    );

    // Асинхронно загрузить профили пользователей в фоне
    void loadUserProfiles(itemsWithReadStatus);
  } catch (error) {
    console.error("[loadActivitiesFromBackground] Failed:", error);
    setActivityStore("error", error instanceof Error ? error.message : "Unknown error");
  } finally {
    setActivityStore("isLoading", false);
  }
}

/**
 * Загрузить профили пользователей для активностей через Drive API
 */
async function loadUserProfiles(items: ActivityItem[]): Promise<void> {
  // Собрать все fileId которые нужно загрузить
  const fileIds = new Set<string>();

  items.forEach((item) => {
    if (item.target.fileId && !userProfileCache.has(item.target.fileId)) {
      fileIds.add(item.target.fileId);
    }
  });

  console.log(`[loadUserProfiles] Processing ${items.length} items...`);
  
  if (fileIds.size === 0) {
    console.log("[loadUserProfiles] No user profiles to load");
    return;
  }

  console.log(`[loadUserProfiles] Loading user info for ${fileIds.size} files...`);

  // Загружаем информацию о файлах параллельно
  const promises = Array.from(fileIds).map(async (fileId) => {
    console.log(`[loadUserProfiles] Fetching info for file ${fileId}...`);
    const fileInfo = await getFileWithUserInfo(fileId);
    
    console.log(`[loadUserProfiles] File ${fileId} info:`, fileInfo);
    if (!fileInfo) {
      console.warn(`[loadUserProfiles] ✗ No file info for file ${fileId}`);
      return;
    }

    const resolvedUser = fileInfo.lastModifyingUser ?? fileInfo.owners?.[0];

    if (!resolvedUser || (!resolvedUser.displayName && !resolvedUser.emailAddress)) {
      console.warn(`[loadUserProfiles] ✗ No usable user data for file ${fileId}`);
      return;
    }

    const displayName =
      resolvedUser.displayName || resolvedUser.emailAddress || "Пользователь";

    userProfileCache.set(fileId, {
      displayName,
      email: resolvedUser.emailAddress,
      photoLink: resolvedUser.photoLink,
    });

    console.log(`[loadUserProfiles] ✓ Cached user for file ${fileId}: ${displayName}`);

    // Обновляем активности с новым именем
    console.log(`[loadUserProfiles] Updating activities for file ${fileId}...`);
    setActivityStore(
      "items",
      (prevItems: typeof activityStore.items) =>
        prevItems.map((item) => {
          if (item.target.fileId === fileId) {
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
      
      console.log(`[Parser] Extracted FileID: ${fileId || "NOT FOUND"} from ${target.driveItem?.name || "unknown"}`);

      // Извлечь актора
      let actorDisplayName = "Загрузка...";
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
          if (typeof personName === "string" && personName.startsWith("people/")) {
            const shortId = personName.substring(personName.lastIndexOf("/") + 1).substring(0, 8);
            actorDisplayName = `ID ${shortId}`;
          }
        }
      }
      
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
          (typeof target.driveItem.name === "string" && !target.driveItem.name.startsWith("items/") 
            ? target.driveItem.name 
            : "Безымянный"),
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
  
  console.log(`[mergeActivities] Merged: ${existing.length} existing + ${fresh.length} fresh = ${result.length} total`);
  
  return result;
}

/**
 * Отметить активность как прочитанную
 */
export async function markAsRead(activityIds: string[]): Promise<void> {
  // Обновить локальное состояние UI
  const updated = activityStore.items.map((item) =>
    activityIds.includes(item.id) ? { ...item, isRead: true } : item,
  );

  setActivityStore("items", updated);
  setActivityStore("unreadCount", updated.filter((a) => !a.isRead).length);

  // Сохранить в storage для синхронизации с background
  const storage = await browser.storage.local.get(STORAGE_KEYS.READ_IDS);
  const readIds = new Set(
    (storage[STORAGE_KEYS.READ_IDS] as string[]) || [],
  );

  activityIds.forEach((id) => readIds.add(id));
  await browser.storage.local.set({
    [STORAGE_KEYS.READ_IDS]: Array.from(readIds),
  });

  console.log(`[markAsRead] Marked ${activityIds.length} activities as read`);
}

/**
 * Отметить все как прочитанные
 */
export async function markAllAsRead(): Promise<void> {
  const allIds = activityStore.items.map((item) => item.id);
  await markAsRead(allIds);
}

/**
 * Очистить старые активности
 */
export async function cleanOldActivities(): Promise<void> {
  const settings = await getSettings();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - settings.autoCleanupDays);

  const filtered = activityStore.items.filter(
    (item) => new Date(item.timestamp) > cutoffDate,
  );

  setActivityStore("items", filtered);

  // Обновить в storage
  await browser.storage.local.set({
    [STORAGE_KEYS.ACTIVITIES]: filtered,
  });

  console.log(`[cleanOldActivities] Cleaned up old activities`);
}

/**
 * Очистить кэш активностей (удалить все сохраненные данные)
 */
export async function clearActivityCache(): Promise<void> {
  await browser.storage.local.remove([
    STORAGE_KEYS.ACTIVITIES,
    STORAGE_KEYS.READ_IDS,
    STORAGE_KEYS.LAST_SYNC,
  ]);
  setActivityStore("items", []);
  setActivityStore("unreadCount", 0);
  setActivityStore("lastSyncTime", null);
  userProfileCache.clear();
  console.log("[clearActivityCache] Cache cleared");
}

export async function getSettings(): Promise<ActivitySettings> {
  return new Promise((resolve) => {
    browser.storage.local.get(["activity_settings"], (result) => {
      const settings = result.activity_settings as Partial<ActivitySettings> | undefined;
      resolve({ ...DEFAULT_SETTINGS, ...(settings || {}) });
    });
  });
}

export async function saveSettings(settings: Partial<ActivitySettings>): Promise<void> {
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
