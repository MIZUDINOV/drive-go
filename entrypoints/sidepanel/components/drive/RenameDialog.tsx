import { createSignal, createEffect, Show } from "solid-js";
import { Dialog } from "@kobalte/core/dialog";
import { Button } from "@kobalte/core/button";
import { TextField } from "@kobalte/core/text-field";
import type { DriveItem } from "./driveTypes";
import { renameFile } from "../../services/driveApi";

type RenameDialogProps = {
  item: DriveItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenameSuccess: () => void;
};

function splitExtension(fileName: string): {
  baseName: string;
  extension: string;
} {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex > 0) {
    return {
      baseName: fileName.slice(0, dotIndex),
      extension: fileName.slice(dotIndex),
    };
  }
  return { baseName: fileName, extension: "" };
}

export function RenameDialog(props: RenameDialogProps) {
  const [baseName, setBaseName] = createSignal("");
  const [extension, setExtension] = createSignal("");
  const [isRenaming, setIsRenaming] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (props.open && props.item) {
      const { baseName: base, extension: ext } = splitExtension(
        props.item.name,
      );
      setBaseName(base);
      setExtension(ext);
      setError(null);
    }
  });

  const fullName = (): string => baseName().trim() + extension();

  const handleRename = async (): Promise<void> => {
    const item = props.item;
    const newFullName = fullName();

    if (!item || !baseName().trim() || newFullName === item.name) return;

    setError(null);
    setIsRenaming(true);

    const result = await renameFile(item.id, newFullName);

    setIsRenaming(false);

    if (result.ok) {
      props.onOpenChange(false);
      props.onRenameSuccess();
    } else {
      setError(result.error);
    }
  };

  const canSubmit = (): boolean => {
    const trimmed = baseName().trim();
    return (
      trimmed.length > 0 && fullName() !== props.item?.name && !isRenaming()
    );
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="dialog-overlay" />
        <Dialog.Content class="dialog-content">
          <Dialog.Title class="dialog-title">Переименовать</Dialog.Title>

          <div class="dialog-body">
            <TextField
              value={baseName()}
              onChange={setBaseName}
              class="folder-name-field"
            >
              <TextField.Input
                class="folder-name-input"
                autofocus
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit()) {
                    void handleRename();
                  }
                }}
              />
            </TextField>

            <Show when={error()}>
              <div class="dialog-error">{error()}</div>
            </Show>
          </div>

          <div class="dialog-footer">
            <Button
              class="dialog-btn dialog-btn-cancel"
              onClick={() => props.onOpenChange(false)}
              disabled={isRenaming()}
            >
              Отмена
            </Button>
            <Button
              class="dialog-btn dialog-btn-create"
              onClick={() => void handleRename()}
              disabled={!canSubmit()}
            >
              {isRenaming() ? "Переименование..." : "ОК"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
