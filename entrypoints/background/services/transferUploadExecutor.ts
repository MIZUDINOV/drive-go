import { fetchWithRetry } from "./transferHttpRetry";
import { CHUNK_SIZE } from "./transferQueueConstants";
import { getSession, upsertSession } from "./transferQueueDb";
import type { TransferQueueItem } from "../../shared/transferQueueTypes";

type ExecuteUploadParams = {
  job: TransferQueueItem;
  payload: Blob;
  signal: AbortSignal;
  onProgress: (uploadedBytes: number) => Promise<void>;
};

type ResumableProbeResult = {
  nextByte: number;
  completedFileId?: string;
};

async function getAccessToken(): Promise<string> {
  const result = await browser.identity.getAuthToken({ interactive: true });
  if (!result?.token) {
    throw new Error("Не удалось получить токен доступа");
  }

  return result.token;
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

  const response = await fetchWithRetry(() =>
    fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        signal,
      },
    ),
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

  const response = await fetchWithRetry(() =>
    fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type":
            params.mimeType || "application/octet-stream",
          "X-Upload-Content-Length": String(params.sizeBytes),
        },
        body: JSON.stringify(metadata),
        signal,
      },
    ),
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Ошибка инициализации resumable: ${response.status} ${text}`,
    );
  }

  const uploadUrl = response.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("Не получен Location для resumable upload");
  }

  return uploadUrl;
}

async function probeResumableProgress(
  uploadUrl: string,
  totalBytes: number,
  token: string,
  signal: AbortSignal,
): Promise<ResumableProbeResult> {
  const response = await fetchWithRetry(() =>
    fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Length": "0",
        "Content-Range": `bytes */${totalBytes}`,
      },
      signal,
    }),
  );

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
  throw new Error(
    `Ошибка проверки resumable сессии: ${response.status} ${text}`,
  );
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
    const probe = await probeResumableProgress(
      uploadUrl,
      blob.size,
      token,
      signal,
    );
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

    const response = await fetchWithRetry(() =>
      fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "Content-Length": String(chunk.size),
          "Content-Range": `bytes ${nextByte}-${endByte}/${blob.size}`,
        },
        body: chunk,
        signal,
      }),
    );

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
      throw new Error(
        "Сессия resumable upload истекла, попробуйте повторить задачу",
      );
    }

    const text = await response.text();
    throw new Error(`Ошибка chunk upload: ${response.status} ${text}`);
  }

  throw new Error("Resumable upload завершился без file id");
}

class TransferUploadExecutor {
  public async executeUpload(params: ExecuteUploadParams): Promise<string> {
    const { job, payload, signal, onProgress } = params;

    if (job.strategy === "multipart") {
      const token = await getAccessToken();
      return uploadMultipart(
        token,
        {
          blob: payload,
          name: job.name,
          mimeType: job.mimeType,
          parentId: job.parentId,
        },
        signal,
      );
    }

    return uploadResumable(job, payload, signal, onProgress);
  }
}

export const transferUploadExecutor = new TransferUploadExecutor();
