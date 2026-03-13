import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { Subject, Subscription, timer } from "rxjs";
import { mergeMap, map, switchMap } from "rxjs/operators";
import { Popover } from "@kobalte/core/popover";
import { Button } from "@kobalte/core/button";
import { Tooltip } from "@kobalte/core/tooltip";
import { useI18n } from "../../../shared/i18n";
import type {
  TransferHistoryItem,
  TransferQueueItem,
} from "../../../shared/transferQueueTypes";
import {
  getTransferPopoverSeenUpTo,
  setTransferPopoverSeenUpTo,
} from "../../../shared/transferQueueUiState";
import {
  cancelTransferQueueItem,
  listTransferQueueSnapshot,
  removeTransferQueueItem,
  retryTransferQueueItem,
  subscribeTransferQueueSnapshots,
} from "../../services/transferQueueClient";

const AUTO_CLOSE_DELAY_MS = 5000;
const MAX_INLINE_NOTICES = 3;
const MAX_RECENT_COMPLETED = 8;

type InlineUploadNotice = {
  id: string;
  name: string;
  direction: TransferQueueItem["direction"];
};

type UploadTaskItemProps = {
  task: TransferQueueItem;
  onCancel: (id: string) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getStatusClass(status: TransferQueueItem["status"]): string {
  switch (status) {
    case "pending":
      return "upload-task-pending";
    case "uploading":
    case "downloading":
      return "upload-task-uploading";
    case "error":
      return "upload-task-error";
    case "cancelled":
      return "upload-task-cancelled";
  }
}

function UploadTaskItem(props: UploadTaskItemProps) {
  const { t } = useI18n();

  const canCancel = () =>
    props.task.status === "pending" ||
    props.task.status === "uploading" ||
    props.task.status === "downloading";

  const canRetry = () =>
    props.task.status === "error" || props.task.status === "cancelled";

  const canRemove = () =>
    props.task.status === "error" || props.task.status === "cancelled";

  const uploadPercent = () =>
    props.task.sizeBytes > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((props.task.progressBytes / props.task.sizeBytes) * 100),
          ),
        )
      : 0;

  const statusText = () => {
    switch (props.task.status) {
      case "pending":
        return t("upload.status.pending");
      case "uploading":
        return t("upload.status.uploading");
      case "downloading":
        return t("upload.status.downloading");
      case "error":
        return t("upload.status.error");
      case "cancelled":
        return t("upload.status.cancelled");
    }
  };

  return (
    <div class="upload-task-item">
      <div class="upload-task-info">
        <div class="upload-task-name" title={props.task.name}>
          {props.task.name}
        </div>
        <div class="upload-task-details">
          <span class={getStatusClass(props.task.status)}>{statusText()}</span>
          <Show
            when={
              props.task.status === "uploading" ||
              props.task.status === "downloading"
            }
          >
            <span class="upload-task-progress-text">
              {formatBytes(props.task.progressBytes)} /{" "}
              {formatBytes(props.task.sizeBytes)}
            </span>
          </Show>
          <Show when={props.task.status === "error" && props.task.errorMessage}>
            <span
              class="upload-task-error-text"
              title={props.task.errorMessage}
            >
              {props.task.errorMessage}
            </span>
          </Show>
        </div>
        <Show
          when={
            props.task.status === "uploading" ||
            props.task.status === "downloading"
          }
        >
          <div class="upload-task-progress-bar">
            <div
              class="upload-task-progress-fill"
              style={{ width: `${uploadPercent()}%` }}
            />
          </div>
        </Show>
      </div>

      <div class="upload-task-actions">
        <Show when={canCancel()}>
          <Tooltip placement="bottom" gutter={4}>
            <Tooltip.Trigger
              as={Button}
              class="upload-task-action-btn"
              type="button"
              aria-label={t("upload.action.cancel")}
              title={t("upload.action.cancel")}
              onClick={() => {
                void props.onCancel(props.task.id);
              }}
            >
              <span class="material-symbols-rounded">close</span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content class="tab-tooltip">
                <Tooltip.Arrow class="tab-tooltip-arrow" />
                <span>{t("upload.action.cancel")}</span>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip>
        </Show>
        <Show when={canRetry()}>
          <Tooltip placement="bottom" gutter={4}>
            <Tooltip.Trigger
              as={Button}
              class="upload-task-action-btn"
              type="button"
              aria-label={t("upload.action.retry")}
              title={t("upload.action.retry")}
              onClick={() => {
                void props.onRetry(props.task.id);
              }}
            >
              <span class="material-symbols-rounded">refresh</span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content class="tab-tooltip">
                <Tooltip.Arrow class="tab-tooltip-arrow" />
                <span>{t("upload.action.retry")}</span>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip>
        </Show>
        <Show when={canRemove()}>
          <Tooltip placement="bottom" gutter={4}>
            <Tooltip.Trigger
              as={Button}
              class="upload-task-action-btn"
              type="button"
              aria-label={t("upload.action.remove")}
              title={t("upload.action.remove")}
              onClick={() => {
                void props.onRemove(props.task.id);
              }}
            >
              <span class="material-symbols-rounded">close</span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content class="tab-tooltip">
                <Tooltip.Arrow class="tab-tooltip-arrow" />
                <span>{t("upload.action.remove")}</span>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip>
        </Show>
      </div>
    </div>
  );
}

