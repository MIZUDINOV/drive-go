import type { DriveBrowserScope } from "../components/drive/useDriveBrowser";
import { DriveViewMode } from "../components/drive/driveTypes";

export enum DriveViewModePreferenceStorageKey {
  ByScope = "driveViewModeByScope",
}

export enum DriveViewModePreferenceScope {
  MyDrive = "my-drive",
  Recent = "recent",
  Shared = "shared",
  Starred = "starred",
}

type ViewModeByScopeRecord = Partial<
  Record<DriveViewModePreferenceScope, DriveViewMode>
>;

const SUPPORTED_SCOPES = new Set<DriveViewModePreferenceScope>([
  DriveViewModePreferenceScope.MyDrive,
  DriveViewModePreferenceScope.Recent,
  DriveViewModePreferenceScope.Shared,
  DriveViewModePreferenceScope.Starred,
]);

function isViewMode(value: unknown): value is DriveViewMode {
  return value === DriveViewMode.List || value === DriveViewMode.Grid;
}

function isPreferenceScope(
  value: DriveBrowserScope,
): value is DriveViewModePreferenceScope {
  return (
    value === DriveViewModePreferenceScope.MyDrive ||
    value === DriveViewModePreferenceScope.Recent ||
    value === DriveViewModePreferenceScope.Shared ||
    value === DriveViewModePreferenceScope.Starred
  );
}

function normalizeStoredViewModes(value: unknown): ViewModeByScopeRecord {
  if (!value || typeof value !== "object") {
    return {};
  }

  const result: ViewModeByScopeRecord = {};
  const source = value as Record<string, unknown>;

  if (isViewMode(source[DriveViewModePreferenceScope.MyDrive])) {
    result[DriveViewModePreferenceScope.MyDrive] =
      source[DriveViewModePreferenceScope.MyDrive];
  }

  if (isViewMode(source[DriveViewModePreferenceScope.Recent])) {
    result[DriveViewModePreferenceScope.Recent] =
      source[DriveViewModePreferenceScope.Recent];
  }

  if (isViewMode(source[DriveViewModePreferenceScope.Shared])) {
    result[DriveViewModePreferenceScope.Shared] =
      source[DriveViewModePreferenceScope.Shared];
  }

  if (isViewMode(source[DriveViewModePreferenceScope.Starred])) {
    result[DriveViewModePreferenceScope.Starred] =
      source[DriveViewModePreferenceScope.Starred];
  }

  return result;
}

export function getDefaultDriveViewMode(): DriveViewMode {
  return DriveViewMode.List;
}

export async function getDriveViewModeForScope(
  scope: DriveBrowserScope,
): Promise<DriveViewMode> {
  if (!isPreferenceScope(scope)) {
    return getDefaultDriveViewMode();
  }

  const storage = await browser.storage.local.get(
    DriveViewModePreferenceStorageKey.ByScope,
  );
  const raw = storage[DriveViewModePreferenceStorageKey.ByScope];
  const record = normalizeStoredViewModes(raw);
  const storedMode = record[scope];
  return isViewMode(storedMode) ? storedMode : getDefaultDriveViewMode();
}

export async function setDriveViewModeForScope(
  scope: DriveBrowserScope,
  mode: DriveViewMode,
): Promise<void> {
  if (!isPreferenceScope(scope)) {
    return;
  }

  const storage = await browser.storage.local.get(
    DriveViewModePreferenceStorageKey.ByScope,
  );
  const current = normalizeStoredViewModes(
    storage[DriveViewModePreferenceStorageKey.ByScope],
  );

  await browser.storage.local.set({
    [DriveViewModePreferenceStorageKey.ByScope]: {
      ...current,
      [scope]: mode,
    },
  });
}
