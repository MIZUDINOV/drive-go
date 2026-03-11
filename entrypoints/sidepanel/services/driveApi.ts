import type {
  DriveApiFile,
  DriveItem,
  DriveListMyDriveResponse,
} from "../components/drive/driveTypes";

type DriveListResult = {
  files?: DriveApiFile[];
  nextPageToken?: string;
};

export type DriveSearchFilters = {
  type:
    | "all"
    | "folders"
    | "documents"
    | "spreadsheets"
    | "presentations"
    | "pdf"
    | "images";
  owner: "all" | "me";
  modified: "any" | "7d" | "30d" | "365d";
};

export const DEFAULT_DRIVE_SEARCH_FILTERS: DriveSearchFilters = {
  type: "all",
  owner: "all",
  modified: "any",
};

type DriveListOptions = {
  searchQuery?: string;
  filters?: DriveSearchFilters;
};

const DRIVE_FIELDS =
  "nextPageToken,files(id,name,mimeType,modifiedTime,size,iconLink,thumbnailLink,webViewLink,owners(displayName))";

function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getModifiedSinceIso(
  filter: DriveSearchFilters["modified"],
): string | null {
  if (filter === "any") {
    return null;
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = filter === "7d" ? 7 : filter === "30d" ? 30 : 365;
  return new Date(now - days * dayMs).toISOString();
}

function getTypeCondition(type: DriveSearchFilters["type"]): string | null {
  switch (type) {
    case "folders":
      return "mimeType = 'application/vnd.google-apps.folder'";
    case "documents":
      return "mimeType = 'application/vnd.google-apps.document'";
    case "spreadsheets":
      return "mimeType = 'application/vnd.google-apps.spreadsheet'";
    case "presentations":
      return "mimeType = 'application/vnd.google-apps.presentation'";
    case "pdf":
      return "mimeType = 'application/pdf'";
    case "images":
      return "mimeType contains 'image/'";
    default:
      return null;
  }
}

function buildDriveQuery(
  folderId: string | null,
  searchQuery: string,
  filters: DriveSearchFilters,
): string {
  const parts: string[] = ["trashed=false"];

  if (folderId) {
    parts.push(`'${escapeQueryValue(folderId)}' in parents`);
  }

  if (searchQuery.trim()) {
    parts.push(`name contains '${escapeQueryValue(searchQuery.trim())}'`);
  }

  const typeCondition = getTypeCondition(filters.type);
  if (typeCondition) {
    parts.push(typeCondition);
  }

  if (filters.owner === "me") {
    parts.push("'me' in owners");
  }

  const modifiedSinceIso = getModifiedSinceIso(filters.modified);
  if (modifiedSinceIso) {
    parts.push(`modifiedTime > '${modifiedSinceIso}'`);
  }

  return parts.join(" and ");
}

function getDriveItemOpenUrl(
  item: Pick<DriveItem, "id" | "mimeType" | "webViewLink">,
): string {
  if (item.webViewLink) {
    return item.webViewLink;
  }

  switch (item.mimeType) {
    case "application/vnd.google-apps.folder":
      return `https://drive.google.com/drive/folders/${item.id}`;
    case "application/vnd.google-apps.document":
      return `https://docs.google.com/document/d/${item.id}/edit`;
    case "application/vnd.google-apps.spreadsheet":
      return `https://docs.google.com/spreadsheets/d/${item.id}/edit`;
    case "application/vnd.google-apps.presentation":
      return `https://docs.google.com/presentation/d/${item.id}/edit`;
    case "application/vnd.google-apps.form":
      return `https://docs.google.com/forms/d/${item.id}/edit`;
    default:
      return `https://drive.google.com/file/d/${item.id}/view`;
  }
}

export async function openDriveItemInNewTab(
  item: Pick<DriveItem, "id" | "mimeType" | "webViewLink">,
): Promise<void> {
  const url = getDriveItemOpenUrl(item);

  if (browser.tabs?.create) {
    await browser.tabs.create({ url });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export async function getAccessToken(): Promise<Browser.identity.GetAuthTokenResult> {
  try {
    return await browser.identity.getAuthToken({ interactive: false });
  } catch {
    return browser.identity.getAuthToken({ interactive: true });
  }
}

export async function listMyDriveFolder(
  folderId: string,
  pageToken?: string,
  options?: DriveListOptions,
): Promise<DriveListMyDriveResponse> {
  const normalizedFolderId = folderId.trim() ? folderId.trim() : "root";
  const searchQuery = options?.searchQuery ?? "";
  const filters = options?.filters ?? DEFAULT_DRIVE_SEARCH_FILTERS;

  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      pageSize: "50",
      q: buildDriveQuery(normalizedFolderId, searchQuery, filters),
      fields: DRIVE_FIELDS,
      orderBy: "folder,name_natural",
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token.token}` },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `Google Drive API error ${response.status}: ${errorText}`,
      };
    }

    const data = (await response.json()) as DriveListResult;

    return {
      ok: true,
      data: {
        files: data.files ?? [],
        nextPageToken: data.nextPageToken,
      },
    };
  } catch (unknownError: unknown) {
    return {
      ok: false,
      error:
        unknownError instanceof Error ? unknownError.message : "Unknown error",
    };
  }
}

export async function searchDriveItems(
  searchQuery: string,
  filters: DriveSearchFilters,
  pageSize = 8,
): Promise<DriveApiFile[]> {
  const trimmedQuery = searchQuery.trim();
  const hasFilter =
    filters.type !== "all" ||
    filters.owner !== "all" ||
    filters.modified !== "any";

  if (!trimmedQuery && !hasFilter) {
    return [];
  }

  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      pageSize: String(pageSize),
      q: buildDriveQuery(null, trimmedQuery, filters),
      fields: DRIVE_FIELDS,
      orderBy: "modifiedTime desc,name_natural",
    });

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token.token}` },
      },
    );

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as DriveListResult;
    return data.files ?? [];
  } catch {
    return [];
  }
}

