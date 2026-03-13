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
import { useI18n } from "../../shared/i18n";
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
  titleKey: Parameters<ReturnType<typeof useI18n>["t"]>[0];
  hintKey: Parameters<ReturnType<typeof useI18n>["t"]>[0];
};

const savePathRows: SavePathRow[] = [
  {
    key: "screenshotFolderId",
    titleKey: "savePaths.row.screenshot.title",
    hintKey: "savePaths.row.screenshot.hint",
  },
  {
    key: "selectionTextFolderId",
    titleKey: "savePaths.row.selectionText.title",
    hintKey: "savePaths.row.selectionText.hint",
  },
  {
    key: "imageFolderId",
    titleKey: "savePaths.row.image.title",
    hintKey: "savePaths.row.image.hint",
  },
  {
    key: "pdfFolderId",
    titleKey: "savePaths.row.pdf.title",
    hintKey: "savePaths.row.pdf.hint",
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
  const { t } = useI18n();
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
        error instanceof Error
          ? error.message
          : t("savePaths.errors.loadFolders");
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
        error instanceof Error ? error.message : t("savePaths.errors.save");
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
      return t("savePaths.rootFolder");
    }

    return folderNameById().get(value) ?? t("savePaths.folderUnavailable");
  };

  return (
    <div class="options-section">
      <h2>{t("savePaths.title")}</h2>
      <p class="options-section-description">{t("savePaths.description")}</p>

      <div class="options-settings-block">
        <h3>{t("savePaths.routes.title")}</h3>

        <Show
          when={!isLoading()}
          fallback={
            <div
              class="options-loading-skeletons"
              aria-label={t("savePaths.loadingAria")}
            >
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
                  <div>{t(row.titleKey)}</div>
                  <div class="options-setting-hint">{t(row.hintKey)}</div>
                </div>

                <OptionsSelect<string>
                  ariaLabel={t(row.titleKey)}
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
