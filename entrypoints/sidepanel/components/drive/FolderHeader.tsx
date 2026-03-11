import { For, Show, JSX, createSignal } from "solid-js";
import { Breadcrumbs } from "@kobalte/core/breadcrumbs";
import { Button } from "@kobalte/core/button";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Dialog } from "@kobalte/core/dialog";
import { TextField } from "@kobalte/core/text-field";
import { FileTypeIcon } from "../../fileTypes";
import { useDriveBrowser } from "./useDriveBrowser";
import { createFolder } from "../../services/driveApi";
import { enqueueFilesForUpload } from "../../services/transferQueueClient";

export function FolderHeader() {
  const browserState = useDriveBrowser();
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);
  const [folderName, setFolderName] = createSignal("Без названия");
  const [isCreating, setIsCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let fileInputRef: HTMLInputElement | undefined;

  const handleCreateFolder = async () => {
    setError(null);
    setIsCreating(true);

    const result = await createFolder(folderName(), browserState.currentFolderId());

    setIsCreating(false);

    if (result.ok) {
      setIsDialogOpen(false);
      setFolderName("Без названия");
      await browserState.refresh();
    } else {
      setError(result.error);
    }
  };

  const handleFileSelect = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      void enqueueFilesForUpload(files, browserState.currentFolderId());
      input.value = "";
    }
  };

  const openFileDialog = () => {
    fileInputRef?.click();
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

  type CreateOption = {
    id: string;
    label: string;
    icon: () => JSX.Element;
    action: () => void;
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
      <div class="folder-header">
        <Breadcrumbs 
          class="folder-breadcrumbs" 
          aria-label="Путь"
          separator={
            <svg class="breadcrumb-separator-icon" width="24px" height="24px" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"></path>
            </svg>
          }
        >
          <For each={browserState.breadcrumbs()}>
            {(crumb, index) => {
              const isLast = () =>
                index() === browserState.breadcrumbs().length - 1;
              return (
                <>
                  <Show
                    when={isLast()}
                    fallback={
                      <>
                        <Breadcrumbs.Link
                          href="#"
                          class="folder-breadcrumb-link"
                          onClick={(event) => {
                            event.preventDefault();
                            void browserState.goToBreadcrumb(index());
                          }}
                        >
                          {crumb.name}
                        </Breadcrumbs.Link>
                        <Breadcrumbs.Separator class="folder-breadcrumb-separator">
                          &gt;
                        </Breadcrumbs.Separator>
                      </>
                    }
                  >
                    <DropdownMenu>
                      <DropdownMenu.Trigger as={Button} class="folder-breadcrumb-dropdown-trigger">
                        {crumb.name}
                        <svg viewBox="0 0 24 24" aria-hidden="true" class="dropdown-icon">
                          <path
                            d="M7 10l5 5 5-5"
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                          />
                        </svg>
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
                  </Show>
                </>
              );
            }}
          </For>
        </Breadcrumbs>
      </div>

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