type CreateFolderResult =
  | { ok: true; folder: DriveApiFile }
  | { ok: false; error: string };

export async function createFolder(
  folderName: string,
  parentId?: string,
): Promise<CreateFolderResult> {
  if (!folderName.trim()) {
    return { ok: false, error: "Имя папки не может быть пустым" };
  }

  try {
    const token = await getAccessToken();
    const metadata = {
      name: folderName.trim(),
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId && { parents: [parentId] }),
    };

    const response = await fetch(
      "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime,iconLink,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `Ошибка создания папки ${response.status}: ${errorText}`,
      };
    }

    const folder = (await response.json()) as DriveApiFile;
    return { ok: true, folder };
  } catch (unknownError: unknown) {
    return {
      ok: false,
      error:
        unknownError instanceof Error
          ? unknownError.message
          : "Неизвестная ошибка",
    };
  }
}

type MoveFileResult = { ok: true } | { ok: false; error: string };

export async function moveFile(
  fileId: string,
  newParentId: string,
  oldParentId?: string,
): Promise<MoveFileResult> {
  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      addParents: newParentId,
      fields: "id,parents",
    });

    if (oldParentId) {
      params.set("removeParents", oldParentId);
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token.token}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `Ошибка перемещения ${response.status}: ${errorText}`,
      };
    }

    return { ok: true };
  } catch (unknownError: unknown) {
    return {
      ok: false,
      error:
        unknownError instanceof Error
          ? unknownError.message
          : "Неизвестная ошибка",
    };
  }
}

type RenameFileResult = { ok: true } | { ok: false; error: string };

type TrashFileResult = { ok: true } | { ok: false; error: string };

export async function trashFile(fileId: string): Promise<TrashFileResult> {
  try {
    const token = await getAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trashed: true }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `Ошибка удаления ${response.status}: ${errorText}`,
      };
    }

    return { ok: true };
  } catch (unknownError: unknown) {
    return {
      ok: false,
      error:
        unknownError instanceof Error
          ? unknownError.message
          : "Неизвестная ошибка",
    };
  }
}

export async function renameFile(
  fileId: string,
  newName: string,
): Promise<RenameFileResult> {
  if (!newName.trim()) {
    return { ok: false, error: "Имя не может быть пустым" };
  }

  try {
    const token = await getAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName.trim() }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `Ошибка переименования ${response.status}: ${errorText}`,
      };
    }

    return { ok: true };
  } catch (unknownError: unknown) {
    return {
      ok: false,
      error:
        unknownError instanceof Error
          ? unknownError.message
          : "Неизвестная ошибка",
    };
  }
}

export async function listAllFolders(): Promise<DriveApiFile[]> {
  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      pageSize: "100",
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed=false",
      fields: "files(id,name,mimeType,iconLink)",
      orderBy: "name_natural",
    });

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token.token}` },
      },
    );

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as DriveListResult;
    return data.files ?? [];
  } catch {
    return [];
  }
}

export async function listMyOwnedFolders(): Promise<DriveApiFile[]> {
  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      pageSize: "100",
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed=false and 'me' in owners",
      fields: "files(id,name,mimeType,iconLink)",
      orderBy: "name_natural",
      supportsAllDrives: "false",
      includeItemsFromAllDrives: "false",
    });

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token.token}` },
      },
    );

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as DriveListResult;
    return data.files ?? [];
  } catch {
    return [];
  }
}

/**
 * Получить информацию о файле с данными пользователей
 * Используется для получения displayName, email и photoLink из Drive API
 */
export async function getFileWithUserInfo(
  fileId: string,
): Promise<{
  lastModifyingUser?: {
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
  };
  owners?: Array<{
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
  }>;
} | null> {
  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      fields: "lastModifyingUser(displayName,emailAddress,photoLink),owners(displayName,emailAddress,photoLink)",
      supportsAllDrives: "true",
    });
    
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`;
    console.log(`[getFileWithUserInfo] GET ${url}`);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token.token}` },
    });

    if (!response.ok) {
      const errorText = await response.text();

      // 403/404 для Activity-таргетов встречаются часто (нет доступа, файл удален/перемещен).
      // Это рабочий сценарий, не считаем его ошибкой уровня error.
      if (response.status === 403 || response.status === 404) {
        console.info(
          `[getFileWithUserInfo] Skip file ${fileId}: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      console.error(`[getFileWithUserInfo] Error: ${response.status} ${response.statusText}`);
      console.error(`[getFileWithUserInfo] Response: ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log(`[getFileWithUserInfo] Response for ${fileId}:`, data);
    return data;
  } catch (error) {
    console.error("[getFileWithUserInfo] Exception:", error);
    return null;
  }
}
