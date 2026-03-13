import {
  addHistoryItem,
  clearHistoryByDirection,
  deletePayload,
  deleteQueueJob,
  deleteHistoryItem,
  deleteSession,
  getPayloadBlob,
  getQueueJob,
  listHistoryItems,
  listPendingQueueJobs,
  listQueueJobs,
  putPayloadBlob,
  putPayloadChunks,
  putQueueJob,
  updateQueueJob,
} from "./transferQueueDb";
import type {
  TransferHistoryItem,
  TransferQueueItem,
  TransferQueueSnapshot,
  TransferSource,
} from "../../shared/transferQueueTypes";
import { TransferQueueRxOrchestrator } from "./transferQueueRxOrchestrator";
import type { TransferQueueLifecycleEvent } from "./transferQueueLifecycleEvent";
import { reduceTransferQueueItem } from "./transferQueueStateReducer";
import {
  CHUNK_SIZE,
  MAX_CONCURRENT_UPLOADS,
  SMALL_FILE_THRESHOLD_BYTES,
} from "./transferQueueConstants";
import { transferUploadExecutor } from "./transferUploadExecutor";
import { translateCurrentLocale } from "../../shared/i18n/runtime";

const OAUTH_SCOPE_DRIVE_WRITE = "https://www.googleapis.com/auth/drive";

type EnqueueUploadParams = {
  source: TransferSource;
  parentId: string | null;
  name: string;
  mimeType: string;
  blob: Blob;
};

const parentNameCache = new Map<string, string>();

function createTransferId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getAccessToken(): Promise<string> {
  const result = await browser.identity.getAuthToken({
    interactive: true,
    scopes: [OAUTH_SCOPE_DRIVE_WRITE],
  });
  if (!result?.token) {
    throw new Error(translateCurrentLocale("service.error.accessToken"));
  }

  return result.token;
}

async function resolveParentFolderName(
  parentId: string | null,
): Promise<string> {
  if (!parentId || parentId === "root") {
    return translateCurrentLocale("transfers.parent.root");
  }

  const cached = parentNameCache.get(parentId);
  if (cached) {
    return cached;
  }

  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      fields: "id,name,mimeType",
      supportsAllDrives: "true",
    });

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(parentId)}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      return parentId;
    }

    const data = (await response.json()) as { name?: string };
    const resolved = data.name?.trim() || parentId;
    parentNameCache.set(parentId, resolved);
    return resolved;
  } catch {
    return parentId;
  }
}

function splitBlobIntoChunks(blob: Blob): Blob[] {
  const chunks: Blob[] = [];

  for (let offset = 0; offset < blob.size; offset += CHUNK_SIZE) {
    chunks.push(blob.slice(offset, offset + CHUNK_SIZE, blob.type));
  }

  return chunks;
}

class TransferQueueEngine {
  private readonly activeJobs = new Set<string>();

  private readonly activeAbortControllers = new Map<string, AbortController>();

  private readonly rxOrchestrator = new TransferQueueRxOrchestrator({
    runPump: () => this.pump(),
    onDisabled: () => this.abortActiveJobs(),
    onError: (error) => {
      console.error("[TransferQueue] Pump orchestration error", error);
    },
  });

  private isInitialized = false;

  private processingEnabled = true;

  private stateChangedListener: (() => void) | null = null;

  private lifecycleListener:
    | ((event: TransferQueueLifecycleEvent) => void)
    | null = null;

  private readonly lastProgressPercentByJob = new Map<string, number>();

  public setStateChangedListener(listener: (() => void) | null): void {
    this.stateChangedListener = listener;
  }

  public setLifecycleListener(
    listener: ((event: TransferQueueLifecycleEvent) => void) | null,
  ): void {
    this.lifecycleListener = listener;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;

    const existingJobs = await listQueueJobs();
    for (const job of existingJobs) {
      if (job.status === "uploading" || job.status === "downloading") {
        await updateQueueJob(job.id, { status: "pending" });
      }
    }

    this.rxOrchestrator.requestPump();
  }

  public setProcessingEnabled(enabled: boolean): void {
    if (this.processingEnabled === enabled) {
      return;
    }

    this.processingEnabled = enabled;
    this.rxOrchestrator.setProcessingEnabled(enabled);
  }

  public dispose(): void {
    this.rxOrchestrator.dispose();
    this.abortActiveJobs();
    this.lastProgressPercentByJob.clear();
  }

