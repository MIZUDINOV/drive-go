import {
  fetchDriveActivity,
  getActivityAccessToken,
} from "./sidepanel/services/activityApi";
import { parseActivities } from "./sidepanel/services/activityManager";
import {
  ActivityNotificationSound,
  type ActivityItem,
  type ActivitySettings,
  type ActivityType,
} from "./sidepanel/services/activityTypes";
import {
  CONTEXT_MENU_IMAGE_ID,
  CONTEXT_MENU_PDF_ID,
  CONTEXT_MENU_ROOT_ID,
  CONTEXT_MENU_SCREENSHOT_ID,
  CONTEXT_MENU_SELECTION_TEXT_ID,
} from "./shared/contextMenuUpload";
import { getTargetParentFolderId } from "./shared/savePathsSettings";
import {
  MESSAGE_ACTIVITY_SYNC_NOW,
  MESSAGE_PLAY_NOTIFICATION_SOUND,
  type ActivitySyncNowMessage,
  type PlayNotificationSoundMessage,
} from "./shared/activityNotifications";
import {
  MESSAGE_TRANSFER_QUEUE_SNAPSHOT_UPDATED,
  MESSAGE_TRANSFER_QUEUE_CANCEL,
  MESSAGE_TRANSFER_QUEUE_CLEAR_HISTORY,
  MESSAGE_TRANSFER_QUEUE_ENQUEUE_UPLOAD,
  MESSAGE_TRANSFER_QUEUE_LIST,
  MESSAGE_TRANSFER_QUEUE_REMOVE,
  MESSAGE_TRANSFER_QUEUE_RETRY,
  PORT_TRANSFER_QUEUE_SIDEPANEL_SESSION,
  PORT_TRANSFER_QUEUE_UPDATES,
  type TransferQueueSnapshotUpdatedPortMessage,
  type TransferQueueMessage,
} from "./shared/transferQueueMessages";
import {
  cleanupStaleStagedTransferBlobs,
  deleteStagedTransferBlob,
  getStagedTransferBlob,
} from "./shared/transferQueueStagingDb";
import { setTransferPopoverSeenUpTo } from "./shared/transferQueueUiState";
import {
  translateCurrentLocale,
  translateStoredLocale,
} from "./shared/i18n/runtime";
import { BackgroundLifecycle } from "./background/services/backgroundLifecycle";
import { TransferQueueCommandBus } from "./background/services/transferQueueCommandBus";
import { TransferQueueEventBus } from "./background/services/transferQueueEventBus";
import { TransferQueuePolicyController } from "./background/services/transferQueuePolicyController";
import { runTransferQueueStateReducerChecks } from "./background/services/transferQueueStateReducerChecks";
import { logTransferQueueLifecycleEvent } from "./background/services/transferQueueTelemetry";
import { transferQueueEngine } from "./background/services/transferQueueEngine";
import {
  getTransferQueueGeneralSettings,
  isTransferQueueGeneralSettingsStorageKey,
} from "./shared/transferQueueSettings";

const DEFAULT_SYNC_INTERVAL_MINUTES = 5;
const MAX_ACTIVITIES = 100; // Хранить только последние N активностей
const ACTIVITY_SETTINGS_KEY = "activity_settings";
const STORAGE_KEY = {
  ACTIVITIES: "activities",
  LAST_SYNC: "lastSyncTime",
  READ_IDS: "readActivityIds",
  NOTIFIED_IDS: "notifiedActivityIds",
};

const MAX_NOTIFIED_IDS = 2000;
const ENQUEUE_DEDUPE_WINDOW_MS = 1200;
const STAGING_BLOB_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const STAGING_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

type RuntimePort = ReturnType<typeof browser.runtime.connect>;

let syncTimer: ReturnType<typeof setTimeout> | undefined;
const backgroundLifecycle = new BackgroundLifecycle();
const transferQueueCommandBus = new TransferQueueCommandBus();
const transferQueueEventBus = new TransferQueueEventBus();
const transferQueuePolicyController = new TransferQueuePolicyController({
  setProcessingEnabled: (enabled) => {
    transferQueueEngine.setProcessingEnabled(enabled);
  },
});
const transferQueueUpdatePorts = new Set<RuntimePort>();
const recentEnqueueByFingerprint = new Map<
  string,
  { timestamp: number; jobId: string }
