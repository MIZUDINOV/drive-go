import { dict as enDict, type Dictionary } from "./locales/en";

const STORAGE_KEY = "uiLocale";

export const RUNTIME_SUPPORTED_LOCALES = ["en", "ru"] as const;
export type RuntimeLocale = (typeof RUNTIME_SUPPORTED_LOCALES)[number];
export type RuntimeTranslationKey = keyof Dictionary;

let cachedLocale: RuntimeLocale = "en";
let cachedDictionary: Dictionary = enDict;
let runtimeInitialized = false;
let loadPromise: Promise<void> | null = null;

function isLocale(value: unknown): value is RuntimeLocale {
  return (
    typeof value === "string" &&
    (RUNTIME_SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

function interpolate(
  template: string,
  params?: Record<string, string>,
): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    return params[key] ?? match;
  });
}

async function fetchDictionary(locale: RuntimeLocale): Promise<Dictionary> {
  if (locale === "ru") {
    const module = await import("./locales/ru");
    return module.dict;
  }

  return enDict;
}

async function syncLocale(locale: RuntimeLocale): Promise<void> {
  cachedLocale = locale;
  cachedDictionary = await fetchDictionary(locale);
}

async function loadStoredLocaleInternal(): Promise<void> {
  try {
    const result = await browser.storage.sync.get(STORAGE_KEY);
    const rawValue: unknown = result[STORAGE_KEY];
    if (isLocale(rawValue)) {
      await syncLocale(rawValue);
      return;
    }
  } catch {
    // Fall back to English dictionary when storage is unavailable.
  }

  cachedLocale = "en";
  cachedDictionary = enDict;
}

function ensureRuntimeInitialized(): void {
  if (runtimeInitialized) {
    return;
  }

  runtimeInitialized = true;
  loadPromise = loadStoredLocaleInternal();

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }

    const localeChange = changes[STORAGE_KEY];
    if (!localeChange || !isLocale(localeChange.newValue)) {
      return;
    }

    loadPromise = syncLocale(localeChange.newValue);
  });
}

ensureRuntimeInitialized();

export async function getStoredLocaleOrDefault(): Promise<RuntimeLocale> {
  ensureRuntimeInitialized();
  if (loadPromise) {
    await loadPromise;
  }

  return cachedLocale;
}

export function translateCurrentLocale(
  key: RuntimeTranslationKey,
  params?: Record<string, string>,
): string {
  ensureRuntimeInitialized();
  return interpolate(cachedDictionary[key] ?? enDict[key] ?? key, params);
}

export async function translateStoredLocale(
  key: RuntimeTranslationKey,
  params?: Record<string, string>,
): Promise<string> {
  await getStoredLocaleOrDefault();
  return translateCurrentLocale(key, params);
}
