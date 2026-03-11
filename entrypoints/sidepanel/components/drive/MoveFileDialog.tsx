import { createSignal, createEffect, For, Show } from "solid-js";
import { Dialog } from "@kobalte/core/dialog";
import { Button } from "@kobalte/core/button";
import { RadioGroup } from "@kobalte/core/radio-group";
import type { DriveItem } from "./driveTypes";
import type { DriveApiFile } from "./driveTypes";
import { listAllFolders, moveFile } from "../../services/driveApi";
import { FileTypeIcon } from "../../fileTypes";

type MoveFileDialogProps = {
  item: DriveItem | null;
  currentFolderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoveSuccess: (targetFolderId: string) => void;
};

export function MoveFileDialog(props: MoveFileDialogProps) {
  const [folders, setFolders] = createSignal<DriveApiFile[]>([]);
  const [selectedFolderId, setSelectedFolderId] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isMoving, setIsMoving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (props.open && props.item) {
      loadFolders();
      setSelectedFolderId(null);
      setError(null);
    }
  });

  const loadFolders = async () => {
    setIsLoading(true);
    const folderList = await listAllFolders();
    setFolders(folderList);
    setIsLoading(false);
  };

  const handleMove = async () => {
    const folderId = selectedFolderId();
    const item = props.item;

    if (!folderId || !item) return;

    setError(null);
    setIsMoving(true);

    const result = await moveFile(item.id, folderId, props.currentFolderId);

    setIsMoving(false);

    if (result.ok) {
      props.onOpenChange(false);
      props.onMoveSuccess(folderId);
    } else {
      setError(result.error);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="dialog-overlay" />
        <Dialog.Content class="dialog-content move-file-dialog-content">
          <Dialog.Title class="dialog-title">
            Перемещение объекта "{props.item?.name}"
          </Dialog.Title>

          <div class="dialog-body move-file-dialog-body">
            <Show
              when={!isLoading()}
              fallback={
                <div class="move-file-loading">Загрузка папок...</div>
              }
            >
              <Show
                when={folders().length > 0}
                fallback={
                  <div class="move-file-empty">Папки не найдены</div>
                }
              >
                <RadioGroup
                  value={selectedFolderId() ?? ""}
                  onChange={setSelectedFolderId}
                  class="move-file-folders"
                >
                  <For each={folders()}>
                    {(folder) => (
                      <RadioGroup.Item value={folder.id} class="move-file-folder-item">
                        <RadioGroup.ItemInput class="move-file-folder-input" />
                        <RadioGroup.ItemControl class="move-file-folder-control">
                          <RadioGroup.ItemIndicator class="move-file-folder-indicator" />
                        </RadioGroup.ItemControl>
                        <RadioGroup.ItemLabel class="move-file-folder-label">
                          <span class="move-file-folder-icon">
                            <FileTypeIcon mimeType={folder.mimeType} />
                          </span>
                          <span class="move-file-folder-name">{folder.name}</span>
                        </RadioGroup.ItemLabel>
                      </RadioGroup.Item>
                    )}
                  </For>
                </RadioGroup>
              </Show>
            </Show>

            <Show when={error()}>
              <div class="dialog-error">{error()}</div>
            </Show>
          </div>

          <div class="dialog-footer">
            <Button
              class="dialog-btn dialog-btn-cancel"
              onClick={() => props.onOpenChange(false)}
              disabled={isMoving()}
            >
              Отмена
            </Button>
            <Button
              class="dialog-btn dialog-btn-create"
              onClick={handleMove}
              disabled={isMoving() || !selectedFolderId()}
            >
              {isMoving() ? "Перемещение..." : "Переместить"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
