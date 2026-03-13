import { BehaviorSubject, type Subscription } from "rxjs";
import {
  getCachedGrantedScopes,
  getGrantedScopes,
  hasGrantedScope,
  isAuthFlowCancelledError,
  OAUTH_SCOPE_DRIVE_ACTIVITY_READONLY,
  OAUTH_SCOPE_DRIVE_WRITE,
  startInteractiveSignIn,
} from "./authService";
import { translateCurrentLocale } from "../../shared/i18n/runtime";

const DRIVE_WRITE_SCOPE = OAUTH_SCOPE_DRIVE_WRITE;
const DRIVE_ACTIVITY_READ_SCOPE = OAUTH_SCOPE_DRIVE_ACTIVITY_READONLY;

export type DriveCapabilityStatus = "unknown" | "granted" | "denied";

export type PermissionCapabilitiesState = {
  driveWrite: DriveCapabilityStatus;
  activityRead: DriveCapabilityStatus;
  grantedScopes: string[];
  isScopesSyncInProgress: boolean;
  isRequestInProgress: boolean;
  lastRequestError: string | null;
};

export type EnsureCapabilityResult =
  | { ok: true }
  | {
      ok: false;
      reason: "cancelled" | "error";
      message: string;
      code?: "not-granted";
    };

const INITIAL_CAPABILITIES_STATE: PermissionCapabilitiesState = {
  driveWrite: "unknown",
  activityRead: "unknown",
  grantedScopes: [],
  isScopesSyncInProgress: false,
  isRequestInProgress: false,
  lastRequestError: null,
};

const permissionCapabilities$ =
  new BehaviorSubject<PermissionCapabilitiesState>(INITIAL_CAPABILITIES_STATE);

function updateState(
  patch: Partial<PermissionCapabilitiesState>,
): PermissionCapabilitiesState {
  const nextState = {
    ...permissionCapabilities$.value,
    ...patch,
  } satisfies PermissionCapabilitiesState;

  permissionCapabilities$.next(nextState);
  return nextState;
}

function getDriveWriteStatusFromScopes(
  scopes: string[],
): DriveCapabilityStatus {
  return hasGrantedScope(scopes, DRIVE_WRITE_SCOPE) ? "granted" : "denied";
}

function getActivityReadStatusFromScopes(
  scopes: string[],
): DriveCapabilityStatus {
  return hasGrantedScope(scopes, DRIVE_ACTIVITY_READ_SCOPE)
    ? "granted"
    : "denied";
}

function applyGrantedScopes(scopes: string[]): PermissionCapabilitiesState {
  return updateState({
    grantedScopes: scopes,
    driveWrite: getDriveWriteStatusFromScopes(scopes),
    activityRead: getActivityReadStatusFromScopes(scopes),
    lastRequestError: null,
  });
}

function normalizeCapabilityError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return translateCurrentLocale("permission.error.requestFailed");
}

export function getPermissionCapabilitiesSnapshot(): PermissionCapabilitiesState {
  return permissionCapabilities$.value;
}

export function subscribePermissionCapabilities(
  onState: (state: PermissionCapabilitiesState) => void,
): Subscription {
  return permissionCapabilities$.subscribe(onState);
}

export function isDriveWritePermissionDeniedError(
  errorMessage: string,
): boolean {
  const normalized = errorMessage.toLowerCase();

  return (
    normalized.includes("auth_required") ||
    normalized.includes("insufficient") ||
    normalized.includes("insufficient authentication scopes") ||
    normalized.includes("request had insufficient authentication scopes") ||
    normalized.includes("insufficientpermissions") ||
    normalized.includes("does not have permission") ||
    normalized.includes("403")
  );
}

export async function syncGrantedScopes(options?: {
  forceRefresh?: boolean;
}): Promise<string[]> {
  updateState({ isScopesSyncInProgress: true });

  try {
    const scopes = await getGrantedScopes(options?.forceRefresh ?? false);
    applyGrantedScopes(scopes);
    return scopes;
  } finally {
    updateState({ isScopesSyncInProgress: false });
  }
}

