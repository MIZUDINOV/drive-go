import { For, Show, createEffect, createSignal, JSX } from "solid-js";
import { Breadcrumbs } from "@kobalte/core/breadcrumbs";
import { SegmentedControl } from "@kobalte/core/segmented-control";
import { Button } from "@kobalte/core/button";
import { Select } from "@kobalte/core/select";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Dialog } from "@kobalte/core/dialog";
import { TextField } from "@kobalte/core/text-field";
import { FileTypeIcon } from "../../fileTypes";
import { useDriveBrowser } from "./useDriveBrowser";
import { DriveItemContextMenu, DriveItemMenuButton } from "./DriveItemMenu";
import type { DriveItem, DriveViewMode } from "./driveTypes";
import { isFolder } from "./driveTypes";
import { DriveItemsSkeleton } from "./DriveItemsSkeleton";
import {
  openDriveItemInNewTab,
  createFolder,
  type DriveSearchFilters,
  DEFAULT_DRIVE_SEARCH_FILTERS,
} from "../../services/driveApi";
import { addFilesToUploadQueue } from "../../services/uploadManager";

type DriveBrowserProps = {
  formatDate: (dateIso: string) => string;
  formatSize: (size?: string) => string;
  onFolderChange?: (folderId: string | null) => void;
};

// Filter constants
const TYPE_OPTIONS: DriveSearchFilters["type"][] = [
  "all",
  "folders",
  "documents",
  "spreadsheets",
  "presentations",
  "pdf",
  "images",
];

const TYPE_LABEL: Record<DriveSearchFilters["type"], string> = {
  all: "Все",
  folders: "Папки",
  documents: "Документы",
  spreadsheets: "Таблицы",
  presentations: "Презентации",
  pdf: "PDF",
  images: "Изображения",
};

const TYPE_MIME: Partial<Record<DriveSearchFilters["type"], string>> = {
  folders: "application/vnd.google-apps.folder",
  documents: "application/vnd.google-apps.document",
  spreadsheets: "application/vnd.google-apps.spreadsheet",
  presentations: "application/vnd.google-apps.presentation",
  pdf: "application/pdf",
  images: "image/png",
};

const OWNER_OPTIONS: DriveSearchFilters["owner"][] = ["all", "me"];

const OWNER_LABEL: Record<DriveSearchFilters["owner"], string> = {
  all: "Все",
  me: "Я",
};

const MODIFIED_OPTIONS: DriveSearchFilters["modified"][] = [
  "any",
  "7d",
  "30d",
  "365d",
];

const MODIFIED_LABEL: Record<DriveSearchFilters["modified"], string> = {
  any: "Любое время",
  "7d": "7 дней",
  "30d": "30 дней",
  "365d": "1 год",
};

type FilterSelectProps<T extends string> = {
  label: string;
  ariaLabel: string;
  value: T;
  options: T[];
  labels: Record<T, string>;
  iconMimeTypes?: Partial<Record<T, string>>;
  onChange: (value: T) => void;
};

