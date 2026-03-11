import { For, Show, onMount } from "solid-js";
import { Button } from "@kobalte/core/button";
import {
  activityStore,
  loadActivitiesFromBackground,
  markAllAsRead,
  requestActivitySyncNow,
} from "../../services/activityManager";
import type { ActivityItem } from "../../services/activityTypes";
import { ActivityItem as ActivityItemComponent } from "./ActivityItem";
import "./Activity.css";

type ActivityGroup = {
  date: string;
  items: ActivityItem[];
};

/**
 * Сгруппировать активности по датам (Сегодня, Вчера, день недели, дата)
 */
function groupActivities(items: ActivityItem[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  let currentGroup: ActivityGroup | null = null;

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  items.forEach((item) => {
    const date = new Date(item.timestamp);
    let dateLabel: string;

    if (isSameDay(date, today)) {
      dateLabel = "Сегодня";
    } else if (isSameDay(date, yesterday)) {
      dateLabel = "Вчера";
    } else if (isThisWeek(date)) {
      dateLabel = formatWeekDay(date);
    } else {
      dateLabel = formatDate(date);
    }

    if (!currentGroup || currentGroup.date !== dateLabel) {
      currentGroup = { date: dateLabel, items: [] };
      groups.push(currentGroup);
    }

    currentGroup.items.push(item);
  });

  return groups;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isThisWeek(date: Date): boolean {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  return date > weekAgo && date < today;
}

function formatWeekDay(date: Date): string {
  return date.toLocaleDateString("ru-RU", { weekday: "long" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

export function ActivityBrowser() {
  onMount(() => {
    // Загрузить активности из background service worker (browser.storage)
    void loadActivitiesFromBackground();
  });

  const handleRefresh = async () => {
    try {
      await requestActivitySyncNow();
      await loadActivitiesFromBackground();
    } catch (error) {
      console.error("[ActivityBrowser] Manual sync failed:", error);
      await loadActivitiesFromBackground();
    }
  };

  const handleMarkAllRead = () => {
    void markAllAsRead();
  };

  const groupedActivities = () => groupActivities(activityStore.items);

  return (
    <div class="activity-browser">
      <div class="activity-header">
        <div class="activity-header-title">
          <h2>Активность</h2>
          <Show when={activityStore.unreadCount > 0}>
            <span class="activity-unread-badge">
              {activityStore.unreadCount}
            </span>
          </Show>
        </div>

        <div class="activity-header-actions">
          <Button
            class="activity-action-btn"
            onClick={handleRefresh}
            disabled={activityStore.isLoading}
            title="Обновить"
          >
            <span class="material-symbols-rounded">refresh</span>
          </Button>
          <Show when={activityStore.unreadCount > 0}>
            <Button
              class="activity-action-btn"
              onClick={handleMarkAllRead}
              title="Отметить все как прочитанные"
            >
              <span class="material-symbols-rounded">done_all</span>
            </Button>
          </Show>
        </div>
      </div>

      <Show when={activityStore.error}>
        <div class="activity-error">
          <span class="material-symbols-rounded">error</span>
          <p>{activityStore.error}</p>
        </div>
      </Show>

      <Show when={activityStore.isLoading && activityStore.items.length === 0}>
        <div class="activity-loading">
          <div class="activity-spinner"></div>
          <p>Загрузка активности...</p>
        </div>
      </Show>

      <Show
        when={!activityStore.isLoading && activityStore.items.length === 0}
        fallback={
          <div class="activity-groups">
            <For each={groupedActivities()}>
              {(group) => (
                <section class="activity-group">
                  <div class="activity-group-date">{group.date}</div>
                  <div class="activity-group-items">
                    <For each={group.items}>
                      {(item) => <ActivityItemComponent item={item} />}
                    </For>
                  </div>
                </section>
              )}
            </For>
          </div>
        }
      >
        <div class="activity-empty">
          <span class="material-symbols-rounded">notifications_none</span>
          <p>Нет новых уведомлений</p>
          <span class="activity-empty-hint">
            Здесь будут появляться комментарии, общий доступ и другие события
          </span>
        </div>
      </Show>
    </div>
  );
}
