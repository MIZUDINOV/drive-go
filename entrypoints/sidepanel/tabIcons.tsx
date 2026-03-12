import { type JSX } from "solid-js";
import gdLogoUrl from "@/assets/gd-logo.svg?url";

export type TabIconName =
  | "drive"
  | "clock"
  | "shared"
  | "star"
  | "pulse"
  | "transfers"
  | "trash"
  | "settings";

const tabIconbyName = new Map<TabIconName, string>([
  ["drive", "storage"],
  ["clock", "schedule"],
  ["shared", "people"],
  ["star", "star"],
  ["pulse", "notifications"],
  ["transfers", "sync_alt"],
  ["trash", "delete"],
  ["settings", "settings"],
]);

export function TabIcon(props: {
  name: TabIconName;
  isSelected?: boolean;
}): JSX.Element {
  if (props.name === "drive") {
    return (
      <img class="tab-icon-logo" src={gdLogoUrl} alt="" aria-hidden="true" />
    );
  }

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