export async function checkDriveWriteCapability(): Promise<boolean> {
  const snapshot = getPermissionCapabilitiesSnapshot();

  if (snapshot.driveWrite === "granted") {
    return true;
  }

  const scopes = await syncGrantedScopes();
  return hasGrantedScope(scopes, DRIVE_WRITE_SCOPE);
}

export async function checkActivityReadCapability(): Promise<boolean> {
  const snapshot = getPermissionCapabilitiesSnapshot();

  if (snapshot.activityRead === "granted") {
    return true;
  }

  const scopes = await syncGrantedScopes();
  return hasGrantedScope(scopes, DRIVE_ACTIVITY_READ_SCOPE);
}

export async function checkActivityReadCapabilityLocally(): Promise<boolean> {
  const snapshot = getPermissionCapabilitiesSnapshot();

  if (snapshot.activityRead === "granted") {
    return true;
  }

  const scopes = await getCachedGrantedScopes();
  applyGrantedScopes(scopes);
  return hasGrantedScope(scopes, DRIVE_ACTIVITY_READ_SCOPE);
}

export function markDriveWriteAsGranted(): void {
  const currentScopes = getPermissionCapabilitiesSnapshot().grantedScopes;
  const mergedScopes = currentScopes.includes(DRIVE_WRITE_SCOPE)
    ? currentScopes
    : [...currentScopes, DRIVE_WRITE_SCOPE];

  applyGrantedScopes(mergedScopes);
}

export function markDriveWriteAsDenied(errorMessage: string): void {
  updateState({
    driveWrite: "denied",
    lastRequestError: errorMessage,
  });
}

export async function ensureDriveWriteCapability(): Promise<EnsureCapabilityResult> {
  const hasCapability = await checkDriveWriteCapability();
  if (hasCapability) {
    return { ok: true };
  }

  updateState({ isRequestInProgress: true, lastRequestError: null });

  try {
    await startInteractiveSignIn([DRIVE_WRITE_SCOPE]);
    const scopes = await syncGrantedScopes({ forceRefresh: true });
    const hasDriveWriteScope = hasGrantedScope(scopes, DRIVE_WRITE_SCOPE);

    updateState({
      isRequestInProgress: false,
    });

    if (!hasDriveWriteScope) {
      const message = translateCurrentLocale(
        "permission.driveWrite.notGranted",
      );
      markDriveWriteAsDenied(message);
      return {
        ok: false,
        reason: "error",
        message,
        code: "not-granted",
      };
    }

    markDriveWriteAsGranted();

    return { ok: true };
  } catch (error: unknown) {
    const message = normalizeCapabilityError(error);
    const reason = isAuthFlowCancelledError(error) ? "cancelled" : "error";

    markDriveWriteAsDenied(message);

    updateState({
      isRequestInProgress: false,
    });

    return {
      ok: false,
      reason,
      message,
    };
  }
}

export async function ensureActivityReadCapability(): Promise<EnsureCapabilityResult> {
  const hasCapability = await checkActivityReadCapability();
  if (hasCapability) {
    return { ok: true };
  }

  updateState({ isRequestInProgress: true, lastRequestError: null });

  try {
    await startInteractiveSignIn([DRIVE_ACTIVITY_READ_SCOPE]);
    const scopes = await syncGrantedScopes({ forceRefresh: true });
    const hasActivityReadScope = hasGrantedScope(
      scopes,
      DRIVE_ACTIVITY_READ_SCOPE,
    );

    updateState({
      isRequestInProgress: false,
    });

    if (!hasActivityReadScope) {
      const message = translateCurrentLocale(
        "permission.activityRead.notGranted",
      );

      updateState({
        activityRead: "denied",
        lastRequestError: message,
      });

      return {
        ok: false,
        reason: "error",
        message,
        code: "not-granted",
      };
    }

    applyGrantedScopes(scopes);
    return { ok: true };
  } catch (error: unknown) {
    const message = normalizeCapabilityError(error);
    const reason = isAuthFlowCancelledError(error) ? "cancelled" : "error";

    updateState({
      activityRead: "denied",
      lastRequestError: message,
      isRequestInProgress: false,
    });

    return {
      ok: false,
      reason,
      message,
    };
  }
}