export function UploadPopover() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = createSignal(false);
  const [isAutoOpened, setIsAutoOpened] = createSignal(false);
  const [tasks, setTasks] = createSignal<TransferQueueItem[]>([]);
  const [recentCompleted, setRecentCompleted] = createSignal<
    TransferHistoryItem[]
  >([]);
  const [inlineNotices, setInlineNotices] = createSignal<InlineUploadNotice[]>(
    [],
  );
  const [seenUpTo, setSeenUpTo] = createSignal<number>(Date.now());
  const [lastAutoOpenCompletedCount, setLastAutoOpenCompletedCount] =
    createSignal(0);
  const autoCloseKick$ = new Subject<void>();
  const inlineNoticeExpiry$ = new Subject<string>();
  const subscriptions: Subscription[] = [];

  const pushInlineNotice = (item: TransferQueueItem): void => {
    setInlineNotices((current) => {
      if (current.some((notice) => notice.id === item.id)) {
        return current;
      }

      const next = [
        ...current,
        {
          id: item.id,
          name: item.name,
          direction: item.direction,
        },
      ];

      if (next.length <= MAX_INLINE_NOTICES) {
        return next;
      }

      return next.slice(next.length - MAX_INLINE_NOTICES);
    });

    inlineNoticeExpiry$.next(item.id);
  };

  const applySnapshot = (
    snapshot: { queue: TransferQueueItem[]; history: TransferHistoryItem[] },
    sessionStartAt: number,
  ): void => {
    const previousQueueById = new Set(tasks().map((item) => item.id));
    const sessionQueue = snapshot.queue.filter(
      (item) => item.createdAt >= sessionStartAt,
    );

    for (const item of sessionQueue) {
      if (!previousQueueById.has(item.id) && !isOpen()) {
        pushInlineNotice(item);
      }
    }

    setTasks(sessionQueue);

    const unseenCompleted = snapshot.history
      .filter((item) => item.completedAt > sessionStartAt)
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, MAX_RECENT_COMPLETED);

    setRecentCompleted(unseenCompleted);

    if (unseenCompleted.length > lastAutoOpenCompletedCount()) {
      setInlineNotices([]);
      setIsOpen(true);
      setIsAutoOpened(true);
      autoCloseKick$.next();
    }

    setLastAutoOpenCompletedCount(unseenCompleted.length);
  };

  const loadTasks = async (): Promise<void> => {
    try {
      const snapshot = await listTransferQueueSnapshot();
      applySnapshot(snapshot, seenUpTo());
    } catch {
      setTasks([]);
      setRecentCompleted([]);
    }
  };

  onMount(() => {
    let unsubscribeSnapshots: (() => void) | null = null;
    const autoCloseSubscription = autoCloseKick$
      .pipe(switchMap(() => timer(AUTO_CLOSE_DELAY_MS)))
      .subscribe(() => {
        if (!isAutoOpened()) {
          return;
        }

        setIsOpen(false);
        setIsAutoOpened(false);
      });

    const inlineNoticeExpirySubscription = inlineNoticeExpiry$
      .pipe(mergeMap((id) => timer(AUTO_CLOSE_DELAY_MS).pipe(map(() => id))))
      .subscribe((expiredId) => {
        setInlineNotices((current) =>
          current.filter((notice) => notice.id !== expiredId),
        );
      });

    subscriptions.push(autoCloseSubscription);
    subscriptions.push(inlineNoticeExpirySubscription);

    void (async () => {
      const initialSeenUpTo = await getTransferPopoverSeenUpTo();
      setSeenUpTo(initialSeenUpTo);
      setLastAutoOpenCompletedCount(0);
      await loadTasks();

      unsubscribeSnapshots = subscribeTransferQueueSnapshots((snapshot) => {
        applySnapshot(snapshot, seenUpTo());
      });
    })();

    onCleanup(() => {
      if (unsubscribeSnapshots) {
        unsubscribeSnapshots();
      }

      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }

      subscriptions.length = 0;
      autoCloseKick$.complete();
      inlineNoticeExpiry$.complete();
      void setTransferPopoverSeenUpTo(Date.now());
    });
  });

  const handlePopoverOpenChange = (open: boolean): void => {
    setIsOpen(open);

    if (!open) {
      setIsAutoOpened(false);
      return;
    }

    setInlineNotices([]);
    setIsAutoOpened(false);
  };

  const hasCompletedTasks = createMemo(() =>
    tasks().some(
      (task) => task.status === "error" || task.status === "cancelled",
    ),
  );

  const popoverBadgeCount = createMemo(
    () => tasks().length + recentCompleted().length,
  );

  const handleCancel = async (id: string): Promise<void> => {
    await cancelTransferQueueItem(id);
    await loadTasks();
  };

  const handleRetry = async (id: string): Promise<void> => {
    await retryTransferQueueItem(id);
    await loadTasks();
  };

  const handleRemove = async (id: string): Promise<void> => {
    await removeTransferQueueItem(id);
    await loadTasks();
  };

  const clearCompletedTasks = async (): Promise<void> => {
    const removableIds = tasks()
      .filter((task) => task.status === "error" || task.status === "cancelled")
      .map((task) => task.id);

    for (const id of removableIds) {
      await removeTransferQueueItem(id);
    }

    await loadTasks();
  };

  return (
    <Popover
      placement="bottom-end"
      open={isOpen()}
      onOpenChange={handlePopoverOpenChange}
    >
      <div class="upload-trigger-wrap">
        <Popover.Trigger
          class="upload-icon-btn"
          type="button"
          aria-label={t("upload.queue.aria")}
        >
          <span class="material-symbols-rounded">upload_file</span>
          <Show when={popoverBadgeCount() > 0}>
            <span class="upload-count">{popoverBadgeCount()}</span>
          </Show>
        </Popover.Trigger>

        <Show when={!isOpen() && inlineNotices().length > 0}>
          <div class="upload-inline-notices" role="status" aria-live="polite">
            <For each={inlineNotices()}>
              {(notice) => (
                <div class="upload-inline-notice-item">
                  <span class="material-symbols-rounded" aria-hidden="true">
                    {notice.direction === "download" ? "download" : "upload"}
                  </span>
                  <div class="upload-inline-notice-copy">
                    <p class="upload-inline-notice-title">
                      {notice.direction === "download"
                        ? t("upload.inline.downloadAdded")
                        : t("upload.inline.uploadAdded")}
                    </p>
                    <p class="upload-inline-notice-name" title={notice.name}>
                      {notice.name}
                    </p>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <Popover.Portal>
        <Popover.Content class="upload-popover-content">
          <div class="upload-popover-header">
            <h3 class="upload-popover-title">{t("upload.title")}</h3>
            <Show when={hasCompletedTasks()}>
              <Tooltip placement="bottom" gutter={4}>
                <Tooltip.Trigger
                  as={Button}
                  class="upload-popover-clear-btn"
                  type="button"
                  aria-label={t("upload.clearCompleted")}
                  title={t("upload.clearCompleted")}
                  onClick={() => {
                    void clearCompletedTasks();
                  }}
                >
                  {t("upload.clear")}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content class="tab-tooltip">
                    <Tooltip.Arrow class="tab-tooltip-arrow" />
                    <span>{t("upload.clearCompleted")}</span>
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip>
            </Show>
          </div>

          <Show
            when={tasks().length > 0}
            fallback={
              <div class="upload-popover-empty">
                <p>{t("upload.empty")}</p>
              </div>
            }
          >
            <div class="upload-popover-list">
              <For each={tasks()}>
                {(task) => (
                  <UploadTaskItem
                    task={task}
                    onCancel={handleCancel}
                    onRetry={handleRetry}
                    onRemove={handleRemove}
                  />
                )}
              </For>
            </div>
          </Show>

          <Show when={recentCompleted().length > 0}>
            <div class="upload-popover-header" style="margin-top: 8px;">
              <h3 class="upload-popover-title">
                {t("upload.completedSession")}
              </h3>
            </div>
            <div class="upload-popover-list">
              <For each={recentCompleted()}>
                {(item) => (
                  <div class="upload-task-item">
                    <div class="upload-task-info">
                      <div class="upload-task-name" title={item.name}>
                        {item.name}
                      </div>
                      <div class="upload-task-details">
                        <span class="upload-task-completed">
                          {t("upload.completed")}
                        </span>
                        <span class="upload-task-progress-text">
                          {formatBytes(item.sizeBytes)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}