>();

function buildEnqueueFingerprint(params: {
  name: string;
  mimeType: string;
  parentId: string | null;
  sizeBytes: number;
}): string {
  return [
    params.name,
    params.mimeType,
    params.parentId ?? "root",
    String(params.sizeBytes),
  ].join("|");
}

function pruneRecentEnqueueCache(now: number): void {
  for (const [fingerprint, entry] of recentEnqueueByFingerprint.entries()) {
    if (now - entry.timestamp > ENQUEUE_DEDUPE_WINDOW_MS) {
      recentEnqueueByFingerprint.delete(fingerprint);
    }
  }
}

async function initializeTransferQueuePolicy(): Promise<void> {
  const settings = await getTransferQueueGeneralSettings();
  transferQueuePolicyController.setBackgroundTransfersEnabled(
    settings.backgroundTransfersEnabled,
  );
}

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  if (import.meta.env.DEV) {
    runTransferQueueStateReducerChecks();
  }

  void transferQueueEngine.initialize();
  void initializeTransferQueuePolicy();
  transferQueueEngine.setStateChangedListener(() => {
    transferQueueEventBus.emitSnapshotChanged();
  });
  transferQueueEngine.setLifecycleListener((event) => {
    logTransferQueueLifecycleEvent(event);
  });

  const sidePanelApi = browser.sidePanel;

  if (sidePanelApi.setPanelBehavior) {
    void sidePanelApi.setPanelBehavior({ openPanelOnActionClick: true });
  }

  void setupContextMenus();
  void cleanupStaleStagedTransferBlobs(STAGING_BLOB_MAX_AGE_MS);
  const stagingCleanupTimer = setInterval(() => {
    void cleanupStaleStagedTransferBlobs(STAGING_BLOB_MAX_AGE_MS);
  }, STAGING_CLEANUP_INTERVAL_MS);

  const handleInstalled = () => {
    void setupContextMenus();
  };

  const handleContextMenuClickListener: Parameters<
    typeof browser.contextMenus.onClicked.addListener
  >[0] = (info, tab) => {
    void handleContextMenuClick(info, tab);
  };

  const handleRuntimeMessage: Parameters<
    typeof browser.runtime.onMessage.addListener
  >[0] = (message, _sender, sendResponse) => {
    void handleTransferQueueRuntimeMessage(message)
      .then((response) => {
        sendResponse(response);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : translateCurrentLocale("background.error.queueMessage");
        sendResponse({ ok: false, error: message });
      });

    return true;
  };

  const handleRuntimeConnect: Parameters<
    typeof browser.runtime.onConnect.addListener
  >[0] = (port) => {
    if (port.name === PORT_TRANSFER_QUEUE_UPDATES) {
      transferQueueUpdatePorts.add(port);

      void transferQueueEngine.listSnapshot().then((snapshot) => {
        const message: TransferQueueSnapshotUpdatedPortMessage = {
          type: MESSAGE_TRANSFER_QUEUE_SNAPSHOT_UPDATED,
          payload: snapshot,
        };

        try {
          port.postMessage(message);
        } catch {
          transferQueueUpdatePorts.delete(port);
        }
      });

      port.onDisconnect.addListener(() => {
        transferQueueUpdatePorts.delete(port);
      });

      return;
    }

    if (port.name !== PORT_TRANSFER_QUEUE_SIDEPANEL_SESSION) {
      return;
    }

    const releaseSession = transferQueuePolicyController.openSidepanelSession();

    port.onDisconnect.addListener(() => {
      releaseSession();
      void setTransferPopoverSeenUpTo(Date.now());
    });
  };

  browser.runtime.onInstalled.addListener(handleInstalled);
  browser.contextMenus.onClicked.addListener(handleContextMenuClickListener);
  browser.runtime.onMessage.addListener(handleRuntimeMessage);
  browser.runtime.onConnect.addListener(handleRuntimeConnect);

  const transferQueueSnapshotSubscription =
    transferQueueEventBus.subscribeSnapshotChanged(async () => {
      if (transferQueueUpdatePorts.size === 0) {
        return;
      }

      const snapshot = await transferQueueEngine.listSnapshot();
      const message: TransferQueueSnapshotUpdatedPortMessage = {
        type: MESSAGE_TRANSFER_QUEUE_SNAPSHOT_UPDATED,
        payload: snapshot,
      };

      for (const port of transferQueueUpdatePorts) {
        try {
          port.postMessage(message);
        } catch {
          transferQueueUpdatePorts.delete(port);
        }
      }
    }, 140);

  backgroundLifecycle.add(() => {
    browser.runtime.onInstalled.removeListener(handleInstalled);
    browser.contextMenus.onClicked.removeListener(
      handleContextMenuClickListener,
    );
    browser.runtime.onMessage.removeListener(handleRuntimeMessage);
    browser.runtime.onConnect.removeListener(handleRuntimeConnect);
  });

  // Синхронизация активностей при запуске
  void syncActivities();
  void refreshBadgeFromStorage();

  // Планировщик синхронизации с интервалом из настроек
  void scheduleNextSyncFromSettings();

  const handleStorageChanged: Parameters<
    typeof browser.storage.onChanged.addListener
  >[0] = (changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes[STORAGE_KEY.ACTIVITIES] || changes[STORAGE_KEY.READ_IDS]) {
      void refreshBadgeFromStorage();
    }

    if (changes[ACTIVITY_SETTINGS_KEY]) {
      // Мгновенно применяем новые фильтры типов и перестраиваем таймер.
      void syncActivities();
      void scheduleNextSyncFromSettings();
    }

    const changedKeys = Object.keys(changes);
    const hasTransferSettingsChange = changedKeys.some((key) =>
      isTransferQueueGeneralSettingsStorageKey(key),
    );

    if (!hasTransferSettingsChange) {
      return;
    }

    void getTransferQueueGeneralSettings().then((settings) => {
      transferQueuePolicyController.setBackgroundTransfersEnabled(
        settings.backgroundTransfersEnabled,
      );
    });
  };

  browser.storage.onChanged.addListener(handleStorageChanged);

  backgroundLifecycle.add(() => {
    browser.storage.onChanged.removeListener(handleStorageChanged);
  });

  backgroundLifecycle.add(() => {
    transferQueueEngine.dispose();
  });

  backgroundLifecycle.add(() => {
    transferQueueSnapshotSubscription.unsubscribe();
    transferQueueEventBus.dispose();
    transferQueueCommandBus.dispose();
    transferQueuePolicyController.dispose();
    transferQueueEngine.setStateChangedListener(null);
    transferQueueEngine.setLifecycleListener(null);
    transferQueueUpdatePorts.clear();
    recentEnqueueByFingerprint.clear();
  });

  backgroundLifecycle.add(() => {
    clearInterval(stagingCleanupTimer);
  });

  const runtimeWithSuspend = browser.runtime as typeof browser.runtime & {
    onSuspend?: { addListener: (callback: () => void) => void };
  };

  runtimeWithSuspend.onSuspend?.addListener(() => {
    backgroundLifecycle.disposeAll();
  });
});

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}

