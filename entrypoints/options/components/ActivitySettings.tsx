import { createSignal, For, onMount, Show } from "solid-js";
import { Switch } from "@kobalte/core/switch";
import {
  getSettings,
  saveSettings,
} from "../../sidepanel/services/activityManager";
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

export function ActivitySettings() {
  const [settings, setSettings] = createSignal<ActivitySettingsType | null>(null);
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveSuccess, setSaveSuccess] = createSignal(false);

  onMount(async () => {
    const loaded = await getSettings();
    setSettings(loaded);
  });

  const handleTypeToggle = (type: ActivityType, enabled: boolean) => {
    const current = settings();
    if (!current) return;

    const enabledTypes = enabled
      ? [...current.enabledTypes, type]
      : current.enabledTypes.filter((t: ActivityType) => t !== type);

    setSettings({ ...current, enabledTypes });
  };

  const handleSave = async () => {
    const current = settings();
    if (!current) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await saveSettings(current);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div class="options-section">
      <h2>Настройки активности</h2>
      <p class="options-section-description">
        Выберите типы уведомлений, которые вы хотите отслеживать
      </p>

      <Show when={settings()}>
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
                    onChange={(enabled) => handleTypeToggle(typeConfig.type, enabled)}
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
            <select
              class="options-select"
              value={settings()!.syncIntervalMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings()!,
                  syncIntervalMinutes: Number(e.currentTarget.value) as 5 | 10 | 15 | 30,
                })
              }
            >
              <option value="5">Каждые 5 минут</option>
              <option value="10">Каждые 10 минут</option>
              <option value="15">Каждые 15 минут</option>
              <option value="30">Каждые 30 минут</option>
            </select>
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
              <div>Автоочистка</div>
              <div class="options-setting-hint">
                Удалять уведомления старше указанного срока
              </div>
            </div>
            <select
              class="options-select"
              value={settings()!.autoCleanupDays}
              onChange={(e) =>
                setSettings({
                  ...settings()!,
                  autoCleanupDays: Number(e.currentTarget.value) as 7 | 14 | 30 | 90,
                })
              }
            >
              <option value="7">7 дней</option>
              <option value="14">14 дней</option>
              <option value="30">30 дней</option>
              <option value="90">90 дней</option>
            </select>
          </div>
        </div>

        <div class="options-actions">
          <button
            class="options-btn options-btn-primary"
            onClick={handleSave}
            disabled={isSaving()}
          >
            <Show when={isSaving()} fallback="Сохранить изменения">
              Сохранение...
            </Show>
          </button>

          <Show when={saveSuccess()}>
            <div class="options-save-success">
              <span class="material-symbols-rounded">check_circle</span>
              Настройки сохранены
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
