import {
  MESSAGE_TRANSFER_QUEUE_CANCEL,
  MESSAGE_TRANSFER_QUEUE_CLEAR_HISTORY,
  MESSAGE_TRANSFER_QUEUE_ENQUEUE_UPLOAD,
  MESSAGE_TRANSFER_QUEUE_LIST,
  MESSAGE_TRANSFER_QUEUE_REMOVE,
  MESSAGE_TRANSFER_QUEUE_RETRY,
  type TransferQueueCancelMessage,
  type TransferQueueEnqueueUploadMessage,
  type TransferQueueListMessage,
  type TransferQueueListResponse,
  type TransferQueueRemoveMessage,
  type TransferQueueRetryMessage,
} from "../../shared/transferQueueMessages";

function isTransferQueueListResponse(value: unknown): value is TransferQueueListResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Array.isArray(record.queue) && Array.isArray(record.history);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export async function enqueueFilesForUpload(
  files: File[],
  parentId: string | null,
): Promise<void> {
  for (const file of files) {
    const bytes = await file.arrayBuffer();

    const message: TransferQueueEnqueueUploadMessage = {
      type: MESSAGE_TRANSFER_QUEUE_ENQUEUE_UPLOAD,
      payload: {
        source: "ui",
        parentId,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        base64: arrayBufferToBase64(bytes),
      },
    };

    await browser.runtime.sendMessage(message);
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
