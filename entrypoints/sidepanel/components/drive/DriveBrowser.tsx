import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  JSX,
  onCleanup,
  onMount,
} from "solid-js";
import { Breadcrumbs } from "@kobalte/core/breadcrumbs";
import { Badge } from "@kobalte/core/badge";
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
import { DriveViewMode, isFolder, type DriveItem } from "./driveTypes";
import {
  openDriveItemInNewTab,
  createFolder,
  type DriveSearchFilters,
  DEFAULT_DRIVE_SEARCH_FILTERS,
} from "../../services/driveApi";
import {
  getDefaultDriveViewMode,
  getDriveViewModeForScope,
  setDriveViewModeForScope,
} from "../../services/driveViewModePreferences";
import { enqueueFilesForUpload } from "../../services/transferQueueClient";
import {
  addSharedItemToStarred,
  removeSharedItem,
} from "../../services/sharedApi";
import { removeFromStarred } from "../../services/starredApi";
import {
  deleteTrashItemForever,
  emptyTrash,
  restoreTrashItem,
} from "../../services/trashApi";
import { markSavePathsFoldersDirty as markFolderPathsDirty } from "../../../shared/savePathsSettings";
import { type DriveItemMenuConfig } from "./DriveItemMenu";
import { DriveItemsContent } from "./DriveItemsContent";
import { EmptyTrashDialog } from "./EmptyTrashDialog";
import { DriveWritePermissionDialog } from "../permissions/DriveWritePermissionDialog";
import { useDriveWritePermissionGate } from "../permissions/useDriveWritePermissionGate";
import {
  type DriveCapabilityStatus,
  getPermissionCapabilitiesSnapshot,
  subscribePermissionCapabilities,
  syncGrantedScopes,
} from "../../services/permissionCapabilities";

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
  "forms",
  "archives",
  "audio",
  "videos",
  "vids",
];

const TYPE_LABEL: Record<DriveSearchFilters["type"], string> = {
  all: "Все",
  folders: "Папки",
  documents: "Документы",
  spreadsheets: "Таблицы",
  presentations: "Презентации",
  pdf: "PDF",
  images: "Изображения",
  forms: "Формы",
  archives: "Архивы",
  audio: "Аудио",
  videos: "Видео",
  vids: "Vids",
};

