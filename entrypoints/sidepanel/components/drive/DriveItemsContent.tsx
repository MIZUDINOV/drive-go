import { For, Show } from "solid-js";
import { FileTypeIcon } from "../../fileTypes";
import { DriveItemsSkeleton } from "./DriveItemsSkeleton";
import {
  DriveItemContextMenu,
  DriveItemMenuButton,
  type DriveItemMenuConfig,
} from "./DriveItemMenu";
import type { DriveItem, DriveViewMode } from "./driveTypes";
import { isFolder } from "./driveTypes";

type DriveItemsContentProps = {
  items: DriveItem[];
  loading: boolean;
  error: string;
  viewMode: DriveViewMode;
  currentFolderId: string;
  formatDate: (dateIso: string) => string;
  formatSize: (size?: string) => string;
  onItemOpen: (item: DriveItem) => void;
  onItemsChanged: () => Promise<void>;
  menuConfig?: DriveItemMenuConfig;
  emptyText: string;
};

function buildMetaLine(
  item: DriveItem,
  formatDate: (dateIso: string) => string,
  formatSize: (size?: string) => string,
): string {
  const owner = item.ownerName || "Вы";
  return `${formatDate(item.modifiedTime)} • ${formatSize(item.size)} • ${owner}`;
}

export function DriveItemsContent(props: DriveItemsContentProps) {
  const hasPreview = (item: DriveItem) =>
    !isFolder(item) && Boolean(item.thumbnailLink);

  const folders = () => props.items.filter((item) => isFolder(item));
  const files = () => props.items.filter((item) => !isFolder(item));

  return (
    <Show when={!props.error} fallback={<p class="drive-error">Ошибка: {props.error}</p>}>
      <Show
        when={props.items.length > 0 || props.loading}
        fallback={
          <p class="drive-empty">
            {props.loading ? "Загрузка..." : props.emptyText}
          </p>
        }
      >
        <Show
          when={!props.loading}
          fallback={<DriveItemsSkeleton viewMode={props.viewMode} />}
        >
          <Show
            when={props.viewMode === "list"}
            fallback={
              <div class="drive-grid-layout">
                <Show when={folders().length > 0}>
                  <div class="drive-grid-folders-row">
                    <For each={folders()}>
                      {(item) => (
                        <DriveItemContextMenu
                          item={item}
                          currentFolderId={props.currentFolderId}
                          onOpen={() => props.onItemOpen(item)}
                          onMoveSuccess={props.onItemsChanged}
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
                                <div class="drive-item-title" title={item.name}>
                                  {item.name}
                                </div>
                              </div>

                              <DriveItemMenuButton
                                item={item}
                                currentFolderId={props.currentFolderId}
                                onOpen={() => props.onItemOpen(item)}
                                onMoveSuccess={props.onItemsChanged}
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
                          onMoveSuccess={props.onItemsChanged}
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
                                <div class="drive-item-title" title={item.name}>
                                  {item.name}
                                </div>
                              </div>

                              <DriveItemMenuButton
                                item={item}
                                currentFolderId={props.currentFolderId}
                                onOpen={() => props.onItemOpen(item)}
                                onMoveSuccess={props.onItemsChanged}
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
                                    event.currentTarget.style.display = "none";
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
              </div>
            }
          >
            <div class="drive-items-list">
              <For each={props.items}>
                {(item) => (
                  <DriveItemContextMenu
                    item={item}
                    currentFolderId={props.currentFolderId}
                    onOpen={() => props.onItemOpen(item)}
                    onMoveSuccess={props.onItemsChanged}
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
                        onMoveSuccess={props.onItemsChanged}
                        menuConfig={props.menuConfig}
                      />
                    </article>
                  </DriveItemContextMenu>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>
    </Show>
  );
}
