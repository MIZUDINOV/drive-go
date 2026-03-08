import { For, Show, createSignal } from "solid-js";
import { Tabs } from "@kobalte/core/tabs";
import { Button } from "@kobalte/core/button";
import { TabIcon, type TabIconName } from "./tabIcons";
import { DriveBrowser } from "./components/drive/DriveBrowser";
import { DriveSearchBar } from "./components/search/DriveSearchBar";
import { CreateButton } from "./components/CreateButton";
import {
  DEFAULT_DRIVE_SEARCH_FILTERS,
  type DriveSearchFilters,
} from "./services/driveApi";
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
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-width="1.9"
              />
            </svg>
          </Button>
        </div>

        <Tabs.List class="tab-list" aria-label="Разделы Google Drive">
          <For each={tabs}>
            {(tab) => (
              <Tabs.Trigger class="tab-item" value={tab.id}>
                <span class="tab-icon">
                  <TabIcon name={tab.icon} />
                </span>
                <span class="tab-label">{tab.title}</span>
              </Tabs.Trigger>
            )}
          </For>
        </Tabs.List>
      </aside>

      <section class="content-area">
        <header class="topbar">
          <h1 class="brand">Google Drive Mini</h1>

          <div class="search-block">
            <DriveSearchBar
              value={searchQuery()}
              filters={searchFilters()}
              active={activeTabId() === "my-drive"}
              onChange={setSearchQuery}
              onFiltersChange={setSearchFilters}
            />

            <CreateButton />

            <Button
              class="upload-icon-btn"
              type="button"
              aria-label="Очередь загрузок"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 17h16v2H4z" fill="currentColor" />
                <path
                  d="M12 4v9m0 0-3.5-3.5M12 13l3.5-3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.9"
                />
              </svg>
              <span class="upload-count">0</span>
            </Button>
          </div>
        </header>

        <div class="content-panels">
          <For each={tabs}>
            {(tab) => (
              <Tabs.Content class="content-card" value={tab.id}>
                <h2>{tab.title}</h2>

                <Show
                  when={tab.id === "my-drive"}
                  fallback={
                    <p>Содержимое раздела появится на следующем шаге.</p>
                  }
                >
                  <DriveBrowser
                    formatDate={formatDate}
                    formatSize={formatSize}
                  />
                </Show>
              </Tabs.Content>
            )}
          </For>
        </div>
      </section>
    </Tabs>
  );
}

export default App;
