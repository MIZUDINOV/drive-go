export type TransferQueueLifecycleEventType =
  | "enqueued"
  | "claimed"
  | "progress"
  | "cancelled"
  | "retried"
  | "removed"
  | "completed"
  | "failed"
  | "paused";

export type TransferQueueLifecycleEvent = {
  type: TransferQueueLifecycleEventType;
  jobId: string;
  timestamp: number;
  status?: string;
  progressPercent?: number;
  message?: string;
};