async function handleTransferQueueRuntimeMessage(
  message: unknown,
): Promise<unknown> {
  const activitySyncMessage = message as ActivitySyncNowMessage;
  if (activitySyncMessage?.type === MESSAGE_ACTIVITY_SYNC_NOW) {
    await syncActivities();
    return { ok: true };
  }

  const transferMessage = message as TransferQueueMessage;

  if (transferMessage?.type === MESSAGE_TRANSFER_QUEUE_LIST) {
    return transferQueueEngine.listSnapshot();
  }

  if (transferMessage?.type === MESSAGE_TRANSFER_QUEUE_CANCEL) {
    await transferQueueCommandBus.enqueue(
      `job:${transferMessage.payload.id}`,
      async () => {
        await transferQueueEngine.cancel(transferMessage.payload.id);
      },
      "high",
    );
    return { ok: true };
  }

  if (transferMessage?.type === MESSAGE_TRANSFER_QUEUE_RETRY) {
    await transferQueueCommandBus.enqueue(
      `job:${transferMessage.payload.id}`,
      async () => {
        await transferQueueEngine.retry(transferMessage.payload.id);
      },
      "high",
    );
    return { ok: true };
  }

  if (transferMessage?.type === MESSAGE_TRANSFER_QUEUE_REMOVE) {
    await transferQueueCommandBus.enqueue(
      `job:${transferMessage.payload.id}`,
      async () => {
        await transferQueueEngine.remove(transferMessage.payload.id);
      },
      "high",
    );
    return { ok: true };
  }

  if (transferMessage?.type === MESSAGE_TRANSFER_QUEUE_CLEAR_HISTORY) {
    await transferQueueCommandBus.enqueue(
      "history:clear",
      async () => {
        await transferQueueEngine.clearHistory(
          transferMessage.payload.direction,
        );
      },
      "high",
    );
    return { ok: true };
  }

  if (transferMessage?.type === MESSAGE_TRANSFER_QUEUE_ENQUEUE_UPLOAD) {
    let blob: Blob;

    if (transferMessage.payload.stagingId) {
      const stagedBlob = await getStagedTransferBlob(
        transferMessage.payload.stagingId,
      );
      if (!stagedBlob) {
        throw new Error(
          translateCurrentLocale("background.error.stagedPayloadMissing"),
        );
      }

      blob = stagedBlob;
    } else if (transferMessage.payload.base64) {
      blob = base64ToBlob(
        transferMessage.payload.base64,
        transferMessage.payload.mimeType,
      );
    } else {
      throw new Error(
        translateCurrentLocale("background.error.invalidEnqueuePayload"),
      );
    }

    const fingerprint = buildEnqueueFingerprint({
      name: transferMessage.payload.name,
      mimeType: transferMessage.payload.mimeType,
      parentId: transferMessage.payload.parentId,
      sizeBytes: blob.size,
    });

    return transferQueueCommandBus.enqueue(
      `enqueue:${fingerprint}`,
      async () => {
        const now = Date.now();
        pruneRecentEnqueueCache(now);

        const existingEntry = recentEnqueueByFingerprint.get(fingerprint);
        if (
          existingEntry &&
          now - existingEntry.timestamp < ENQUEUE_DEDUPE_WINDOW_MS
        ) {
          return {
            ok: true,
            deduped: true,
            existingJobId: existingEntry.jobId,
          };
        }

        try {
          const job = await transferQueueEngine.enqueueUpload({
            source: transferMessage.payload.source,
            parentId: transferMessage.payload.parentId,
            name: transferMessage.payload.name,
            mimeType: transferMessage.payload.mimeType,
            blob,
          });

          recentEnqueueByFingerprint.set(fingerprint, {
            timestamp: now,
            jobId: job.id,
          });

          return { ok: true, jobId: job.id };
        } finally {
          if (transferMessage.payload.stagingId) {
            await deleteStagedTransferBlob(transferMessage.payload.stagingId);
          }
        }
      },
    );
  }

  return undefined;
}

