import type { TransferQueueItem } from "../../shared/transferQueueTypes";
import { reduceTransferQueueItem } from "./transferQueueStateReducer";

function createMockJob(status: TransferQueueItem["status"]): TransferQueueItem {
  return {
    id: "mock-job",
    direction: "upload",
    source: "ui",
    name: "mock.bin",
    mimeType: "application/octet-stream",
    sizeBytes: 1024,
    parentId: null,
    strategy: "resumable",
    status,
    progressBytes: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[TransferQueueReducerChecks] ${message}`);
  }
}

export function runTransferQueueStateReducerChecks(): void {
  const claimed = reduceTransferQueueItem(createMockJob("pending"), {
    type: "claim",
    direction: "upload",
  });
  assert(
    claimed.status === "uploading",
    "pending -> claim(upload) must set uploading",
  );

  const retry = reduceTransferQueueItem(createMockJob("error"), {
    type: "retry",
  });
  assert(retry.status === "pending", "error -> retry must set pending");

  const progress = reduceTransferQueueItem(
    { ...createMockJob("uploading"), progressBytes: 100 },
    {
      type: "progress",
      progressBytes: 500,
    },
  );
  assert(
    progress.progressBytes === 500,
    "uploading -> progress should update bytes",
  );

  const paused = reduceTransferQueueItem(createMockJob("uploading"), {
    type: "pause",
  });
  assert(paused.status === "pending", "uploading -> pause must set pending");

  let illegalTransitionThrown = false;
  try {
    reduceTransferQueueItem(createMockJob("pending"), {
      type: "retry",
    });
  } catch {
    illegalTransitionThrown = true;
  }

  assert(illegalTransitionThrown, "illegal transition must throw");
}
