import type { UploadProgress, UploadResult } from "./uploadTypes";

const CHUNK_SIZE = 512 * 1024; // 512 KB
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

type ProgressCallback = (progress: UploadProgress) => void;

async function getAccessToken(): Promise<string> {
  const result = await browser.identity.getAuthToken({ interactive: true });
  if (!result || !result.token) {
    throw new Error("Не удалось получить токен доступа");
  }
  return result.token;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Инициализирует resumable upload сессию
 */
async function initiateResumableUpload(
  file: File,
  parentId: string | null,
  token: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  const metadata = {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    ...(parentId && { parents: [parentId] }),
  };

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": metadata.mimeType,
        "X-Upload-Content-Length": file.size.toString(),
      },
      body: JSON.stringify(metadata),
      signal: abortSignal,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка инициализации загрузки: ${errorText}`);
  }

  const uploadUrl = response.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("Не получен URL для загрузки");
  }

  return uploadUrl;
}

/**
 * Загружает чанк файла
 */
async function uploadChunk(
  uploadUrl: string,
  chunk: Blob,
  start: number,
  fileSize: number,
  token: string,
  abortSignal?: AbortSignal,
): Promise<{ completed: boolean; fileId?: string }> {
  const end = start + chunk.size - 1;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader(
      "Content-Range",
      `bytes ${start}-${end}/${fileSize}`,
    );

    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        xhr.abort();
        reject(new Error("Загрузка отменена"));
      });
    }

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        // Загрузка завершена
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({ completed: true, fileId: response.id });
        } catch {
          reject(new Error("Не удалось разобрать ответ сервера"));
        }
      } else if (xhr.status === 308) {
        // Чанк загружен, продолжить
        resolve({ completed: false });
      } else {
        reject(new Error(`Ошибка загрузки чанка: ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Сетевая ошибка при загрузке чанка"));
    };

    xhr.send(chunk);
  });
}

/**
 * Загружает файл с прогрессом (resumable upload)
 */
export async function uploadFileWithProgress(
  file: File,
  parentId: string | null,
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal,
): Promise<UploadResult> {
  let retries = 0;

  while (retries <= MAX_RETRIES) {
    try {
      const token = await getAccessToken();
      
      // Инициализация сессии
      const uploadUrl = await initiateResumableUpload(
        file,
        parentId,
        token,
        abortSignal,
      );

      let uploadedBytes = 0;

      // Загрузка чанками
      while (uploadedBytes < file.size) {
        const chunk = file.slice(uploadedBytes, uploadedBytes + CHUNK_SIZE);
        
        const result = await uploadChunk(
          uploadUrl,
          chunk,
          uploadedBytes,
          file.size,
          token,
          abortSignal,
        );

        uploadedBytes += chunk.size;

        // Обновление прогресса
        onProgress({
          uploadedBytes,
          totalBytes: file.size,
          progress: Math.round((uploadedBytes / file.size) * 100),
        });

        if (result.completed && result.fileId) {
          return {
            success: true,
            fileId: result.fileId,
            name: file.name,
          };
        }
      }

      throw new Error("Загрузка не завершена корректно");
    } catch (error) {
      if (error instanceof Error && error.message === "Загрузка отменена") {
        return {
          success: false,
          error: "Загрузка отменена",
        };
      }

      retries++;
      if (retries > MAX_RETRIES) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Неизвестная ошибка",
        };
      }

      // Exponential backoff
      await delay(RETRY_DELAY_MS * Math.pow(2, retries - 1));
    }
  }

  return {
    success: false,
    error: "Превышено количество попыток загрузки",
  };
}

/**
 * Загружает маленький файл (<5MB) одним запросом
 */
export async function uploadSmallFile(
  file: File,
  parentId: string | null,
  abortSignal?: AbortSignal,
): Promise<UploadResult> {
  try {
    const token = await getAccessToken();

    const metadata = {
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      ...(parentId && { parents: [parentId] }),
    };

    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    );
    formData.append("file", file);

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        signal: abortSignal,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка загрузки: ${errorText}`);
    }

    const result = await response.json();
    return {
      success: true,
      fileId: result.id,
      name: file.name,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "Загрузка отменена",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    };
  }
}
