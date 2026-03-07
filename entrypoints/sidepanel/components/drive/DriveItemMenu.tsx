import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Button } from "@kobalte/core/button";
import type { DriveItem } from "./driveTypes";

type DriveItemMenuProps = {
  item: DriveItem;
};

function logPlaceholder(action: string, item: DriveItem) {
  console.log(`[placeholder] ${action}:`, { id: item.id, name: item.name });
}

export function DriveItemMenu(props: DriveItemMenuProps) {
  return (
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
          <DropdownMenu.Item
            class="drive-item-menu-item"
            onSelect={() => logPlaceholder("open", props.item)}
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
            onSelect={() => logPlaceholder("move", props.item)}
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
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  );
}
