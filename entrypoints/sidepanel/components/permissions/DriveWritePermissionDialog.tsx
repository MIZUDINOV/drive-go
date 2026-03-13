import { Show } from "solid-js";
import { AlertDialog } from "@kobalte/core/alert-dialog";
import { Button } from "@kobalte/core/button";
import { useI18n } from "../../../shared/i18n";

type DriveWritePermissionDialogProps = {
  open: boolean;
  isRequestInProgress: boolean;
  errorMessage: string | null;
  onOpenChange: (open: boolean) => void;
  onRequestAccess: () => Promise<void>;
};

export function DriveWritePermissionDialog(
  props: DriveWritePermissionDialogProps,
) {
  const { t } = useI18n();
  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay class="dialog-overlay" />
        <AlertDialog.Content class="dialog-content permission-dialog-content">
          <AlertDialog.Title class="dialog-title">
            {t("drive.permission.title")}
          </AlertDialog.Title>

          <div class="dialog-body permission-dialog-body">
            <AlertDialog.Description class="permission-dialog-description">
              {t("drive.permission.description")}
            </AlertDialog.Description>

            <Show when={props.errorMessage}>
              {(message) => <div class="dialog-error">{message()}</div>}
            </Show>
          </div>

          <div class="dialog-footer">
            <Button
              class="dialog-btn dialog-btn-cancel"
              onClick={() => props.onOpenChange(false)}
              disabled={props.isRequestInProgress}
            >
              {t("drive.permission.cancel")}
            </Button>

            <Button
              class="dialog-btn dialog-btn-create"
              onClick={() => {
                void props.onRequestAccess();
              }}
              disabled={props.isRequestInProgress}
            >
              {props.isRequestInProgress
                ? t("drive.permission.requesting")
                : t("drive.permission.grant")}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog>
  );
}
