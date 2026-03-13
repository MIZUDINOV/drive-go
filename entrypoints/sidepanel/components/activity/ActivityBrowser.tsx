import { For, Show, createEffect, createSignal } from "solid-js";
import { Button } from "@kobalte/core/button";
import { Tooltip } from "@kobalte/core/tooltip";
import {
  activityStore,
  loadActivitiesFromBackground,
  markAllAsRead,
  requestActivitySyncNow,
} from "../../services/activityManager";
import type { ActivityItem } from "../../services/activityTypes";
import {
  checkActivityReadCapabilityLocally,
  ensureActivityReadCapability,
} from "../../services/permissionCapabilities";
import { ActivityItem as ActivityItemComponent } from "./ActivityItem";
import { ScrollToTopButton } from "../drive/ScrollToTopButton";
import { useI18n, type Locale } from "../../../shared/i18n";
import "./Activity.css";

type ActivityBrowserProps = {
  isActive: boolean;
};

type ActivityGroup = {
  date: string;
  items: ActivityItem[];
};

/**
 * Сгруппировать активности по датам (Сегодня, Вчера, день недели, дата)
 */
function groupActivities(
  items: ActivityItem[],
  locale: Locale,
  labels: { today: string; yesterday: string },
): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  let currentGroup: ActivityGroup | null = null;

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  items.forEach((item) => {
    const date = new Date(item.timestamp);
    let dateLabel: string;

    if (isSameDay(date, today)) {
      dateLabel = labels.today;
    } else if (isSameDay(date, yesterday)) {
      dateLabel = labels.yesterday;
    } else if (isThisWeek(date)) {
      dateLabel = formatWeekDay(date, locale);
    } else {
      dateLabel = formatDate(date, locale);
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

function formatWeekDay(date: Date, locale: Locale): string {
  return date.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
    weekday: "long",
  });
}

function formatDate(date: Date, locale: Locale): string {
  return date.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "long",
  });
}

export function ActivityBrowser(props: ActivityBrowserProps) {
  const { locale, t } = useI18n();
  const [hasActivityAccess, setHasActivityAccess] = createSignal(false);
  const [isPermissionRequestInProgress, setIsPermissionRequestInProgress] =
    createSignal(false);
  const [permissionRequestError, setPermissionRequestError] = createSignal<
    string | null
  >(null);
  const [showScrollTop, setShowScrollTop] = createSignal(false);
  let activityScrollRef: HTMLDivElement | undefined;

  const syncActivityAccessFromStorage = async (): Promise<void> => {
    const hasAccess = await checkActivityReadCapabilityLocally();
    setHasActivityAccess(hasAccess);

    if (!hasAccess) {
      return;
    }

    await loadActivitiesFromBackground();
  };

  createEffect(() => {
    if (!props.isActive) {
      return;
    }

    void syncActivityAccessFromStorage();
  });

  const handleRefresh = async () => {
    const hasAccess = await checkActivityReadCapabilityLocally();

    setHasActivityAccess(hasAccess);
    if (!hasAccess) {
      return;
    }

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

  const handleRequestActivityReadAccess = async (): Promise<void> => {
    setPermissionRequestError(null);
    setIsPermissionRequestInProgress(true);

    const result = await ensureActivityReadCapability();

    setIsPermissionRequestInProgress(false);

    if (!result.ok) {
      setPermissionRequestError(
        result.code === "not-granted"
          ? t("activity.browser.access.notGranted")
          : result.message,
      );
      setHasActivityAccess(false);
      return;
    }

    setPermissionRequestError(null);
    const granted = await checkActivityReadCapabilityLocally();
    setHasActivityAccess(granted);

    if (!granted) {
      return;
    }

    await loadActivitiesFromBackground();
  };

  const groupedActivities = () =>
    groupActivities(activityStore.items, locale(), {
      today: t("activity.browser.group.today"),
      yesterday: t("activity.browser.group.yesterday"),
    });

  return (
    <div class="activity-browser">
      <div class="activity-header">
        <div class="activity-header-title">
          <h2>{t("activity.browser.title")}</h2>
          <Show when={activityStore.unreadCount > 0}>
            <span class="activity-unread-badge">
              {activityStore.unreadCount}
            </span>
          </Show>
        </div>

        <div class="activity-header-actions">
          <Tooltip placement="bottom" gutter={6}>
            <Tooltip.Trigger
              as={Button}
              class="activity-action-btn"
              onClick={handleRefresh}
              disabled={activityStore.isLoading || !hasActivityAccess()}
              aria-label={t("activity.browser.refresh")}
            >
              <span class="material-symbols-rounded">refresh</span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content class="tab-tooltip">
                <Tooltip.Arrow class="tab-tooltip-arrow" />
                <span>{t("activity.browser.refresh")}</span>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip>

          <Show when={activityStore.unreadCount > 0}>
            <Tooltip placement="bottom" gutter={6}>
              <Tooltip.Trigger
                as={Button}
                class="activity-action-btn"
                onClick={handleMarkAllRead}
                aria-label={t("activity.browser.markAllRead")}
              >
                <span class="material-symbols-rounded">done_all</span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content class="tab-tooltip">
                  <Tooltip.Arrow class="tab-tooltip-arrow" />
                  <span>{t("activity.browser.markAllRead")}</span>
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip>
          </Show>
        </div>
      </div>

      <Show when={activityStore.error}>
        <div class="activity-error">
          <span class="material-symbols-rounded">error</span>
          <p>{activityStore.error}</p>
        </div>
      </Show>

      <Show when={!hasActivityAccess()}>
        <section class="activity-access-card">
          <div class="activity-access-card-icon">
            <span class="material-symbols-rounded">notifications_off</span>
          </div>
          <div class="activity-access-card-body">
            <h3>{t("activity.browser.access.title")}</h3>
            <p>{t("activity.browser.access.description")}</p>

            <Show when={permissionRequestError()}>
              {(message) => (
                <div class="activity-access-card-error">{message()}</div>
              )}
            </Show>

            <Button
              class="activity-access-card-btn"
              onClick={() => {
                void handleRequestActivityReadAccess();
              }}
              disabled={isPermissionRequestInProgress()}
            >
              {isPermissionRequestInProgress()
                ? t("activity.browser.access.requesting")
                : t("activity.browser.access.grant")}
            </Button>
          </div>
        </section>
      </Show>

      <Show when={activityStore.isLoading && activityStore.items.length === 0}>
        <div class="activity-loading">
          <div class="activity-spinner"></div>
          <p>{t("activity.browser.loading")}</p>
        </div>
      </Show>

      <Show
        when={
          hasActivityAccess() &&
          !activityStore.isLoading &&
          activityStore.items.length === 0
        }
        fallback={
          <Show when={hasActivityAccess()}>
            <div class="activity-groups">
              <div class="activity-scroll-area">
                <div
                  class="activity-groups-inner"
                  onScroll={(e) => {
                    setShowScrollTop(e.currentTarget.scrollTop > 220);
                    activityScrollRef = e.currentTarget;
                  }}
                >
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
                <ScrollToTopButton
                  visible={showScrollTop()}
                  onScrollTop={() =>
                    activityScrollRef?.scrollTo({ top: 0, behavior: "smooth" })
                  }
                />
              </div>
            </div>
          </Show>
        }
      >
        <div class="activity-empty">
          <span class="material-symbols-rounded">notifications_none</span>
          <p>{t("activity.browser.empty.title")}</p>
          <span class="activity-empty-hint">
            {t("activity.browser.empty.hint")}
          </span>
        </div>
      </Show>
    </div>
  );
}
