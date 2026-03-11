import {
  MESSAGE_TRANSFER_QUEUE_SNAPSHOT_UPDATED,
  MESSAGE_TRANSFER_QUEUE_CANCEL,
  MESSAGE_TRANSFER_QUEUE_CLEAR_HISTORY,
  MESSAGE_TRANSFER_QUEUE_ENQUEUE_UPLOAD,
  MESSAGE_TRANSFER_QUEUE_LIST,
  MESSAGE_TRANSFER_QUEUE_REMOVE,
  MESSAGE_TRANSFER_QUEUE_RETRY,
  PORT_TRANSFER_QUEUE_UPDATES,
  type TransferQueueSnapshotUpdatedPortMessage,
  type TransferQueueCancelMessage,
  type TransferQueueEnqueueUploadMessage,
  type TransferQueueEnqueueUploadResponse,
  type TransferQueueListMessage,
  type TransferQueueListResponse,
  type TransferQueueRemoveMessage,
  type TransferQueueRetryMessage,
} from "../../shared/transferQueueMessages";
import { putStagedTransferBlob } from "../../shared/transferQueueStagingDb";

function isTransferQueueListResponse(value: unknown): value is TransferQueueListResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Array.isArray(record.queue) && Array.isArray(record.history);
}

function createStagingId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isTransferQueueEnqueueUploadResponse(
  value: unknown,
): value is TransferQueueEnqueueUploadResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.ok !== "boolean") {
    return false;
  }

  if (record.jobId !== undefined && typeof record.jobId !== "string") {
    return false;
  }

  if (record.deduped !== undefined && typeof record.deduped !== "boolean") {
    return false;
  }

  if (
    record.existingJobId !== undefined &&
    typeof record.existingJobId !== "string"
  ) {
    return false;
  }

  return true;
}

export async function enqueueFilesForUpload(
  files: File[],
  parentId: string | null,
): Promise<void> {
  for (const file of files) {
    const stagingId = createStagingId();
    await putStagedTransferBlob(
      stagingId,
      file,
      file.type || "application/octet-stream",
    );

    const message: TransferQueueEnqueueUploadMessage = {
      type: MESSAGE_TRANSFER_QUEUE_ENQUEUE_UPLOAD,
      payload: {
        source: "ui",
        parentId,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        stagingId,
      },
    };

    const response = await browser.runtime.sendMessage(message);
    if (!isTransferQueueEnqueueUploadResponse(response) || !response.ok) {
      throw new Error("Некорректный ответ enqueue-upload");
    }

    if (response.deduped && !response.existingJobId) {
      await listTransferQueueSnapshot();
    }
  }
}

export async function listTransferQueueSnapshot(): Promise<TransferQueueListResponse> {
  const message: TransferQueueListMessage = {
    type: MESSAGE_TRANSFER_QUEUE_LIST,
  };

  try {
    const response = await browser.runtime.sendMessage(message);
    if (!isTransferQueueListResponse(response)) {
      return { queue: [], history: [] };
    }

    return response;
  } catch {
    return { queue: [], history: [] };
  }
}

export async function cancelTransferQueueItem(id: string): Promise<void> {
  const message: TransferQueueCancelMessage = {
    type: MESSAGE_TRANSFER_QUEUE_CANCEL,
    payload: { id },
  };

  await browser.runtime.sendMessage(message);
}

export async function retryTransferQueueItem(id: string): Promise<void> {
  const message: TransferQueueRetryMessage = {
    type: MESSAGE_TRANSFER_QUEUE_RETRY,
    payload: { id },
  };

  await browser.runtime.sendMessage(message);
}

export async function removeTransferQueueItem(id: string): Promise<void> {
  const message: TransferQueueRemoveMessage = {
    type: MESSAGE_TRANSFER_QUEUE_REMOVE,
    payload: { id },
  };

  await browser.runtime.sendMessage(message);
}

export async function clearTransferHistory(
  direction?: "upload" | "download",
): Promise<void> {
  const message = {
    type: MESSAGE_TRANSFER_QUEUE_CLEAR_HISTORY,
    payload: { direction },
  };

  await browser.runtime.sendMessage(message);
}

export function subscribeTransferQueueSnapshots(
  onSnapshot: (snapshot: TransferQueueListResponse) => void,
): () => void {
  const port = browser.runtime.connect({
    name: PORT_TRANSFER_QUEUE_UPDATES,
  });

  const listener = (message: unknown) => {
    const update = message as TransferQueueSnapshotUpdatedPortMessage;
    if (update?.type !== MESSAGE_TRANSFER_QUEUE_SNAPSHOT_UPDATED) {
      return;
    }

    if (!isTransferQueueListResponse(update.payload)) {
      return;
    }

    onSnapshot(update.payload);
  };

  port.onMessage.addListener(listener);

  return () => {
    port.onMessage.removeListener(listener);
    port.disconnect();
  };
}
