import { createSignal, For, Show } from "solid-js";
import { ActivitySettings } from "./components/ActivitySettings";

type SettingsSection = {
  id: string;
  title: string;
  icon: string;
};

const sections: SettingsSection[] = [
  { id: "activity", title: "Активность", icon: "notifications" },
  { id: "general", title: "Общие", icon: "settings" },
  { id: "about", title: "О расширении", icon: "info" },
];

export function OptionsApp() {
  const [activeSection, setActiveSection] = createSignal<string>("activity");

  return (
    <div class="options-layout">
      <aside class="options-sidebar">
        <div class="options-header">
          <div class="options-logo">
            <img src="/icon/128.png" alt="Logo" width="32" height="32" />
            <h1>Google Drive Go</h1>
          </div>
        </div>

        <nav class="options-nav">
          <For each={sections}>
            {(section) => (
              <button
                class={`options-nav-item ${activeSection() === section.id ? "options-nav-item-active" : ""}`}
                onClick={() => setActiveSection(section.id)}
              >
                <span class="material-symbols-rounded">{section.icon}</span>
                <span>{section.title}</span>
              </button>
            )}
          </For>
        </nav>
      </aside>

      <main class="options-content">
        <Show when={activeSection() === "activity"}>
          <ActivitySettings />
        </Show>

        <Show when={activeSection() === "general"}>
          <div class="options-section">
            <h2>Общие настройки</h2>
            <p class="options-section-description">
              Здесь будут общие настройки расширения
            </p>
          </div>
        </Show>

        <Show when={activeSection() === "about"}>
          <div class="options-section">
            <h2>О расширении</h2>
            <p class="options-section-description">
              Google Drive Go - компактное расширение для работы с Google Drive
            </p>
            <div class="options-about-version">
              <strong>Версия:</strong> 1.0.0
            </div>
          </div>
        </Show>
      </main>
    </div>
  );
}
