import { Show, createSignal } from "solid-js";
import { Dialog } from "@kobalte/core/dialog";
import { Button } from "@kobalte/core/button";
import { useI18n } from "../../../shared/i18n";

type EmptyTrashDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean>;
};

export function EmptyTrashDialog(props: EmptyTrashDialogProps) {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleDelete = async (): Promise<void> => {
    setError(null);
    setIsDeleting(true);

    const success = await props.onConfirm();
    setIsDeleting(false);

    if (success) {
      props.onOpenChange(false);
      return;
    }

    setError(t("drive.emptyTrashDialog.error"));
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="dialog-overlay" />

        <Dialog.Content class="danger-delete-dialog-content">
          <Dialog.Title class="danger-delete-dialog-title">
            {t("drive.emptyTrashDialog.title")}
          </Dialog.Title>

          <div class="danger-delete-dialog-body">
            <Dialog.Description class="danger-delete-dialog-description">
              {t("drive.emptyTrashDialog.description")}
            </Dialog.Description>

            <Show when={error()}>
              <div class="dialog-error">{error()}</div>
            </Show>
          </div>

          <div class="danger-delete-dialog-footer">
            <Button
              class="danger-delete-cancel-btn danger-delete-cancel-btn-neutral"
              onClick={() => props.onOpenChange(false)}
              disabled={isDeleting()}
            >
              {t("drive.emptyTrashDialog.cancel")}
            </Button>

            <Button
              class="danger-delete-confirm-btn"
              onClick={() => void handleDelete()}
              disabled={isDeleting()}
            >
              {isDeleting()
                ? t("drive.emptyTrashDialog.deleting")
                : t("drive.emptyTrashDialog.confirm")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
