import { createSignal, JSX } from "solid-js";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { ContextMenu } from "@kobalte/core/context-menu";
import { Button } from "@kobalte/core/button";
import type { DriveItem } from "./driveTypes";
import { MoveFileDialog } from "./MoveFileDialog";

type MenuItemsProps = {
  item: DriveItem;
  currentFolderId: string;
  onOpen: () => void;
  onMoveSuccess?: () => void;
  onMoveClick: () => void;
};

function logPlaceholder(action: string, item: DriveItem) {
  console.log(`[placeholder] ${action}:`, { id: item.id, name: item.name });
}

function DropdownMenuItems(props: MenuItemsProps) {
  return (
    <>
      <DropdownMenu.Item
        class="drive-item-menu-item"
        onSelect={props.onOpen}
      >
        Открыть
      </DropdownMenu.Item>
      <DropdownMenu.Item
        class="drive-item-menu-item"
        onSelect={() => logPlaceholder("rename", props.item)}
      >
        Переименовать
      </DropdownMenu.Item>
      <DropdownMenu.Item
        class="drive-item-menu-item"
        onSelect={props.onMoveClick}
      >
        Переместить
      </DropdownMenu.Item>
      <DropdownMenu.Item
        class="drive-item-menu-item"
        onSelect={() => logPlaceholder("delete", props.item)}
      >
        Удалить
      </DropdownMenu.Item>
      <DropdownMenu.Item
        class="drive-item-menu-item"
        onSelect={() => logPlaceholder("share", props.item)}
      >
        Поделиться
      </DropdownMenu.Item>
    </>
  );
}

function ContextMenuItems(props: MenuItemsProps) {
  return (
    <>
      <ContextMenu.Item
        class="drive-item-menu-item"
        onSelect={props.onOpen}
      >
        Открыть
      </ContextMenu.Item>
      <ContextMenu.Item
        class="drive-item-menu-item"
        onSelect={() => logPlaceholder("rename", props.item)}
      >
        Переименовать
      </ContextMenu.Item>
      <ContextMenu.Item
        class="drive-item-menu-item"
        onSelect={props.onMoveClick}
      >
        Переместить
      </ContextMenu.Item>
      <ContextMenu.Item
        class="drive-item-menu-item"
        onSelect={() => logPlaceholder("delete", props.item)}
      >
        Удалить
      </ContextMenu.Item>
      <ContextMenu.Item
        class="drive-item-menu-item"
        onSelect={() => logPlaceholder("share", props.item)}
      >
        Поделиться
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

  const handleMoveClick = () => {
    setIsMoveDialogOpen(true);
  };

  const handleMoveSuccess = () => {
    if (props.onMoveSuccess) {
      props.onMoveSuccess();
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
              onMoveClick={handleMoveClick}
            />
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu>

      <MoveFileDialog
        item={props.item}
        currentFolderId={props.currentFolderId}
        open={isMoveDialogOpen()}
        onOpenChange={setIsMoveDialogOpen}
        onMoveSuccess={handleMoveSuccess}
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

  const handleMoveClick = () => {
    setIsMoveDialogOpen(true);
  };

  const handleMoveSuccess = () => {
    if (props.onMoveSuccess) {
      props.onMoveSuccess();
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
              onMoveClick={handleMoveClick}
            />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>

      <MoveFileDialog
        item={props.item}
        currentFolderId={props.currentFolderId}
        open={isMoveDialogOpen()}
        onOpenChange={setIsMoveDialogOpen}
        onMoveSuccess={handleMoveSuccess}
      />
    </>
  );
}
