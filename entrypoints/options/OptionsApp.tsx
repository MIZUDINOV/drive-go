import { For, createMemo } from "solid-js";
import { Portal } from "solid-js/web";
import { Toast } from "@kobalte/core/toast";
import { Tabs } from "@kobalte/core/tabs";
import { ActivitySettings } from "./components/ActivitySettings";
import { SavePathsSettings } from "./components/SavePathsSettings";
import { GeneralSettings } from "./components/GeneralSettings";
import { useI18n } from "../shared/i18n";

type SettingsSection = {
  id: string;
  title: string;
  icon: string;
};

export function OptionsApp() {
  const { t } = useI18n();
  const sections = createMemo<SettingsSection[]>(() => [
    { id: "activity", title: t("options.nav.activity"), icon: "notifications" },
    {
      id: "save-paths",
      title: t("options.nav.savePaths"),
      icon: "folder_managed",
    },
    { id: "general", title: t("options.nav.general"), icon: "settings" },
    { id: "about", title: t("options.nav.about"), icon: "info" },
  ]);

  return (
    <>
      <Portal>
        <Toast.Region>
          <Toast.List class="toast-list" />
        </Toast.Region>
      </Portal>
      <Tabs
        class="options-layout"
        defaultValue="activity"
        orientation="vertical"
      >
        <aside class="options-sidebar">
          <div class="options-header">
            <div class="options-logo">
              <img src="/icon/128.png" alt="Logo" width="32" height="32" />
              <h1>Drive GO</h1>
            </div>
          </div>

          <nav>
            <Tabs.List class="options-nav" aria-label={t("options.nav.aria")}>
              <For each={sections()}>
                {(section) => (
                  <Tabs.Trigger class="options-nav-item" value={section.id}>
                    <span class="material-symbols-rounded">{section.icon}</span>
                    <span>{section.title}</span>
                  </Tabs.Trigger>
                )}
              </For>
            </Tabs.List>
          </nav>
        </aside>

        <main class="options-content">
          <Tabs.Content value="activity">
            <ActivitySettings />
          </Tabs.Content>

          <Tabs.Content value="save-paths">
            <SavePathsSettings />
          </Tabs.Content>

          <Tabs.Content value="general">
            <GeneralSettings />
          </Tabs.Content>

          <Tabs.Content value="about">
            <div class="options-section">
              <h2>{t("options.about.title")}</h2>
              <p class="options-section-description">
                {t("options.about.description")}
              </p>
              <div class="options-about-version">
                <strong>{t("options.about.versionLabel")}:</strong> 1.0.0
              </div>
            </div>
          </Tabs.Content>
        </main>
      </Tabs>
    </>
  );
}
