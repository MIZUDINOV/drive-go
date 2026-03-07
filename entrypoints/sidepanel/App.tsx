import { For, type JSX, Show, createEffect, createSignal } from "solid-js";
import { Tabs } from "@kobalte/core/tabs";
import { TextField } from "@kobalte/core/text-field";
import { Button } from "@kobalte/core/button";
import { FileTypeIcon } from "./fileTypes";
import { TabIcon, type TabIconName } from "./tabIcons";
import "./App.css";

type TabItem = {
  id: string;
  title: string;
  icon: TabIconName;
};

type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  ownerName?: string;
  iconLink?: string;
};

type DriveApiOwner = {
  displayName?: string;
};

type DriveApiFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  iconLink?: string;
  owners?: DriveApiOwner[];
};

type DriveListMyDriveResponse = {
  ok: boolean;
  data?: {
    files?: DriveApiFile[];
    nextPageToken?: string;
  };
  error?: string;
};

const tabs: TabItem[] = [
  { id: "my-drive", title: "Мой диск", icon: "drive" },
  { id: "recent", title: "Недавние", icon: "clock" },
  { id: "shared", title: "Доступные мне", icon: "shared" },
  { id: "starred", title: "Избранные", icon: "star" },
  { id: "activity", title: "Активность", icon: "pulse" },
  { id: "trash", title: "Корзина", icon: "trash" },
];

function OwnerAvatar(props: { ownerName?: string }) {
  return (
    <span class="owner-avatar" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="8.5"
          r="3.2"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />
        <path
          d="M5 19c0-3.1 2.8-5 7-5s7 1.9 7 5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />
      </svg>
    </span>
  );
}

function DriveItemIcon(props: { mimeType: string }): JSX.Element {
  return (
    <span class="name-icon" aria-hidden="true">
      <FileTypeIcon mimeType={props.mimeType} />
    </span>
  );
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
  const [myDriveItems, setMyDriveItems] = createSignal<DriveItem[]>([]);
  const [myDriveLoading, setMyDriveLoading] = createSignal(false);
  const [myDriveError, setMyDriveError] = createSignal("");
  const [myDriveNextPageToken, setMyDriveNextPageToken] =
    createSignal<string>();
  const [myDriveLoaded, setMyDriveLoaded] = createSignal(false);

  const loadMyDrive = async (reset = true) => {
    if (myDriveLoading()) {
      return;
    }

    setMyDriveLoading(true);
    setMyDriveError("");

    try {
      const response: DriveListMyDriveResponse =
        await browser.runtime.sendMessage({
          type: "DRIVE_LIST_MY_DRIVE",
          pageToken: reset ? undefined : myDriveNextPageToken(),
        });

      if (!response.ok) {
        throw new Error(response.error || "Не удалось загрузить Мой диск");
      }

      const mapped = (response.data?.files ?? []).map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime ?? "",
        size: file.size,
        ownerName: file.owners?.[0]?.displayName,
        iconLink: file.iconLink,
      }));

      if (reset) {
        setMyDriveItems(mapped);
      } else {
        setMyDriveItems((prev) => [...prev, ...mapped]);
      }

      setMyDriveNextPageToken(response.data?.nextPageToken);
      setMyDriveLoaded(true);
    } catch (error: unknown) {
      setMyDriveError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setMyDriveLoading(false);
    }
  };

  createEffect(() => {
    if (activeTabId() === "my-drive" && !myDriveLoaded()) {
      void loadMyDrive(true);
    }
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
            <TextField class="search-field">
              <TextField.Label class="sr-only">
                Глобальный поиск
              </TextField.Label>
              <TextField.Input
                class="search-input"
                type="search"
                placeholder="Глобальный поиск"
              />
            </TextField>

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
                  <div class="drive-toolbar">
                    <Button
                      type="button"
                      class="refresh-btn"
                      onClick={() => void loadMyDrive(true)}
                      disabled={myDriveLoading()}
                    >
                      {myDriveLoading() ? "Обновление..." : "Обновить"}
                    </Button>
                    <span class="drive-meta">
                      Элементов: {myDriveItems().length}
                    </span>
                  </div>

                  <Show
                    when={!myDriveError()}
                    fallback={
                      <p class="drive-error">Ошибка: {myDriveError()}</p>
                    }
                  >
                    <Show
                      when={myDriveItems().length > 0}
                      fallback={
                        <p class="drive-empty">
                          {myDriveLoading()
                            ? "Загрузка..."
                            : "В Моем диске пока нет файлов и папок."}
                        </p>
                      }
                    >
                      <div class="drive-table-wrap">
                        <table class="drive-table">
                          <thead>
                            <tr>
                              <th>Название</th>
                              <th>Изменен</th>
                              <th>Размер</th>
                              <th>Владелец</th>
                            </tr>
                          </thead>
                          <tbody>
                            <For each={myDriveItems()}>
                              {(item) => (
                                <tr>
                                  <td class="file-name" title={item.name}>
                                    <span class="name-cell">
                                      <DriveItemIcon mimeType={item.mimeType} />
                                      <span class="name-text">{item.name}</span>
                                    </span>
                                  </td>
                                  <td>{formatDate(item.modifiedTime)}</td>
                                  <td>{formatSize(item.size)}</td>
                                  <td>
                                    <span class="owner-cell">
                                      <OwnerAvatar ownerName={item.ownerName} />
                                      <span class="owner-name">
                                        {item.ownerName || "Вы"}
                                      </span>
                                    </span>
                                  </td>
                                </tr>
                              )}
                            </For>
                          </tbody>
                        </table>
                      </div>
                    </Show>
                  </Show>
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
