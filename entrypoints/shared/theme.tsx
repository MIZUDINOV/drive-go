import {
  createContext,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type ParentComponent,
} from "solid-js";

const STORAGE_KEY = "uiTheme";

export const SUPPORTED_THEMES = ["light", "dark"] as const;
export type UiTheme = (typeof SUPPORTED_THEMES)[number];

type ThemeContextValue = {
  theme: Accessor<UiTheme>;
  setTheme: (next: UiTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue>();

function isTheme(value: unknown): value is UiTheme {
  return (
    typeof value === "string" &&
    (SUPPORTED_THEMES as readonly string[]).includes(value)
  );
}

function applyThemeToDocument(theme: UiTheme): void {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

async function loadStoredTheme(): Promise<UiTheme | null> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    const rawValue: unknown = result[STORAGE_KEY];
    if (isTheme(rawValue)) {
      return rawValue;
    }
  } catch {
    return null;
  }

  return null;
}

export const ThemeProvider: ParentComponent = (props) => {
  const [theme, setThemeSignal] = createSignal<UiTheme>("light");

  const setTheme = (next: UiTheme): void => {
    setThemeSignal(next);
    applyThemeToDocument(next);
    void browser.storage.local.set({ [STORAGE_KEY]: next });
  };

  onMount(() => {
    applyThemeToDocument(theme());

    const handleStorageChanged = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (areaName !== "local") {
        return;
      }

      const themeChange = changes[STORAGE_KEY];
      if (!themeChange || !isTheme(themeChange.newValue)) {
        return;
      }

      setThemeSignal(themeChange.newValue);
      applyThemeToDocument(themeChange.newValue);
    };

    browser.storage.onChanged.addListener(handleStorageChanged);

    void loadStoredTheme().then((storedTheme) => {
      if (!storedTheme) {
        return;
      }

      setThemeSignal(storedTheme);
      applyThemeToDocument(storedTheme);
    });

    onCleanup(() => {
      browser.storage.onChanged.removeListener(handleStorageChanged);
    });
  });

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
      }}
    >
      {props.children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
