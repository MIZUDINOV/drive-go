import { getAccessToken, getWriteAccessToken } from "./driveApi";
import { translateCurrentLocale } from "../../shared/i18n/runtime";

export type PermissionRole = "reader" | "commenter" | "writer";

export type DrivePermission = {
  id: string;
  type: "user" | "group" | "domain" | "anyone";
  role: string;
  emailAddress?: string;
  displayName?: string;
};

type PermissionsListResponse = {
  permissions?: DrivePermission[];
};

type ListPermissionsResult =
  | { ok: true; permissions: DrivePermission[] }
  | { ok: false; error: string };

export async function listPermissions(
  fileId: string,
): Promise<ListPermissionsResult> {
  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      fields: "permissions(id,type,role,emailAddress,displayName)",
    });

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token.token}` },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: translateCurrentLocale("sharing.error.listPermissionsStatus", {
          status: String(response.status),
          details: errorText,
        }),
      };
    }

    const data = (await response.json()) as PermissionsListResponse;
    return { ok: true, permissions: data.permissions ?? [] };
  } catch (unknownError: unknown) {
    return {
      ok: false,
      error:
        unknownError instanceof Error
          ? unknownError.message
          : translateCurrentLocale("service.error.unknown"),
    };
  }
}

type AddPermissionResult = { ok: true } | { ok: false; error: string };

export async function addPermission(
  fileId: string,
  email: string,
  role: PermissionRole,
): Promise<AddPermissionResult> {
  try {
    const token = await getWriteAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?sendNotificationEmail=false`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "user",
          role,
          emailAddress: email.trim(),
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: translateCurrentLocale("sharing.error.addPermissionStatus", {
          status: String(response.status),
          details: errorText,
        }),
      };
    }

    return { ok: true };
  } catch (unknownError: unknown) {
    return {
      ok: false,
      error:
        unknownError instanceof Error
          ? unknownError.message
          : translateCurrentLocale("service.error.unknown"),
    };
  }
}

type DeletePermissionResult = { ok: true } | { ok: false; error: string };

export async function deletePermission(
  fileId: string,
  permissionId: string,
): Promise<DeletePermissionResult> {
  try {
    const token = await getWriteAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${permissionId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token.token}` },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: translateCurrentLocale("sharing.error.deletePermissionStatus", {
          status: String(response.status),
          details: errorText,
        }),
      };
    }

    return { ok: true };
  } catch (unknownError: unknown) {
    return {
      ok: false,
      error:
        unknownError instanceof Error
          ? unknownError.message
          : translateCurrentLocale("service.error.unknown"),
    };
  }
}
