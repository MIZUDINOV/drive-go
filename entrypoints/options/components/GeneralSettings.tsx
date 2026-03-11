import { Show, createEffect, createSignal, onMount } from "solid-js";
import { Alert } from "@kobalte/core/alert";
import { Skeleton } from "@kobalte/core/skeleton";
import { Switch } from "@kobalte/core/switch";
import {
  getTransferQueueGeneralSettings,
  saveTransferQueueGeneralSettings,
  type TransferQueueGeneralSettings,
} from "../../shared/transferQueueSettings";

const DEFAULT_SETTINGS: TransferQueueGeneralSettings = {
  backgroundTransfersEnabled: true,
};

export function GeneralSettings() {
  const [settings, setSettings] = createSignal<TransferQueueGeneralSettings | null>(
    null,
  );
  const [saveError, setSaveError] = createSignal<string | null>(null);
  let isInitialSync = true;

  onMount(async () => {
    try {
      const loadedSettings = await getTransferQueueGeneralSettings();
      setSettings(loadedSettings);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Не удалось загрузить общие настройки";
      setSaveError(message);
      setSettings(DEFAULT_SETTINGS);
    }
  });

  createEffect(() => {
    const nextSettings = settings();
    if (!nextSettings) {
      return;
    }

    if (isInitialSync) {
      isInitialSync = false;
      return;
    }

    setSaveError(null);

    void saveTransferQueueGeneralSettings(nextSettings).catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Не удалось сохранить общие настройки";
      setSaveError(message);
    });
  });

  return (
    <div class="options-section">
      <h2>Общие настройки</h2>
      <p class="options-section-description">
        Управляйте поведением загрузок при закрытой боковой панели.
      </p>

      <Show
        when={settings()}
        fallback={
          <div
            class="options-loading-skeletons"
            aria-label="Загрузка общих настроек"
          >
            <Skeleton class="options-skeleton" height={92} radius={12} />
          </div>
        }
      >
        <div class="options-settings-block">
          <h3>Передачи</h3>

          <div class="options-setting-row">
            <div class="options-setting-label">
              <div>Фоновая загрузка</div>
              <div class="options-setting-hint">
                Если включено, загрузки продолжаются после закрытия расширения. Если
                выключено, загрузки ставятся на паузу и продолжаются при открытии боковой
                панели.
              </div>
            </div>

            <Switch
              class="options-switch"
              checked={settings()!.backgroundTransfersEnabled}
              onChange={(enabled) =>
                setSettings({
                  ...settings()!,
                  backgroundTransfersEnabled: enabled,
                })
              }
            >
              <Switch.Input class="options-switch-input" />
              <Switch.Control class="options-switch-control">
                <Switch.Thumb class="options-switch-thumb" />
              </Switch.Control>
            </Switch>
          </div>
        </div>
      </Show>

      <Show when={saveError()}>
        <Alert class="options-alert options-alert-error" style="margin-top: 12px;">
          <span class="material-symbols-rounded" aria-hidden="true">error</span>
          <span>{saveError()}</span>
        </Alert>
      </Show>
    </div>
  );
}
