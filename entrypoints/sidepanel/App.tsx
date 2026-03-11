import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { Badge } from "@kobalte/core/badge";
import { Tabs } from "@kobalte/core/tabs";
import { Button } from "@kobalte/core/button";
import { Tooltip } from "@kobalte/core/tooltip";
import { TabIcon, type TabIconName } from "./tabIcons";
import { DriveBrowser } from "./components/drive/DriveBrowser";
import { ActivityBrowser } from "./components/activity/ActivityBrowser";
import { DriveSearchBar } from "./components/search/DriveSearchBar";
import { UploadPopover } from "./components/upload/UploadPopover";
import { DragDropOverlay } from "./components/upload/DragDropOverlay";
import { TransfersBrowser } from "./components/transfers/TransfersBrowser";
import { enqueueFilesForUpload } from "./services/transferQueueClient";
import {
  DEFAULT_DRIVE_SEARCH_FILTERS,
  type DriveSearchFilters,
} from "./services/driveApi";
import {
  MESSAGE_PLAY_NOTIFICATION_SOUND,
  type PlayNotificationSoundMessage,
} from "../shared/activityNotifications";
import { PORT_TRANSFER_QUEUE_SIDEPANEL_SESSION } from "../shared/transferQueueMessages";
import "material-symbols/rounded.css";
import "./App.css";

type TabItem = {
  id: string;
  title: string;
  icon: TabIconName;
};

const tabs: TabItem[] = [
  { id: "my-drive", title: "Мой диск", icon: "drive" },
  { id: "recent", title: "Недавние", icon: "clock" },
  { id: "shared", title: "Доступные мне", icon: "shared" },
  { id: "starred", title: "Избранные", icon: "star" },
  { id: "activity", title: "Активность", icon: "pulse" },
  { id: "transfers", title: "Передачи", icon: "transfers" },
  { id: "trash", title: "Корзина", icon: "trash" },
];

const ACTIVITY_STORAGE_KEYS = {
  ACTIVITIES: "activities",
  READ_IDS: "readActivityIds",
};

async function getUnreadActivityCount(): Promise<number> {
  const storage = await browser.storage.local.get([
    ACTIVITY_STORAGE_KEYS.ACTIVITIES,
    ACTIVITY_STORAGE_KEYS.READ_IDS,
  ]);

  const activities = Array.isArray(storage[ACTIVITY_STORAGE_KEYS.ACTIVITIES])
    ? (storage[ACTIVITY_STORAGE_KEYS.ACTIVITIES] as Array<{ id?: string }>)
    : [];

  const readIds = new Set(
    Array.isArray(storage[ACTIVITY_STORAGE_KEYS.READ_IDS])
      ? (storage[ACTIVITY_STORAGE_KEYS.READ_IDS] as string[])
      : [],
  );

  return activities.reduce((count, item) => {
    if (!item?.id) {
      return count;
    }

    return readIds.has(item.id) ? count : count + 1;
  }, 0);
}

