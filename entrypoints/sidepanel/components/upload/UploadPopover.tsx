import { For, Show } from "solid-js";
import { Popover } from "@kobalte/core/popover";
import { Button } from "@kobalte/core/button";
import type { UploadTask } from "../../services/uploadTypes";
import {
  uploadStore,
  cancelUploadTask,
  removeUploadTask,
  clearCompletedTasks,
  retryUploadTask,
} from "../../services/uploadManager";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getStatusText(status: UploadTask["status"]): string {
  switch (status) {
    case "pending":
      return "В очереди";
    case "uploading":
      return "Загрузка...";
    case "completed":
      return "Завершено";
    case "error":
      return "Ошибка";
    case "cancelled":
      return "Отменено";
  }
}

function getStatusClass(status: UploadTask["status"]): string {
  switch (status) {
    case "pending":
      return "upload-task-pending";
    case "uploading":
      return "upload-task-uploading";
    case "completed":
      return "upload-task-completed";
    case "error":
      return "upload-task-error";
    case "cancelled":
      return "upload-task-cancelled";
  }
}

type UploadTaskItemProps = {
  task: UploadTask;
};

function UploadTaskItem(props: UploadTaskItemProps) {
  const canCancel = () =>
    props.task.status === "pending" || props.task.status === "uploading";
  const canRetry = () =>
    props.task.status === "error" || props.task.status === "cancelled";
  const canRemove = () =>
    props.task.status === "completed" ||
    props.task.status === "error" ||
    props.task.status === "cancelled";

  return (
    <div class="upload-task-item">
      <div class="upload-task-info">
        <div class="upload-task-name" title={props.task.name}>
          {props.task.name}
        </div>
        <div class="upload-task-details">
          <span class={getStatusClass(props.task.status)}>
            {getStatusText(props.task.status)}
          </span>
          <Show when={props.task.status === "uploading"}>
            <span class="upload-task-progress-text">
              {formatBytes(props.task.uploadedBytes)} / {formatBytes(props.task.size)}
            </span>
          </Show>
          <Show when={props.task.status === "error" && props.task.error}>
            <span class="upload-task-error-text" title={props.task.error}>
              {props.task.error}
            </span>
          </Show>
        </div>
        <Show when={props.task.status === "uploading"}>
          <div class="upload-task-progress-bar">
            <div
              class="upload-task-progress-fill"
              style={{ width: `${props.task.progress}%` }}
            />
          </div>
        </Show>
      </div>

      <div class="upload-task-actions">
        <Show when={canCancel()}>
          <Button
            class="upload-task-action-btn"
            type="button"
            onClick={() => cancelUploadTask(props.task.id)}
            title="Отменить"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M6 18L18 6"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </Button>
        </Show>
        <Show when={canRetry()}>
          <Button
            class="upload-task-action-btn"
            type="button"
            onClick={() => retryUploadTask(props.task.id)}
            title="Повторить"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 12a8 8 0 0 1 14.3-4.9M20 12a8 8 0 0 1-14.3 4.9"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
              <path
                d="M18 7l.3 5 5-.3M6 17l-.3-5-5 .3"
                fill="currentColor"
              />
            </svg>
          </Button>
        </Show>
        <Show when={canRemove()}>
          <Button
            class="upload-task-action-btn"
            type="button"
            onClick={() => removeUploadTask(props.task.id)}
            title="Удалить"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M6 18L18 6"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </Button>
        </Show>
      </div>
    </div>
  );
}

export function UploadPopover() {
  const hasCompletedTasks = () =>
    uploadStore.tasks.some(
      (task) =>
        task.status === "completed" ||
        task.status === "error" ||
        task.status === "cancelled",
    );

  return (
    <Popover placement="bottom-end">
      <Popover.Trigger class="upload-icon-btn" type="button" aria-label="Очередь загрузок">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 17h16v2H4z" fill="currentColor" />
          <path
            d="M12 4v9m0 0-3.5-3.5M12 13l3.5-3.5"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.9"
          />
        </svg>
        <Show when={uploadStore.tasks.length > 0}>
          <span class="upload-count">{uploadStore.tasks.length}</span>
        </Show>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content class="upload-popover-content">
          <div class="upload-popover-header">
            <h3 class="upload-popover-title">Загрузки</h3>
            <Show when={hasCompletedTasks()}>
              <Button
                class="upload-popover-clear-btn"
                type="button"
                onClick={clearCompletedTasks}
              >
                Очистить
              </Button>
            </Show>
          </div>

          <Show
            when={uploadStore.tasks.length > 0}
            fallback={
              <div class="upload-popover-empty">
                <p>Нет загрузок</p>
              </div>
            }
          >
            <div class="upload-popover-list">
              <For each={uploadStore.tasks}>
                {(task) => <UploadTaskItem task={task} />}
              </For>
            </div>
          </Show>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}
