import { createSignal } from "solid-js";
import {
  checkActivityReadCapability,
  ensureActivityReadCapability,
} from "../../services/permissionCapabilities";

export function useActivityReadPermissionGate() {
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] =
    createSignal(false);
  const [isPermissionRequestInProgress, setIsPermissionRequestInProgress] =
    createSignal(false);
  const [permissionRequestError, setPermissionRequestError] = createSignal<
    string | null
  >(null);

  const ensureActivityReadOrRequest = async (
    message: string,
  ): Promise<boolean> => {
    const hasCapability = await checkActivityReadCapability();
    if (hasCapability) {
      return true;
    }

    setPermissionRequestError(message);
    setIsPermissionDialogOpen(true);
    return false;
  };

  const requestActivityReadAccess = async (): Promise<boolean> => {
    setIsPermissionRequestInProgress(true);
    const result = await ensureActivityReadCapability();
    setIsPermissionRequestInProgress(false);

    if (!result.ok) {
      setPermissionRequestError(result.message);
      return false;
    }

    setPermissionRequestError(null);
    setIsPermissionDialogOpen(false);
    return true;
  };

  return {
    isPermissionDialogOpen,
    isPermissionRequestInProgress,
    permissionRequestError,
    setIsPermissionDialogOpen,
    ensureActivityReadOrRequest,
    requestActivityReadAccess,
  };
}
