import {
  addHistoryItem,
  clearHistoryByDirection,
  deletePayload,
  deleteQueueJob,
  deleteHistoryItem,
  deleteSession,
  getPayloadBlob,
  getQueueJob,
  getSession,
  listHistoryItems,
  listPendingQueueJobs,
  listQueueJobs,
  putPayloadBlob,
  putPayloadChunks,
  putQueueJob,
  updateQueueJob,
  upsertSession,
} from "./transferQueueDb";
import type {
  TransferHistoryItem,
  TransferQueueItem,
  TransferQueueSnapshot,
  TransferSource,
} from "../../shared/transferQueueTypes";

const SMALL_FILE_THRESHOLD_BYTES = 5 * 1024 * 1024;
const CHUNK_SIZE = 512 * 1024;
const MAX_CONCURRENT_UPLOADS = 2;
const ROOT_FOLDER_LABEL = "Корневая папка";

type EnqueueUploadParams = {
  source: TransferSource;
  parentId: string | null;
  name: string;
  mimeType: string;
  blob: Blob;
};

const parentNameCache = new Map<string, string>();

function createTransferId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getAccessToken(): Promise<string> {
  const result = await browser.identity.getAuthToken({ interactive: true });
  if (!result?.token) {
    throw new Error("Не удалось получить токен доступа");
  }

  return result.token;
}

