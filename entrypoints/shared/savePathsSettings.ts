export type SaveTarget = "screenshot" | "selectionText" | "pdf" | "image";

export type SavePathsSettings = {
  screenshotFolderId: string | null;
  selectionTextFolderId: string | null;
  pdfFolderId: string | null;
  imageFolderId: string | null;
};

const STORAGE_KEY = "save_paths_settings";
const FOLDERS_DIRTY_KEY = "save_paths_folders_dirty";

export const DEFAULT_SAVE_PATHS_SETTINGS: SavePathsSettings = {
  screenshotFolderId: null,
  selectionTextFolderId: null,
  pdfFolderId: null,
  imageFolderId: null,
};

export async function getSavePathsSettings(): Promise<SavePathsSettings> {
  return new Promise((resolve) => {
    browser.storage.local.get([STORAGE_KEY], (result) => {
      const stored = result[STORAGE_KEY] as Partial<SavePathsSettings> | undefined;
      resolve({ ...DEFAULT_SAVE_PATHS_SETTINGS, ...(stored || {}) });
    });
  });
}

export async function saveSavePathsSettings(
  next: Partial<SavePathsSettings>,
): Promise<void> {
  const current = await getSavePathsSettings();
  const updated = { ...current, ...next };

  return new Promise((resolve) => {
    browser.storage.local.set({ [STORAGE_KEY]: updated }, resolve);
  });
}

export async function getTargetParentFolderId(
  target: SaveTarget,
): Promise<string | null> {
  const settings = await getSavePathsSettings();

  if (target === "screenshot") return settings.screenshotFolderId;
  if (target === "selectionText") return settings.selectionTextFolderId;
  if (target === "pdf") return settings.pdfFolderId;
  return settings.imageFolderId;
}

export async function markSavePathsFoldersDirty(): Promise<void> {
  return new Promise((resolve) => {
    browser.storage.local.set({ [FOLDERS_DIRTY_KEY]: true }, resolve);
  });
}

export async function consumeSavePathsFoldersDirtyFlag(): Promise<boolean> {
  return new Promise((resolve) => {
    browser.storage.local.get([FOLDERS_DIRTY_KEY], (result) => {
      const isDirty = Boolean(result[FOLDERS_DIRTY_KEY]);

      if (!isDirty) {
        resolve(false);
        return;
      }

      browser.storage.local.set({ [FOLDERS_DIRTY_KEY]: false }, () => {
        resolve(true);
      });
    });
  });
}
