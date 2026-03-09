import { For, Show } from "solid-js";
import { Popover } from "@kobalte/core/popover";
import { Button } from "@kobalte/core/button";
import { Tooltip } from "@kobalte/core/tooltip";
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
          <Tooltip placement="bottom" gutter={4}>
            <Button
              class="upload-task-action-btn"
              type="button"
              onClick={() => cancelUploadTask(props.task.id)}
            >
              <span class="material-symbols-rounded">close</span>
            </Button>
            <Tooltip.Portal>
              <Tooltip.Content class="tab-tooltip">
                <Tooltip.Arrow />
                <span>Отменить</span>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip>
        </Show>
        <Show when={canRetry()}>
          <Tooltip placement="bottom" gutter={4}>
            <Button
              class="upload-task-action-btn"
              type="button"
              onClick={() => retryUploadTask(props.task.id)}
            >
              <span class="material-symbols-rounded">refresh</span>
            </Button>
            <Tooltip.Portal>
              <Tooltip.Content class="tab-tooltip">
                <Tooltip.Arrow />

                <span>Повторить</span>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip>
        </Show>
        <Show when={canRemove()}>
          <Tooltip placement="bottom" gutter={4}>
            <Button
              class="upload-task-action-btn"
              type="button"
              onClick={() => removeUploadTask(props.task.id)}
            >
              <span class="material-symbols-rounded">close</span>
            </Button>
            <Tooltip.Portal>
              <Tooltip.Content class="tab-tooltip">
                <Tooltip.Arrow />
                <span>Удалить</span>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip>
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
        <span class="material-symbols-rounded">upload_file</span>
        <Show when={uploadStore.tasks.length > 0}>
          <span class="upload-count">{uploadStore.tasks.length}</span>
        </Show>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content class="upload-popover-content">
          <div class="upload-popover-header">
            <h3 class="upload-popover-title">Загрузки</h3>
            <Show when={hasCompletedTasks()}>
              <Tooltip placement="bottom" gutter={4}>
                <Button
                  class="upload-popover-clear-btn"
                  type="button"
                  onClick={clearCompletedTasks}
                >
                  Очистить
                </Button>
                <Tooltip.Portal>
                  <Tooltip.Content class="tab-tooltip">
                    <Tooltip.Arrow />
                    <span>Очистить завершённые</span>
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip>
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
