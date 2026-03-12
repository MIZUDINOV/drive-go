import type {
  DriveApiFile,
  DriveListMyDriveResponse,
} from "../components/drive/driveTypes";
import {
  DEFAULT_DRIVE_SEARCH_FILTERS,
  type DriveSearchFilters,
  getAccessToken,
  getWriteAccessToken,
} from "./driveApi";

type DriveListResult = {
  files?: DriveApiFile[];
  nextPageToken?: string;
};

type StarredListOptions = {
  folderId?: string;
  filters?: DriveSearchFilters;
};

type StarredMutationResult = { ok: true } | { ok: false; error: string };

const STARRED_ROOT_ID = "starred-root";

const STARRED_FIELDS =
  "nextPageToken,files(id,name,mimeType,modifiedTime,size,iconLink,thumbnailLink,webViewLink,owners(displayName,emailAddress))";

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
    case "forms":
      return "mimeType = 'application/vnd.google-apps.form'";
    case "archives":
      return "(mimeType = 'application/zip' or mimeType = 'application/x-zip-compressed' or mimeType = 'application/x-rar-compressed' or mimeType = 'application/x-7z-compressed' or mimeType = 'application/x-tar' or mimeType = 'application/gzip')";
    case "audio":
      return "mimeType contains 'audio/'";
    case "videos":
      return "(mimeType contains 'video/' or mimeType = 'application/vnd.google-apps.video')";
    case "vids":
      return "mimeType = 'application/vnd.google-apps.vid'";
    default:
      return null;
  }
}

function buildStarredQuery(
  folderId: string,
  filters: DriveSearchFilters,
): string {
  const isRoot = folderId === STARRED_ROOT_ID;
  const parts: string[] = isRoot
    ? ["starred=true", "trashed=false"]
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

export async function listStarredItems(
  pageToken?: string,
  options?: StarredListOptions,
): Promise<DriveListMyDriveResponse> {
  const folderId = options?.folderId?.trim() || STARRED_ROOT_ID;
  const filters = options?.filters ?? DEFAULT_DRIVE_SEARCH_FILTERS;

  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      pageSize: "50",
      q: buildStarredQuery(folderId, filters),
      fields: STARRED_FIELDS,
      orderBy: "folder,name_natural",
      spaces: "drive",
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

export async function removeFromStarred(
  fileId: string,
): Promise<StarredMutationResult> {
  try {
    const token = await getWriteAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ starred: false }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `Ошибка снятия пометки ${response.status}: ${errorText}`,
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
