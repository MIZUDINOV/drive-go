import { Show, createSignal, JSX } from "solid-js";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { ContextMenu } from "@kobalte/core/context-menu";
import { Button } from "@kobalte/core/button";
import type { DriveItem } from "./driveTypes";
import { MoveFileDialog } from "./MoveFileDialog";
import { RenameDialog } from "./RenameDialog";
import { TrashConfirmDialog } from "./TrashConfirmDialog";
import { ShareDialog } from "./ShareDialog";

export type DriveItemMenuAction =
  | "open"
  | "rename"
  | "move"
  | "trash"
  | "share"
  | "copy-link"
  | "add-star"
  | "remove-star"
  | "remove-shared";

export type DriveItemMenuConfig = {
  actions: DriveItemMenuAction[];
  trashLabel?: string;
  onAddStar?: (item: DriveItem) => Promise<boolean>;
  onRemoveStar?: (item: DriveItem) => Promise<boolean>;
  onRemoveShared?: (item: DriveItem) => Promise<boolean>;
};

const DEFAULT_ACTIONS: DriveItemMenuAction[] = [
  "open",
  "rename",
  "move",
  "trash",
  "share",
  "copy-link",
];

type MenuItemsProps = {
  actions: DriveItemMenuAction[];
  trashLabel?: string;
  onOpen: () => void;
  onMoveClick: () => void;
  onRenameClick: () => void;
  onTrashClick: () => void;
  onShareClick: () => void;
  onCopyLink: () => void;
  onAddStarClick: () => void;
  onRemoveStarClick: () => void;
  onRemoveSharedClick: () => void;
};

function hasAction(
  actions: DriveItemMenuAction[],
  action: DriveItemMenuAction,
): boolean {
  return actions.includes(action);
}

function DropdownMenuItems(props: MenuItemsProps) {
  return (
    <>
      <Show when={hasAction(props.actions, "open")}>
        <DropdownMenu.Item class="drive-item-menu-item" onSelect={props.onOpen}>
          <span class="material-symbols-rounded drive-item-menu-icon">
            open_in_new
          </span>
          <DropdownMenu.ItemLabel>Открыть</DropdownMenu.ItemLabel>
        </DropdownMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "share")}>
        <DropdownMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onShareClick}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">
            person_add
          </span>
          <DropdownMenu.ItemLabel>Поделиться</DropdownMenu.ItemLabel>
        </DropdownMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "add-star")}>
        <DropdownMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onAddStarClick}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">star</span>
          <DropdownMenu.ItemLabel>Добавить в помеченные</DropdownMenu.ItemLabel>
        </DropdownMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "remove-star")}>
        <DropdownMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onRemoveStarClick}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">
            star_outline
          </span>
          <DropdownMenu.ItemLabel>Убрать из помеченных</DropdownMenu.ItemLabel>
        </DropdownMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "rename")}>
        <DropdownMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onRenameClick}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">edit</span>
          <DropdownMenu.ItemLabel>Переименовать</DropdownMenu.ItemLabel>
        </DropdownMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "move")}>
        <DropdownMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onMoveClick}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">
            drive_file_move
          </span>
          <DropdownMenu.ItemLabel>Переместить</DropdownMenu.ItemLabel>
        </DropdownMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "copy-link")}>
        <DropdownMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onCopyLink}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">link</span>
          <DropdownMenu.ItemLabel>Копировать ссылку</DropdownMenu.ItemLabel>
        </DropdownMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "trash")}>
        <DropdownMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onTrashClick}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">
            delete
          </span>
          <DropdownMenu.ItemLabel>
            {props.trashLabel ?? "Отправить в корзину"}
          </DropdownMenu.ItemLabel>
        </DropdownMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "remove-shared")}>
        <DropdownMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onRemoveSharedClick}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">
            delete
          </span>
          <DropdownMenu.ItemLabel>Удалить</DropdownMenu.ItemLabel>
        </DropdownMenu.Item>
      </Show>
    </>
  );
}

