import { type JSX } from "solid-js";

export type TabIconName = "drive" | "clock" | "shared" | "star" | "pulse" | "trash";

const tabIconByName = new Map<TabIconName, () => JSX.Element>([
  [
    "drive",
    () => (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M8 3h8l5 9-4 7H7l-4-7z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />
        <path
          d="M10 3l-5 9m9-9 5 9m-2 7-5-7m-5 7 5-7"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />
      </svg>
    ),
  ],
  [
    "clock",
    () => (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="8"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />
        <path
          d="M12 7v5l3 2"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-width="1.8"
        />
      </svg>
    ),
  ],
  [
    "shared",
    () => (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="8"
          cy="10"
          r="3"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />
        <circle
          cx="16"
          cy="8"
          r="2.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />
        <path
          d="M4 18c0-2.7 2-4 4-4s4 1.3 4 4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />
        <path
          d="M13 16c.5-1.4 1.8-2.2 3.4-2.2 1.7 0 3.1.9 3.6 2.2"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />
      </svg>
    ),
  ],
  [
    "star",
    () => (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 4l2.2 4.7 5.1.7-3.7 3.5.9 5-4.5-2.5-4.5 2.5.9-5-3.7-3.5 5.1-.7z"
          fill="none"
          stroke="currentColor"
          stroke-linejoin="round"
          stroke-width="1.8"
        />
      </svg>
    ),
  ],
  [
    "pulse",
    () => (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3 12h4l2-4 3 8 2-4h7"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.8"
        />
      </svg>
    ),
  ],
  [
    "trash",
    () => (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M5 7h14M7 7v12h10V7"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />
        <path
          d="M9 7V5h6v2"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />
      </svg>
    ),
  ],
]);

export function TabIcon(props: { name: TabIconName }): JSX.Element {
  const renderIcon = tabIconByName.get(props.name) ?? tabIconByName.get("trash");
  return renderIcon ? renderIcon() : <></>;
}
