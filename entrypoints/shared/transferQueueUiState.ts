const STORAGE_KEY_TRANSFER_POPOVER_SEEN_UP_TO = "transfer_popover_seen_up_to";

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.floor(value);
}

export async function getTransferPopoverSeenUpTo(): Promise<number> {
  return new Promise((resolve) => {
    browser.storage.local.get([STORAGE_KEY_TRANSFER_POPOVER_SEEN_UP_TO], (result) => {
      const normalized = normalizeTimestamp(result[STORAGE_KEY_TRANSFER_POPOVER_SEEN_UP_TO]);
      if (normalized !== null) {
        resolve(normalized);
        return;
      }

      const now = Date.now();
      browser.storage.local.set({ [STORAGE_KEY_TRANSFER_POPOVER_SEEN_UP_TO]: now }, () => {
        resolve(now);
      });
    });
  });
}

export async function setTransferPopoverSeenUpTo(timestamp: number): Promise<void> {
  const normalized = normalizeTimestamp(timestamp) ?? Date.now();

  return new Promise((resolve) => {
    browser.storage.local.set(
      { [STORAGE_KEY_TRANSFER_POPOVER_SEEN_UP_TO]: normalized },
      () => resolve(),
    );
  });
}
