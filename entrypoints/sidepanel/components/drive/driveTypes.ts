export const ROOT_FOLDER_ID = "root";
export const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

export type DriveOwner = {
  displayName?: string;
};

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  ownerName?: string;
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
};

export type DriveApiFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  owners?: DriveOwner[];
};

export type DriveListMyDriveResponse = {
  ok: boolean;
  data?: {
    files?: DriveApiFile[];
    nextPageToken?: string;
  };
  error?: string;
};

export type BreadcrumbItem = {
  id: string;
  name: string;
};

export type DriveViewMode = "list" | "grid";

export function isFolder(item: Pick<DriveItem, "mimeType">): boolean {
  return item.mimeType === FOLDER_MIME_TYPE;
}
