import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { Tabs } from "@kobalte/core/tabs";
import { Button } from "@kobalte/core/button";
import { Tooltip } from "@kobalte/core/tooltip";
import { TabIcon, type TabIconName } from "./tabIcons";
import { DriveBrowser } from "./components/drive/DriveBrowser";
import { ActivityBrowser } from "./components/activity/ActivityBrowser";
import { DriveSearchBar } from "./components/search/DriveSearchBar";
import { UploadPopover } from "./components/upload/UploadPopover";
import { DragDropOverlay } from "./components/upload/DragDropOverlay";
import { addFilesToUploadQueue } from "./services/uploadManager";
import {
  DEFAULT_DRIVE_SEARCH_FILTERS,
  type DriveSearchFilters,
} from "./services/driveApi";
import {
  MESSAGE_ENQUEUE_UPLOAD,
  type UploadBridgeMessage,
} from "../shared/contextMenuUpload";
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
  { id: "trash", title: "Корзина", icon: "trash" },
];

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
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
  const [currentFolderId, setCurrentFolderId] = createSignal<string | null>(
    null,
  );

  const handleFilesDrop = (files: File[]) => {
    addFilesToUploadQueue(files, currentFolderId());
  };

  onMount(() => {
    const listener = (message: unknown) => {
      const payload = message as UploadBridgeMessage;
      if (!payload || payload.type !== MESSAGE_ENQUEUE_UPLOAD) {
        return;
      }

      const fileBytes = base64ToUint8Array(payload.payload.base64);
      const fileBuffer = new ArrayBuffer(fileBytes.length);
      new Uint8Array(fileBuffer).set(fileBytes);
      const file = new File([fileBuffer], payload.payload.name, {
        type: payload.payload.mimeType,
      });

      addFilesToUploadQueue([file], payload.payload.parentId);
    };

    browser.runtime.onMessage.addListener(listener);
    onCleanup(() => {
      browser.runtime.onMessage.removeListener(listener);
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

                <Show when={tab.id === "activity"}>
                  <ActivityBrowser />
                </Show>

                <Show
                  when={
                    tab.id !== "my-drive" &&
                    tab.id !== "recent" &&
                    tab.id !== "starred" &&
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
