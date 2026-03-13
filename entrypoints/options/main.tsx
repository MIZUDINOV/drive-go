import { render } from "solid-js/web";
import { OptionsApp } from "./OptionsApp";
import { I18nProvider } from "../shared/i18n";
import { ThemeProvider } from "../shared/theme";
import "material-symbols/rounded.css";
import "./options.css";

const root = document.getElementById("root");

if (root) {
  render(
    () => (
      <ThemeProvider>
        <I18nProvider>
          <OptionsApp />
        </I18nProvider>
      </ThemeProvider>
    ),
    root,
  );
}