function FilterSelect<T extends string>(props: FilterSelectProps<T>) {
  return (
    <label class="drive-browser-filter">
      <span>{props.label}</span>
      <Select<T>
        value={props.value}
        options={props.options}
        optionValue={(option) => option}
        optionTextValue={(option) => props.labels[option]}
        onChange={(next) => {
          if (next) {
            props.onChange(next);
          }
        }}
        itemComponent={(itemProps) => {
          const option = itemProps.item.rawValue as T;
          const iconMimeType = props.iconMimeTypes?.[option];

          return (
            <Select.Item item={itemProps.item} class="drive-browser-filter-item">
              <Show when={iconMimeType !== undefined}>
                <span class="drive-browser-filter-item-icon" aria-hidden="true">
                  <FileTypeIcon
                    mimeType={iconMimeType ?? "application/octet-stream"}
                  />
                </span>
              </Show>

              <Select.ItemLabel>{props.labels[option]}</Select.ItemLabel>

              <Select.ItemIndicator class="drive-browser-filter-item-indicator">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 13l4 4L19 7"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
              </Select.ItemIndicator>
            </Select.Item>
          );
        }}
      >
        <Select.Trigger
          class="drive-browser-filter-trigger"
          aria-label={props.ariaLabel}
        >
          <Select.Value class="drive-browser-filter-value">
            {(state) => (state.selectedOption() ? props.labels[state.selectedOption() as T] : "")}
          </Select.Value>
          <Select.Icon>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M7 10l5 5 5-5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content class="drive-browser-filter-content">
            <Select.Listbox class="drive-browser-filter-listbox" />
          </Select.Content>
        </Select.Portal>
      </Select>
    </label>
  );
}

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
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);
  const [folderName, setFolderName] = createSignal("Без названия");
  const [isCreating, setIsCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let fileInputRef: HTMLInputElement | undefined;

  // Filter menu states
  const [isTypeMenuOpen, setIsTypeMenuOpen] = createSignal(false);
  const [isOwnerMenuOpen, setIsOwnerMenuOpen] = createSignal(false);
  const [isModifiedMenuOpen, setIsModifiedMenuOpen] = createSignal(false);

  createEffect(() => {
    if (
      !browserState.loading() &&
      browserState.loadedFolderId() !== browserState.currentFolderId()
    ) {
      void browserState.loadFolder(browserState.currentFolderId(), true);
    }
  });

  // Reload when filters change
  createEffect(() => {
    browserState.filters();
    void browserState.loadFolder(browserState.currentFolderId(), true);
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

  const handleCreateFolder = async () => {
    setError(null);
    setIsCreating(true);

    const result = await createFolder(
      folderName(),
      browserState.currentFolderId(),
    );

    setIsCreating(false);

    if (result.ok) {
      setIsDialogOpen(false);
      setFolderName("Без названия");
      await browserState.refresh();
    } else {
      setError(result.error);
    }
  };

  const handleFileSelect = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      addFilesToUploadQueue(files, browserState.currentFolderId());
      input.value = "";
    }
  };

  const openFileDialog = () => {
    fileInputRef?.click();
  };

  const openDialog = () => {
    setIsDialogOpen(true);
    setError(null);
  };

  const openGoogleDoc = (
    type: "document" | "spreadsheets" | "presentation" | "forms",
  ) => {
    const baseUrls = {
      document: "https://docs.google.com/document/create",
      spreadsheets: "https://docs.google.com/spreadsheets/create",
      presentation: "https://docs.google.com/presentation/create",
      forms: "https://docs.google.com/forms/create",
    };

    const url = baseUrls[type];
    if (browser.tabs?.create) {
      browser.tabs.create({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  type CreateOption = {
    id: string;
    label: string;
    icon: () => JSX.Element;
    action: () => void;
  };

  const createOptions: CreateOption[] = [
    {
      id: "folder",
      label: "Создать папку",
      icon: () => (
        <FileTypeIcon mimeType="application/vnd.google-apps.folder" />
      ),
      action: openDialog,
    },
    {
      id: "upload",
      label: "Загрузить файлы",
      icon: () => (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 17h16v2H4z" fill="currentColor" />
          <path
            d="M12 4v9m0 0l-3.5-3.5M12 13l3.5-3.5"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.9"
          />
        </svg>
      ),
      action: openFileDialog,
    },
    {
      id: "document",
      label: "Google Документы",
      icon: () => (
        <FileTypeIcon mimeType="application/vnd.google-apps.document" />
      ),
      action: () => openGoogleDoc("document"),
    },
    {
      id: "spreadsheets",
      label: "Google Таблицы",
      icon: () => (
        <FileTypeIcon mimeType="application/vnd.google-apps.spreadsheet" />
      ),
      action: () => openGoogleDoc("spreadsheets"),
    },
    {
      id: "presentation",
      label: "Google Презентации",
      icon: () => (
        <FileTypeIcon mimeType="application/vnd.google-apps.presentation" />
      ),
      action: () => openGoogleDoc("presentation"),
    },
    {
      id: "forms",
      label: "Google Формы",
      icon: () => <FileTypeIcon mimeType="application/vnd.google-apps.form" />,
      action: () => openGoogleDoc("forms"),
    },
  ];

  const hasPreview = (item: DriveItem) =>
    !isFolder(item) && Boolean(item.thumbnailLink);

  const folders = () => browserState.items().filter((item) => isFolder(item));
  const files = () => browserState.items().filter((item) => !isFolder(item));

  return (
    <section class="drive-browser">
      <div class="folder-header">
        <div class="folder-header-left">
          <Breadcrumbs class="drive-breadcrumbs" aria-label="Путь">
            <For each={browserState.breadcrumbs()}>
              {(crumb, index) => {
                const isLast = () =>
                  index() === browserState.breadcrumbs().length - 1;
                return (
                  <>
                    <Show
                      when={isLast()}
                      fallback={
                        <>
                          <Breadcrumbs.Link
                            href="#"
                            class="folder-breadcrumb-link"
                            onClick={(event) => {
                              event.preventDefault();
                              void browserState.goToBreadcrumb(index());
                            }}
                          >
                            {crumb.name}
                          </Breadcrumbs.Link>
                          <Breadcrumbs.Separator class="folder-breadcrumb-separator"></Breadcrumbs.Separator>
                        </>
                      }
                    >
                      <DropdownMenu>
                        <DropdownMenu.Trigger
                          as={Button}
                          class="folder-breadcrumb-dropdown-trigger"
                        >
                          {crumb.name}
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            class="dropdown-icon"
                          >
                            <path
                              d="M7 10l5 5 5-5"
                              fill="none"
                              stroke="currentColor"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                            />
                          </svg>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Portal>
                          <DropdownMenu.Content class="create-menu-content">
                            {createOptions.map((option) => (
                              <DropdownMenu.Item
                                class="create-menu-item"
                                onSelect={option.action}
                              >
                                <span class="create-menu-item-icon">
                                  {option.icon()}
                                </span>
                                <span class="create-menu-item-label">
                                  {option.label}
                                </span>
                              </DropdownMenu.Item>
                            ))}
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu>
                    </Show>
                  </>
                );
              }}
            </For>
          </Breadcrumbs>
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
      </div>

      <header class="drive-browser-header">
        <div class="drive-browser-filters">
          <FilterSelect
            label="Тип"
            ariaLabel="Фильтр по типу"
            value={browserState.filters().type}
            options={TYPE_OPTIONS}
            labels={TYPE_LABEL}
            iconMimeTypes={TYPE_MIME}
            onChange={(type) =>
              browserState.setFilters({ ...browserState.filters(), type })
            }
          />

          <FilterSelect
            label="Люди"
            ariaLabel="Фильтр по владельцу"
            value={browserState.filters().owner}
            options={OWNER_OPTIONS}
            labels={OWNER_LABEL}
            onChange={(owner) =>
              browserState.setFilters({ ...browserState.filters(), owner })
            }
          />

          <FilterSelect
            label="Изменено"
            ariaLabel="Фильтр по дате изменения"
            value={browserState.filters().modified}
            options={MODIFIED_OPTIONS}
            labels={MODIFIED_LABEL}
            onChange={(modified) =>
              browserState.setFilters({ ...browserState.filters(), modified })
            }
          />

          <Button
            type="button"
            class="drive-browser-clear-filters-btn"
            onClick={() => {
              browserState.setFilters(DEFAULT_DRIVE_SEARCH_FILTERS);
              void browserState.refresh();
            }}
            disabled={browserState.loading()}
          >
            Очистить фильтры
          </Button>
        </div>

        <div class="drive-browser-left-actions">
          <Button
            type="button"
            class="refresh-btn"
            onClick={() => void browserState.refresh()}
            disabled={browserState.loading()}
          >
            {browserState.loading() ? "Обновление..." : "Обновить"}
          </Button>
        </div>
      </header>

      <Show
        when={!browserState.error()}
        fallback={<p class="drive-error">Ошибка: {browserState.error()}</p>}
      >
        <Show
          when={browserState.items().length > 0 || browserState.loading()}
          fallback={
            <p class="drive-empty">
              {browserState.loading()
                ? "Загрузка..."
                : "В этой папке пока нет файлов и папок."}
            </p>
          }
        >
          <Show
            when={!browserState.loading()}
            fallback={<DriveItemsSkeleton viewMode={viewMode()} />}
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

      <input
        ref={fileInputRef}
        type="file"
        multiple
        class="upload-file-input"
        onChange={handleFileSelect}
      />

      <Dialog open={isDialogOpen()} onOpenChange={setIsDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay class="dialog-overlay" />
          <Dialog.Content class="dialog-content">
            <Dialog.Title class="dialog-title">Новая папка</Dialog.Title>

            <div class="dialog-body">
              <TextField
                value={folderName()}
                onChange={setFolderName}
                class="folder-name-field"
              >
                <TextField.Input
                  class="folder-name-input"
                  autofocus
                  onFocus={(e) => e.currentTarget.select()}
                />
              </TextField>

              <Show when={error()}>
                <div class="dialog-error">{error()}</div>
              </Show>
            </div>

            <div class="dialog-footer">
              <Button
                class="dialog-btn dialog-btn-cancel"
                onClick={() => setIsDialogOpen(false)}
                disabled={isCreating()}
              >
                Отмена
              </Button>
              <Button
                class="dialog-btn dialog-btn-create"
                onClick={handleCreateFolder}
                disabled={isCreating() || !folderName().trim()}
              >
                {isCreating() ? "Создание..." : "Создать"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </section>
  );
}