async function getActivitySettingsFromStorage(): Promise<ActivitySettings> {
  const defaults: ActivitySettings = {
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
    syncIntervalMinutes: DEFAULT_SYNC_INTERVAL_MINUTES,
    autoCleanupDays: 30,
    playSound: false,
    notificationSound: ActivityNotificationSound.Chime,
  };

  return new Promise((resolve) => {
    browser.storage.local.get([ACTIVITY_SETTINGS_KEY], (result) => {
      const stored = result[ACTIVITY_SETTINGS_KEY] as
        | Partial<ActivitySettings>
        | undefined;
      resolve({ ...defaults, ...(stored || {}) });
    });
  });
}

async function getCurrentUserEmail(): Promise<string | null> {
  try {
    if (!browser.identity.getProfileUserInfo) {
      return null;
    }

    const profile = await browser.identity.getProfileUserInfo();
    const email = profile.email?.trim();
    return email ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}

function normalizeSyncInterval(minutes: number): 1 | 5 | 10 | 15 | 30 {
  if (
    minutes === 1 ||
    minutes === 5 ||
    minutes === 10 ||
    minutes === 15 ||
    minutes === 30
  ) {
    return minutes;
  }

  return DEFAULT_SYNC_INTERVAL_MINUTES;
}

async function scheduleNextSyncFromSettings(): Promise<void> {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = undefined;
  }

  const settings = await getActivitySettingsFromStorage();
  const intervalMinutes = normalizeSyncInterval(settings.syncIntervalMinutes);

  syncTimer = setTimeout(
    () => {
      void syncActivities().finally(() => {
        void scheduleNextSyncFromSettings();
      });
    },
    intervalMinutes * 60 * 1000,
  );
}

