import type {
  DriveApiFile,
  DriveItem,
  DriveListMyDriveResponse,
} from "../components/drive/driveTypes";

type DriveListResult = {
  files?: DriveApiFile[];
  nextPageToken?: string;
};

const DRIVE_FIELDS =
  "nextPageToken,files(id,name,mimeType,modifiedTime,size,iconLink,thumbnailLink,webViewLink,owners(displayName))";

function getDriveItemOpenUrl(item: Pick<DriveItem, "id" | "mimeType" | "webViewLink">): string {
  if (item.webViewLink) {
    return item.webViewLink;
  }

  switch (item.mimeType) {
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

async function getAccessToken(): Promise<Browser.identity.GetAuthTokenResult> {
  try {
    return await browser.identity.getAuthToken({ interactive: false });
  } catch {
    return browser.identity.getAuthToken({ interactive: true });
  }
}

export async function listMyDriveFolder(
  folderId: string,
  pageToken?: string,
): Promise<DriveListMyDriveResponse> {
  const normalizedFolderId = folderId.trim() ? folderId.trim() : "root";

  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      pageSize: "50",
      q: `trashed=false and '${normalizedFolderId}' in parents`,
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