const TYPE_MIME: Partial<Record<DriveSearchFilters["type"], string>> = {
  folders: "application/vnd.google-apps.folder",
  documents: "application/vnd.google-apps.document",
  spreadsheets: "application/vnd.google-apps.spreadsheet",
  presentations: "application/vnd.google-apps.presentation",
  pdf: "application/pdf",
  images: "image/png",
  forms: "application/vnd.google-apps.form",
  archives: "application/zip",
  audio: "audio/mpeg",
  videos: "video/mp4",
  vids: "application/vnd.google-apps.vid",
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

              <Select.ItemLabel class="drive-browser-filter-item-label">
                {props.labels[option]}
              </Select.ItemLabel>

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
  const MY_DRIVE_TOAST_REGION_ID = "my-drive-actions";
  const SHARED_TOAST_REGION_ID = "shared-drive-actions";
  const RECENT_TOAST_REGION_ID = "recent-drive-actions";
  const STARRED_TOAST_REGION_ID = "starred-drive-actions";
  const TRASH_TOAST_REGION_ID = "trash-drive-actions";
  const scope = props.scope ?? "my-drive";
  const isSharedScope = scope === "shared";
  const isRecentScope = scope === "recent";
  const isStarredScope = scope === "starred";
  const isTrashScope = scope === "trash";
  const browserState = useDriveBrowser({ scope });
  const [viewMode, setViewMode] = createSignal<DriveViewMode>(
    getDefaultDriveViewMode(),
  );
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);
  const [isEmptyTrashDialogOpen, setIsEmptyTrashDialogOpen] =
    createSignal(false);
  const [folderName, setFolderName] = createSignal("Без названия");
  const [isCreating, setIsCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const permissionGate = useDriveWritePermissionGate();
  const [driveWriteStatus, setDriveWriteStatus] =
    createSignal<DriveCapabilityStatus>("unknown");
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

  const applyLocalRemoval = async (
    item: Pick<DriveItem, "id" | "mimeType">,
    options?: { markFoldersDirty?: boolean },
  ): Promise<void> => {
    browserState.removeItemLocally(item.id);

    if (options?.markFoldersDirty && isFolder(item)) {
      await markFolderPathsDirty();
    }
  };

  const applyLocalRemovalById = (itemId: string): void => {
    browserState.removeItemLocally(itemId);
  };

  const applyLocalRename = (itemId: string, newName: string): void => {
    browserState.updateItemLocally(itemId, {
      name: newName,
      modifiedTime: new Date().toISOString(),
    });
  };

  const applyLocalMove = async (
    item: DriveItem,
    targetFolderId: string,
  ): Promise<void> => {
    if (targetFolderId !== browserState.currentFolderId()) {
      browserState.removeItemLocally(item.id);
    }

    if (isFolder(item)) {
      await markFolderPathsDirty();
    }
  };

  const executeRestoreTrashItem = async (item: DriveItem): Promise<boolean> => {
    const result = await restoreTrashItem(item.id);
    if (!result.ok) {
      const isPermissionDenied = permissionGate.handleDriveWriteDeniedFallback(
        result.error,
        "Для восстановления требуется доступ на изменение Google Drive.",
        async () => {
          await executeRestoreTrashItem(item);
        },
      );

      if (isPermissionDenied) {
        return false;
      }

      showActionToast(
        "Не удалось восстановить",
        result.error,
        "error",
        TRASH_TOAST_REGION_ID,
      );
      return false;
    }

    await applyLocalRemoval(item, { markFoldersDirty: true });

    showActionToast(
      "Восстановлено",
      `Файл \"${item.name}\" восстановлен из корзины.`,
      "success",
      TRASH_TOAST_REGION_ID,
    );
    return false;
  };

  const executeDeleteForeverTrashItem = async (
    item: DriveItem,
  ): Promise<boolean> => {
    const result = await deleteTrashItemForever(item.id);
    if (!result.ok) {
      const isPermissionDenied = permissionGate.handleDriveWriteDeniedFallback(
        result.error,
        "Для окончательного удаления требуется доступ на изменение Google Drive.",
        async () => {
          await executeDeleteForeverTrashItem(item);
        },
      );

      if (isPermissionDenied) {
        return false;
      }

      showActionToast(
        "Не удалось удалить навсегда",
        result.error,
        "error",
        TRASH_TOAST_REGION_ID,
      );
      return false;
    }

    await applyLocalRemoval(item, { markFoldersDirty: true });

    showActionToast(
      "Удалено навсегда",
      `Файл \"${item.name}\" удален безвозвратно.`,
      "success",
      TRASH_TOAST_REGION_ID,
    );
    return true;
  };

  const menuConfig = createMemo<DriveItemMenuConfig | undefined>(() => {
    if (scope === "my-drive") {
      return {
        actions: [
          "open",
          "rename",
          "move",
          "trash",
          "share",
          "copy-link",
          "add-star",
        ],
        onAddStar: async (item) => {
          const canProceed = await permissionGate.ensureDriveWriteOrRequest(
            "Для добавления в помеченные требуется доступ на изменение Google Drive.",
            async () => {
              await addSharedItemToStarred(item.id);
            },
          );

          if (!canProceed) {
            return false;
          }

          const result = await addSharedItemToStarred(item.id);
          if (!result.ok) {
            const isPermissionDenied =
              permissionGate.handleDriveWriteDeniedFallback(
                result.error,
                "Для добавления в помеченные требуется доступ на изменение Google Drive.",
                async () => {
                  await addSharedItemToStarred(item.id);
                },
              );

            if (isPermissionDenied) {
              return false;
            }

            showActionToast(
              "Не удалось добавить в помеченные",
              result.error,
              "error",
              MY_DRIVE_TOAST_REGION_ID,
            );
            return false;
          }

          showActionToast(
            "Добавлено в помеченные",
            `Файл \"${item.name}\" добавлен в Избранное Google Drive.`,
            "success",
            MY_DRIVE_TOAST_REGION_ID,
          );

          return false;
        },
      };
    }

    if (!isSharedScope && !isRecentScope && !isStarredScope && !isTrashScope) {
      return undefined;
    }

    if (isTrashScope) {
      return {
        actions: ["restore", "delete-forever"],
        onRestore: async (item) => {
          const canProceed = await permissionGate.ensureDriveWriteOrRequest(
            "Для восстановления требуется доступ на изменение Google Drive.",
            async () => {
              await executeRestoreTrashItem(item);
            },
          );

          if (!canProceed) {
            return false;
          }

          return executeRestoreTrashItem(item);
        },
        onDeleteForever: async (item) => {
          const canProceed = await permissionGate.ensureDriveWriteOrRequest(
            "Для окончательного удаления требуется доступ на изменение Google Drive.",
            async () => {
              await executeDeleteForeverTrashItem(item);
            },
          );

          if (!canProceed) {
            return false;
          }

          return executeDeleteForeverTrashItem(item);
        },
      };
    }

    if (isStarredScope) {
      return {
        actions: ["open", "share", "copy-link", "remove-star"],
        onRemoveStar: async (item) => {
          const canProceed = await permissionGate.ensureDriveWriteOrRequest(
            "Для изменения помеченных требуется доступ на изменение Google Drive.",
            async () => {
              await removeFromStarred(item.id);
            },
          );

          if (!canProceed) {
            return false;
          }

          const result = await removeFromStarred(item.id);
          if (!result.ok) {
            const isPermissionDenied =
              permissionGate.handleDriveWriteDeniedFallback(
                result.error,
                "Для изменения помеченных требуется доступ на изменение Google Drive.",
                async () => {
                  await removeFromStarred(item.id);
                },
              );

            if (isPermissionDenied) {
              return false;
            }

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

          await applyLocalRemoval(item);
          return false;
        },
      };
    }

    if (isRecentScope) {
      return {
        actions: ["open", "share", "add-star", "copy-link"],
        onAddStar: async (item) => {
          const canProceed = await permissionGate.ensureDriveWriteOrRequest(
            "Для добавления в помеченные требуется доступ на изменение Google Drive.",
            async () => {
              await addSharedItemToStarred(item.id);
            },
          );

          if (!canProceed) {
            return false;
          }

          const result = await addSharedItemToStarred(item.id);
          if (!result.ok) {
            const isPermissionDenied =
              permissionGate.handleDriveWriteDeniedFallback(
                result.error,
                "Для добавления в помеченные требуется доступ на изменение Google Drive.",
                async () => {
                  await addSharedItemToStarred(item.id);
                },
              );

            if (isPermissionDenied) {
              return false;
            }

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
        const canProceed = await permissionGate.ensureDriveWriteOrRequest(
          "Для добавления в помеченные требуется доступ на изменение Google Drive.",
          async () => {
            await addSharedItemToStarred(item.id);
          },
        );

        if (!canProceed) {
          return false;
        }

        const result = await addSharedItemToStarred(item.id);
        if (!result.ok) {
          const isPermissionDenied =
            permissionGate.handleDriveWriteDeniedFallback(
              result.error,
              "Для добавления в помеченные требуется доступ на изменение Google Drive.",
              async () => {
                await addSharedItemToStarred(item.id);
              },
            );

          if (isPermissionDenied) {
            return false;
          }

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
        const canProceed = await permissionGate.ensureDriveWriteOrRequest(
          "Для удаления из раздела требуется доступ на изменение Google Drive.",
          async () => {
            await removeSharedItem(item.id);
          },
        );

        if (!canProceed) {
          return false;
        }

        const result = await removeSharedItem(item.id);
        if (!result.ok) {
          const isPermissionDenied =
            permissionGate.handleDriveWriteDeniedFallback(
              result.error,
              "Для удаления из раздела требуется доступ на изменение Google Drive.",
              async () => {
                await removeSharedItem(item.id);
              },
            );

          if (isPermissionDenied) {
            return false;
          }

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

        await applyLocalRemoval(item);
        return false;
      },
    };
  });

  onMount(() => {
    const permissionSubscription = subscribePermissionCapabilities((state) => {
      setDriveWriteStatus(state.driveWrite);
    });

    const initialPermissionState = getPermissionCapabilitiesSnapshot();
    setDriveWriteStatus(initialPermissionState.driveWrite);

    void syncGrantedScopes();

    onCleanup(() => {
      permissionSubscription.unsubscribe();
    });

    void getDriveViewModeForScope(scope).then((mode) => {
      setViewMode(mode);
    });
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

  const onItemDoubleClick = (item: DriveItem) => {
    if (isFolder(item)) {
      if (isTrashScope) {
        return;
      }

      void browserState.openFolder(item);
      return;
    }

    void openDriveItemInNewTab(item);
  };

  const handleCreateFolder = async () => {
    setError(null);

    const canProceed = await permissionGate.ensureDriveWriteOrRequest(
      "Для создания папки требуется доступ на изменение Google Drive.",
      handleCreateFolder,
    );
    if (!canProceed) {
      return;
    }

    setIsCreating(true);

    const result = await createFolder(
      folderName(),
      browserState.currentFolderId(),
    );

    setIsCreating(false);

    if (result.ok) {
      await markFolderPathsDirty();
      setIsDialogOpen(false);
      setFolderName("Без названия");

      const currentFilters = browserState.filters();
      const isFolderAllowedByType =
        currentFilters.type === "all" || currentFilters.type === "folders";

      if (isFolderAllowedByType) {
        browserState.upsertItemLocally({
          id: result.folder.id,
          name: result.folder.name,
          mimeType: result.folder.mimeType,
          modifiedTime: result.folder.modifiedTime ?? "",
          size: result.folder.size,
          ownerName: result.folder.owners?.[0]?.displayName,
          iconLink: result.folder.iconLink,
          thumbnailLink: result.folder.thumbnailLink,
          webViewLink: result.folder.webViewLink,
        });
      }
    } else {
      const isPermissionDenied = permissionGate.handleDriveWriteDeniedFallback(
        result.error,
        "Для создания папки требуется доступ на изменение Google Drive.",
        handleCreateFolder,
      );

      if (isPermissionDenied) {
        return;
      }

      setError(result.error);
    }
  };

  const handleFileSelect = async (event: Event): Promise<void> => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      input.value = "";

      const canProceed = await permissionGate.ensureDriveWriteOrRequest(
        "Для загрузки файлов требуется доступ на изменение Google Drive.",
        async () => {
          await enqueueFilesForUpload(files, browserState.currentFolderId());
        },
      );
      if (!canProceed) {
        return;
      }

      try {
        await enqueueFilesForUpload(files, browserState.currentFolderId());
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Не удалось загрузить файлы";

        const isPermissionDenied =
          permissionGate.handleDriveWriteDeniedFallback(
            message,
            "Для загрузки файлов требуется доступ на изменение Google Drive.",
            async () => {
              await enqueueFilesForUpload(
                files,
                browserState.currentFolderId(),
              );
            },
          );

        if (isPermissionDenied) {
          return;
        }

        setError(message);
      }

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

  const handleItemMoved = (item: DriveItem, targetFolderId: string) => {
    void applyLocalMove(item, targetFolderId);
  };

  const handleItemRenamed = (itemId: string, newName: string) => {
    applyLocalRename(itemId, newName);
  };

  const handleItemTrashed = (itemId: string) => {
    applyLocalRemovalById(itemId);
  };

  const openGoogleDoc = (
    type: "document" | "spreadsheets" | "presentation" | "forms" | "vids",
  ) => {
    const baseUrls = {
      document: "https://docs.google.com/document/create",
      spreadsheets: "https://docs.google.com/spreadsheets/create",
      presentation: "https://docs.google.com/presentation/create",
      forms: "https://docs.google.com/forms/create",
      vids: "https://docs.google.com/videos/create",
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
    {
      id: "vids",
      label: "Google Vids",
      icon: () => <FileTypeIcon mimeType="application/vnd.google-apps.vid" />,
      action: () => openGoogleDoc("vids"),
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

  const handleEmptyTrash = async (): Promise<boolean> => {
    const result = await emptyTrash();
    if (!result.ok) {
      showActionToast(
        "Не удалось очистить корзину",
        result.error,
        "error",
        TRASH_TOAST_REGION_ID,
      );
      return false;
    }

    browserState.clearItemsLocally();
    await markFolderPathsDirty();

    showActionToast(
      "Корзина очищена",
      "Все объекты в корзине удалены безвозвратно.",
      "success",
      TRASH_TOAST_REGION_ID,
    );

    return true;
  };

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

        <div class="folder-header-actions">
          <Tooltip placement="bottom" gutter={6}>
            <Tooltip.Trigger
              as={Button}
              type="button"
              class="drive-refresh-icon-btn"
              classList={{ "is-loading": browserState.loading() }}
              onClick={() => void browserState.refresh()}
              disabled={browserState.loading()}
              aria-label={
                browserState.loading()
                  ? "Обновляем содержимое диска"
                  : "Обновить диск"
              }
            >
              <span class="material-symbols-rounded" aria-hidden="true">
                sync
              </span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content class="tab-tooltip">
                <Tooltip.Arrow class="tab-tooltip-arrow" />
                <span>
                  {browserState.loading()
                    ? "Обновляем содержимое диска..."
                    : "Обновить диск"}
                </span>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip>

          <SegmentedControl
            class="drive-view-toggle"
            value={viewMode()}
            onChange={(value) => {
              if (
                value === DriveViewMode.List ||
                value === DriveViewMode.Grid
              ) {
                setViewMode(value);
                void setDriveViewModeForScope(scope, value);
              }
            }}
            aria-label="Режим отображения"
          >
            <Tooltip placement="bottom" gutter={4}>
              <Tooltip.Trigger
                as={SegmentedControl.Item}
                class="drive-view-toggle-item"
                value={DriveViewMode.List}
                aria-label="Режим списка"
              >
                <SegmentedControl.ItemInput class="drive-view-toggle-input" />
                <SegmentedControl.ItemLabel class="drive-view-toggle-item-label">
                  <span class="material-symbols-rounded">list</span>
                </SegmentedControl.ItemLabel>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content class="tab-tooltip">
                  <Tooltip.Arrow class="tab-tooltip-arrow" />
                  <span>Список</span>
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip>
            <Tooltip placement="bottom" gutter={4}>
              <Tooltip.Trigger
                as={SegmentedControl.Item}
                class="drive-view-toggle-item"
                value={DriveViewMode.Grid}
                aria-label="Режим плиток"
              >
                <SegmentedControl.ItemInput class="drive-view-toggle-input" />
                <SegmentedControl.ItemLabel class="drive-view-toggle-item-label">
                  <span class="material-symbols-rounded">grid_view</span>
                </SegmentedControl.ItemLabel>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content class="tab-tooltip">
                  <Tooltip.Arrow class="tab-tooltip-arrow" />
                  <span>Плитка</span>
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip>
          </SegmentedControl>
        </div>
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
          <Show when={scope === "my-drive" && driveWriteStatus() === "denied"}>
            <Tooltip placement="bottom" gutter={6}>
              <Tooltip.Trigger
                as={Badge}
                class="drive-access-indicator"
                aria-live="polite"
                tabIndex={0}
              >
                <span class="material-symbols-rounded" aria-hidden="true">
                  lock
                </span>
                <span>Только просмотр</span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content class="tab-tooltip">
                  <Tooltip.Arrow class="tab-tooltip-arrow" />
                  <span>
                    Право на изменение не выдано. При действиях записи покажем
                    запрос доступа.
                  </span>
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip>
          </Show>
        </div>
      </header>

      <Show when={isTrashScope}>
        <section class="trash-info-banner" aria-label="Информация о корзине">
          <p class="trash-info-text">
            Объекты в корзине удаляются навсегда через 30 дней после попадания в
            нее.
          </p>
          <Button
            type="button"
            class="trash-empty-btn"
            onClick={() => setIsEmptyTrashDialogOpen(true)}
            disabled={
              browserState.loading() || browserState.items().length === 0
            }
          >
            Очистить корзину
          </Button>
        </section>
      </Show>

      <Show when={isTrashScope}>
        <EmptyTrashDialog
          open={isEmptyTrashDialogOpen()}
          onOpenChange={setIsEmptyTrashDialogOpen}
          onConfirm={handleEmptyTrash}
        />
      </Show>

      <DriveItemsContent
        items={browserState.items()}
        loading={browserState.loading()}
        loadingMore={browserState.loadingMore()}
        hasMore={Boolean(browserState.nextPageToken())}
        onLoadMore={() => void browserState.loadMore()}
        error={browserState.error()}
        viewMode={viewMode()}
        currentFolderId={browserState.currentFolderId()}
        formatDate={props.formatDate}
        formatSize={props.formatSize}
        onItemOpen={onItemDoubleClick}
        onItemMoved={handleItemMoved}
        onItemRenamed={handleItemRenamed}
        onItemTrashed={handleItemTrashed}
        menuConfig={menuConfig()}
        emptyText={
          isSharedScope
            ? "Нет файлов, открытых для вас."
            : isRecentScope
              ? "Недавних файлов пока нет."
              : isStarredScope
                ? "Помеченных файлов пока нет."
                : isTrashScope
                  ? "Корзина пуста."
                  : "В этой папке пока нет файлов и папок."
        }
      />

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

          <DriveWritePermissionDialog
            open={permissionGate.isPermissionDialogOpen()}
            isRequestInProgress={permissionGate.isPermissionRequestInProgress()}
            errorMessage={permissionGate.permissionRequestError()}
            onOpenChange={permissionGate.setIsPermissionDialogOpen}
            onRequestAccess={permissionGate.requestDriveWriteAccess}
          />
        </>
      </Show>

      <Portal>
        <Show when={scope === "my-drive"}>
          <Toast.Region
            class="drive-toast-region"
            regionId={MY_DRIVE_TOAST_REGION_ID}
            limit={4}
          >
            <Toast.List class="drive-toast-list" />
          </Toast.Region>
        </Show>

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

        <Show when={isTrashScope}>
          <Toast.Region
            class="drive-toast-region"
            regionId={TRASH_TOAST_REGION_ID}
            limit={4}
          >
            <Toast.List class="drive-toast-list" />
          </Toast.Region>
        </Show>
      </Portal>
    </section>
  );
}
