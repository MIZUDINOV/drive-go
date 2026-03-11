import { createSignal, For, onMount, Show, createEffect } from "solid-js";
import { Toast, toaster } from "@kobalte/core/toast";
import { Switch } from "@kobalte/core/switch";
import { Button } from "@kobalte/core/button";
import { Skeleton } from "@kobalte/core/skeleton";
import { Alert } from "@kobalte/core/alert";
import { OptionsSelect } from "./OptionsSelect";
import {
  getSettings,
  saveSettings,
} from "../../sidepanel/services/activityManager";
import {
  ActivityNotificationSound,
} from "../../sidepanel/services/activityTypes";
import type {
  ActivityType,
  ActivitySettings as ActivitySettingsType,
} from "../../sidepanel/services/activityTypes";

type ActivityTypeConfig = {
  type: ActivityType;
  label: string;
  description: string;
};

const activityTypes: ActivityTypeConfig[] = [
  {
    type: "comment",
    label: "Комментарии",
    description: "Новые комментарии к вашим файлам",
  },
  {
    type: "reply",
    label: "Ответы",
    description: "Ответы на ваши комментарии",
  },
  {
    type: "mention",
    label: "Упоминания",
    description: "Когда вас упоминают в комментариях",
  },
  {
    type: "share",
    label: "Общий доступ",
    description: "Когда с вами делятся файлами",
  },
  {
    type: "edit",
    label: "Редактирование",
    description: "Изменения в общих файлах",
  },
  {
    type: "create",
    label: "Создание",
    description: "Новые файлы в общих папках",
  },
  {
    type: "permission_change",
    label: "Изменение прав",
    description: "Изменения прав доступа к файлам",
  },
];

const SYNC_INTERVAL_OPTIONS = [1, 5, 10, 15, 30] as const;
type SyncIntervalOption = (typeof SYNC_INTERVAL_OPTIONS)[number];

const SYNC_INTERVAL_LABEL: Record<SyncIntervalOption, string> = {
  1: "Каждую минуту",
  5: "Каждые 5 минут",
  10: "Каждые 10 минут",
  15: "Каждые 15 минут",
  30: "Каждые 30 минут",
};

const AUTO_CLEANUP_OPTIONS = [7, 14, 30, 90] as const;
type AutoCleanupOption = (typeof AUTO_CLEANUP_OPTIONS)[number];

const AUTO_CLEANUP_LABEL: Record<AutoCleanupOption, string> = {
  7: "7 дней",
  14: "14 дней",
  30: "30 дней",
  90: "90 дней",
};

const NOTIFICATION_SOUND_OPTIONS = [
  ActivityNotificationSound.Chime,
  ActivityNotificationSound.Bell,
  ActivityNotificationSound.Digital,
] as const;
type NotificationSoundOption = ActivityNotificationSound;

const NOTIFICATION_SOUND_LABEL: Record<NotificationSoundOption, string> = {
  [ActivityNotificationSound.Chime]: "Chime",
  [ActivityNotificationSound.Bell]: "Bell",
  [ActivityNotificationSound.Digital]: "Digital",
};

function playPreviewSound(sound: NotificationSoundOption): void {
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

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
  const [settings, setSettings] = createSignal<ActivitySettingsType | null>(
    null,
  );
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveSuccess, setSaveSuccess] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  // Флаг, чтобы не запускать автосохранение при первой загрузке
  let isFirstLoad = true;
  // id последнего тоста для обновления (используем ref вне компонента, как в примере Kobalte)

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
              <span>Настройки сохранены</span>
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
        setSaveError("Ошибка сохранения настроек");
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
      <h2>Настройки активности</h2>
      <p class="options-section-description">
        Выберите типы уведомлений, которые вы хотите отслеживать
      </p>

      <Show
        when={settings()}
        fallback={
          <div
            class="options-loading-skeletons"
            aria-label="Загрузка настроек активности"
          >
            <Skeleton class="options-skeleton" height={120} radius={12} />
            <Skeleton class="options-skeleton" height={96} radius={12} />
            <Skeleton class="options-skeleton" height={180} radius={12} />
          </div>
        }
      >
        <div class="options-settings-block">
          <h3>Типы активности</h3>
          <div class="options-activity-types">
            <For each={activityTypes}>
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
          <h3>Синхронизация</h3>
          <div class="options-setting-row">
            <div class="options-setting-label">
              <div>Интервал обновления</div>
              <div class="options-setting-hint">
                Как часто проверять новые уведомления
              </div>
            </div>
            <OptionsSelect<SyncIntervalOption>
              ariaLabel="Интервал обновления"
              value={settings()!.syncIntervalMinutes}
              options={[...SYNC_INTERVAL_OPTIONS]}
              getLabel={(value) => SYNC_INTERVAL_LABEL[value]}
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
          <h3>Дополнительно</h3>

          <div class="options-setting-row">
            <div class="options-setting-label">
              <div>Браузерные уведомления</div>
              <div class="options-setting-hint">
                Показывать всплывающие уведомления
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
              <div>Звуковые уведомления</div>
              <div class="options-setting-hint">
                Воспроизводить звук при новых событиях
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
                <div>Тип звука</div>
                <div class="options-setting-hint">
                  Выберите звук уведомления об изменениях
                </div>
              </div>
              <div class="options-sound-picker">
                <OptionsSelect<NotificationSoundOption>
                  ariaLabel="Тип звука"
                  value={settings()!.notificationSound}
                  options={[...NOTIFICATION_SOUND_OPTIONS]}
                  getLabel={(value) => NOTIFICATION_SOUND_LABEL[value]}
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
                  aria-label="Прослушать звук"
                  onClick={() => playPreviewSound(settings()!.notificationSound)}
                >
                  <span class="material-symbols-rounded">play_arrow</span>
                </Button>
              </div>
            </div>
          </Show>

          <div class="options-setting-row">
            <div class="options-setting-label">
              <div>Автоочистка</div>
              <div class="options-setting-hint">
                Удалять уведомления старше указанного срока
              </div>
            </div>
            <OptionsSelect<AutoCleanupOption>
              ariaLabel="Автоочистка"
              value={settings()!.autoCleanupDays}
              options={[...AUTO_CLEANUP_OPTIONS]}
              getLabel={(value) => AUTO_CLEANUP_LABEL[value]}
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
