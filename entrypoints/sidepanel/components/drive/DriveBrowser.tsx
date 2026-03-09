import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  JSX,
  onCleanup,
} from "solid-js";
import { Breadcrumbs } from "@kobalte/core/breadcrumbs";
import { SegmentedControl } from "@kobalte/core/segmented-control";
import { Button } from "@kobalte/core/button";
import { Select } from "@kobalte/core/select";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Dialog } from "@kobalte/core/dialog";
import { TextField } from "@kobalte/core/text-field";
import { Tooltip } from "@kobalte/core/tooltip";
import { Toast, toaster } from "@kobalte/core/toast";
import { Portal } from "solid-js/web";
import { FileTypeIcon } from "../../fileTypes";
import { useDriveBrowser, type DriveBrowserScope } from "./useDriveBrowser";
import type { DriveItem, DriveViewMode } from "./driveTypes";
import { isFolder } from "./driveTypes";
import {
  openDriveItemInNewTab,
  createFolder,
  type DriveSearchFilters,
  DEFAULT_DRIVE_SEARCH_FILTERS,
} from "../../services/driveApi";
import {
  addFilesToUploadQueue,
  subscribeToUploadQueueSettled,
} from "../../services/uploadManager";
import {
  addSharedItemToStarred,
  removeSharedItem,
} from "../../services/sharedApi";
import { removeFromStarred } from "../../services/starredApi";
import { type DriveItemMenuConfig } from "./DriveItemMenu";
import { DriveItemsContent } from "./DriveItemsContent";

type DriveBrowserProps = {
  formatDate: (dateIso: string) => string;
  formatSize: (size?: string) => string;
  onFolderChange?: (folderId: string | null) => void;
  scope?: DriveBrowserScope;
};

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
            <Select.Item
              item={itemProps.item}
              class="drive-browser-filter-item"
            >
              <Show when={iconMimeType !== undefined}>
                <span class="drive-browser-filter-item-icon" aria-hidden="true">
                  <FileTypeIcon
                    mimeType={iconMimeType ?? "application/octet-stream"}
                  />
                </span>
              </Show>

              <Select.ItemLabel>{props.labels[option]}</Select.ItemLabel>

              <Select.ItemIndicator class="drive-browser-filter-item-indicator">
                <span class="material-symbols-rounded">done</span>
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
            {(state) =>
              state.selectedOption()
                ? props.labels[state.selectedOption() as T]
                : ""
            }
          </Select.Value>
          <Select.Icon>
            <span class="material-symbols-rounded">expand_more</span>
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

