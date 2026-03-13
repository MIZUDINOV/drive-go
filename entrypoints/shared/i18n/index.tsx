import {
  createContext,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type ParentComponent,
} from "solid-js";
import { translator } from "@solid-primitives/i18n";
import { dict as enDict, type Dictionary } from "./locales/en";

const STORAGE_KEY = "uiLocale";

export const SUPPORTED_LOCALES = ["en", "ru"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type TranslationKey = keyof Dictionary;

type I18nContextValue = {
  locale: Accessor<Locale>;
  isDictionaryLoading: Accessor<boolean>;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
};

const I18nContext = createContext<I18nContextValue>();

function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

async function fetchDictionary(locale: Locale): Promise<Dictionary> {
  if (locale === "ru") {
    const module = await import("./locales/ru");
    return module.dict;
  }

  return enDict;
}

async function loadStoredLocale(): Promise<Locale | null> {
  try {
    const result = await browser.storage.sync.get(STORAGE_KEY);
    const rawValue: unknown = result[STORAGE_KEY];
    if (isLocale(rawValue)) {
      return rawValue;
    }
  } catch {
    return null;
  }

  return null;
}

export const I18nProvider: ParentComponent = (props) => {
  const [locale, setLocaleSignal] = createSignal<Locale>("en");
  const [dictionary] = createResource(locale, fetchDictionary, {
    initialValue: enDict,
  });

  const mergedDictionary = createMemo<Dictionary>(() => {
    const current = dictionary();
    return {
      ...enDict,
      ...(current ?? {}),
    };
  });

  const translate = translator(mergedDictionary);

  const t = (key: TranslationKey, params?: Record<string, string>): string => {
    return translate(key, params) ?? enDict[key] ?? key;
  };

  const setLocale = (next: Locale): void => {
    setLocaleSignal(next);
    void browser.storage.sync.set({ [STORAGE_KEY]: next });
  };

  onMount(() => {
    const handleStorageChanged = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (areaName !== "sync") {
        return;
      }

      const localeChange = changes[STORAGE_KEY];
      if (!localeChange || !isLocale(localeChange.newValue)) {
        return;
      }

      setLocaleSignal(localeChange.newValue);
    };

    browser.storage.onChanged.addListener(handleStorageChanged);

    void loadStoredLocale().then((stored) => {
      if (stored) {
        setLocaleSignal(stored);
      }
    });

    onCleanup(() => {
      browser.storage.onChanged.removeListener(handleStorageChanged);
    });
  });

  return (
    <I18nContext.Provider
      value={{
        locale,
        isDictionaryLoading: () => dictionary.loading,
        setLocale,
        t,
      }}
    >
      {props.children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}
