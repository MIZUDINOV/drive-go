import { createStore } from "solid-js/store";
import type { UploadTask, UploadStatus } from "./uploadTypes";
import { uploadFileWithProgress, uploadSmallFile } from "./uploadApi";

const SMALL_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

type UploadStore = {
  tasks: UploadTask[];
  isProcessing: boolean;
};

const [uploadStore, setUploadStore] = createStore<UploadStore>({
  tasks: [],
  isProcessing: false,
});

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Добавляет файлы в очередь загрузок
 */
export function addFilesToUploadQueue(
  files: File[],
  parentId: string | null,
): void {
  const newTasks = files.map((file): UploadTask => ({
    id: generateId(),
    file,
    name: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    parentId,
    status: "pending",
    progress: 0,
    uploadedBytes: 0,
    createdAt: Date.now(),
  }));

  setUploadStore("tasks", (tasks) => [...tasks, ...newTasks]);

  // Запускаем обработку очереди
  void processUploadQueue();
}

/**
 * Обрабатывает очередь загрузок последовательно
 */
async function processUploadQueue(): Promise<void> {
  // Если уже обрабатываем, выходим
  if (uploadStore.isProcessing) {
    return;
  }

  setUploadStore("isProcessing", true);

  while (true) {
    // Находим первую pending задачу
    const taskIndex = uploadStore.tasks.findIndex(
      (task) => task.status === "pending",
    );

    if (taskIndex === -1) {
      // Нет задач для загрузки
      break;
    }

    const task = uploadStore.tasks[taskIndex];

    // Обновляем статус на uploading
    setUploadStore("tasks", taskIndex, "status", "uploading");

    // Создаём AbortController для возможности отмены
    const abortController = new AbortController();
    setUploadStore("tasks", taskIndex, "abortController", abortController);

    try {
      let result;

      if (task.size < SMALL_FILE_SIZE) {
        // Маленький файл - загружаем одним запросом
        result = await uploadSmallFile(
          task.file,
          task.parentId,
          abortController.signal,
        );

        // Для маленьких файлов обновляем прогресс сразу на 100%
        setUploadStore("tasks", taskIndex, {
          progress: 100,
          uploadedBytes: task.size,
        });
      } else {
        // Большой файл - загружаем с прогрессом
        result = await uploadFileWithProgress(
          task.file,
          task.parentId,
          (progressInfo) => {
            setUploadStore("tasks", taskIndex, {
              progress: progressInfo.progress,
              uploadedBytes: progressInfo.uploadedBytes,
            });
          },
          abortController.signal,
        );
      }

      if (result.success) {
        setUploadStore("tasks", taskIndex, {
          status: "completed",
          progress: 100,
          uploadedBytes: task.size,
        });
      } else {
        setUploadStore("tasks", taskIndex, {
          status: "error",
          error: result.error,
        });
      }
    } catch (error) {
      setUploadStore("tasks", taskIndex, {
        status: "error",
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    } finally {
      // Удаляем AbortController
      setUploadStore("tasks", taskIndex, "abortController", undefined);
    }
  }

  setUploadStore("isProcessing", false);
}

/**
 * Отменяет задачу загрузки
 */
export function cancelUploadTask(taskId: string): void {
  const taskIndex = uploadStore.tasks.findIndex((task) => task.id === taskId);
  if (taskIndex === -1) return;

  const task = uploadStore.tasks[taskIndex];

  if (task.status === "uploading" && task.abortController) {
    task.abortController.abort();
  }

  setUploadStore("tasks", taskIndex, {
    status: "cancelled",
    error: "Отменено пользователем",
  });
}

/**
 * Удаляет задачу из очереди
 */
export function removeUploadTask(taskId: string): void {
  setUploadStore("tasks", (tasks) => tasks.filter((task) => task.id !== taskId));
}

/**
 * Очищает завершённые/ошибочные/отменённые задачи
 */
export function clearCompletedTasks(): void {
  setUploadStore("tasks", (tasks) =>
    tasks.filter((task) => task.status === "pending" || task.status === "uploading"),
  );
}

/**
 * Повторяет загрузку задачи с ошибкой
 */
export function retryUploadTask(taskId: string): void {
  const taskIndex = uploadStore.tasks.findIndex((task) => task.id === taskId);
  if (taskIndex === -1) return;

  setUploadStore("tasks", taskIndex, {
    status: "pending",
    progress: 0,
    uploadedBytes: 0,
    error: undefined,
  });

  void processUploadQueue();
}

/**
 * Геттеры для доступа к данным
 */
export function getUploadTasks(): UploadTask[] {
  return uploadStore.tasks;
}

export function getUploadTasksCount(): number {
  return uploadStore.tasks.length;
}

export function getActiveUploadsCount(): number {
  return uploadStore.tasks.filter(
    (task) => task.status === "pending" || task.status === "uploading",
  ).length;
}

export function getCompletedUploadsCount(): number {
  return uploadStore.tasks.filter((task) => task.status === "completed").length;
}

export { uploadStore };
