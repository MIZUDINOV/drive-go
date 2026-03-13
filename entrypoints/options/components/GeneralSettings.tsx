import { Show, createEffect, createSignal, onMount } from "solid-js";
import { Alert } from "@kobalte/core/alert";
import { Skeleton } from "@kobalte/core/skeleton";
import { Switch } from "@kobalte/core/switch";
import { OptionsSelect } from "./OptionsSelect";
import {
  getTransferQueueGeneralSettings,
  saveTransferQueueGeneralSettings,
  type TransferQueueGeneralSettings,
} from "../../shared/transferQueueSettings";
import { SUPPORTED_LOCALES, type Locale, useI18n } from "../../shared/i18n";

const DEFAULT_SETTINGS: TransferQueueGeneralSettings = {
  backgroundTransfersEnabled: true,
};

export function GeneralSettings() {
  const { locale, setLocale, t } = useI18n();
  const [settings, setSettings] =
    createSignal<TransferQueueGeneralSettings | null>(null);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  let isInitialSync = true;

  onMount(async () => {
    try {
      const loadedSettings = await getTransferQueueGeneralSettings();
      setSettings(loadedSettings);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("general.errors.load");
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

    void saveTransferQueueGeneralSettings(nextSettings).catch(
      (error: unknown) => {
        const message =
          error instanceof Error ? error.message : t("general.errors.save");
        setSaveError(message);
      },
    );
  });

  const getLocaleLabel = (value: Locale): string => {
    if (value === "es") {
      return t("general.language.es");
    }

    if (value === "pt_BR") {
      return t("general.language.pt_BR");
    }

    if (value === "fr") {
      return t("general.language.fr");
    }

    if (value === "de") {
      return t("general.language.de");
    }

    if (value === "ru") {
      return t("general.language.ru");
    }

    return t("general.language.en");
  };

  return (
    <div class="options-section">
      <h2>{t("general.title")}</h2>
      <p class="options-section-description">{t("general.description")}</p>

      <div class="options-settings-block">
        <h3>{t("general.language.title")}</h3>
        <div class="options-setting-row">
          <div class="options-setting-label">
            <div>{t("general.language.title")}</div>
            <div class="options-setting-hint">{t("general.language.hint")}</div>
          </div>
          <OptionsSelect<Locale>
            ariaLabel={t("general.language.aria")}
            value={locale()}
            options={[...SUPPORTED_LOCALES]}
            getLabel={getLocaleLabel}
            onChange={setLocale}
          />
        </div>
      </div>

      <Show
        when={settings()}
        fallback={
          <div
            class="options-loading-skeletons"
            aria-label={t("general.loadingAria")}
          >
            <Skeleton class="options-skeleton" height={92} radius={12} />
          </div>
        }
      >
        <div class="options-settings-block">
          <h3>{t("general.transfers.title")}</h3>

          <div class="options-setting-row">
            <div class="options-setting-label">
              <div>{t("general.backgroundUpload.title")}</div>
              <div class="options-setting-hint">
                {t("general.backgroundUpload.hint")}
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
        <Alert
          class="options-alert options-alert-error"
          style="margin-top: 12px;"
        >
          <span class="material-symbols-rounded" aria-hidden="true">
            error
          </span>
          <span>{saveError()}</span>
        </Alert>
      </Show>
    </div>
  );
}