function ContextMenuItems(props: MenuItemsProps) {
  return (
    <>
      <Show when={hasAction(props.actions, "open")}>
        <ContextMenu.Item class="drive-item-menu-item" onSelect={props.onOpen}>
          <span class="material-symbols-rounded drive-item-menu-icon">
            open_in_new
          </span>
          <ContextMenu.ItemLabel>Открыть</ContextMenu.ItemLabel>
        </ContextMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "share")}>
        <ContextMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onShareClick}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">
            person_add
          </span>
          <ContextMenu.ItemLabel>Поделиться</ContextMenu.ItemLabel>
        </ContextMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "add-star")}>
        <ContextMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onAddStarClick}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">star</span>
          <ContextMenu.ItemLabel>Добавить в помеченные</ContextMenu.ItemLabel>
        </ContextMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "remove-star")}>
        <ContextMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onRemoveStarClick}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">
            star_outline
          </span>
          <ContextMenu.ItemLabel>Убрать из помеченных</ContextMenu.ItemLabel>
        </ContextMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "rename")}>
        <ContextMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onRenameClick}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">edit</span>
          <ContextMenu.ItemLabel>Переименовать</ContextMenu.ItemLabel>
        </ContextMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "move")}>
        <ContextMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onMoveClick}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">
            drive_file_move
          </span>
          <ContextMenu.ItemLabel>Переместить</ContextMenu.ItemLabel>
        </ContextMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "copy-link")}>
        <ContextMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onCopyLink}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">link</span>
          <ContextMenu.ItemLabel>Копировать ссылку</ContextMenu.ItemLabel>
        </ContextMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "trash")}>
        <ContextMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onTrashClick}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">
            delete
          </span>
          <ContextMenu.ItemLabel>
            {props.trashLabel ?? "Отправить в корзину"}
          </ContextMenu.ItemLabel>
        </ContextMenu.Item>
      </Show>

      <Show when={hasAction(props.actions, "remove-shared")}>
        <ContextMenu.Item
          class="drive-item-menu-item"
          onSelect={props.onRemoveSharedClick}
        >
          <span class="material-symbols-rounded drive-item-menu-icon">
            delete
          </span>
          <ContextMenu.ItemLabel>Удалить</ContextMenu.ItemLabel>
        </ContextMenu.Item>
      </Show>
    </>
  );
}

type DriveItemContextMenuProps = {
  item: DriveItem;
  currentFolderId: string;
  onOpen: () => void;
  onMoveSuccess?: () => void;
  menuConfig?: DriveItemMenuConfig;
  children: JSX.Element;
};

