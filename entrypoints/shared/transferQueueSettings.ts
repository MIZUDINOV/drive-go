export type TransferQueueGeneralSettings = {
  backgroundTransfersEnabled: boolean;
};

const STORAGE_KEY = "transfer_queue_general_settings";

export const DEFAULT_TRANSFER_QUEUE_GENERAL_SETTINGS: TransferQueueGeneralSettings =
  {
    backgroundTransfersEnabled: true,
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeSettings(value: unknown): TransferQueueGeneralSettings {
  if (!isRecord(value)) {
    return DEFAULT_TRANSFER_QUEUE_GENERAL_SETTINGS;
  }

  const backgroundTransfersEnabled =
    typeof value.backgroundTransfersEnabled === "boolean"
      ? value.backgroundTransfersEnabled
      : DEFAULT_TRANSFER_QUEUE_GENERAL_SETTINGS.backgroundTransfersEnabled;

  return {
    backgroundTransfersEnabled,
  };
}

export async function getTransferQueueGeneralSettings(): Promise<TransferQueueGeneralSettings> {
  return new Promise((resolve) => {
    browser.storage.local.get([STORAGE_KEY], (result) => {
      resolve(normalizeSettings(result[STORAGE_KEY]));
    });
  });
}

export async function saveTransferQueueGeneralSettings(
  next: Partial<TransferQueueGeneralSettings>,
): Promise<void> {
  const current = await getTransferQueueGeneralSettings();
  const updated: TransferQueueGeneralSettings = {
    ...current,
    ...next,
  };

  return new Promise((resolve) => {
    browser.storage.local.set({ [STORAGE_KEY]: updated }, resolve);
  });
}

export function isTransferQueueGeneralSettingsStorageKey(key: string): boolean {
  return key === STORAGE_KEY;
}
