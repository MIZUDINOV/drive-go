import { Button } from "@kobalte/core/button";
import "./Settings.css";

export function SettingsBrowser() {
  const handleOpenSettings = () => {
    browser.runtime.openOptionsPage();
  };

  return (
    <div class="settings-browser">
      <div class="settings-container">
        <div class="settings-empty-state">
          <span class="material-symbols-rounded">settings</span>
          <h2>Настройки</h2>
          <p>
            Откройте полную страницу настроек для управления всеми опциями
            расширения
          </p>

          <Button class="settings-open-btn" onClick={handleOpenSettings}>
            <span class="material-symbols-rounded">open_in_new</span>
            <span>Открыть настройки</span>
          </Button>
        </div>

        <div class="settings-info">
          <div class="settings-section">
            <h3>Активность</h3>
            <p>
              Настройте типы уведомлений, интервал синхронизации и другие
              параметры активности
            </p>
          </div>

          <div class="settings-section">
            <h3>Общие</h3>
            <p>Базовые настройки расширения</p>
          </div>

          <div class="settings-section">
            <h3>О расширении</h3>
            <p>Информация о версии и ссылки на ресурсы</p>
          </div>
        </div>
      </div>
    </div>
  );
}
