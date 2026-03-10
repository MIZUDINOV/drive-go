import type { ActivitySettings } from "../sidepanel/services/activityTypes";

export const MESSAGE_PLAY_NOTIFICATION_SOUND = "gdrivego.play-notification-sound";

export type PlayNotificationSoundMessage = {
  type: typeof MESSAGE_PLAY_NOTIFICATION_SOUND;
  payload: {
    sound: ActivitySettings["notificationSound"];
  };
};