function filterByEnabledTypes(
  items: ActivityItem[],
  enabledTypes: ActivityType[],
): ActivityItem[] {
  const enabledSet = new Set(enabledTypes);
  return items.filter((item) => enabledSet.has(item.type));
}

function applyAutoCleanupByDays(
  items: ActivityItem[],
  days: number,
): ActivityItem[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return items.filter((item) => {
    const itemTime = new Date(item.timestamp).getTime();
    if (Number.isNaN(itemTime)) {
      return true;
    }

    return itemTime > cutoff;
  });
}

function getActivityTypeLabel(type: ActivityType): string {
  const labels: Record<ActivityType, string> = {
    comment: translateCurrentLocale("background.activityType.comment"),
    reply: translateCurrentLocale("background.activityType.reply"),
    mention: translateCurrentLocale("background.activityType.mention"),
    share: translateCurrentLocale("background.activityType.share"),
    edit: translateCurrentLocale("background.activityType.edit"),
    create: translateCurrentLocale("background.activityType.create"),
    move: translateCurrentLocale("background.activityType.move"),
    rename: translateCurrentLocale("background.activityType.rename"),
    delete: translateCurrentLocale("background.activityType.delete"),
    restore: translateCurrentLocale("background.activityType.restore"),
    permission_change: translateCurrentLocale(
      "background.activityType.permissionChange",
    ),
  };

  return labels[type];
}

function isSelfActivity(
  item: ActivityItem,
  currentUserEmail: string | null,
): boolean {
  if (item.actor.type !== "user") {
    return false;
  }

  if (item.actor.isCurrentUser) {
    return true;
  }

  if (!currentUserEmail || !item.actor.email) {
    return false;
  }

  return item.actor.email.trim().toLowerCase() === currentUserEmail;
}

async function notifyAboutNewActivities(
  newItems: ActivityItem[],
  settings: ActivitySettings,
): Promise<void> {
  if (
    !settings.notificationsEnabled ||
    newItems.length === 0 ||
    !browser.notifications?.create
  ) {
    return;
  }

  const title =
    newItems.length === 1
      ? await translateStoredLocale("background.notification.singleTitle", {
          type: getActivityTypeLabel(newItems[0].type),
        })
      : await translateStoredLocale("background.notification.multiTitle", {
          count: String(newItems.length),
        });

  const message =
    newItems.length === 1
      ? `${newItems[0].target.fileName}`
      : await translateStoredLocale("background.notification.multiMessage");

  await browser.notifications.create(`activity-${Date.now()}`, {
    type: "basic",
    iconUrl: browser.runtime.getURL("/icon/128.png"),
    title,
    message,
    silent: !settings.playSound,
  });

  if (settings.playSound) {
    const soundMessage: PlayNotificationSoundMessage = {
      type: MESSAGE_PLAY_NOTIFICATION_SOUND,
      payload: {
        sound: settings.notificationSound,
      },
    };

    try {
      await browser.runtime.sendMessage(soundMessage);
    } catch {
      // Если UI-контекст не активен, остаётся системный звук нотификации.
    }
  }
}

