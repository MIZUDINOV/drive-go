import type { TransferQueueLifecycleEvent } from "./transferQueueLifecycleEvent";

export function logTransferQueueLifecycleEvent(
  event: TransferQueueLifecycleEvent,
): void {
  const parts = [
    `[TransferQueue][${event.type}]`,
    `jobId=${event.jobId}`,
  ];

  if (event.status) {
    parts.push(`status=${event.status}`);
  }

  if (typeof event.progressPercent === "number") {
    parts.push(`progress=${event.progressPercent}%`);
  }

  if (event.message) {
    parts.push(`message=${event.message}`);
  }

  parts.push(`at=${new Date(event.timestamp).toISOString()}`);

  if (event.type === "failed") {
    console.error(parts.join(" "));
    return;
  }

  console.info(parts.join(" "));
}
