import type { ActivitySettings } from "../sidepanel/services/activityTypes";

export enum ActivityRuntimeMessageType {
  PlayNotificationSound = "gdrivego.play-notification-sound",
  ActivitySyncNow = "gdrivego.activity-sync-now",
}

export const MESSAGE_PLAY_NOTIFICATION_SOUND =
  ActivityRuntimeMessageType.PlayNotificationSound;
export const MESSAGE_ACTIVITY_SYNC_NOW =
  ActivityRuntimeMessageType.ActivitySyncNow;

export type PlayNotificationSoundMessage = {
  type: ActivityRuntimeMessageType.PlayNotificationSound;
  payload: {
    sound: ActivitySettings["notificationSound"];
  };
};

export type ActivitySyncNowMessage = {
  type: ActivityRuntimeMessageType.ActivitySyncNow;
};

export type ActivitySyncNowResponse = {
  ok: boolean;
};