async function setupContextMenus(): Promise<void> {
  await browser.contextMenus.removeAll();

  browser.contextMenus.create({
    id: CONTEXT_MENU_ROOT_ID,
    title: "Drive GO",
    contexts: ["all"],
  });

  browser.contextMenus.create({
    id: CONTEXT_MENU_SCREENSHOT_ID,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: await translateStoredLocale("background.contextMenu.screenshot"),
    contexts: ["page", "frame", "selection", "image", "link"],
  });

  browser.contextMenus.create({
    id: CONTEXT_MENU_SELECTION_TEXT_ID,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: await translateStoredLocale("background.contextMenu.selectionText"),
    contexts: ["selection"],
  });

  browser.contextMenus.create({
    id: CONTEXT_MENU_PDF_ID,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: await translateStoredLocale("background.contextMenu.pdf"),
    contexts: ["page", "frame", "selection", "image", "link"],
  });

  browser.contextMenus.create({
    id: CONTEXT_MENU_IMAGE_ID,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: await translateStoredLocale("background.contextMenu.image"),
    contexts: ["image"],
  });
}

async function handleContextMenuClick(
  info: Browser.contextMenus.OnClickData,
  tab?: Browser.tabs.Tab,
): Promise<void> {
  try {
    if (info.menuItemId === CONTEXT_MENU_SCREENSHOT_ID) {
      await saveScreenshotToDrive(tab);
      return;
    }

    if (info.menuItemId === CONTEXT_MENU_SELECTION_TEXT_ID) {
      await saveSelectionTextToDrive(info, tab);
      return;
    }

    if (info.menuItemId === CONTEXT_MENU_PDF_ID) {
      return;
    }

    if (info.menuItemId === CONTEXT_MENU_IMAGE_ID) {
      await saveImageToDrive(info, tab);
    }
  } catch (error) {
    console.error("[ContextMenu] Action handling failed:", error);
  }
}

function sanitizeFilePart(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/[^a-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "file"
  );
}

function getDomainFromUrl(url?: string): string {
  if (!url) return "unknown-site";

  try {
    const parsed = new URL(url);
    return sanitizeFilePart(parsed.hostname || "unknown-site");
  } catch {
    return "unknown-site";
  }
}

function getDateStamp(date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const mimeType = blob.type || "image/png";
  return new File([blob], filename, { type: mimeType });
}

async function enqueueFileForUpload(
  file: File,
  parentId: string | null,
  tabId?: number,
): Promise<void> {
  if (tabId && browser.sidePanel?.open) {
    try {
      await browser.sidePanel.open({ tabId });
    } catch {
      // Панель может быть недоступна в некоторых состояниях браузера.
    }
  }

  await transferQueueEngine.enqueueUpload({
    source: "context-menu",
    parentId,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    blob: file,
  });
}

async function saveScreenshotToDrive(tab?: Browser.tabs.Tab): Promise<void> {
  if (!tab || tab.windowId === undefined) {
    throw new Error(
      translateCurrentLocale("background.error.activeTabNotFound"),
    );
  }

  const domain = getDomainFromUrl(tab.url);
  const dateStamp = getDateStamp();
  const parentId = await getTargetParentFolderId("screenshot");
  const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });

  const fileName = `${domain}_${dateStamp}.png`;
  const screenshotFile = await dataUrlToFile(dataUrl, fileName);
  await enqueueFileForUpload(screenshotFile, parentId, tab.id);
}

async function saveSelectionTextToDrive(
  info: Browser.contextMenus.OnClickData,
  tab?: Browser.tabs.Tab,
): Promise<void> {
  const selectedText =
    typeof info.selectionText === "string" ? info.selectionText.trim() : "";
  if (!selectedText) {
    throw new Error(
      translateCurrentLocale("background.error.selectionTextNotFound"),
    );
  }

  const domain = getDomainFromUrl(tab?.url);
  const dateStamp = getDateStamp();
  const parentId = await getTargetParentFolderId("selectionText");
  const fileName = `${domain}_${dateStamp}.txt`;
  const textFile = new File([selectedText], fileName, {
    type: "text/plain;charset=utf-8",
  });

  await enqueueFileForUpload(textFile, parentId, tab?.id);
}

