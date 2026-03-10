import { For } from "solid-js";
import { Portal } from "solid-js/web";
import { Toast } from "@kobalte/core/toast";
import { Tabs } from "@kobalte/core/tabs";
import { ActivitySettings } from "./components/ActivitySettings";
import { SavePathsSettings } from "./components/SavePathsSettings";

type SettingsSection = {
  id: string;
  title: string;
  icon: string;
};

const sections: SettingsSection[] = [
  { id: "activity", title: "Активность", icon: "notifications" },
  { id: "save-paths", title: "Пути сохранения", icon: "folder_managed" },
  { id: "general", title: "Общие", icon: "settings" },
  { id: "about", title: "О расширении", icon: "info" },
];

export function OptionsApp() {
  return (
    <>
      <Portal>
        <Toast.Region>
          <Toast.List class="toast-list" />
        </Toast.Region>
      </Portal>
      <Tabs class="options-layout" defaultValue="activity" orientation="vertical">
        <aside class="options-sidebar">
          <div class="options-header">
            <div class="options-logo">
              <img src="/icon/128.png" alt="Logo" width="32" height="32" />
              <h1>Google Drive Go</h1>
            </div>
          </div>

          <nav>
            <Tabs.List class="options-nav" aria-label="Разделы настроек">
              <For each={sections}>
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
            <div class="options-section">
              <h2>Общие настройки</h2>
              <p class="options-section-description">
                Здесь будут общие настройки расширения
              </p>
            </div>
          </Tabs.Content>

          <Tabs.Content value="about">
            <div class="options-section">
              <h2>О расширении</h2>
              <p class="options-section-description">
                Google Drive Go - компактное расширение для работы с Google Drive
              </p>
              <div class="options-about-version">
                <strong>Версия:</strong> 1.0.0
              </div>
            </div>
          </Tabs.Content>
        </main>
      </Tabs>
    </>
  );
}
