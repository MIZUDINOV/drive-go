import {
  createSignal,
  For,
  onMount,
  Show,
  createEffect,
  createMemo,
} from "solid-js";
import { Toast, toaster } from "@kobalte/core/toast";
import { Switch } from "@kobalte/core/switch";
import { Button } from "@kobalte/core/button";
import { Skeleton } from "@kobalte/core/skeleton";
import { Alert } from "@kobalte/core/alert";
import { OptionsSelect } from "./OptionsSelect";
import { useI18n } from "../../shared/i18n";
import {
  getSettings,
  saveSettings,
} from "../../sidepanel/services/activityManager";
import { ActivityNotificationSound } from "../../sidepanel/services/activityTypes";
import type {
  ActivityType,
  ActivitySettings as ActivitySettingsType,
} from "../../sidepanel/services/activityTypes";

type ActivityTypeConfig = {
  type: ActivityType;
  label: string;
  description: string;
};

const SYNC_INTERVAL_OPTIONS = [1, 5, 10, 15, 30] as const;
type SyncIntervalOption = (typeof SYNC_INTERVAL_OPTIONS)[number];

const AUTO_CLEANUP_OPTIONS = [7, 14, 30, 90] as const;
type AutoCleanupOption = (typeof AUTO_CLEANUP_OPTIONS)[number];

const NOTIFICATION_SOUND_OPTIONS = [
  ActivityNotificationSound.Chime,
  ActivityNotificationSound.Bell,
  ActivityNotificationSound.Digital,
] as const;
type NotificationSoundOption = ActivityNotificationSound;

function playPreviewSound(sound: NotificationSoundOption): void {
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  const context = new AudioContextCtor();
  const now = context.currentTime;

  const playTone = (freq: number, startOffset: number, duration: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(0.12, now + startOffset + 0.01);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + startOffset + duration,
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(now + startOffset);
    oscillator.stop(now + startOffset + duration + 0.03);
  };

  if (sound === ActivityNotificationSound.Bell) {
    playTone(880, 0, 0.22);
    playTone(1320, 0.12, 0.28);
  } else if (sound === ActivityNotificationSound.Digital) {
    playTone(720, 0, 0.08);
    playTone(960, 0.1, 0.08);
    playTone(1240, 0.2, 0.1);
  } else {
    playTone(660, 0, 0.16);
    playTone(990, 0.18, 0.2);
  }

  setTimeout(() => {
    void context.close();
  }, 900);
}

let lastToastId: number | undefined = undefined;
let lastToastResetTimer: ReturnType<typeof setTimeout> | undefined;