function getExtensionFromMimeType(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("svg")) return "svg";
  if (mimeType.includes("bmp")) return "bmp";
  return "bin";
}

function getImageBaseName(srcUrl: string): string {
  try {
    const url = new URL(srcUrl);
    const pathName = url.pathname.split("/").pop() || "image";
    const decoded = decodeURIComponent(pathName);
    const noExt = decoded.replace(/\.[^.]+$/, "");
    return sanitizeFilePart(noExt || "image");
  } catch {
    return "image";
  }
}

async function saveImageToDrive(
  info: Browser.contextMenus.OnClickData,
  tab?: Browser.tabs.Tab,
): Promise<void> {
  const srcUrl = typeof info.srcUrl === "string" ? info.srcUrl : "";
  if (!srcUrl) {
    throw new Error(
      translateCurrentLocale("background.error.imageUrlNotFound"),
    );
  }

  const response = await fetch(srcUrl);
  if (!response.ok) {
    throw new Error(`Не удалось загрузить картинку (${response.status})`);
  }

  const blob = await response.blob();
  const mimeType = blob.type || "application/octet-stream";
  const extension = getExtensionFromMimeType(mimeType);
  const domain = getDomainFromUrl(tab?.url);
  const imageBaseName = getImageBaseName(srcUrl);
  const parentId = await getTargetParentFolderId("image");
  const fileName = `${imageBaseName}_${domain}.${extension}`;
  const imageFile = new File([blob], fileName, { type: mimeType });

  await enqueueFileForUpload(imageFile, parentId, tab?.id);
}

function isNetworkFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") || message.includes("networkerror")
  );
}

/**
 * Синхронизировать активности из Drive Activity API
 */
