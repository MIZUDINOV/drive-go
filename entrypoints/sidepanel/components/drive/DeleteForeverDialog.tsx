import { Show, createSignal } from "solid-js";
import { Dialog } from "@kobalte/core/dialog";
import { Button } from "@kobalte/core/button";
import type { DriveItem } from "./driveTypes";

type DeleteForeverDialogProps = {
  item: DriveItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (item: DriveItem) => Promise<boolean>;
};

export function DeleteForeverDialog(props: DeleteForeverDialogProps) {
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

    setError("Не удалось удалить объект. Попробуйте еще раз.");
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="dialog-overlay" />

        <Dialog.Content class="danger-delete-dialog-content">
          <Dialog.Title class="danger-delete-dialog-title">
            Удалить навсегда?
          </Dialog.Title>

          <div class="danger-delete-dialog-body">
            <Dialog.Description class="danger-delete-dialog-description">
              Объект "{props.item?.name}" будет удален навсегда. Это действие
              нельзя отменить.
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
              Отмена
            </Button>

            <Button
              class="danger-delete-confirm-btn"
              onClick={() => void handleDelete()}
              disabled={isDeleting()}
            >
              {isDeleting() ? "Удаление..." : "Удалить"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
