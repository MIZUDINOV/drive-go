import { fetchDriveActivity, getAccessToken } from "./sidepanel/services/activityApi";
import { parseActivities } from "./sidepanel/services/activityManager";
import type { ActivityItem, ActivitySettings, ActivityType } from "./sidepanel/services/activityTypes";
import {
  CONTEXT_MENU_IMAGE_ID,
  CONTEXT_MENU_PDF_ID,
  CONTEXT_MENU_ROOT_ID,
  CONTEXT_MENU_SCREENSHOT_ID,
  CONTEXT_MENU_SELECTION_TEXT_ID,
  MESSAGE_ENQUEUE_UPLOAD,
  type UploadBridgeMessage,
} from "./shared/contextMenuUpload";
import { getTargetParentFolderId } from "./shared/savePathsSettings";

const DEFAULT_SYNC_INTERVAL_MINUTES = 5;
const MAX_ACTIVITIES = 100; // Хранить только последние N активностей
const ACTIVITY_SETTINGS_KEY = "activity_settings";
const STORAGE_KEY = {
  ACTIVITIES: "activities",
  LAST_SYNC: "lastSyncTime",
  READ_IDS: "readActivityIds",
};

let syncTimer: ReturnType<typeof setTimeout> | undefined;

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  const sidePanelApi = browser.sidePanel;

  if (sidePanelApi.setPanelBehavior) {
    void sidePanelApi.setPanelBehavior({ openPanelOnActionClick: true });
  }

  void setupContextMenus();
  browser.runtime.onInstalled.addListener(() => {
    void setupContextMenus();
  });
  browser.contextMenus.onClicked.addListener((info, tab) => {
    void handleContextMenuClick(info, tab);
  });

  // Синхронизация активностей при запуске
  void syncActivities();

  // Планировщик синхронизации с интервалом из настроек
  void scheduleNextSyncFromSettings();

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[ACTIVITY_SETTINGS_KEY]) {
      return;
    }

    // Мгновенно применяем новые фильтры типов и перестраиваем таймер.
    void syncActivities();
    void scheduleNextSyncFromSettings();
  });
});

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
  };

  return new Promise((resolve) => {
    browser.storage.local.get([ACTIVITY_SETTINGS_KEY], (result) => {
      const stored = result[ACTIVITY_SETTINGS_KEY] as Partial<ActivitySettings> | undefined;
      resolve({ ...defaults, ...(stored || {}) });
    });
  });
}

function normalizeSyncInterval(minutes: number): 1 | 5 | 10 | 15 | 30 {
  if (minutes === 1 || minutes === 5 || minutes === 10 || minutes === 15 || minutes === 30) {
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

  syncTimer = setTimeout(() => {
    void syncActivities().finally(() => {
      void scheduleNextSyncFromSettings();
    });
  }, intervalMinutes * 60 * 1000);
}

function filterByEnabledTypes(items: ActivityItem[], enabledTypes: ActivityType[]): ActivityItem[] {
  const enabledSet = new Set(enabledTypes);
  return items.filter((item) => enabledSet.has(item.type));
}

async function setupContextMenus(): Promise<void> {
  await browser.contextMenus.removeAll();

  browser.contextMenus.create({
    id: CONTEXT_MENU_ROOT_ID,
    title: "Google Drive Go",
    contexts: ["all"],
  });

  browser.contextMenus.create({
    id: CONTEXT_MENU_SCREENSHOT_ID,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: "Сохранить скрин текущей вкладки",
    contexts: ["page", "frame", "selection", "image", "link"],
  });

  browser.contextMenus.create({
    id: CONTEXT_MENU_SELECTION_TEXT_ID,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: "Сохранить выделенный текст",
    contexts: ["selection"],
  });

  browser.contextMenus.create({
    id: CONTEXT_MENU_PDF_ID,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: "Сохранить страницу как PDF (скоро)",
    contexts: ["page", "frame", "selection", "image", "link"],
  });

  browser.contextMenus.create({
    id: CONTEXT_MENU_IMAGE_ID,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: "Сохранить картинку в Drive",
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
      console.info("[ContextMenu] PDF сохранение пока в заглушке.");
      return;
    }

    if (info.menuItemId === CONTEXT_MENU_IMAGE_ID) {
      await saveImageToDrive(info, tab);
    }
  } catch (error) {
    console.error("[ContextMenu] Ошибка обработки действия:", error);
  }
}

function sanitizeFilePart(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "file";
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
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

  const bytes = await file.arrayBuffer();
  const message: UploadBridgeMessage = {
    type: MESSAGE_ENQUEUE_UPLOAD,
    payload: {
      parentId,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      base64: arrayBufferToBase64(bytes),
    },
  };

  const attempts = 8;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await browser.runtime.sendMessage(message);
      return;
    } catch {
      await delay(250);
    }
  }

  throw new Error("Не удалось передать файл в очередь загрузки");
}

async function saveScreenshotToDrive(tab?: Browser.tabs.Tab): Promise<void> {
  if (!tab || tab.windowId === undefined) {
    throw new Error("Не удалось определить активную вкладку для скриншота");
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
  const selectedText = typeof info.selectionText === "string" ? info.selectionText.trim() : "";
  if (!selectedText) {
    throw new Error("Выделенный текст не найден");
  }

  const domain = getDomainFromUrl(tab?.url);
  const dateStamp = getDateStamp();
  const parentId = await getTargetParentFolderId("selectionText");
  const fileName = `${domain}_${dateStamp}.txt`;
  const textFile = new File([selectedText], fileName, { type: "text/plain;charset=utf-8" });

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
    throw new Error("URL картинки не найден");
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

/**
 * Синхронизировать активности из Drive Activity API
 */
async function syncActivities(): Promise<void> {
  try {
    console.log("[Background] Starting activity sync...");

    // Проверяем авторизацию
    try {
      await getAccessToken();
    } catch (error) {
      console.log("[Background] User not authenticated, skipping sync");
      return;
    }

    // Получить активности с API
    const response = await fetchDriveActivity(undefined, MAX_ACTIVITIES);
    const parsed = parseActivities(response.activities || []);
    const settings = await getActivitySettingsFromStorage();
    const filteredParsed = filterByEnabledTypes(parsed, settings.enabledTypes);

    console.log(`[Background] Fetched ${parsed.length} activities (${filteredParsed.length} после фильтра)`);

    // Получить текущие данные из storage
    const storage = await browser.storage.local.get(STORAGE_KEY.ACTIVITIES);
    const existingActivities = (storage[STORAGE_KEY.ACTIVITIES] || []) as ActivityItem[];

    // Объединить: новые + старые, удалить дубликаты, сохранить MAX_ACTIVITIES
    const merged = mergeActivities(existingActivities, filteredParsed);
    const filteredMerged = filterByEnabledTypes(merged, settings.enabledTypes);
    const limited = filteredMerged.slice(0, MAX_ACTIVITIES);

    // Сохранить в storage
    await browser.storage.local.set({
      [STORAGE_KEY.ACTIVITIES]: limited,
      [STORAGE_KEY.LAST_SYNC]: new Date().toISOString(),
    });

    console.log(`[Background] Saved ${limited.length} activities to storage`);

    // Обновить icon badge с количеством непрочитанных
    await updateBadge(limited);
  } catch (error) {
    console.error("[Background] Sync error:", error);
  }
}

/**
 * Объединить существующие активности с новыми, избегая дубликатов
 */
function mergeActivities(existing: ActivityItem[], fresh: ActivityItem[]): ActivityItem[] {
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
