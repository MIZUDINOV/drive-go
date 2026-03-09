import type {
  DriveApiFile,
  DriveListMyDriveResponse,
} from "../components/drive/driveTypes";
import {
  DEFAULT_DRIVE_SEARCH_FILTERS,
  type DriveSearchFilters,
  getAccessToken,
} from "./driveApi";
import { deletePermission, listPermissions } from "./sharingApi";

type DriveListResult = {
  files?: DriveApiFile[];
  nextPageToken?: string;
};

type SharedListOptions = {
  folderId?: string;
  filters?: DriveSearchFilters;
};

type SharedMutationResult = { ok: true } | { ok: false; error: string };

const SHARED_FIELDS =
  "nextPageToken,files(id,name,mimeType,modifiedTime,size,iconLink,thumbnailLink,webViewLink,owners(displayName,emailAddress))";

const SHARED_ROOT_ID = "shared-root";

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

function buildSharedQuery(
  folderId: string,
  filters: DriveSearchFilters,
): string {
  const isSharedRoot = folderId === SHARED_ROOT_ID;
  const parts: string[] = isSharedRoot
    ? ["sharedWithMe", "trashed=false"]
    : [`'${escapeQueryValue(folderId)}' in parents`, "trashed=false"];

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

export async function listSharedWithMe(
  pageToken?: string,
  options?: SharedListOptions,
): Promise<DriveListMyDriveResponse> {
  const folderId = options?.folderId?.trim() || SHARED_ROOT_ID;
  const filters = options?.filters ?? DEFAULT_DRIVE_SEARCH_FILTERS;

  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      pageSize: "50",
      q: buildSharedQuery(folderId, filters),
      fields: SHARED_FIELDS,
      orderBy: "folder,name_natural",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
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

export async function addSharedItemToStarred(
  fileId: string,
): Promise<SharedMutationResult> {
  try {
    const token = await getAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ starred: true }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `Ошибка добавления в помеченные ${response.status}: ${errorText}`,
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

async function getCurrentUserEmail(): Promise<string | null> {
  try {
    if (!browser.identity.getProfileUserInfo) {
      return null;
    }

    const profile = await browser.identity.getProfileUserInfo();
    const email = profile.email?.trim();
    return email ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function removeSharedItem(
  fileId: string,
): Promise<SharedMutationResult> {
  const email = await getCurrentUserEmail();

  if (!email) {
    return {
      ok: false,
      error:
        "Не удалось определить текущего пользователя. Проверьте разрешение identity.email.",
    };
  }

  const permissionsResult = await listPermissions(fileId);
  if (!permissionsResult.ok) {
    return { ok: false, error: permissionsResult.error };
  }

  const ownPermission = permissionsResult.permissions.find(
    (permission) => permission.emailAddress?.toLowerCase() === email,
  );

  if (!ownPermission) {
    return {
      ok: false,
      error:
        "Не найдена персональная запись доступа. Возможно, доступ унаследован от группы или домена.",
    };
  }

  const deleteResult = await deletePermission(fileId, ownPermission.id);
  if (!deleteResult.ok) {
    return { ok: false, error: deleteResult.error };
  }

  return { ok: true };
}
