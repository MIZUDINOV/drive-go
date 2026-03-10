import { createSignal, Show } from "solid-js";
import { Dialog } from "@kobalte/core/dialog";
import { Button } from "@kobalte/core/button";
import type { DriveItem } from "./driveTypes";
import { isFolder } from "./driveTypes";
import { trashFile } from "../../services/driveApi";
import { markSavePathsFoldersDirty } from "../../../shared/savePathsSettings";

type TrashConfirmDialogProps = {
  item: DriveItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrashSuccess: () => void;
};

export function TrashConfirmDialog(props: TrashConfirmDialogProps) {
  const [isTrashing, setIsTrashing] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleTrash = async (): Promise<void> => {
    const item = props.item;
    if (!item) return;

    setError(null);
    setIsTrashing(true);

    const result = await trashFile(item.id);

    setIsTrashing(false);

    if (result.ok) {
      if (isFolder(item)) {
        await markSavePathsFoldersDirty();
      }

      props.onOpenChange(false);
      props.onTrashSuccess();
    } else {
      setError(result.error);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="dialog-overlay" />
        <Dialog.Content class="dialog-content">
          <Dialog.Title class="dialog-title">
            Отправить в корзину
          </Dialog.Title>

          <div class="dialog-body">
            <Dialog.Description>
              Объект «{props.item?.name}» будет перемещён в корзину.
            </Dialog.Description>

            <Show when={error()}>
              <div class="dialog-error">{error()}</div>
            </Show>
          </div>

          <div class="dialog-footer">
            <Button
              class="dialog-btn dialog-btn-cancel"
              onClick={() => props.onOpenChange(false)}
              disabled={isTrashing()}
            >
              Отмена
            </Button>
            <Button
              class="dialog-btn dialog-btn-create"
              onClick={() => void handleTrash()}
              disabled={isTrashing()}
            >
              {isTrashing() ? "Удаление..." : "В корзину"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
