import { createSignal, JSX, Show } from "solid-js";
import { Dialog } from "@kobalte/core/dialog";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Button } from "@kobalte/core/button";
import { TextField } from "@kobalte/core/text-field";
import { createFolder } from "../services/driveApi";
import { addFilesToUploadQueue } from "../services/uploadManager";
import { FileTypeIcon } from "../fileTypes";

type CreateOption = {
  id: string;
  label: string;
  icon: () => JSX.Element;
  action: () => void;
};

type CreateButtonProps = {
  currentFolderId: string | null;
};

export function CreateButton(props: CreateButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);
  const [folderName, setFolderName] = createSignal("Без названия");
  const [isCreating, setIsCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  
  let fileInputRef: HTMLInputElement | undefined;

  const handleCreateFolder = async () => {
    setError(null);
    setIsCreating(true);

    const result = await createFolder(folderName());

    setIsCreating(false);

    if (result.ok) {
      setIsDialogOpen(false);
      setFolderName("Без названия");
      // TODO: refresh the drive browser or notify parent
      console.log("Папка создана:", result.folder);
    } else {
      setError(result.error);
    }
  };

  const openDialog = () => {
    setIsDialogOpen(true);
    setError(null);
  };

  const openGoogleDoc = (type: "document" | "spreadsheets" | "presentation" | "forms") => {
    const baseUrls = {
      document: "https://docs.google.com/document/create",
      spreadsheets: "https://docs.google.com/spreadsheets/create",
      presentation: "https://docs.google.com/presentation/create",
      forms: "https://docs.google.com/forms/create",
    };

    const url = baseUrls[type];
    if (browser.tabs?.create) {
      browser.tabs.create({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleFileSelect = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      addFilesToUploadQueue(files, props.currentFolderId);
      input.value = ""; // Сброс для повторного выбора тех же файлов
    }
  };

  const openFileDialog = () => {
    fileInputRef?.click();
  };

  const createOptions: CreateOption[] = [
    {
      id: "folder",
      label: "Создать папку",
      icon: () => <FileTypeIcon mimeType="application/vnd.google-apps.folder" />,
      action: openDialog,
    },
    {
      id: "upload",
      label: "Загрузить файлы",
      icon: () => (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 17h16v2H4z" fill="currentColor" />
          <path
            d="M12 4v9m0 0-3.5-3.5M12 13l3.5-3.5"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.9"
          />
        </svg>
      ),
      action: openFileDialog,
    },
    {
      id: "document",
      label: "Google Документы",
      icon: () => <FileTypeIcon mimeType="application/vnd.google-apps.document" />,
      action: () => openGoogleDoc("document"),
    },
    {
      id: "spreadsheets",
      label: "Google Таблицы",
      icon: () => <FileTypeIcon mimeType="application/vnd.google-apps.spreadsheet" />,
      action: () => openGoogleDoc("spreadsheets"),
    },
    {
      id: "presentation",
      label: "Google Презентации",
      icon: () => <FileTypeIcon mimeType="application/vnd.google-apps.presentation" />,
      action: () => openGoogleDoc("presentation"),
    },
    {
      id: "forms",
      label: "Google Формы",
      icon: () => <FileTypeIcon mimeType="application/vnd.google-apps.form" />,
      action: () => openGoogleDoc("forms"),
    },
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger as={Button} class="create-button" aria-label="Создать">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="create-icon">
            <path
              d="M18 13h-5v5c0 .55-.45 1-1 1s-1-.45-1-1v-5H6c-.55 0-1-.45-1-1s.45-1 1-1h5V6c0-.55.45-1 1-1s1 .45 1 1v5h5c.55 0 1 .45 1 1s-.45 1-1 1z"
              fill="currentColor"
            />
          </svg>
          <span class="create-label">Создать</span>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content class="create-menu-content">
            {createOptions.map((option) => (
              <DropdownMenu.Item
                class="create-menu-item"
                onSelect={option.action}
              >
                <span class="create-menu-item-icon">{option.icon()}</span>
                <span class="create-menu-item-label">{option.label}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        class="upload-file-input"
        onChange={handleFileSelect}
      />

      <Dialog open={isDialogOpen()} onOpenChange={setIsDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay class="dialog-overlay" />
          <Dialog.Content class="dialog-content">
            <Dialog.Title class="dialog-title">Новая папка</Dialog.Title>

            <div class="dialog-body">
              <TextField
                value={folderName()}
                onChange={setFolderName}
                class="folder-name-field"
              >
                <TextField.Input
                  class="folder-name-input"
                  autofocus
                  onFocus={(e) => e.currentTarget.select()}
                />
              </TextField>

              <Show when={error()}>
                <div class="dialog-error">{error()}</div>
              </Show>
            </div>

            <div class="dialog-footer">
              <Button
                class="dialog-btn dialog-btn-cancel"
                onClick={() => setIsDialogOpen(false)}
                disabled={isCreating()}
              >
                Отмена
              </Button>
              <Button
                class="dialog-btn dialog-btn-create"
                onClick={handleCreateFolder}
                disabled={isCreating() || !folderName().trim()}
              >
                {isCreating() ? "Создание..." : "Создать"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