async function syncActivities(): Promise<void> {
  try {
    console.log("[Background] Starting activity sync...");

    // Проверяем авторизацию
    try {
      await getActivityAccessToken();
    } catch (error) {
      console.log(
        "[Background] Activity scope is not granted (or user is not signed in), skipping activity sync",
      );
      return;
    }

    // Получить активности с API
    let response;
    try {
      response = await fetchDriveActivity(undefined, MAX_ACTIVITIES);
    } catch (error) {
      if (isNetworkFetchError(error)) {
        console.warn(
          "[Background] Activity sync skipped: network is unavailable",
        );
        return;
      }

      throw error;
    }

    const parsed = parseActivities(response.activities || []);
    const currentUserEmail = await getCurrentUserEmail();
    const withoutSelfActivities = parsed.filter(
      (item) => !isSelfActivity(item, currentUserEmail),
    );
    const settings = await getActivitySettingsFromStorage();
    const filteredParsed = filterByEnabledTypes(
      withoutSelfActivities,
      settings.enabledTypes,
    );

    console.log(
      `[Background] Fetched ${parsed.length} activities (${withoutSelfActivities.length} после удаления своих, ${filteredParsed.length} после фильтра)`,
    );

    // Получить текущие данные из storage
    const storage = await browser.storage.local.get([
      STORAGE_KEY.ACTIVITIES,
      STORAGE_KEY.LAST_SYNC,
      STORAGE_KEY.READ_IDS,
      STORAGE_KEY.NOTIFIED_IDS,
    ]);
    const existingActivities = (storage[STORAGE_KEY.ACTIVITIES] ||
      []) as ActivityItem[];
    const existingReadIds = new Set(
      (storage[STORAGE_KEY.READ_IDS] as string[]) || [],
    );
    const notifiedIds = new Set(
      (storage[STORAGE_KEY.NOTIFIED_IDS] as string[]) || [],
    );
    const lastSyncTime =
      typeof storage[STORAGE_KEY.LAST_SYNC] === "string"
        ? (storage[STORAGE_KEY.LAST_SYNC] as string)
        : null;
    const existingIds = new Set(existingActivities.map((item) => item.id));
    const isInitialBootstrap =
      existingActivities.length === 0 &&
      existingReadIds.size === 0 &&
      notifiedIds.size === 0 &&
      lastSyncTime === null;
    const newItems = filteredParsed.filter(
      (item) => !existingIds.has(item.id) && !notifiedIds.has(item.id),
    );

    // Объединить: новые + старые, удалить дубликаты, сохранить MAX_ACTIVITIES
    const merged = mergeActivities(existingActivities, filteredParsed);
    const filteredMerged = filterByEnabledTypes(merged, settings.enabledTypes);
    const cleaned = applyAutoCleanupByDays(
      filteredMerged,
      settings.autoCleanupDays,
    );
    const limited = cleaned.slice(0, MAX_ACTIVITIES);
    const nextReadIds = isInitialBootstrap
      ? limited.map((item) => item.id)
      : Array.from(
          new Set([
            ...existingReadIds,
            ...existingActivities
              .filter((item) => item.isRead)
              .map((item) => item.id),
          ]),
        ).filter((id) => limited.some((item) => item.id === id));

    // Сохранить в storage
    const nextNotifiedIds = [
      ...new Set([
        ...notifiedIds,
        ...(isInitialBootstrap
          ? limited.map((item) => item.id)
          : newItems.map((item) => item.id)),
      ]),
    ].slice(-MAX_NOTIFIED_IDS);

    await browser.storage.local.set({
      [STORAGE_KEY.ACTIVITIES]: limited,
      [STORAGE_KEY.LAST_SYNC]: new Date().toISOString(),
      [STORAGE_KEY.READ_IDS]: nextReadIds,
      [STORAGE_KEY.NOTIFIED_IDS]: nextNotifiedIds,
    });

    console.log(`[Background] Saved ${limited.length} activities to storage`);

    if (!isInitialBootstrap) {
      await notifyAboutNewActivities(newItems, settings);
    }

    // Обновить icon badge с количеством непрочитанных
    await updateBadge(limited);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      console.warn(
        "[Background] Activity sync skipped due to transient network error",
      );
      return;
    }

    console.error("[Background] Sync error:", error);
  }
}

/**
 * Объединить существующие активности с новыми, избегая дубликатов
 */
function mergeActivities(
  existing: ActivityItem[],
  fresh: ActivityItem[],
): ActivityItem[] {
  const existingIds = new Set(existing.map((a) => a.id));

  // Добавить новые активности в начало
  const merged: ActivityItem[] = [
    ...fresh.filter((a) => !existingIds.has(a.id)),
    ...existing,
  ];

  // Сортировать по времени (новые сверху)
  return merged.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/**
 * Обновить иконку badge с количеством непрочитанных
 */
async function updateBadge(activities: ActivityItem[]): Promise<void> {
  try {
    // Получить список прочитанных
    const storage = await browser.storage.local.get(STORAGE_KEY.READ_IDS);
    const readIds = new Set((storage[STORAGE_KEY.READ_IDS] as string[]) || []);

    // Посчитать непрочитанные
    const unreadCount = activities.filter((a) => !readIds.has(a.id)).length;

    // Обновить badge
    if (unreadCount > 0) {
      await browser.action.setBadgeText({ text: unreadCount.toString() });
      await browser.action.setBadgeBackgroundColor({ color: "#EA4335" }); // Google Red
    } else {
      await browser.action.setBadgeText({ text: "" });
    }

    console.log(`[Background] Badge updated: ${unreadCount} unread`);
  } catch (error) {
    console.error("[Background] Failed to update badge:", error);
  }
}

async function refreshBadgeFromStorage(): Promise<void> {
  const storage = await browser.storage.local.get(STORAGE_KEY.ACTIVITIES);
  const activities = Array.isArray(storage[STORAGE_KEY.ACTIVITIES])
    ? (storage[STORAGE_KEY.ACTIVITIES] as ActivityItem[])
    : [];

  await updateBadge(activities);
}
