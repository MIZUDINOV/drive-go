/**
 * Типы активности в Google Drive
 */
export type ActivityType =
  | "comment" // Комментарий к файлу
  | "reply" // Ответ на комментарий
  | "mention" // Упоминание в комментарии
  | "share" // Файл поделился
  | "edit" // Редактирование файла
  | "create" // Создание файла
  | "move" // Перемещение файла
  | "rename" // Переименование
  | "delete" // Удаление в корзину
  | "restore" // Восстановление из корзины
  | "permission_change"; // Изменение прав доступа

/**
 * Актор (кто выполнил действие)
 */
export type ActivityActor = {
  type: "user" | "anonymous" | "system";
  displayName?: string;
  email?: string;
  photoUrl?: string;
};

/**
 * Целевой объект активности
 */
export type ActivityTarget = {
  fileId: string;
  fileName: string;
  mimeType: string;
  iconUrl?: string;
};

/**
 * Детали конкретного типа активности
 */
export type ActivityDetails = {
  // Для комментариев
  commentText?: string;
  quotedText?: string; // текст, на который ответили

  // Для шаринга
  sharedRole?: "reader" | "writer" | "commenter" | "owner";
  targetUserEmail?: string;

  // Для переименования
  oldName?: string;
  newName?: string;

  // Для перемещения
  oldParentName?: string;
  newParentName?: string;
};

/**
 * Элемент активности
 */
export type ActivityItem = {
  id: string;
  type: ActivityType;
  timestamp: string; // ISO date string
  actor: ActivityActor;
  target: ActivityTarget;
  details?: ActivityDetails;
  isRead: boolean;
};

/**
 * Группа активностей (по дате)
 */
export type ActivityGroup = {
  date: string; // "Сегодня", "Вчера", "7 марта", etc.
  items: ActivityItem[];
};

/**
 * Настройки активности
 */
export type ActivitySettings = {
  enabledTypes: ActivityType[];
  notificationsEnabled: boolean;
  syncIntervalMinutes: 1 | 5 | 10 | 15 | 30;
  autoCleanupDays: 7 | 14 | 30 | 90;
  playSound: boolean;
};

/**
 * Состояние хранилища активности
 */
export type ActivityStore = {
  items: ActivityItem[];
  unreadCount: number;
  lastSyncTime: string | null;
  isLoading: boolean;
  error: string | null;
};

/**
 * Ответ API Drive Activity
 */
export type DriveActivityResponse = {
  activities: DriveActivity[];
  nextPageToken?: string;
};

export type DriveActivity = {
  primaryActionDetail: {
    comment?: {
      post?: { subtype: string };
      assignment?: { subtype: string };
    };
    edit?: Record<string, unknown>;
    create?: { new?: { name: string } };
    move?: {
      addedParents?: Array<{ title?: string }>;
      removedParents?: Array<{ title?: string }>;
    };
    rename?: {
      oldTitle?: string;
      newTitle?: string;
    };
    delete?: { type: string };
    restore?: { type: string };
    permissionChange?: {
      addedPermissions?: Array<{ role: string }>;
      removedPermissions?: Array<{ role: string }>;
    };
  };
  actors?: Array<{
    user?: Record<string, unknown> | {
      knownUser?: {
        personName?: string;
        isCurrentUser?: boolean;
      };
      emailAddress?: string;
      displayName?: string;
    };
    anonymous?: Record<string, unknown>;
    system?: Record<string, unknown>;
  }>;
  targets?: Array<{
    driveItem?: {
      id?: string;
      resourceId?: string;
      name?: string;
      title?: string;
      mimeType?: string;
      driveFile?: {
        name?: string;
        title?: string;
      };
      driveFolder?: {
        type?: string;
      };
    };
    fileComment?: {
      legacyCommentId?: string;
      linkToDiscussion?: string;
    };
  }>;
  timestamp?: string;
  timeRange?: {
    startTime?: string;
    endTime?: string;
  };
};
