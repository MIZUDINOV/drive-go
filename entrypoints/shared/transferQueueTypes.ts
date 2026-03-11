export type TransferDirection = "upload" | "download";

export type TransferSource = "ui" | "context-menu";

export type TransferQueueStatus =
  | "pending"
  | "uploading"
  | "downloading"
  | "error"
  | "cancelled";

export type TransferStrategy = "multipart" | "resumable";

export type TransferQueueItem = {
  id: string;
  direction: TransferDirection;
  source: TransferSource;
  name: string;
  mimeType: string;
  sizeBytes: number;
  parentId: string | null;
  parentName?: string;
  strategy: TransferStrategy;
  status: TransferQueueStatus;
  progressBytes: number;
  createdAt: number;
  updatedAt: number;
  errorMessage?: string;
};

export type TransferHistoryItem = {
  id: string;
  direction: TransferDirection;
  source: TransferSource;
  name: string;
  mimeType: string;
  sizeBytes: number;
  parentId: string | null;
  parentName?: string;
  completedAt: number;
  driveFileId?: string;
};

export type TransferQueueSnapshot = {
  queue: TransferQueueItem[];
  history: TransferHistoryItem[];
};
