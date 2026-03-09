import { createSignal, JSX } from "solid-js";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { ContextMenu } from "@kobalte/core/context-menu";
import { Button } from "@kobalte/core/button";
import type { DriveItem } from "./driveTypes";
import { MoveFileDialog } from "./MoveFileDialog";
import { RenameDialog } from "./RenameDialog";
import { TrashConfirmDialog } from "./TrashConfirmDialog";
import { ShareDialog } from "./ShareDialog";

type MenuItemsProps = {
  item: DriveItem;
  currentFolderId: string;
  onOpen: () => void;
  onMoveSuccess?: () => void;
  onMoveClick: () => void;
  onRenameClick: () => void;
  onTrashClick: () => void;
  onShareClick: () => void;
  onCopyLink: () => void;
};

function DropdownMenuItems(props: MenuItemsProps) {
  return (
    <>
      <DropdownMenu.Item class="drive-item-menu-item" onSelect={props.onOpen}>
        <span class="material-symbols-rounded drive-item-menu-icon">
          open_in_new
        </span>
        <DropdownMenu.ItemLabel>Открыть</DropdownMenu.ItemLabel>
      </DropdownMenu.Item>
      <DropdownMenu.Item
        class="drive-item-menu-item"
        onSelect={props.onRenameClick}
      >
        <span class="material-symbols-rounded drive-item-menu-icon">edit</span>
        <DropdownMenu.ItemLabel>Переименовать</DropdownMenu.ItemLabel>
      </DropdownMenu.Item>
      <DropdownMenu.Item
        class="drive-item-menu-item"
        onSelect={props.onMoveClick}
      >
        <span class="material-symbols-rounded drive-item-menu-icon">
          drive_file_move
        </span>
        <DropdownMenu.ItemLabel>Переместить</DropdownMenu.ItemLabel>
      </DropdownMenu.Item>
      <DropdownMenu.Item
        class="drive-item-menu-item"
        onSelect={props.onTrashClick}
      >
        <span class="material-symbols-rounded drive-item-menu-icon">
          delete
        </span>
        <DropdownMenu.ItemLabel>Отправить в корзину</DropdownMenu.ItemLabel>
      </DropdownMenu.Item>
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger
          class="drive-item-menu-item"
          textValue="Поделиться"
        >
          <span class="material-symbols-rounded drive-item-menu-icon">
            person_add
          </span>
          <span>Поделиться</span>
          <span class="material-symbols-rounded drive-item-submenu-arrow">
            chevron_right
          </span>
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent class="drive-item-menu-content">
            <DropdownMenu.Item
              class="drive-item-menu-item"
              onSelect={props.onShareClick}
            >
              <span class="material-symbols-rounded drive-item-menu-icon">
                person_add
              </span>
              <DropdownMenu.ItemLabel>Открыть доступ</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              class="drive-item-menu-item"
              onSelect={props.onCopyLink}
            >
              <span class="material-symbols-rounded drive-item-menu-icon">
                link
              </span>
              <DropdownMenu.ItemLabel>Копировать ссылку</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
    </>
  );
}

function ContextMenuItems(props: MenuItemsProps) {
  return (
    <>
      <ContextMenu.Item class="drive-item-menu-item" onSelect={props.onOpen}>
        <span class="material-symbols-rounded drive-item-menu-icon">
          open_in_new
        </span>
        <ContextMenu.ItemLabel>Открыть</ContextMenu.ItemLabel>
      </ContextMenu.Item>

      <ContextMenu.Item
        class="drive-item-menu-item"
        onSelect={props.onRenameClick}
      >
        <span class="material-symbols-rounded drive-item-menu-icon">edit</span>
        <ContextMenu.ItemLabel>Переименовать</ContextMenu.ItemLabel>
      </ContextMenu.Item>

      <ContextMenu.Item
        class="drive-item-menu-item"
        onSelect={props.onMoveClick}
      >
        <span class="material-symbols-rounded drive-item-menu-icon">
          drive_file_move
        </span>
        <ContextMenu.ItemLabel>Переместить</ContextMenu.ItemLabel>
      </ContextMenu.Item>

      <ContextMenu.Sub>
        <ContextMenu.SubTrigger
          class="drive-item-menu-item"
          textValue="Поделиться"
        >
          <span class="material-symbols-rounded drive-item-menu-icon">
            person_add
          </span>
          <span>Поделиться</span>
          <span class="material-symbols-rounded drive-item-submenu-arrow">
            chevron_right
          </span>
        </ContextMenu.SubTrigger>
        <ContextMenu.Portal>
          <ContextMenu.SubContent class="drive-item-menu-content">
            <ContextMenu.Item
              class="drive-item-menu-item"
              onSelect={props.onShareClick}
            >
              <span class="material-symbols-rounded drive-item-menu-icon">
                person_add
              </span>
              <ContextMenu.ItemLabel>Открыть доступ</ContextMenu.ItemLabel>
            </ContextMenu.Item>
            <ContextMenu.Item
              class="drive-item-menu-item"
              onSelect={props.onCopyLink}
            >
              <span class="material-symbols-rounded drive-item-menu-icon">
                link
              </span>
              <ContextMenu.ItemLabel>Копировать ссылку</ContextMenu.ItemLabel>
            </ContextMenu.Item>
          </ContextMenu.SubContent>
        </ContextMenu.Portal>
      </ContextMenu.Sub>

      <ContextMenu.Item
        class="drive-item-menu-item"
        onSelect={props.onTrashClick}
      >
        <span class="material-symbols-rounded drive-item-menu-icon">
          delete
        </span>
        <ContextMenu.ItemLabel>Отправить в корзину</ContextMenu.ItemLabel>
      </ContextMenu.Item>
    </>
  );
}

