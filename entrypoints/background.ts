import { fetchDriveActivity, getAccessToken } from "./sidepanel/services/activityApi";
import { parseActivities } from "./sidepanel/services/activityManager";
import type { ActivityItem, ActivitySettings } from "./sidepanel/services/activityTypes";

const SYNC_INTERVAL_MINUTES = 5;
const MAX_ACTIVITIES = 100; // Хранить только последние N активностей
const STORAGE_KEY = {
  ACTIVITIES: "activities",
  LAST_SYNC: "lastSyncTime",
  READ_IDS: "readActivityIds",
};

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  const sidePanelApi = browser.sidePanel;

  if (sidePanelApi.setPanelBehavior) {
    void sidePanelApi.setPanelBehavior({ openPanelOnActionClick: true });
  }

  // Синхронизация активностей при запуске
  void syncActivities();

  // Периодическая синхронизация каждые 5 минут
  setInterval(() => {
    void syncActivities();
  }, SYNC_INTERVAL_MINUTES * 60 * 1000);
});

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

    console.log(`[Background] Fetched ${parsed.length} activities`);

    // Получить текущие данные из storage
    const storage = await browser.storage.local.get(STORAGE_KEY.ACTIVITIES);
    const existingActivities = (storage[STORAGE_KEY.ACTIVITIES] || []) as ActivityItem[];

    // Объединить: новые + старые, удалить дубликаты, сохранить MAX_ACTIVITIES
    const merged = mergeActivities(existingActivities, parsed);
    const limited = merged.slice(0, MAX_ACTIVITIES);

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
