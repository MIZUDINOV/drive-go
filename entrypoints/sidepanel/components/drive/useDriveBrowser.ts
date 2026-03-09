import { createSignal } from "solid-js";
import {
  ROOT_FOLDER_ID,
  type BreadcrumbItem,
  type DriveApiFile,
  type DriveItem,
} from "./driveTypes";
import {
  listMyDriveFolder,
  type DriveSearchFilters,
  DEFAULT_DRIVE_SEARCH_FILTERS,
} from "../../services/driveApi";
import { listSharedWithMe } from "../../services/sharedApi";

export type DriveBrowserScope = "my-drive" | "shared";

type UseDriveBrowserOptions = {
  scope?: DriveBrowserScope;
};

const SHARED_ROOT_ID = "shared-root";

function mapApiFile(file: DriveApiFile): DriveItem {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime ?? "",
    size: file.size,
    ownerName: file.owners?.[0]?.displayName,
    iconLink: file.iconLink,
    thumbnailLink: file.thumbnailLink,
    webViewLink: file.webViewLink,
  };
}

export function useDriveBrowser(options?: UseDriveBrowserOptions) {
  const scope = options?.scope ?? "my-drive";
  const isSharedScope = scope === "shared";
  const [items, setItems] = createSignal<DriveItem[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [nextPageToken, setNextPageToken] = createSignal<string>();
  const [loadedFolderId, setLoadedFolderId] = createSignal<string>();
  const [filters, setFilters] = createSignal<DriveSearchFilters>(
    DEFAULT_DRIVE_SEARCH_FILTERS,
  );
  let requestSeq = 0;
  const [breadcrumbs, setBreadcrumbs] = createSignal<BreadcrumbItem[]>([
    {
      id: isSharedScope ? SHARED_ROOT_ID : ROOT_FOLDER_ID,
      name: isSharedScope ? "Доступные мне" : "Мой диск",
    },
  ]);

  const currentFolderId = () =>
    breadcrumbs()[breadcrumbs().length - 1]?.id ??
    (isSharedScope ? SHARED_ROOT_ID : ROOT_FOLDER_ID);

  const loadFolder = async (folderId: string, reset: boolean) => {
    const requestId = ++requestSeq;

    if (reset) {
      setItems([]);
      setNextPageToken(undefined);
    }

    setLoading(true);
    setError("");

    try {
      const response = isSharedScope
        ? await listSharedWithMe(reset ? undefined : nextPageToken(), {
            folderId,
            filters: filters(),
          })
        : await listMyDriveFolder(
            folderId,
            reset ? undefined : nextPageToken(),
            { filters: filters() },
          );

      if (requestId !== requestSeq) {
        return;
      }

      if (!response.ok) {
        throw new Error(response.error || "Не удалось загрузить папку");
      }

      const mapped = (response.data?.files ?? []).map(mapApiFile);
      const loadedId = folderId;

      if (reset) {
        setItems(mapped);
        setLoadedFolderId(loadedId);
      } else {
        setItems((prev) => [...prev, ...mapped]);
      }

      setNextPageToken(response.data?.nextPageToken);
    } catch (unknownError: unknown) {
      if (requestId !== requestSeq) {
        return;
      }

      setError(
        unknownError instanceof Error ? unknownError.message : "Unknown error",
      );
    } finally {
      if (requestId === requestSeq) {
        setLoading(false);
      }
    }
  };

  const refresh = async () => {
    await loadFolder(currentFolderId(), true);
  };

  const loadMore = async () => {
    if (!nextPageToken()) {
      return;
    }
    await loadFolder(currentFolderId(), false);
  };

  const openFolder = async (item: DriveItem) => {
    setBreadcrumbs((prev) => [...prev, { id: item.id, name: item.name }]);
    await loadFolder(item.id, true);
  };

  const goUp = async () => {
    const currentPath = breadcrumbs();
    if (currentPath.length <= 1) {
      return;
    }

    const nextPath = currentPath.slice(0, -1);
    setBreadcrumbs(nextPath);
    const parentId = nextPath[nextPath.length - 1]?.id ?? ROOT_FOLDER_ID;
    await loadFolder(parentId, true);
  };

  const goToBreadcrumb = async (index: number) => {
    const currentPath = breadcrumbs();
    if (index < 0 || index >= currentPath.length) {
      return;
    }

    const nextPath = currentPath.slice(0, index + 1);
    setBreadcrumbs(nextPath);
    const folderId = nextPath[nextPath.length - 1]?.id ?? ROOT_FOLDER_ID;
    await loadFolder(folderId, true);
  };

  return {
    scope,
    items,
    loading,
    error,
    filters,
    setFilters,
    nextPageToken,
    loadedFolderId,
    breadcrumbs,
    currentFolderId,
    loadFolder,
    refresh,
    loadMore,
    openFolder,
    goUp,
    goToBreadcrumb,
  };
}
