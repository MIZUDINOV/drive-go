import { Show } from "solid-js";
import { Button } from "@kobalte/core/button";
import { Tooltip } from "@kobalte/core/tooltip";
import type { ActivityItem as ActivityItemType } from "../../services/activityTypes";
import { markAsRead } from "../../services/activityManager";
import { FileTypeIcon } from "../../fileTypes";

type Props = {
  item: ActivityItemType;
};

/**
 * Получить текст действия для типа активности
 */
function getActivityActionText(type: ActivityItemType["type"]): string {
  switch (type) {
    case "comment":
      return "оставил комментарий";
    case "reply":
      return "ответил на комментарий";
    case "mention":
      return "упомянул вас в комментарии";
    case "share":
      return "предоставил доступ к файлу";
    case "edit":
      return "отредактировал файл";
    case "create":
      return "создал файл";
    case "move":
      return "переместил файл";
    case "rename":
      return "переименовал файл";
    case "delete":
      return "удалил файл";
    case "restore":
      return "восстановил файл";
    case "permission_change":
      return "изменил права доступа";
    default:
      return "выполнил действие";
  }
}

function getActorInitials(actorName: string): string {
  const words = actorName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`.toUpperCase();
}

/**
 * Иконка типа активности
 */
function getActivityIcon(type: ActivityItemType["type"]): string {
  const iconMap: Record<ActivityItemType["type"], string> = {
    comment: "comment",
    reply: "reply",
    mention: "alternate_email",
    share: "share",
    edit: "edit",
    create: "add",
    move: "drive_file_move",
    rename: "edit",
    delete: "delete",
    restore: "restore_from_trash",
    permission_change: "lock",
  };
  return iconMap[type] || "notifications";
}

/**
 * Форматирование относительного времени
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "только что";
  if (diffMins < 60) return `${diffMins} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays < 7) return `${diffDays} дн назад`;

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export function ActivityItem(props: Props) {
  const actorName = () => props.item.actor.displayName || "Кто-то";
  const actorInitials = () => getActorInitials(actorName());

  const handleClick = () => {
    // Отметить как прочитанное при клике (локально в расширении)
    // Не отправляется запрос в Google Drive
    if (!props.item.isRead) {
      void markAsRead([props.item.id]);
    }

    // Открыть файл в Google Drive
    if (props.item.target.fileId) {
      const fileUrl = `https://drive.google.com/file/d/${props.item.target.fileId}/view`;
      window.open(fileUrl, "_blank");
    } else {
      console.warn("File ID not available for this activity item");
    }
  };

  return (
    <div
      class={`activity-item ${props.item.isRead ? "" : "activity-item-unread"}`}
      onClick={handleClick}
    >
      <div class="activity-item-icon-container">
        <span class="material-symbols-rounded activity-item-type-icon">
          {getActivityIcon(props.item.type)}
        </span>
        {!props.item.isRead && <div class="activity-item-unread-dot"></div>}
      </div>

      <div class="activity-item-content">
        <div class="activity-item-text">
          <span class="activity-item-actor">
            <span class="activity-item-avatar" aria-hidden="true">
              <Show
                when={props.item.actor.photoUrl}
                fallback={<span>{actorInitials()}</span>}
              >
                <img src={props.item.actor.photoUrl} alt="" />
              </Show>
            </span>
            <span class="activity-item-actor-name">{actorName()}</span>
          </span>
          <span class="activity-item-action">
            {` ${getActivityActionText(props.item.type)}`}
          </span>
        </div>

        <div class="activity-item-target">
          <FileTypeIcon mimeType={props.item.target.mimeType} />
          <span class="activity-item-filename">
            {props.item.target.fileName}
          </span>
        </div>

        <Show when={props.item.details?.commentText}>
          <div class="activity-item-comment-preview">
            "{props.item.details!.commentText}"
          </div>
        </Show>

        <Show
          when={
            props.item.type === "rename" &&
            props.item.details?.oldName &&
            props.item.details?.newName
          }
        >
          <div class="activity-item-rename-info">
            <span class="activity-item-old-name">
              {props.item.details!.oldName}
            </span>
            <span class="material-symbols-rounded activity-item-arrow">
              arrow_forward
            </span>
            <span class="activity-item-new-name">
              {props.item.details!.newName}
            </span>
          </div>
        </Show>

        <div class="activity-item-time">
          {formatRelativeTime(props.item.timestamp)}
        </div>
      </div>

      <Tooltip placement="left" gutter={6}>
        <Button
          class="activity-item-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          aria-label="Открыть файл"
        >
          <span class="material-symbols-rounded">open_in_new</span>
        </Button>
        <Tooltip.Portal>
          <Tooltip.Content class="tab-tooltip">
            <Tooltip.Arrow />
            <span>Открыть файл</span>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip>
    </div>
  );
}