export function DriveBrowser(props: DriveBrowserProps) {
  const SHARED_TOAST_REGION_ID = "shared-drive-actions";
  const RECENT_TOAST_REGION_ID = "recent-drive-actions";
  const STARRED_TOAST_REGION_ID = "starred-drive-actions";
  const scope = props.scope ?? "my-drive";
  const isSharedScope = scope === "shared";
  const isRecentScope = scope === "recent";
  const isStarredScope = scope === "starred";
  const browserState = useDriveBrowser({ scope });
  const [viewMode, setViewMode] = createSignal<DriveViewMode>("list");
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);
  const [folderName, setFolderName] = createSignal("Без названия");
  const [isCreating, setIsCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let fileInputRef: HTMLInputElement | undefined;
  let hasFilterEffectInitialized = false;

  const showActionToast = (
    title: string,
    description: string,
    tone: "success" | "error",
    regionId: string,
  ) => {
    toaster.show(
      (toastProps) => (
        <Toast
          toastId={toastProps.toastId}
          class={`drive-toast drive-toast-${tone}`}
          duration={4000}
          priority={tone === "error" ? "high" : "low"}
        >
          <div class="drive-toast-main">
            <Toast.Title class="drive-toast-title">{title}</Toast.Title>
            <Toast.Description class="drive-toast-description">
              {description}
            </Toast.Description>
          </div>

          <Toast.CloseButton class="drive-toast-close" aria-label="Закрыть">
            <span class="material-symbols-rounded">close</span>
          </Toast.CloseButton>

          <Toast.ProgressTrack class="drive-toast-progress-track">
            <Toast.ProgressFill class="drive-toast-progress-fill" />
          </Toast.ProgressTrack>
        </Toast>
      ),
      { region: regionId },
    );
  };

  const menuConfig = createMemo<DriveItemMenuConfig | undefined>(() => {
    if (!isSharedScope && !isRecentScope && !isStarredScope) {
      return undefined;
    }

    if (isStarredScope) {
      return {
        actions: ["open", "share", "copy-link", "remove-star"],
        onRemoveStar: async (item) => {
          const result = await removeFromStarred(item.id);
          if (!result.ok) {
            showActionToast(
              "Не удалось убрать пометку",
              result.error,
              "error",
              STARRED_TOAST_REGION_ID,
            );
            return false;
          }

          showActionToast(
            "Убрано из помеченных",
            `Файл \"${item.name}\" удален из Избранного Google Drive.`,
            "success",
            STARRED_TOAST_REGION_ID,
          );

          browserState.removeItemLocally(item.id);

          // Обновляем список локально без полного перезапроса.
          return false;
        },
      };
    }

    if (isRecentScope) {
      return {
        actions: ["open", "share", "add-star", "copy-link"],
        onAddStar: async (item) => {
          const result = await addSharedItemToStarred(item.id);
          if (!result.ok) {
            showActionToast(
              "Не удалось добавить в помеченные",
              result.error,
              "error",
              RECENT_TOAST_REGION_ID,
            );
            return false;
          }

          showActionToast(
            "Добавлено в помеченные",
            `Файл \"${item.name}\" добавлен в Избранное Google Drive.`,
            "success",
            RECENT_TOAST_REGION_ID,
          );

          return false;
        },
      };
    }

    return {
      actions: ["open", "share", "add-star", "remove-shared"],
      onAddStar: async (item) => {
        const result = await addSharedItemToStarred(item.id);
        if (!result.ok) {
          showActionToast(
            "Не удалось добавить в помеченные",
            result.error,
            "error",
            SHARED_TOAST_REGION_ID,
          );
          return false;
        }

        showActionToast(
          "Добавлено в помеченные",
          `Файл \"${item.name}\" добавлен в Избранное Google Drive.`,
          "success",
          SHARED_TOAST_REGION_ID,
        );

        // Для shared не перезагружаем список после добавления в избранное.
        return false;
      },
      onRemoveShared: async (item) => {
        const result = await removeSharedItem(item.id);
        if (!result.ok) {
          showActionToast(
            "Не удалось удалить из доступа",
            result.error,
            "error",
            SHARED_TOAST_REGION_ID,
          );
          return false;
        }

        showActionToast(
          "Удалено из Доступные мне",
          `Файл \"${item.name}\" больше не отображается в этом разделе.`,
          "success",
          SHARED_TOAST_REGION_ID,
        );
        return true;
      },
    };
  });

  createEffect(() => {
    const loadTarget = browserState.currentFolderId();

    if (
      !browserState.loading() &&
      browserState.loadedFolderId() !== loadTarget
    ) {
      void browserState.loadFolder(loadTarget, true);
    }
  });

  createEffect(() => {
    browserState.filters();

    if (!hasFilterEffectInitialized) {
      hasFilterEffectInitialized = true;
      return;
    }

    void browserState.loadFolder(browserState.currentFolderId(), true);
  });

  createEffect(() => {
    if (!props.onFolderChange) {
      return;
    }

    props.onFolderChange(
      scope === "my-drive" ? browserState.currentFolderId() : null,
    );
  });

  createEffect(() => {
    if (scope !== "my-drive") {
      return;
    }

    const unsubscribe = subscribeToUploadQueueSettled((successfulParentIds) => {
      const currentFolderId = browserState.currentFolderId();

      if (!successfulParentIds.includes(currentFolderId)) {
        return;
      }

      if (browserState.loading()) {
        return;
      }

      void browserState.refresh();
    });

    onCleanup(unsubscribe);
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
      icon: () => <span class="material-symbols-rounded">upload_file</span>,
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

  const typeOptions = () =>
    isRecentScope
      ? ([
          "all",
          "documents",
          "spreadsheets",
          "presentations",
          "pdf",
          "images",
        ] as DriveSearchFilters["type"][])
      : TYPE_OPTIONS;

  return (
    <section class="drive-browser">
      <div class="folder-header">
        <div class="folder-header-left">
          <Breadcrumbs class="drive-breadcrumbs" aria-label="Путь">
            <For each={browserState.breadcrumbs()}>
              {(crumb, index) => {
                const isLast = () =>
                  index() === browserState.breadcrumbs().length - 1;

                const canNavigate = () => !isLast();
                const canShowDropdown = () => isLast() && scope === "my-drive";

                const typeOptions = () =>
                  isRecentScope
                    ? ([
                        "all",
                        "documents",
                        "spreadsheets",
                        "presentations",
                        "pdf",
                        "images",
                      ] as DriveSearchFilters["type"][])
                    : TYPE_OPTIONS;

                return (
                  <>
                    <Show
                      when={canNavigate()}
                      fallback={
                        <Show
                          when={canShowDropdown()}
                          fallback={
                            <span class="folder-breadcrumb-link">
                              {crumb.name}
                            </span>
                          }
                        >
                          <DropdownMenu>
                            <DropdownMenu.Trigger
                              as={Button}
                              class="folder-breadcrumb-dropdown-trigger"
                            >
                              {crumb.name}
                              <span class="material-symbols-rounded dropdown-icon">
                                expand_more
                              </span>
                            </DropdownMenu.Trigger>

                            <DropdownMenu.Portal>
                              <DropdownMenu.Content class="create-menu-content">
                                <For each={createOptions}>
                                  {(option) => (
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
                                  )}
                                </For>
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu>
                        </Show>
                      }
                    >
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
                        <Breadcrumbs.Separator class="folder-breadcrumb-separator" />
                      </>
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
          <Tooltip placement="bottom" gutter={4}>
            <SegmentedControl.Item
              class="drive-view-toggle-item"
              value="list"
              aria-label="Режим списка"
            >
              <SegmentedControl.ItemInput class="drive-view-toggle-input" />
              <SegmentedControl.ItemLabel class="drive-view-toggle-item-label">
                <span class="material-symbols-rounded">list</span>
              </SegmentedControl.ItemLabel>
            </SegmentedControl.Item>
            <Tooltip.Portal>
              <Tooltip.Content class="tab-tooltip">
                <Tooltip.Arrow />
                <span>Список</span>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip>
          <Tooltip placement="bottom" gutter={4}>
            <SegmentedControl.Item
              class="drive-view-toggle-item"
              value="grid"
              aria-label="Режим плиток"
            >
              <SegmentedControl.ItemInput class="drive-view-toggle-input" />
              <SegmentedControl.ItemLabel class="drive-view-toggle-item-label">
                <span class="material-symbols-rounded">grid_view</span>
              </SegmentedControl.ItemLabel>
            </SegmentedControl.Item>
            <Tooltip.Portal>
              <Tooltip.Content class="tab-tooltip">
                <Tooltip.Arrow />
                <span>Плитка</span>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip>
        </SegmentedControl>
      </div>

      <header class="drive-browser-header">
        <div class="drive-browser-filters">
          <FilterSelect
            label="Тип"
            ariaLabel="Фильтр по типу"
            value={browserState.filters().type}
            options={typeOptions()}
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

      <DriveItemsContent
        items={browserState.items()}
        loading={browserState.loading()}
        error={browserState.error()}
        viewMode={viewMode()}
        currentFolderId={browserState.currentFolderId()}
        formatDate={props.formatDate}
        formatSize={props.formatSize}
        onItemOpen={onItemDoubleClick}
        onItemsChanged={browserState.refresh}
        menuConfig={menuConfig()}
        emptyText={
          isSharedScope
            ? "Нет файлов, открытых для вас."
            : isRecentScope
              ? "Недавних файлов пока нет."
              : isStarredScope
                ? "Помеченных файлов пока нет."
                : "В этой папке пока нет файлов и папок."
        }
      />

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

      <Show when={scope === "my-drive"}>
        <>
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
        </>
      </Show>

      <Portal>
        <Show when={isSharedScope}>
          <Toast.Region
            class="drive-toast-region"
            regionId={SHARED_TOAST_REGION_ID}
            limit={4}
          >
            <Toast.List class="drive-toast-list" />
          </Toast.Region>
        </Show>

        <Show when={isRecentScope}>
          <Toast.Region
            class="drive-toast-region"
            regionId={RECENT_TOAST_REGION_ID}
            limit={4}
          >
            <Toast.List class="drive-toast-list" />
          </Toast.Region>
        </Show>

        <Show when={isStarredScope}>
          <Toast.Region
            class="drive-toast-region"
            regionId={STARRED_TOAST_REGION_ID}
            limit={4}
          >
            <Toast.List class="drive-toast-list" />
          </Toast.Region>
        </Show>
      </Portal>
    </section>
  );
}
