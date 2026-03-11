import type {
  TransferHistoryItem,
  TransferQueueItem,
  TransferSource,
} from "./transferQueueTypes";

export const MESSAGE_TRANSFER_QUEUE_ENQUEUE_UPLOAD =
  "gdrivego.transfer-queue.enqueue-upload";
export const MESSAGE_TRANSFER_QUEUE_LIST = "gdrivego.transfer-queue.list";
export const MESSAGE_TRANSFER_QUEUE_CANCEL = "gdrivego.transfer-queue.cancel";
export const MESSAGE_TRANSFER_QUEUE_RETRY = "gdrivego.transfer-queue.retry";
export const MESSAGE_TRANSFER_QUEUE_REMOVE = "gdrivego.transfer-queue.remove";
export const MESSAGE_TRANSFER_QUEUE_CLEAR_HISTORY =
  "gdrivego.transfer-queue.clear-history";
export const PORT_TRANSFER_QUEUE_SIDEPANEL_SESSION =
  "gdrivego.transfer-queue.sidepanel-session";

export type TransferQueueEnqueueUploadMessage = {
  type: typeof MESSAGE_TRANSFER_QUEUE_ENQUEUE_UPLOAD;
  payload: {
    source: TransferSource;
    parentId: string | null;
    name: string;
    mimeType: string;
    stagingId?: string;
    base64?: string;
  };
};

export type TransferQueueListMessage = {
  type: typeof MESSAGE_TRANSFER_QUEUE_LIST;
};

export type TransferQueueCancelMessage = {
  type: typeof MESSAGE_TRANSFER_QUEUE_CANCEL;
  payload: {
    id: string;
  };
};

export type TransferQueueRetryMessage = {
  type: typeof MESSAGE_TRANSFER_QUEUE_RETRY;
  payload: {
    id: string;
  };
};

export type TransferQueueRemoveMessage = {
  type: typeof MESSAGE_TRANSFER_QUEUE_REMOVE;
  payload: {
    id: string;
  };
};

export type TransferQueueClearHistoryMessage = {
  type: typeof MESSAGE_TRANSFER_QUEUE_CLEAR_HISTORY;
  payload: {
    direction?: "upload" | "download";
  };
};

export type TransferQueueMessage =
  | TransferQueueEnqueueUploadMessage
  | TransferQueueListMessage
  | TransferQueueCancelMessage
  | TransferQueueRetryMessage
  | TransferQueueRemoveMessage
  | TransferQueueClearHistoryMessage;

export type TransferQueueListResponse = {
  queue: TransferQueueItem[];
  history: TransferHistoryItem[];
};