async function resolveParentFolderName(
  parentId: string | null,
): Promise<string> {
  if (!parentId || parentId === "root") {
    return ROOT_FOLDER_LABEL;
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

async function uploadMultipart(
  token: string,
  params: {
    blob: Blob;
    name: string;
    mimeType: string;
    parentId: string | null;
  },
  signal: AbortSignal,
): Promise<string> {
  const metadata = {
    name: params.name,
    mimeType: params.mimeType || "application/octet-stream",
    ...(params.parentId ? { parents: [params.parentId] } : {}),
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  formData.append("file", params.blob, params.name);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      signal,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка загрузки: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { id?: string };
  if (!data.id) {
    throw new Error("Drive API не вернул id загруженного файла");
  }

  return data.id;
}

async function createResumableSession(
  token: string,
  params: {
    name: string;
    mimeType: string;
    sizeBytes: number;
    parentId: string | null;
  },
  signal: AbortSignal,
): Promise<string> {
  const metadata = {
    name: params.name,
    mimeType: params.mimeType || "application/octet-stream",
    ...(params.parentId ? { parents: [params.parentId] } : {}),
  };

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": params.mimeType || "application/octet-stream",
        "X-Upload-Content-Length": String(params.sizeBytes),
      },
      body: JSON.stringify(metadata),
      signal,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка инициализации resumable: ${response.status} ${text}`);
  }

  const uploadUrl = response.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("Не получен Location для resumable upload");
  }

  return uploadUrl;
}

type ResumableProbeResult = {
  nextByte: number;
  completedFileId?: string;
};

async function probeResumableProgress(
  uploadUrl: string,
  totalBytes: number,
  token: string,
  signal: AbortSignal,
): Promise<ResumableProbeResult> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Length": "0",
      "Content-Range": `bytes */${totalBytes}`,
    },
    signal,
  });

  if (response.status === 200 || response.status === 201) {
    const data = (await response.json()) as { id?: string };
    return {
      nextByte: totalBytes,
      completedFileId: data.id,
    };
  }

  if (response.status === 308) {
    const range = response.headers.get("Range");
    if (!range) {
      return { nextByte: 0 };
    }

    const match = /bytes=0-(\d+)/i.exec(range);
    if (!match) {
      return { nextByte: 0 };
    }

    const lastUploadedByte = Number(match[1]);
    if (!Number.isFinite(lastUploadedByte) || lastUploadedByte < 0) {
      return { nextByte: 0 };
    }

    return { nextByte: lastUploadedByte + 1 };
  }

  if (response.status === 404) {
    return { nextByte: -1 };
  }

  const text = await response.text();
  throw new Error(`Ошибка проверки resumable сессии: ${response.status} ${text}`);
}

async function uploadResumable(
  job: TransferQueueItem,
  blob: Blob,
  signal: AbortSignal,
  onProgress: (uploadedBytes: number) => Promise<void>,
): Promise<string> {
  const token = await getAccessToken();
  const existingSession = await getSession(job.id);

  let uploadUrl = existingSession?.uploadUrl;
  let nextByte = existingSession?.nextByte ?? 0;

  if (!uploadUrl) {
    uploadUrl = await createResumableSession(
      token,
      {
        name: job.name,
        mimeType: job.mimeType,
        sizeBytes: blob.size,
        parentId: job.parentId,
      },
      signal,
    );

    await upsertSession({
      jobId: job.id,
      uploadUrl,
      nextByte: 0,
      updatedAt: Date.now(),
    });
  } else {
    const probe = await probeResumableProgress(uploadUrl, blob.size, token, signal);
    if (probe.completedFileId) {
      await onProgress(blob.size);
      return probe.completedFileId;
    }

    if (probe.nextByte < 0) {
      uploadUrl = await createResumableSession(
        token,
        {
          name: job.name,
          mimeType: job.mimeType,
          sizeBytes: blob.size,
          parentId: job.parentId,
        },
        signal,
      );
      nextByte = 0;
      await upsertSession({
        jobId: job.id,
        uploadUrl,
        nextByte,
        updatedAt: Date.now(),
      });
    } else {
      nextByte = probe.nextByte;
      await onProgress(nextByte);
      await upsertSession({
        jobId: job.id,
        uploadUrl,
        nextByte,
        updatedAt: Date.now(),
      });
    }
  }

  while (nextByte < blob.size) {
    const endByte = Math.min(nextByte + CHUNK_SIZE, blob.size) - 1;
    const chunk = blob.slice(nextByte, endByte + 1, blob.type);

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(chunk.size),
        "Content-Range": `bytes ${nextByte}-${endByte}/${blob.size}`,
      },
      body: chunk,
      signal,
    });

    if (response.status === 200 || response.status === 201) {
      const data = (await response.json()) as { id?: string };
      if (!data.id) {
        throw new Error("Drive API не вернул id после resumable upload");
      }

      await onProgress(blob.size);
      return data.id;
    }

    if (response.status === 308) {
      nextByte = endByte + 1;
      await onProgress(nextByte);
      await upsertSession({
        jobId: job.id,
        uploadUrl,
        nextByte,
        updatedAt: Date.now(),
      });
      continue;
    }

    if (response.status === 404) {
      throw new Error("Сессия resumable upload истекла, попробуйте повторить задачу");
    }

    const text = await response.text();
    throw new Error(`Ошибка chunk upload: ${response.status} ${text}`);
  }

  throw new Error("Resumable upload завершился без file id");
}

class TransferQueueEngine {
  private readonly activeJobs = new Set<string>();

  private readonly activeAbortControllers = new Map<string, AbortController>();

  private isInitialized = false;

  private processingEnabled = true;

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

    await this.pump();
  }

  public setProcessingEnabled(enabled: boolean): void {
    if (this.processingEnabled === enabled) {
      return;
    }

    this.processingEnabled = enabled;

    if (!enabled) {
      for (const controller of this.activeAbortControllers.values()) {
        controller.abort();
      }
      return;
    }

    void this.pump();
  }

  public async enqueueUpload(params: EnqueueUploadParams): Promise<TransferQueueItem> {
    const now = Date.now();
    const strategy = params.blob.size > SMALL_FILE_THRESHOLD_BYTES ? "resumable" : "multipart";
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

    await this.pump();
    return job;
  }

  public async listSnapshot(): Promise<TransferQueueSnapshot> {
    const [queue, history] = await Promise.all([listQueueJobs(), listHistoryItems()]);
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

    await updateQueueJob(jobId, {
      status: "cancelled",
      errorMessage: "Отменено пользователем",
    });
  }

  public async retry(jobId: string): Promise<void> {
    const job = await getQueueJob(jobId);
    if (!job || (job.status !== "error" && job.status !== "cancelled")) {
      return;
    }

    await updateQueueJob(jobId, {
      status: "pending",
      progressBytes: 0,
      errorMessage: undefined,
    });
    await this.pump();
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
      return;
    }

    await deleteHistoryItem(jobId);
  }

  public async clearHistory(direction?: "upload" | "download"): Promise<void> {
    await clearHistoryByDirection(direction);
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
        status: nextJob.direction === "upload" ? "uploading" : "downloading",
        errorMessage: undefined,
      });

      if (!claimedJob) {
        continue;
      }

      this.activeJobs.add(claimedJob.id);
      void this.processJob(claimedJob).finally(() => {
        this.activeJobs.delete(claimedJob.id);
        void this.pump();
      });
    }
  }

  private async processJob(job: TransferQueueItem): Promise<void> {
    const abortController = new AbortController();
    this.activeAbortControllers.set(job.id, abortController);

    try {
      if (job.direction !== "upload") {
        throw new Error("Download pipeline будет добавлен в следующей итерации");
      }

      const payload = await getPayloadBlob(job.id);
      if (!payload) {
        throw new Error("Не найден payload задачи в IndexedDB");
      }

      const onProgress = async (uploadedBytes: number): Promise<void> => {
        await updateQueueJob(job.id, {
          progressBytes: Math.min(uploadedBytes, job.sizeBytes),
        });
      };

      const driveFileId =
        job.strategy === "multipart"
          ? await uploadMultipart(
              await getAccessToken(),
              {
                blob: payload,
                name: job.name,
                mimeType: job.mimeType,
                parentId: job.parentId,
              },
              abortController.signal,
            )
          : await uploadResumable(job, payload, abortController.signal, onProgress);

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
    } catch (error: unknown) {
      const isAbortError =
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError");

      if (isAbortError && !this.processingEnabled) {
        await updateQueueJob(job.id, {
          status: "pending",
          errorMessage: undefined,
        });
        return;
      }

      if (isAbortError) {
        const current = await getQueueJob(job.id);
        if (current?.status === "cancelled") {
          return;
        }
      }

      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      await updateQueueJob(job.id, {
        status: "error",
        errorMessage: message,
      });
    } finally {
      this.activeAbortControllers.delete(job.id);
    }
  }
}

export const transferQueueEngine = new TransferQueueEngine();
