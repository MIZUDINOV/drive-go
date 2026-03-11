import { Subscription, fromEventPattern } from "rxjs";
import { filter, map, share, throttleTime } from "rxjs/operators";
import {
  ActivityRuntimeMessageType,
  type PlayNotificationSoundMessage,
} from "../../shared/activityNotifications";
import {
  ActivityNotificationSound,
  type ActivitySettings,
} from "./activityTypes";

const SOUND_THROTTLE_MS = 280;

type RuntimeMessageListener = Parameters<
  typeof browser.runtime.onMessage.addListener
>[0];

type RuntimeMessageArgs = [
  unknown,
  Browser.runtime.MessageSender,
  (response?: unknown) => void,
];

const runtimeMessageListenerMap = new Map<
  (args: RuntimeMessageArgs) => void,
  RuntimeMessageListener
>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNotificationSound(
  value: unknown,
): value is ActivitySettings["notificationSound"] {
  return (
    value === ActivityNotificationSound.Chime ||
    value === ActivityNotificationSound.Bell ||
    value === ActivityNotificationSound.Digital
  );
}

function isPlayNotificationSoundMessage(
  message: unknown,
): message is PlayNotificationSoundMessage {
  if (!isRecord(message)) {
    return false;
  }

  const type = message.type;
  const payload = message.payload;
  if (!isRecord(payload)) {
    return false;
  }

  return (
    type === ActivityRuntimeMessageType.PlayNotificationSound &&
    isNotificationSound(payload.sound)
  );
}

const runtimeMessages$ = fromEventPattern<RuntimeMessageArgs>(
  (handler) => {
    const listener: RuntimeMessageListener = (
      message,
      sender,
      sendResponse,
    ) => {
      handler([message, sender, sendResponse]);
    };

    runtimeMessageListenerMap.set(handler, listener);
    browser.runtime.onMessage.addListener(listener);
  },
  (handler) => {
    const listener = runtimeMessageListenerMap.get(handler);
    if (!listener) {
      return;
    }

    browser.runtime.onMessage.removeListener(listener);
    runtimeMessageListenerMap.delete(handler);
  },
).pipe(map(([message]) => message));

export const activityNotificationSound$ = runtimeMessages$.pipe(
  filter(isPlayNotificationSoundMessage),
  map((message) => message.payload.sound),
  throttleTime(SOUND_THROTTLE_MS, undefined, {
    leading: true,
    trailing: false,
  }),
  share(),
);

export function subscribeActivityNotificationSound(
  listener: (sound: ActivitySettings["notificationSound"]) => void,
): Subscription {
  return activityNotificationSound$.subscribe(listener);
}
