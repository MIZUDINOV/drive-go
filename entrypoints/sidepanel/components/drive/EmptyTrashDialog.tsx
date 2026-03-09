import { Show, createSignal } from "solid-js";
import { Dialog } from "@kobalte/core/dialog";
import { Button } from "@kobalte/core/button";

type EmptyTrashDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean>;
};

export function EmptyTrashDialog(props: EmptyTrashDialogProps) {
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

    setError("Не удалось очистить корзину. Попробуйте еще раз.");
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
              Все объекты в корзине будут удалены навсегда. Это действие нельзя
              отменить.
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