export function DriveItemContextMenu(props: DriveItemContextMenuProps) {
  const actions = () => props.menuConfig?.actions ?? DEFAULT_ACTIONS;
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

  const handleAddStar = async () => {
    if (!props.menuConfig?.onAddStar) {
      return;
    }

    const success = await props.menuConfig.onAddStar(props.item);
    if (success) {
      handleSuccess();
    }
  };

  const handleRemoveShared = async () => {
    if (!props.menuConfig?.onRemoveShared) {
      return;
    }

    const success = await props.menuConfig.onRemoveShared(props.item);
    if (success) {
      handleSuccess();
    }
  };

  const handleRemoveStar = async () => {
    if (!props.menuConfig?.onRemoveStar) {
      return;
    }

    const success = await props.menuConfig.onRemoveStar(props.item);
    if (success) {
      handleSuccess();
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
              actions={actions()}
              trashLabel={props.menuConfig?.trashLabel}
              onOpen={props.onOpen}
              onMoveClick={() => setIsMoveDialogOpen(true)}
              onRenameClick={() => setIsRenameDialogOpen(true)}
              onTrashClick={() => setIsTrashDialogOpen(true)}
              onShareClick={() => setIsShareDialogOpen(true)}
              onCopyLink={handleCopyLink}
              onAddStarClick={() => void handleAddStar()}
              onRemoveStarClick={() => void handleRemoveStar()}
              onRemoveSharedClick={() => void handleRemoveShared()}
            />
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu>

      <Show when={hasAction(actions(), "move")}>
        <MoveFileDialog
          item={props.item}
          currentFolderId={props.currentFolderId}
          open={isMoveDialogOpen()}
          onOpenChange={setIsMoveDialogOpen}
          onMoveSuccess={handleSuccess}
        />
      </Show>

      <Show when={hasAction(actions(), "rename")}>
        <RenameDialog
          item={props.item}
          open={isRenameDialogOpen()}
          onOpenChange={setIsRenameDialogOpen}
          onRenameSuccess={handleSuccess}
        />
      </Show>

      <Show when={hasAction(actions(), "trash")}>
        <TrashConfirmDialog
          item={props.item}
          open={isTrashDialogOpen()}
          onOpenChange={setIsTrashDialogOpen}
          onTrashSuccess={handleSuccess}
        />
      </Show>

      <Show when={hasAction(actions(), "share")}>
        <ShareDialog
          item={props.item}
          open={isShareDialogOpen()}
          onOpenChange={setIsShareDialogOpen}
        />
      </Show>
    </>
  );
}

type DriveItemMenuButtonProps = {
  item: DriveItem;
  currentFolderId: string;
  onOpen: () => void;
  onMoveSuccess?: () => void;
  menuConfig?: DriveItemMenuConfig;
};

export function DriveItemMenuButton(props: DriveItemMenuButtonProps) {
  const actions = () => props.menuConfig?.actions ?? DEFAULT_ACTIONS;
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

  const handleAddStar = async () => {
    if (!props.menuConfig?.onAddStar) {
      return;
    }

    const success = await props.menuConfig.onAddStar(props.item);
    if (success) {
      handleSuccess();
    }
  };

  const handleRemoveShared = async () => {
    if (!props.menuConfig?.onRemoveShared) {
      return;
    }

    const success = await props.menuConfig.onRemoveShared(props.item);
    if (success) {
      handleSuccess();
    }
  };

  const handleRemoveStar = async () => {
    if (!props.menuConfig?.onRemoveStar) {
      return;
    }

    const success = await props.menuConfig.onRemoveStar(props.item);
    if (success) {
      handleSuccess();
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
              actions={actions()}
              trashLabel={props.menuConfig?.trashLabel}
              onOpen={props.onOpen}
              onMoveClick={() => setIsMoveDialogOpen(true)}
              onRenameClick={() => setIsRenameDialogOpen(true)}
              onTrashClick={() => setIsTrashDialogOpen(true)}
              onShareClick={() => setIsShareDialogOpen(true)}
              onCopyLink={handleCopyLink}
              onAddStarClick={() => void handleAddStar()}
              onRemoveStarClick={() => void handleRemoveStar()}
              onRemoveSharedClick={() => void handleRemoveShared()}
            />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>

      <Show when={hasAction(actions(), "move")}>
        <MoveFileDialog
          item={props.item}
          currentFolderId={props.currentFolderId}
          open={isMoveDialogOpen()}
          onOpenChange={setIsMoveDialogOpen}
          onMoveSuccess={handleSuccess}
        />
      </Show>

      <Show when={hasAction(actions(), "rename")}>
        <RenameDialog
          item={props.item}
          open={isRenameDialogOpen()}
          onOpenChange={setIsRenameDialogOpen}
          onRenameSuccess={handleSuccess}
        />
      </Show>

      <Show when={hasAction(actions(), "trash")}>
        <TrashConfirmDialog
          item={props.item}
          open={isTrashDialogOpen()}
          onOpenChange={setIsTrashDialogOpen}
          onTrashSuccess={handleSuccess}
        />
      </Show>

      <Show when={hasAction(actions(), "share")}>
        <ShareDialog
          item={props.item}
          open={isShareDialogOpen()}
          onOpenChange={setIsShareDialogOpen}
        />
      </Show>
    </>
  );
}