export function ActivitySettings() {
  const { t } = useI18n();

  const [settings, setSettings] = createSignal<ActivitySettingsType | null>(
    null,
  );
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveSuccess, setSaveSuccess] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  // Флаг, чтобы не запускать автосохранение при первой загрузке
  let isFirstLoad = true;
  // id последнего тоста для обновления (используем ref вне компонента, как в примере Kobalte)

  const activityTypes = createMemo<ActivityTypeConfig[]>(() => [
    {
      type: "comment",
      label: t("activity.type.comment.label"),
      description: t("activity.type.comment.description"),
    },
    {
      type: "reply",
      label: t("activity.type.reply.label"),
      description: t("activity.type.reply.description"),
    },
    {
      type: "mention",
      label: t("activity.type.mention.label"),
      description: t("activity.type.mention.description"),
    },
    {
      type: "share",
      label: t("activity.type.share.label"),
      description: t("activity.type.share.description"),
    },
    {
      type: "edit",
      label: t("activity.type.edit.label"),
      description: t("activity.type.edit.description"),
    },
    {
      type: "create",
      label: t("activity.type.create.label"),
      description: t("activity.type.create.description"),
    },
    {
      type: "permission_change",
      label: t("activity.type.permission_change.label"),
      description: t("activity.type.permission_change.description"),
    },
  ]);

  const getSyncIntervalLabel = (value: SyncIntervalOption): string => {
    return t(`activity.sync.interval.${value}` as const);
  };

  const getAutoCleanupLabel = (value: AutoCleanupOption): string => {
    return t(`activity.advanced.cleanup.${value}` as const);
  };

  const getNotificationSoundLabel = (
    value: NotificationSoundOption,
  ): string => {
    if (value === ActivityNotificationSound.Bell) {
      return t("activity.advanced.sound.option.bell");
    }
    if (value === ActivityNotificationSound.Digital) {
      return t("activity.advanced.sound.option.digital");
    }
    return t("activity.advanced.sound.option.chime");
  };

  onMount(async () => {
    const loaded = await getSettings();
    setSettings(loaded);
  });

  // Автосохранение настроек при изменении
  createEffect(() => {
    const current = settings();
    if (!current) return;
    if (isFirstLoad) {
      isFirstLoad = false;
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    saveSettings(current)
      .then(() => {
        // Показываем только один тост сохранения, переиспользуя предыдущий id.
        const toastContent = (toastProps: { toastId: number }) => (
          <Toast
            toastId={toastProps.toastId}
            class="toast-success"
            duration={2000}
          >
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="material-symbols-rounded" style="font-size:20px;">
                check_circle
              </span>
              <span>{t("activity.toast.saved")}</span>
            </div>
            <Toast.ProgressTrack>
              <Toast.ProgressFill />
            </Toast.ProgressTrack>
          </Toast>
        );
        if (lastToastId !== undefined) {
          toaster.update(lastToastId, toastContent);
        } else {
          lastToastId = toaster.show(toastContent);
        }

        if (lastToastResetTimer) {
          clearTimeout(lastToastResetTimer);
        }
        const activeToastId = lastToastId;
        lastToastResetTimer = setTimeout(() => {
          if (lastToastId === activeToastId) {
            lastToastId = undefined;
          }
          lastToastResetTimer = undefined;
        }, 2200);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 1500);
      })
      .catch((error) => {
        setSaveError(t("activity.errors.save"));
        console.error("Failed to save settings:", error);
      })
      .finally(() => {
        setIsSaving(false);
      });
  });

  const handleTypeToggle = (type: ActivityType, enabled: boolean) => {
    const current = settings();
    if (!current) return;
    const enabledTypes = enabled
      ? [...current.enabledTypes, type]
      : current.enabledTypes.filter((t: ActivityType) => t !== type);
    setSettings({ ...current, enabledTypes });
  };

  return (
    <div class="options-section">
      <h2>{t("activity.title")}</h2>
      <p class="options-section-description">{t("activity.description")}</p>

      <Show
        when={settings()}
        fallback={
          <div
            class="options-loading-skeletons"
            aria-label={t("activity.loadingAria")}
          >
            <Skeleton class="options-skeleton" height={120} radius={12} />
            <Skeleton class="options-skeleton" height={96} radius={12} />
            <Skeleton class="options-skeleton" height={180} radius={12} />
          </div>
        }
      >
        <div class="options-settings-block">
          <h3>{t("activity.types.title")}</h3>
          <div class="options-activity-types">
            <For each={activityTypes()}>
              {(typeConfig) => (
                <div class="options-activity-type-item">
                  <div class="options-activity-type-info">
                    <div class="options-activity-type-label">
                      {typeConfig.label}
                    </div>
                    <div class="options-activity-type-description">
                      {typeConfig.description}
                    </div>
                  </div>
                  <Switch
                    class="options-switch"
                    checked={settings()!.enabledTypes.includes(typeConfig.type)}
                    onChange={(enabled) =>
                      handleTypeToggle(typeConfig.type, enabled)
                    }
                  >
                    <Switch.Input class="options-switch-input" />
                    <Switch.Control class="options-switch-control">
                      <Switch.Thumb class="options-switch-thumb" />
                    </Switch.Control>
                  </Switch>
                </div>
              )}
            </For>
          </div>
        </div>

        <div class="options-settings-block">
          <h3>{t("activity.sync.title")}</h3>
          <div class="options-setting-row">
            <div class="options-setting-label">
              <div>{t("activity.sync.interval.title")}</div>
              <div class="options-setting-hint">
                {t("activity.sync.interval.hint")}
              </div>
            </div>
            <OptionsSelect<SyncIntervalOption>
              ariaLabel={t("activity.sync.interval.aria")}
              value={settings()!.syncIntervalMinutes}
              options={[...SYNC_INTERVAL_OPTIONS]}
              getLabel={getSyncIntervalLabel}
              onChange={(value) =>
                setSettings({
                  ...settings()!,
                  syncIntervalMinutes: value,
                })
              }
            />
          </div>
        </div>

        <div class="options-settings-block">
          <h3>{t("activity.advanced.title")}</h3>

          <div class="options-setting-row">
            <div class="options-setting-label">
              <div>{t("activity.advanced.browserNotifications.title")}</div>
              <div class="options-setting-hint">
                {t("activity.advanced.browserNotifications.hint")}
              </div>
            </div>
            <Switch
              class="options-switch"
              checked={settings()!.notificationsEnabled}
              onChange={(enabled) =>
                setSettings({ ...settings()!, notificationsEnabled: enabled })
              }
            >
              <Switch.Input class="options-switch-input" />
              <Switch.Control class="options-switch-control">
                <Switch.Thumb class="options-switch-thumb" />
              </Switch.Control>
            </Switch>
          </div>

          <div class="options-setting-row">
            <div class="options-setting-label">
              <div>{t("activity.advanced.sound.title")}</div>
              <div class="options-setting-hint">
                {t("activity.advanced.sound.hint")}
              </div>
            </div>
            <Switch
              class="options-switch"
              checked={settings()!.playSound}
              onChange={(enabled) =>
                setSettings({ ...settings()!, playSound: enabled })
              }
            >
              <Switch.Input class="options-switch-input" />
              <Switch.Control class="options-switch-control">
                <Switch.Thumb class="options-switch-thumb" />
              </Switch.Control>
            </Switch>
          </div>

          <Show when={settings()!.playSound}>
            <div class="options-setting-row">
              <div class="options-setting-label">
                <div>{t("activity.advanced.soundType.title")}</div>
                <div class="options-setting-hint">
                  {t("activity.advanced.soundType.hint")}
                </div>
              </div>
              <div class="options-sound-picker">
                <OptionsSelect<NotificationSoundOption>
                  ariaLabel={t("activity.advanced.soundType.aria")}
                  value={settings()!.notificationSound}
                  options={[...NOTIFICATION_SOUND_OPTIONS]}
                  getLabel={getNotificationSoundLabel}
                  onChange={(value) => {
                    setSettings({
                      ...settings()!,
                      notificationSound: value,
                    });
                    playPreviewSound(value);
                  }}
                />
                <Button
                  class="options-sound-preview-btn"
                  aria-label={t("activity.advanced.sound.previewAria")}
                  onClick={() =>
                    playPreviewSound(settings()!.notificationSound)
                  }
                >
                  <span class="material-symbols-rounded">play_arrow</span>
                </Button>
              </div>
            </div>
          </Show>

          <div class="options-setting-row">
            <div class="options-setting-label">
              <div>{t("activity.advanced.cleanup.title")}</div>
              <div class="options-setting-hint">
                {t("activity.advanced.cleanup.hint")}
              </div>
            </div>
            <OptionsSelect<AutoCleanupOption>
              ariaLabel={t("activity.advanced.cleanup.aria")}
              value={settings()!.autoCleanupDays}
              options={[...AUTO_CLEANUP_OPTIONS]}
              getLabel={getAutoCleanupLabel}
              onChange={(value) =>
                setSettings({
                  ...settings()!,
                  autoCleanupDays: value,
                })
              }
            />
          </div>
        </div>
      </Show>
    </div>
  );
}