function playNotificationSound(
  sound: "chime" | "bell" | "digital",
): void {
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  const context = new AudioContextCtor();
  const now = context.currentTime;

  const playTone = (freq: number, startOffset: number, duration: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(0.12, now + startOffset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(now + startOffset);
    oscillator.stop(now + startOffset + duration + 0.03);
  };

  if (sound === "bell") {
    playTone(880, 0, 0.22);
    playTone(1320, 0.12, 0.28);
  } else if (sound === "digital") {
    playTone(720, 0, 0.08);
    playTone(960, 0.1, 0.08);
    playTone(1240, 0.2, 0.1);
  } else {
    playTone(660, 0, 0.16);
    playTone(990, 0.18, 0.2);
  }

  setTimeout(() => {
    void context.close();
  }, 900);
}

function formatDate(dateIso: string) {
  if (!dateIso) {
    return "-";
  }

  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatSize(size?: string) {
  if (!size) {
    return "-";
  }

  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "-";
  }

  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const fixed = unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${fixed} ${units[unitIndex]}`;
}

function App() {
  const [isMenuCollapsed, setIsMenuCollapsed] = createSignal(true);
  const [activeTabId, setActiveTabId] = createSignal(tabs[0].id);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchFilters, setSearchFilters] = createSignal<DriveSearchFilters>(
    DEFAULT_DRIVE_SEARCH_FILTERS,
  );
  const [activityUnreadCount, setActivityUnreadCount] = createSignal(0);
  const [currentFolderId, setCurrentFolderId] = createSignal<string | null>(
    null,
  );

  const handleFilesDrop = (files: File[]) => {
    void enqueueFilesForUpload(files, currentFolderId());
  };

  onMount(() => {
    const refreshUnreadCount = async () => {
      try {
        const unread = await getUnreadActivityCount();
        setActivityUnreadCount(unread);
      } catch {
        setActivityUnreadCount(0);
      }
    };

    const sidepanelSessionPort = browser.runtime.connect({
      name: PORT_TRANSFER_QUEUE_SIDEPANEL_SESSION,
    });

    void refreshUnreadCount();

    const listener = (message: unknown) => {
      const soundMessage = message as PlayNotificationSoundMessage;
      if (soundMessage?.type === MESSAGE_PLAY_NOTIFICATION_SOUND) {
        playNotificationSound(soundMessage.payload.sound);
      }
    };

    const storageListener: Parameters<
      typeof browser.storage.onChanged.addListener
    >[0] = (changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      if (changes[ACTIVITY_STORAGE_KEYS.ACTIVITIES] || changes[ACTIVITY_STORAGE_KEYS.READ_IDS]) {
        void refreshUnreadCount();
      }
    };

    browser.runtime.onMessage.addListener(listener);
    browser.storage.onChanged.addListener(storageListener);
    onCleanup(() => {
      browser.runtime.onMessage.removeListener(listener);
      browser.storage.onChanged.removeListener(storageListener);
      sidepanelSessionPort.disconnect();
    });
  });

  return (
    <Tabs
      class={`panel-layout ${isMenuCollapsed() ? "collapsed" : ""}`}
      orientation="vertical"
      value={activeTabId()}
      onChange={setActiveTabId}
    >
      <aside class="sidebar">
        <div class="sidebar-top">
          <Button
            class="menu-btn"
            type="button"
            aria-label="Переключить меню"
            onClick={() => setIsMenuCollapsed((prev) => !prev)}
          >
            <span class="material-symbols-rounded">menu</span>
          </Button>
        </div>

        <Tabs.List class="tab-list" aria-label="Разделы Google Drive">
          <For each={tabs}>
            {(tab) => (
              <Tooltip
                placement="right"
                gutter={8}
                disabled={!isMenuCollapsed()}
              >
                <Tabs.Trigger class="tab-item" value={tab.id}>
                  <span class="tab-icon">
                    <TabIcon
                      name={tab.icon}
                      isSelected={activeTabId() === tab.id}
                    />
                  </span>
                  <span class="tab-label">{tab.title}</span>
                  <Show when={tab.id === "activity" && activityUnreadCount() > 0}>
                    <Badge
                      class="tab-activity-badge"
                      textValue={`${activityUnreadCount()} непрочитанных уведомлений`}
                    >
                      {activityUnreadCount() > 99 ? "99+" : activityUnreadCount()}
                    </Badge>
                  </Show>
                </Tabs.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content class="tab-tooltip">
                    <Tooltip.Arrow />
                    <span>{tab.title}</span>
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip>
            )}
          </For>
        </Tabs.List>

        <div class="sidebar-bottom">
          <Tooltip placement="right" gutter={8} disabled={!isMenuCollapsed()}>
            <Button
              class="settings-btn"
              onClick={() => {
                const optionsUrl = browser.runtime.getURL("/options.html");
                window.open(optionsUrl, "google-drive-go-options");
              }}
              title="Настройки"
            >
              <span class="material-symbols-rounded">settings</span>
              <span class="tab-label">Настройки</span>
            </Button>
            <Tooltip.Portal>
              <Tooltip.Content class="tab-tooltip">
                <Tooltip.Arrow />
                <span>Настройки</span>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip>
        </div>
      </aside>

      <section class="content-area">
        <header class="topbar">
          <h1 class="brand">Google Drive Go</h1>

          <div class="search-block">
            <DriveSearchBar
              value={searchQuery()}
              filters={searchFilters()}
              active={activeTabId() === "my-drive"}
              onChange={setSearchQuery}
              onFiltersChange={setSearchFilters}
            />

            <UploadPopover />
          </div>
        </header>

        <div class="content-panels">
          <For each={tabs}>
            {(tab) => (
              <Tabs.Content class="content-card" value={tab.id}>
                <Show when={tab.id === "my-drive"}>
                  <DriveBrowser
                    formatDate={formatDate}
                    formatSize={formatSize}
                    onFolderChange={setCurrentFolderId}
                  />
                </Show>

                <Show when={tab.id === "shared"}>
                  <DriveBrowser
                    scope="shared"
                    formatDate={formatDate}
                    formatSize={formatSize}
                  />
                </Show>

                <Show when={tab.id === "recent"}>
                  <DriveBrowser
                    scope="recent"
                    formatDate={formatDate}
                    formatSize={formatSize}
                  />
                </Show>

                <Show when={tab.id === "starred"}>
                  <DriveBrowser
                    scope="starred"
                    formatDate={formatDate}
                    formatSize={formatSize}
                  />
                </Show>

                <Show when={tab.id === "trash"}>
                  <DriveBrowser
                    scope="trash"
                    formatDate={formatDate}
                    formatSize={formatSize}
                  />
                </Show>

                <Show when={tab.id === "transfers"}>
                  <TransfersBrowser />
                </Show>

                <Show when={tab.id === "activity"}>
                  <ActivityBrowser />
                </Show>

                <Show
                  when={
                    tab.id !== "my-drive" &&
                    tab.id !== "recent" &&
                    tab.id !== "starred" &&
                    tab.id !== "transfers" &&
                    tab.id !== "trash" &&
                    tab.id !== "activity" &&
                    tab.id !== "shared"
                  }
                >
                  <p>Содержимое раздела появится на следующем шаге.</p>
                </Show>
              </Tabs.Content>
            )}
          </For>
        </div>
      </section>

      <DragDropOverlay onDrop={handleFilesDrop} />
    </Tabs>
  );
}

export default App;