type DriveItemContextMenuProps = {
  item: DriveItem;
  currentFolderId: string;
  onOpen: () => void;
  onMoveSuccess?: () => void;
  children: JSX.Element;
};

export function DriveItemContextMenu(props: DriveItemContextMenuProps) {
  const [isMoveDialogOpen, setIsMoveDialogOpen] = createSignal(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = createSignal(false);
  const [isTrashDialogOpen, setIsTrashDialogOpen] = createSignal(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = createSignal(false);

  const handleSuccess = () => {
    if (props.onMoveSuccess) {
      props.onMoveSuccess();
    }
  };

  const handleCopyLink = () => {
    const url = props.item.webViewLink;
    if (url) {
      void navigator.clipboard.writeText(url);
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenu.Trigger class="drive-item-context-trigger">
          {props.children}
        </ContextMenu.Trigger>

        <ContextMenu.Portal>
          <ContextMenu.Content class="drive-item-menu-content">
            <ContextMenuItems
              item={props.item}
              currentFolderId={props.currentFolderId}
              onOpen={props.onOpen}
              onMoveSuccess={props.onMoveSuccess}
              onMoveClick={() => setIsMoveDialogOpen(true)}
              onRenameClick={() => setIsRenameDialogOpen(true)}
              onTrashClick={() => setIsTrashDialogOpen(true)}
              onShareClick={() => setIsShareDialogOpen(true)}
              onCopyLink={handleCopyLink}
            />
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu>

      <MoveFileDialog
        item={props.item}
        currentFolderId={props.currentFolderId}
        open={isMoveDialogOpen()}
        onOpenChange={setIsMoveDialogOpen}
        onMoveSuccess={handleSuccess}
      />

      <RenameDialog
        item={props.item}
        open={isRenameDialogOpen()}
        onOpenChange={setIsRenameDialogOpen}
        onRenameSuccess={handleSuccess}
      />

      <TrashConfirmDialog
        item={props.item}
        open={isTrashDialogOpen()}
        onOpenChange={setIsTrashDialogOpen}
        onTrashSuccess={handleSuccess}
      />

      <ShareDialog
        item={props.item}
        open={isShareDialogOpen()}
        onOpenChange={setIsShareDialogOpen}
      />
    </>
  );
}

type DriveItemMenuButtonProps = {
  item: DriveItem;
  currentFolderId: string;
  onOpen: () => void;
  onMoveSuccess?: () => void;
};

export function DriveItemMenuButton(props: DriveItemMenuButtonProps) {
  const [isMoveDialogOpen, setIsMoveDialogOpen] = createSignal(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = createSignal(false);
  const [isTrashDialogOpen, setIsTrashDialogOpen] = createSignal(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = createSignal(false);

  const handleSuccess = () => {
    if (props.onMoveSuccess) {
      props.onMoveSuccess();
    }
  };

  const handleCopyLink = () => {
    const url = props.item.webViewLink;
    if (url) {
      void navigator.clipboard.writeText(url);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger
          as={Button}
          class="drive-item-menu-btn"
          type="button"
          aria-label={`Действия для ${props.item.name}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="6" r="1.8" fill="currentColor" />
            <circle cx="12" cy="12" r="1.8" fill="currentColor" />
            <circle cx="12" cy="18" r="1.8" fill="currentColor" />
          </svg>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="drive-item-menu-content">
            <DropdownMenuItems
              item={props.item}
              currentFolderId={props.currentFolderId}
              onOpen={props.onOpen}
              onMoveSuccess={props.onMoveSuccess}
              onMoveClick={() => setIsMoveDialogOpen(true)}
              onRenameClick={() => setIsRenameDialogOpen(true)}
              onTrashClick={() => setIsTrashDialogOpen(true)}
              onShareClick={() => setIsShareDialogOpen(true)}
              onCopyLink={handleCopyLink}
            />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>

      <MoveFileDialog
        item={props.item}
        currentFolderId={props.currentFolderId}
        open={isMoveDialogOpen()}
        onOpenChange={setIsMoveDialogOpen}
        onMoveSuccess={handleSuccess}
      />

      <RenameDialog
        item={props.item}
        open={isRenameDialogOpen()}
        onOpenChange={setIsRenameDialogOpen}
        onRenameSuccess={handleSuccess}
      />

      <TrashConfirmDialog
        item={props.item}
        open={isTrashDialogOpen()}
        onOpenChange={setIsTrashDialogOpen}
        onTrashSuccess={handleSuccess}
      />

      <ShareDialog
        item={props.item}
        open={isShareDialogOpen()}
        onOpenChange={setIsShareDialogOpen}
      />
    </>
  );
}
