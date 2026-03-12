import { createSignal } from "solid-js";
import {
  checkDriveWriteCapability,
  ensureDriveWriteCapability,
  isDriveWritePermissionDeniedError,
} from "../../services/permissionCapabilities";

type PermissionAction = () => Promise<void>;

export function useDriveWritePermissionGate() {
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] =
    createSignal(false);
  const [isPermissionRequestInProgress, setIsPermissionRequestInProgress] =
    createSignal(false);
  const [permissionRequestError, setPermissionRequestError] = createSignal<
    string | null
  >(null);
  const [pendingAction, setPendingAction] = createSignal<PermissionAction | null>(
    null,
  );

  const queuePermissionRequest = (
    message: string,
    action?: PermissionAction,
  ): void => {
    setPermissionRequestError(message);
    if (action) {
      setPendingAction(() => action);
    } else {
      setPendingAction(null);
    }
    setIsPermissionDialogOpen(true);
  };

  const ensureDriveWriteOrRequest = async (
    message: string,
    retryAction: PermissionAction,
  ): Promise<boolean> => {
    const hasWriteCapability = await checkDriveWriteCapability();
    if (hasWriteCapability) {
      return true;
    }

    queuePermissionRequest(message, retryAction);
    return false;
  };

  const handleDriveWriteDeniedFallback = (
    operationError: string,
    message: string,
    retryAction: PermissionAction,
  ): boolean => {
    if (!isDriveWritePermissionDeniedError(operationError)) {
      return false;
    }

    queuePermissionRequest(message, retryAction);
    return true;
  };

  const requestDriveWriteAccess = async (): Promise<void> => {
    setIsPermissionRequestInProgress(true);
    const result = await ensureDriveWriteCapability();
    setIsPermissionRequestInProgress(false);

    if (!result.ok) {
      setPermissionRequestError(result.message);
      return;
    }

    setIsPermissionDialogOpen(false);

    const nextAction = pendingAction();
    setPendingAction(null);
    if (nextAction) {
      await nextAction();
    }
  };

  return {
    isPermissionDialogOpen,
    isPermissionRequestInProgress,
    permissionRequestError,
    setIsPermissionDialogOpen,
    ensureDriveWriteOrRequest,
    handleDriveWriteDeniedFallback,
    requestDriveWriteAccess,
  };
}
