import { For, Show, createSignal, createMemo } from "solid-js";
import { FileTypeIcon } from "../../fileTypes";
import { DriveItemsSkeleton } from "./DriveItemsSkeleton";
import {
  DriveItemContextMenu,
  DriveItemMenuButton,
  type DriveItemMenuConfig,
} from "./DriveItemMenu";
import { DriveViewMode, isFolder, type DriveItem } from "./driveTypes";
import { ScrollToTopButton } from "./ScrollToTopButton";
import { useI18n } from "../../../shared/i18n";

type DriveItemsContentProps = {
  items: DriveItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  error: string;
  viewMode: DriveViewMode;
  currentFolderId: string;
  formatDate: (dateIso: string) => string;
  formatSize: (size?: string) => string;
  onItemOpen: (item: DriveItem) => void;
  onItemMoved: (item: DriveItem, targetFolderId: string) => void;
  onItemRenamed: (itemId: string, newName: string) => void;
  onItemTrashed: (itemId: string) => void;
  menuConfig?: DriveItemMenuConfig;
  emptyText: string;
};

export function DriveItemsContent(props: DriveItemsContentProps) {
  const { t } = useI18n();

  const buildMetaLine = (
    item: DriveItem,
    formatDate: (dateIso: string) => string,
    formatSize: (size?: string) => string,
  ): string => {
    const owner = item.ownerName || t("drive.content.ownerMe");
    return `${formatDate(item.modifiedTime)} \u2022 ${formatSize(item.size)} \u2022 ${owner}`;
  };
  const [showScrollTop, setShowScrollTop] = createSignal(false);
  const folders = createMemo(() => props.items.filter(isFolder));
  const files = createMemo(() => props.items.filter((i) => !isFolder(i)));
  const hasPreview = (item: DriveItem) => !!item.thumbnailLink;
  let scrollRef: HTMLDivElement | undefined;

  const handleScroll = (el: HTMLDivElement) => {
    setShowScrollTop(el.scrollTop > 220);
    scrollRef = el;
  };

  const handleScrollToTop = () => {
    scrollRef?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Show
      when={!props.error}
      fallback={
        <p class="drive-error">
          {t("drive.content.error", { error: props.error })}
        </p>
      }
    >
      <Show
        when={props.items.length > 0 || props.loading}
        fallback={
          <p class="drive-empty">
            {props.loading ? t("drive.content.loading") : props.emptyText}
          </p>
        }
      >
        <Show
          when={!props.loading || props.items.length > 0}
          fallback={<DriveItemsSkeleton viewMode={props.viewMode} />}
        >
          <Show
            when={props.viewMode === DriveViewMode.List}
            fallback={
              <div class="drive-scroll-area">
                <div
                  class="drive-grid-layout"
                  onScroll={(e) => handleScroll(e.currentTarget)}
                >
                  <Show when={folders().length > 0}>
                    <div class="drive-grid-folders-row">
                      <For each={folders()}>
                        {(item) => (
                          <DriveItemContextMenu
                            item={item}
                            currentFolderId={props.currentFolderId}
                            onOpen={() => props.onItemOpen(item)}
                            onItemMoved={props.onItemMoved}
                            onItemRenamed={props.onItemRenamed}
                            onItemTrashed={props.onItemTrashed}
                            menuConfig={props.menuConfig}
                          >
                            <article
                              class="drive-item drive-item-grid drive-item-grid-folder"
                              onClick={(event) => {
                                if (event.detail === 2) {
                                  props.onItemOpen(item);
                                }
                              }}
                            >
                              <div class="drive-grid-tile-top">
                                <div class="drive-grid-title-wrap">
                                  <span class="name-icon" aria-hidden="true">
                                    <FileTypeIcon mimeType={item.mimeType} />
                                  </span>
                                  <div
                                    class="drive-item-title"
                                    title={item.name}
                                  >
                                    {item.name}
                                  </div>
                                </div>

                                <DriveItemMenuButton
                                  item={item}
                                  currentFolderId={props.currentFolderId}
                                  onOpen={() => props.onItemOpen(item)}
                                  onItemMoved={props.onItemMoved}
                                  onItemRenamed={props.onItemRenamed}
                                  onItemTrashed={props.onItemTrashed}
                                  menuConfig={props.menuConfig}
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
                            currentFolderId={props.currentFolderId}
                            onOpen={() => props.onItemOpen(item)}
                            onItemMoved={props.onItemMoved}
                            onItemRenamed={props.onItemRenamed}
                            onItemTrashed={props.onItemTrashed}
                            menuConfig={props.menuConfig}
                          >
                            <article
                              class="drive-item drive-item-grid"
                              onClick={(event) => {
                                if (event.detail === 2) {
                                  props.onItemOpen(item);
                                }
                              }}
                            >
                              <div class="drive-grid-tile-top">
                                <div class="drive-grid-title-wrap">
                                  <span class="name-icon" aria-hidden="true">
                                    <FileTypeIcon mimeType={item.mimeType} />
                                  </span>
                                  <div
                                    class="drive-item-title"
                                    title={item.name}
                                  >
                                    {item.name}
                                  </div>
                                </div>

                                <DriveItemMenuButton
                                  item={item}
                                  currentFolderId={props.currentFolderId}
                                  onOpen={() => props.onItemOpen(item)}
                                  onItemMoved={props.onItemMoved}
                                  onItemRenamed={props.onItemRenamed}
                                  onItemTrashed={props.onItemTrashed}
                                  menuConfig={props.menuConfig}
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
                                      event.currentTarget.style.display =
                                        "none";
                                    }}
                                  />
                                </Show>
                              </div>
                            </article>
                          </DriveItemContextMenu>
                        )}
                      </For>
                    </div>
                  </Show>

                  <Show when={props.hasMore}>
                    <button
                      type="button"
                      class="drive-load-more-btn"
                      disabled={props.loadingMore}
                      onClick={props.onLoadMore}
                    >
                      <Show
                        when={props.loadingMore}
                        fallback={<>{t("drive.content.loadMore")}</>}
                      >
                        <span
                          class="drive-load-more-spinner"
                          aria-hidden="true"
                        />
                        {t("drive.content.loading")}
                      </Show>
                    </button>
                  </Show>
                </div>
                <ScrollToTopButton
                  visible={showScrollTop()}
                  onScrollTop={handleScrollToTop}
                />
              </div>
            }
          >
            <div class="drive-scroll-area">
              <div
                class="drive-items-list"
                onScroll={(e) => handleScroll(e.currentTarget)}
              >
                <For each={props.items}>
                  {(item) => (
                    <DriveItemContextMenu
                      item={item}
                      currentFolderId={props.currentFolderId}
                      onOpen={() => props.onItemOpen(item)}
                      onItemMoved={props.onItemMoved}
                      onItemRenamed={props.onItemRenamed}
                      onItemTrashed={props.onItemTrashed}
                      menuConfig={props.menuConfig}
                    >
                      <article
                        class="drive-item drive-item-list"
                        onClick={(event) => {
                          if (event.detail === 2) {
                            props.onItemOpen(item);
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
                          currentFolderId={props.currentFolderId}
                          onOpen={() => props.onItemOpen(item)}
                          onItemMoved={props.onItemMoved}
                          onItemRenamed={props.onItemRenamed}
                          onItemTrashed={props.onItemTrashed}
                          menuConfig={props.menuConfig}
                        />
                      </article>
                    </DriveItemContextMenu>
                  )}
                </For>
                <Show when={props.hasMore}>
                  <button
                    type="button"
                    class="drive-load-more-btn"
                    disabled={props.loadingMore}
                    onClick={props.onLoadMore}
                  >
                    <Show
                      when={props.loadingMore}
                      fallback={<>{t("drive.content.loadMore")}</>}
                    >
                      <span
                        class="drive-load-more-spinner"
                        aria-hidden="true"
                      />
                      {t("drive.content.loading")}
                    </Show>
                  </button>
                </Show>
              </div>
              <ScrollToTopButton
                visible={showScrollTop()}
                onScrollTop={handleScrollToTop}
              />
            </div>
          </Show>
        </Show>
      </Show>
    </Show>
  );
}
