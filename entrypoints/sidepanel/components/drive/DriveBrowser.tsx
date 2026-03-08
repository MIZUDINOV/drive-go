import { For, Show, createEffect, createSignal } from "solid-js";
import { Breadcrumbs } from "@kobalte/core/breadcrumbs";
import { SegmentedControl } from "@kobalte/core/segmented-control";
import { Button } from "@kobalte/core/button";
import { FileTypeIcon } from "../../fileTypes";
import { useDriveBrowser } from "./useDriveBrowser";
import { DriveItemContextMenu, DriveItemMenuButton } from "./DriveItemMenu";
import type { DriveItem, DriveViewMode } from "./driveTypes";
import { isFolder } from "./driveTypes";
import { openDriveItemInNewTab } from "../../services/driveApi";

type DriveBrowserProps = {
  formatDate: (dateIso: string) => string;
  formatSize: (size?: string) => string;
  onFolderChange?: (folderId: string | null) => void;
};

function buildMetaLine(
  item: DriveItem,
  formatDate: (dateIso: string) => string,
  formatSize: (size?: string) => string,
): string {
  const owner = item.ownerName || "Вы";
  return `${formatDate(item.modifiedTime)} • ${formatSize(item.size)} • ${owner}`;
}

export function DriveBrowser(props: DriveBrowserProps) {
  const browserState = useDriveBrowser();
  const [viewMode, setViewMode] = createSignal<DriveViewMode>("list");

  createEffect(() => {
    if (
      !browserState.loading() &&
      browserState.loadedFolderId() !== browserState.currentFolderId()
    ) {
      void browserState.loadFolder(browserState.currentFolderId(), true);
    }
  });

  // Уведомляем родителя об изменении папки
  createEffect(() => {
    const folderId = browserState.currentFolderId();
    if (props.onFolderChange) {
      props.onFolderChange(folderId);
    }
  });

  const onItemDoubleClick = (item: DriveItem) => {
    if (isFolder(item)) {
      void browserState.openFolder(item);
      return;
    }

    void openDriveItemInNewTab(item);
  };

  const hasPreview = (item: DriveItem) =>
    !isFolder(item) && Boolean(item.thumbnailLink);

  const folders = () => browserState.items().filter((item) => isFolder(item));
  const files = () => browserState.items().filter((item) => !isFolder(item));

  return (
    <section class="drive-browser">
      <header class="drive-browser-header">
        <div class="drive-browser-left-actions">
          <Button
            type="button"
            class="drive-browser-back-btn"
            onClick={() => void browserState.goUp()}
            disabled={
              browserState.breadcrumbs().length <= 1 || browserState.loading()
            }
          >
            Назад
          </Button>

          <Button
            type="button"
            class="refresh-btn"
            onClick={() => void browserState.refresh()}
            disabled={browserState.loading()}
          >
            {browserState.loading() ? "Обновление..." : "Обновить"}
          </Button>
        </div>

        <SegmentedControl
          class="drive-view-toggle"
          value={viewMode()}
          onChange={(value) => {
            if (value === "list" || value === "grid") {
              setViewMode(value);
            }
          }}
          aria-label="Режим отображения"
        >
          <SegmentedControl.Item
            class="drive-view-toggle-item"
            value="list"
            aria-label="Режим списка"
            title="Список"
          >
            <SegmentedControl.ItemInput class="drive-view-toggle-input" />
            <SegmentedControl.ItemLabel class="drive-view-toggle-item-label">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 7h12M6 12h12M6 17h12"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-width="1.8"
                />
              </svg>
            </SegmentedControl.ItemLabel>
          </SegmentedControl.Item>
          <SegmentedControl.Item
            class="drive-view-toggle-item"
            value="grid"
            aria-label="Режим плиток"
            title="Плитка"
          >
            <SegmentedControl.ItemInput class="drive-view-toggle-input" />
            <SegmentedControl.ItemLabel class="drive-view-toggle-item-label">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect
                  x="5"
                  y="5"
                  width="5.5"
                  height="5.5"
                  rx="1"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                />
                <rect
                  x="13.5"
                  y="5"
                  width="5.5"
                  height="5.5"
                  rx="1"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                />
                <rect
                  x="5"
                  y="13.5"
                  width="5.5"
                  height="5.5"
                  rx="1"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                />
                <rect
                  x="13.5"
                  y="13.5"
                  width="5.5"
                  height="5.5"
                  rx="1"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                />
              </svg>
            </SegmentedControl.ItemLabel>
          </SegmentedControl.Item>
        </SegmentedControl>
      </header>

      <Breadcrumbs class="drive-breadcrumbs" aria-label="Путь">
        <For each={browserState.breadcrumbs()}>
          {(crumb, index) => {
            const isLast = () =>
              index() === browserState.breadcrumbs().length - 1;
            return (
              <>
                <Breadcrumbs.Link
                  href="#"
                  class={`drive-breadcrumb-link ${isLast() ? "is-current" : ""}`}
                  onClick={(event) => {
                    event.preventDefault();
                    void browserState.goToBreadcrumb(index());
                  }}
                >
                  {crumb.name}
                </Breadcrumbs.Link>
                <Show when={!isLast()}>
                  <Breadcrumbs.Separator class="drive-breadcrumb-separator">
                    &gt;
                  </Breadcrumbs.Separator>
                </Show>
              </>
            );
          }}
        </For>
      </Breadcrumbs>

      <div class="drive-meta">Элементов: {browserState.items().length}</div>

      <Show
        when={!browserState.error()}
        fallback={<p class="drive-error">Ошибка: {browserState.error()}</p>}
      >
        <Show
          when={browserState.items().length > 0}
          fallback={
            <p class="drive-empty">
              {browserState.loading()
                ? "Загрузка..."
                : "В этой папке пока нет файлов и папок."}
            </p>
          }
        >
          <Show
            when={viewMode() === "list"}
            fallback={
              <div class="drive-grid-layout">
                <Show when={folders().length > 0}>
                  <div class="drive-grid-folders-row">
                    <For each={folders()}>
                      {(item) => (
                        <DriveItemContextMenu
                          item={item}
                          currentFolderId={browserState.currentFolderId()}
                          onOpen={() => onItemDoubleClick(item)}
                          onMoveSuccess={browserState.refresh}
                        >
                          <article
                            class="drive-item drive-item-grid drive-item-grid-folder"
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              if (event.detail === 2) {
                                onItemDoubleClick(item);
                              }
                            }}
                          >
                            <div class="drive-grid-tile-top">
                              <div class="drive-grid-title-wrap">
                                <span class="name-icon" aria-hidden="true">
                                  <FileTypeIcon mimeType={item.mimeType} />
                                </span>
                                <div class="drive-item-title" title={item.name}>
                                  {item.name}
                                </div>
                              </div>

                              <DriveItemMenuButton
                                item={item}
                                currentFolderId={browserState.currentFolderId()}
                                onOpen={() => onItemDoubleClick(item)}
                                onMoveSuccess={browserState.refresh}
                              />
                            </div>
                          </article>
                        </DriveItemContextMenu>
                      )}
                    </For>
                  </div>
                </Show>

                <Show when={files().length > 0}>
                  <div class="drive-items-grid">
                    <For each={files()}>
                      {(item) => (
                        <DriveItemContextMenu
                          item={item}
                          currentFolderId={browserState.currentFolderId()}
                          onOpen={() => onItemDoubleClick(item)}
                          onMoveSuccess={browserState.refresh}
                        >
                          <article
                            class="drive-item drive-item-grid"
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              if (event.detail === 2) {
                                onItemDoubleClick(item);
                              }
                            }}
                          >
                            <div class="drive-grid-tile-top">
                              <div class="drive-grid-title-wrap">
                                <span class="name-icon" aria-hidden="true">
                                  <FileTypeIcon mimeType={item.mimeType} />
                                </span>
                                <div class="drive-item-title" title={item.name}>
                                  {item.name}
                                </div>
                              </div>

                              <DriveItemMenuButton
                                item={item}
                                currentFolderId={browserState.currentFolderId()}
                                onOpen={() => onItemDoubleClick(item)}
                                onMoveSuccess={browserState.refresh}
                              />
                            </div>

                            <div class="drive-grid-preview">
                              <Show
                                when={hasPreview(item)}
                                fallback={
                                  <span
                                    class="drive-grid-preview-fallback"
                                    aria-hidden="true"
                                  >
                                    <FileTypeIcon mimeType={item.mimeType} />
                                  </span>
                                }
                              >
                                <img
                                  class="drive-grid-preview-image"
                                  src={item.thumbnailLink}
                                  alt=""
                                  loading="lazy"
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                  }}
                                />
                              </Show>
                            </div>

                            {/* <div
                            class="drive-item-meta"
                            title={buildMetaLine(item, props.formatDate, props.formatSize)}
                          >
                            {buildMetaLine(item, props.formatDate, props.formatSize)}
                          </div> */}
                          </article>
                        </DriveItemContextMenu>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            }
          >
            <div class="drive-items-list">
              <For each={browserState.items()}>
                {(item) => (
                  <DriveItemContextMenu
                    item={item}
                    currentFolderId={browserState.currentFolderId()}
                    onOpen={() => onItemDoubleClick(item)}
                    onMoveSuccess={browserState.refresh}
                  >
                    <article
                      class="drive-item drive-item-list"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        if (event.detail === 2) {
                          onItemDoubleClick(item);
                        }
                      }}
                    >
                      <div class="drive-item-main">
                        <span class="name-icon" aria-hidden="true">
                          <FileTypeIcon mimeType={item.mimeType} />
                        </span>
                        <div class="drive-item-text">
                          <div class="drive-item-title" title={item.name}>
                            {item.name}
                          </div>
                          <div
                            class="drive-item-meta"
                            title={buildMetaLine(
                              item,
                              props.formatDate,
                              props.formatSize,
                            )}
                          >
                            {buildMetaLine(
                              item,
                              props.formatDate,
                              props.formatSize,
                            )}
                          </div>
                        </div>
                      </div>

                      <DriveItemMenuButton
                        item={item}
                        currentFolderId={browserState.currentFolderId()}
                        onOpen={() => onItemDoubleClick(item)}
                        onMoveSuccess={browserState.refresh}
                      />
                    </article>
                  </DriveItemContextMenu>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>

      <Show when={Boolean(browserState.nextPageToken())}>
        <Button
          type="button"
          class="drive-load-more-btn"
          disabled={browserState.loading()}
          onClick={() => void browserState.loadMore()}
        >
          {browserState.loading() ? "Загрузка..." : "Показать еще"}
        </Button>
      </Show>
    </section>
  );
}
