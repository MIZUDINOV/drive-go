import { type JSX } from "solid-js";

export type TabIconName = "drive" | "clock" | "shared" | "star" | "pulse" | "trash";

const tabIconbyName = new Map<TabIconName, string>([
  ["drive", "storage"],
  ["clock", "schedule"],
  ["shared", "people"],
  ["star", "star"],
  ["pulse", "notifications"],
  ["trash", "delete"],
]);

export function TabIcon(props: { name: TabIconName; isSelected?: boolean }): JSX.Element {
  const iconName = tabIconbyName.get(props.name) ?? "delete";
  
  return (
    <span 
      class="material-symbols-rounded" 
      {...(props.isSelected && { "data-selected": true })}
      aria-hidden="true"
    >
      {iconName}
    </span>
  );
}