  public async enqueueUpload(
    params: EnqueueUploadParams,
  ): Promise<TransferQueueItem> {
    const now = Date.now();
    const strategy =
      params.blob.size > SMALL_FILE_THRESHOLD_BYTES ? "resumable" : "multipart";
    const parentName = await resolveParentFolderName(params.parentId);

    const job: TransferQueueItem = {
      id: createTransferId(),
      direction: "upload",
      source: params.source,
      name: params.name,
      mimeType: params.mimeType || "application/octet-stream",
      sizeBytes: params.blob.size,
      parentId: params.parentId,
      parentName,
      strategy,
      status: "pending",
      progressBytes: 0,
      createdAt: now,
      updatedAt: now,
    };

    await putQueueJob(job);

    if (strategy === "resumable") {
      const chunks = splitBlobIntoChunks(params.blob);
      await putPayloadChunks(job.id, chunks, job.mimeType);
    } else {
      await putPayloadBlob(job.id, params.blob, job.mimeType);
    }

    this.notifyStateChanged();
    this.emitLifecycleEvent({
      type: "enqueued",
      jobId: job.id,
      timestamp: Date.now(),
      status: job.status,
      message: `${job.strategy}:${job.direction}`,
    });
    this.rxOrchestrator.requestPump();
    return job;
  }

  public async listSnapshot(): Promise<TransferQueueSnapshot> {
    const [queue, history] = await Promise.all([
      listQueueJobs(),
      listHistoryItems(),
    ]);
    return { queue, history };
  }

  public async cancel(jobId: string): Promise<void> {
    const job = await getQueueJob(jobId);
    if (!job) {
      return;
    }

    const activeController = this.activeAbortControllers.get(jobId);
    if (activeController) {
      activeController.abort();
    }

    await this.applyTransition(jobId, {
      type: "cancel",
    });
    this.notifyStateChanged();
    this.emitLifecycleEvent({
      type: "cancelled",
      jobId,
      timestamp: Date.now(),
      status: "cancelled",
      message: "cancel requested by user",
    });
  }

  public async retry(jobId: string): Promise<void> {
    const job = await getQueueJob(jobId);
    if (!job || (job.status !== "error" && job.status !== "cancelled")) {
      return;
    }

    await this.applyTransition(jobId, {
      type: "retry",
    });
    this.notifyStateChanged();
    this.lastProgressPercentByJob.delete(jobId);
    this.emitLifecycleEvent({
      type: "retried",
      jobId,
      timestamp: Date.now(),
      status: "pending",
    });
    this.rxOrchestrator.requestPump();
  }

  public async remove(jobId: string): Promise<void> {
    const queueJob = await getQueueJob(jobId);

    if (queueJob) {
      const activeController = this.activeAbortControllers.get(jobId);
      if (activeController) {
        activeController.abort();
      }

      await deleteQueueJob(jobId);
      await deletePayload(jobId);
      await deleteSession(jobId);
      this.notifyStateChanged();
      this.lastProgressPercentByJob.delete(jobId);
      this.emitLifecycleEvent({
        type: "removed",
        jobId,
        timestamp: Date.now(),
        message: "removed from queue",
      });
      return;
    }

    await deleteHistoryItem(jobId);
    this.notifyStateChanged();
    this.emitLifecycleEvent({
      type: "removed",
      jobId,
      timestamp: Date.now(),
      message: "removed from history",
    });
  }

  public async clearHistory(direction?: "upload" | "download"): Promise<void> {
    await clearHistoryByDirection(direction);
    this.notifyStateChanged();
  }

  private async pump(): Promise<void> {
    if (!this.processingEnabled) {
      return;
    }

    while (this.activeJobs.size < MAX_CONCURRENT_UPLOADS) {
      const nextJobs = await listPendingQueueJobs(MAX_CONCURRENT_UPLOADS * 2);
      const nextJob = nextJobs.find((job) => !this.activeJobs.has(job.id));

      if (!nextJob) {
        break;
      }

      const claimedJob = await updateQueueJob(nextJob.id, {
        ...reduceTransferQueueItem(nextJob, {
          type: "claim",
          direction: nextJob.direction,
        }),
      });

      if (!claimedJob) {
        continue;
      }

      this.activeJobs.add(claimedJob.id);
      this.emitLifecycleEvent({
        type: "claimed",
        jobId: claimedJob.id,
        timestamp: Date.now(),
        status: claimedJob.status,
      });
      void this.processJob(claimedJob).finally(() => {
        this.activeJobs.delete(claimedJob.id);
        this.rxOrchestrator.requestPump();
      });
    }
  }

