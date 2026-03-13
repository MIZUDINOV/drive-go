import { Show, createSignal } from "solid-js";
import { Dialog } from "@kobalte/core/dialog";
import { Button } from "@kobalte/core/button";
import type { DriveItem } from "./driveTypes";
import { useI18n } from "../../../shared/i18n";

type DeleteForeverDialogProps = {
  item: DriveItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (item: DriveItem) => Promise<boolean>;
};

export function DeleteForeverDialog(props: DeleteForeverDialogProps) {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleDelete = async (): Promise<void> => {
    const item = props.item;
    if (!item) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    const success = await props.onConfirm(item);
    setIsDeleting(false);

    if (success) {
      props.onOpenChange(false);
      return;
    }

    setError(t("drive.deleteDialog.error"));
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="dialog-overlay" />

        <Dialog.Content class="danger-delete-dialog-content">
          <Dialog.Title class="danger-delete-dialog-title">
            {t("drive.deleteDialog.title")}
          </Dialog.Title>

          <div class="danger-delete-dialog-body">
            <Dialog.Description class="danger-delete-dialog-description">
              {t("drive.deleteDialog.description", {
                name: props.item?.name ?? "",
              })}
            </Dialog.Description>

            <Show when={error()}>
              <div class="dialog-error">{error()}</div>
            </Show>
          </div>

          <div class="danger-delete-dialog-footer">
            <Button
              class="danger-delete-cancel-btn"
              onClick={() => props.onOpenChange(false)}
              disabled={isDeleting()}
            >
              {t("drive.deleteDialog.cancel")}
            </Button>

            <Button
              class="danger-delete-confirm-btn"
              onClick={() => void handleDelete()}
              disabled={isDeleting()}
            >
              {isDeleting()
                ? t("drive.deleteDialog.deleting")
                : t("drive.deleteDialog.confirm")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
