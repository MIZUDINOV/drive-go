import type {
  DriveApiFile,
  DriveListMyDriveResponse,
} from "../components/drive/driveTypes";

type DriveListResult = {
  files?: DriveApiFile[];
  nextPageToken?: string;
};

const DRIVE_FIELDS =
  "nextPageToken,files(id,name,mimeType,modifiedTime,size,iconLink,thumbnailLink,owners(displayName))";

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
