import { For } from "solid-js";
import { Skeleton } from "@kobalte/core/skeleton";
import type { DriveViewMode } from "./driveTypes";

type DriveItemsSkeletonProps = {
  viewMode: DriveViewMode;
};

// List view skeleton item
function ListSkeletonItem() {
  return (
    <div class="drive-item drive-item-list skeleton-item-list">
      <div class="drive-item-main">
        <Skeleton class="skeleton skeleton-icon" width={24} height={24} radius={4}>
          <span class="name-icon" aria-hidden="true">📄</span>
        </Skeleton>
        <div class="drive-item-text">
          <Skeleton class="skeleton skeleton-title" width={150} height={13} radius={6}>
            <span>Loading file name...</span>
          </Skeleton>
          <Skeleton class="skeleton skeleton-meta" width={200} height={12} radius={6} style={{ "margin-top": "4px" }}>
            <span>Loading metadata...</span>
          </Skeleton>
        </div>
      </div>
      <Skeleton class="skeleton skeleton-menu" width={24} height={24} radius={4}>
        <span>⋮</span>
      </Skeleton>
    </div>
  );
}

// Grid file skeleton item
function GridFileSkeletonItem() {
  return (
    <div class="drive-item drive-item-grid skeleton-item-grid">
      <div class="drive-grid-tile-top">
        <div class="drive-grid-title-wrap">
          <Skeleton class="skeleton skeleton-icon" width={24} height={24} radius={4}>
            <span class="name-icon" aria-hidden="true">📄</span>
          </Skeleton>
          <Skeleton class="skeleton skeleton-title" height={13} radius={6} style={{ flex: "1 1 0", "min-width": "0" }}>
            <span>Loading...</span>
          </Skeleton>
        </div>
        <Skeleton class="skeleton skeleton-menu" width={24} height={24} radius={4}>
          <span>⋮</span>
        </Skeleton>
      </div>
      <Skeleton class="skeleton skeleton-preview" radius={8} style={{ flex: "1 1 auto", "min-height": "200px" }}>
        <div class="drive-grid-preview-fallback">Preview loading...</div>
      </Skeleton>
    </div>
  );
}

// Grid folder skeleton item
function GridFolderSkeletonItem() {
  return (
    <div class="drive-item drive-item-grid-folder skeleton-item-grid-folder">
      <div class="drive-grid-tile-top">
        <div class="drive-grid-title-wrap">
          <Skeleton class="skeleton skeleton-icon" width={20} height={20} radius={4}>
            <span class="name-icon" aria-hidden="true">📁</span>
          </Skeleton>
          <Skeleton class="skeleton skeleton-title-folder" height={13} radius={6} style={{ flex: "1 1 0", "min-width": "0" }}>
            <span>Loading folder...</span>
          </Skeleton>
        </div>
        <Skeleton class="skeleton skeleton-menu" width={20} height={20} radius={4}>
          <span>⋮</span>
        </Skeleton>
      </div>
    </div>
  );
}

export function DriveItemsSkeleton(props: DriveItemsSkeletonProps) {
  if (props.viewMode === "list") {
    return (
      <div class="drive-items-list" aria-busy="true">
        <For each={Array(8)}>
          {() => <ListSkeletonItem />}
        </For>
      </div>
    );
  }

  return (
    <div class="drive-grid-layout" aria-busy="true">
      <div class="drive-grid-folders-row">
        <For each={Array(2)}>
          {() => <GridFolderSkeletonItem />}
        </For>
      </div>
      <div class="drive-items-grid">
        <For each={Array(6)}>
          {() => <GridFileSkeletonItem />}
        </For>
      </div>
    </div>
  );
}
