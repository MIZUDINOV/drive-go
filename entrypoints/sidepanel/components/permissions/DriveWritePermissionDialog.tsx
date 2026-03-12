import { Show } from "solid-js";
import { AlertDialog } from "@kobalte/core/alert-dialog";
import { Button } from "@kobalte/core/button";

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
  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay class="dialog-overlay" />
        <AlertDialog.Content class="dialog-content permission-dialog-content">
          <AlertDialog.Title class="dialog-title">
            Нужен доступ на изменение Drive
          </AlertDialog.Title>

          <div class="dialog-body permission-dialog-body">
            <AlertDialog.Description class="permission-dialog-description">
              Для этого действия нужно право на изменение файлов в Google Drive.
              Нажмите "Выдать доступ", чтобы продолжить и автоматически
              повторить действие.
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
              Отмена
            </Button>

            <Button
              class="dialog-btn dialog-btn-create"
              onClick={() => {
                void props.onRequestAccess();
              }}
              disabled={props.isRequestInProgress}
            >
              {props.isRequestInProgress ? "Запрос прав..." : "Выдать доступ"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog>
  );
}
