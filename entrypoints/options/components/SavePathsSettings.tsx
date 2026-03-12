import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onMount,
} from "solid-js";
import { Skeleton } from "@kobalte/core/skeleton";
import { Alert } from "@kobalte/core/alert";
import type { DriveApiFile } from "../../sidepanel/components/drive/driveTypes";
import { listMyOwnedFolders } from "../../sidepanel/services/driveApi";
import {
  consumeSavePathsFoldersDirtyFlag,
  getSavePathsSettings,
  saveSavePathsSettings,
  type SavePathsSettings,
} from "../../shared/savePathsSettings";
import { OptionsSelect } from "./OptionsSelect";

type SavePathField = keyof SavePathsSettings;

type SavePathRow = {
  key: SavePathField;
  title: string;
  hint: string;
};

const savePathRows: SavePathRow[] = [
  {
    key: "screenshotFolderId",
    title: "Папка для скриншотов",
    hint: "Если не выбрано, файлы сохраняются в корень Drive.",
  },
  {
    key: "selectionTextFolderId",
    title: "Папка для выделенного текста",
    hint: "Если не выбрано, txt-файлы сохраняются в корень Drive.",
  },
  {
    key: "imageFolderId",
    title: "Папка для картинок",
    hint: "Если не выбрано, изображения сохраняются в корень Drive.",
  },
  {
    key: "pdfFolderId",
    title: "Папка для PDF",
    hint: "Подготовлено заранее: сохранение PDF будет добавлено позже.",
  },
];

const DEFAULT_SETTINGS: SavePathsSettings = {
  screenshotFolderId: null,
  selectionTextFolderId: null,
  imageFolderId: null,
  pdfFolderId: null,
};

// Кэш живет, пока открыта страница настроек (контекст options).
let cachedOwnedFolders: DriveApiFile[] | null = null;
let cachedOwnedFoldersRequest: Promise<DriveApiFile[]> | null = null;

async function getOwnedFoldersCached(
  forceRefresh = false,
): Promise<DriveApiFile[]> {
  if (!forceRefresh && cachedOwnedFolders) {
    return cachedOwnedFolders;
  }

  if (!cachedOwnedFoldersRequest) {
    cachedOwnedFoldersRequest = listMyOwnedFolders()
      .then((items) => {
        cachedOwnedFolders = items;
        return items;
      })
      .finally(() => {
        cachedOwnedFoldersRequest = null;
      });
  }

  return cachedOwnedFoldersRequest;
}

export function SavePathsSettings() {
  const [settings, setSettings] =
    createSignal<SavePathsSettings>(DEFAULT_SETTINGS);
  const [folders, setFolders] = createSignal<DriveApiFile[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  let isInitialSync = true;

  const folderNameById = createMemo(() => {
    const map = new Map<string, string>();
    for (const folder of folders()) {
      map.set(folder.id, folder.name);
    }
    return map;
  });

  const baseOptions = createMemo(() => [
    "root",
    ...folders().map((folder) => folder.id),
  ]);

  onMount(async () => {
    try {
      const [loadedSettings, shouldRefreshFolders] = await Promise.all([
        getSavePathsSettings(),
        consumeSavePathsFoldersDirtyFlag(),
      ]);

      const loadedFolders = await getOwnedFoldersCached(shouldRefreshFolders);

      setSettings(loadedSettings);
      setFolders(loadedFolders);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Не удалось загрузить папки";
      setSaveError(message);
    } finally {
      setIsLoading(false);
    }
  });

  createEffect(() => {
    const nextSettings = settings();

    if (isInitialSync) {
      isInitialSync = false;
      return;
    }

    setSaveError(null);
    void saveSavePathsSettings(nextSettings).catch((error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось сохранить настройки";
      setSaveError(message);
    });
  });

  const updateField = (field: SavePathField, value: string) => {
    const folderId = value === "root" ? null : value;
    setSettings((prev) => ({
      ...prev,
      [field]: folderId,
    }));
  };

  const getOptionsForField = (field: SavePathField): string[] => {
    const currentValue = settings()[field];
    const options = baseOptions();

    if (currentValue && !options.includes(currentValue)) {
      return [...options, currentValue];
    }

    return options;
  };

  const getFolderLabel = (value: string): string => {
    if (value === "root") {
      return "Корневая папка";
    }

    return folderNameById().get(value) ?? "Папка недоступна";
  };

  return (
    <div class="options-section">
      <h2>Пути сохранения</h2>
      <p class="options-section-description">
        Выберите папки Google Drive для автосохранения из контекстного меню.
      </p>

      <div class="options-settings-block">
        <h3>Маршруты сохранения</h3>

        <Show
          when={!isLoading()}
          fallback={
            <div class="options-loading-skeletons" aria-label="Загрузка папок">
              <Skeleton class="options-skeleton" height={52} radius={8} />
              <Skeleton class="options-skeleton" height={52} radius={8} />
              <Skeleton class="options-skeleton" height={52} radius={8} />
              <Skeleton class="options-skeleton" height={52} radius={8} />
            </div>
          }
        >
          <For each={savePathRows}>
            {(row) => (
              <div class="options-setting-row">
                <div class="options-setting-label">
                  <div>{row.title}</div>
                  <div class="options-setting-hint">{row.hint}</div>
                </div>

                <OptionsSelect<string>
                  ariaLabel={row.title}
                  value={settings()[row.key] ?? "root"}
                  options={getOptionsForField(row.key)}
                  getLabel={getFolderLabel}
                  onChange={(value) => updateField(row.key, value)}
                />
              </div>
            )}
          </For>
        </Show>

        <Show when={saveError()}>
          <Alert
            class="options-alert options-alert-error"
            style="margin-top: 12px;"
          >
            <span class="material-symbols-rounded" aria-hidden="true">
              error
            </span>
            <span>{saveError()}</span>
          </Alert>
        </Show>
      </div>
    </div>
  );
}
