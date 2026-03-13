import { render } from "solid-js/web";
import { I18nProvider } from "../shared/i18n";
import { ThemeProvider } from "../shared/theme";

import "./style.css";
import App from "./App";

render(
  () => (
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  ),
  document.getElementById("root")!,
);