  private abortActiveJobs(): void {
    for (const controller of this.activeAbortControllers.values()) {
      controller.abort();
    }
  }

  private async processJob(job: TransferQueueItem): Promise<void> {
    const abortController = new AbortController();
    this.activeAbortControllers.set(job.id, abortController);

    try {
      if (job.direction !== "upload") {
        throw new Error(
          "Download pipeline will be added in a future iteration",
        );
      }

      const payload = await getPayloadBlob(job.id);
      if (!payload) {
        throw new Error(
          translateCurrentLocale("transfer.error.payloadNotFound"),
        );
      }

      const onProgress = async (uploadedBytes: number): Promise<void> => {
        await this.applyTransition(job.id, {
          type: "progress",
          progressBytes: uploadedBytes,
        });
        this.notifyStateChanged();

        const safePercent =
          job.sizeBytes > 0
            ? Math.min(
                100,
                Math.max(0, Math.round((uploadedBytes / job.sizeBytes) * 100)),
              )
            : 0;
        const lastPercent = this.lastProgressPercentByJob.get(job.id) ?? -1;
        if (safePercent === 100 || safePercent - lastPercent >= 5) {
          this.lastProgressPercentByJob.set(job.id, safePercent);
          this.emitLifecycleEvent({
            type: "progress",
            jobId: job.id,
            timestamp: Date.now(),
            status: "uploading",
            progressPercent: safePercent,
          });
        }
      };

      const driveFileId = await transferUploadExecutor.executeUpload({
        job,
        payload,
        signal: abortController.signal,
        onProgress,
      });

      const historyItem: TransferHistoryItem = {
        id: job.id,
        direction: "upload",
        source: job.source,
        name: job.name,
        mimeType: job.mimeType,
        sizeBytes: job.sizeBytes,
        parentId: job.parentId,
        parentName: job.parentName,
        completedAt: Date.now(),
        driveFileId,
      };

      await addHistoryItem(historyItem);
      await deleteQueueJob(job.id);
      await deletePayload(job.id);
      await deleteSession(job.id);
      this.notifyStateChanged();
      this.lastProgressPercentByJob.delete(job.id);
      this.emitLifecycleEvent({
        type: "completed",
        jobId: job.id,
        timestamp: Date.now(),
        message: `driveFileId=${driveFileId}`,
      });
    } catch (error: unknown) {
      const isAbortError =
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError");

      if (isAbortError && !this.processingEnabled) {
        await this.applyTransition(job.id, {
          type: "pause",
        });
        this.notifyStateChanged();
        this.emitLifecycleEvent({
          type: "paused",
          jobId: job.id,
          timestamp: Date.now(),
          status: "pending",
          message: "processing disabled",
        });
        return;
      }

      if (isAbortError) {
        const current = await getQueueJob(job.id);
        if (current?.status === "cancelled") {
          return;
        }
      }

      const message =
        error instanceof Error
          ? error.message
          : translateCurrentLocale("service.error.unknown");
      await this.applyTransition(job.id, {
        type: "fail",
        message,
      });
      this.notifyStateChanged();
      this.emitLifecycleEvent({
        type: "failed",
        jobId: job.id,
        timestamp: Date.now(),
        status: "error",
        message,
      });
    } finally {
      this.activeAbortControllers.delete(job.id);
      this.lastProgressPercentByJob.delete(job.id);
    }
  }

  private notifyStateChanged(): void {
    this.stateChangedListener?.();
  }

  private emitLifecycleEvent(event: TransferQueueLifecycleEvent): void {
    this.lifecycleListener?.(event);
  }

  private async applyTransition(
    jobId: string,
    transition:
      | { type: "cancel" }
      | { type: "retry" }
      | { type: "pause" }
      | { type: "fail"; message: string }
      | { type: "progress"; progressBytes: number },
  ): Promise<void> {
    const current = await getQueueJob(jobId);
    if (!current) {
      return;
    }

    try {
      const patch = reduceTransferQueueItem(current, transition);
      await updateQueueJob(jobId, patch);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "invalid transition";
      console.warn(
        `[TransferQueue] Skipping transition for ${jobId}: ${message}`,
      );
    }
  }
}

export const transferQueueEngine = new TransferQueueEngine();
