import type { DriveActivityResponse } from "./activityTypes";

const ACTIVITY_API_BASE = "https://driveactivity.googleapis.com/v2";

/**
 * Получить активность из Drive Activity API v2
 */
export async function fetchDriveActivity(
  pageToken?: string,
  pageSize: number = 50,
): Promise<DriveActivityResponse> {
  const token = await getAccessToken();

  const body = {
    pageSize,
    ...(pageToken && { pageToken }),
    // Фильтрация: только действия других пользователей или важные события
    filter: "time > \"2024-01-01T00:00:00Z\"",
  };

  const response = await fetch(`${ACTIVITY_API_BASE}/activity:query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Activity API error: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Получить информацию о профиле пользователя через People API
 * @param resourceName - вида "people/1234567890" из Drive Activity API
 * 
 * ВАЖНО: People API возвращает только ОБЩЕДОСТУПНУЮ информацию других пользователей.
 * Многие пользователи скрывают имя и email в настройках приватности Google,
 * поэтому API может вернуть только фото или вообще пустой результат.
 * 
 * РЕКОМЕНДАЦИЯ: Используйте Drive API files.get с полями lastModifyingUser/owners
 * вместо People API — там информация более надежная и не зависит от настроек приватности.
 * 
 * @deprecated Используйте getFileWithUserInfo() из driveApi.ts
 */
export async function fetchUserProfile(resourceName: string): Promise<{
  displayName?: string;
  emailAddress?: string;
  photoUrl?: string;
} | null> {
  try {
    if (!resourceName?.startsWith("people/")) {
      console.warn(`[fetchUserProfile] Invalid resourceName: ${resourceName}`);
      return null;
    }

    const token = await getAccessToken();
    const url = `https://people.googleapis.com/v1/${resourceName}?personFields=names,emailAddresses,photos`;
    console.log(`[fetchUserProfile] GET ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error(`[fetchUserProfile] API error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(`[fetchUserProfile] Response: ${text}`);
      
      // Проверка на отключенный People API
      if (response.status === 403 && text.includes('SERVICE_DISABLED')) {
        console.warn('[fetchUserProfile] People API is disabled. Enable it in Google Cloud Console: https://console.developers.google.com/apis/api/people.googleapis.com');
      }
      
      return null;
    }

    const data = (await response.json()) as any;
    const displayName = data.names?.[0]?.displayName;
    const email = data.emailAddresses?.[0]?.value;
    const photoUrl = data.photos?.[0]?.url;
    
    // Если нет ни имени, ни email - профиль недоступен
    if (!displayName && !email) {
      console.warn(`[fetchUserProfile] Profile data not available for ${resourceName} (privacy settings or insufficient permissions)`);
      
      // Возвращаем хотя бы фото, если есть
      if (photoUrl) {
        return {
          displayName: undefined,
          emailAddress: undefined,
          photoUrl,
        };
      }
      
      return null;
    }
    
    console.log(`[fetchUserProfile] Successfully loaded: ${displayName || 'N/A'} (${email || 'N/A'})`);
    
    return {
      displayName,
      emailAddress: email,
      photoUrl,
    };
  } catch (error) {
    console.error("[fetchUserProfile] Exception:", error);
    return null;
  }
}

/**
 * Получить комментарии к файлу
 */
export async function fetchFileComments(
  fileId: string,
  pageToken?: string,
): Promise<{
  comments: Array<{
    id: string;
    content: string;
    author: {
      displayName: string;
      photoLink?: string;
      emailAddress?: string;
    };
    createdTime: string;
    modifiedTime: string;
    resolved: boolean;
    replies?: Array<{
      id: string;
      content: string;
      author: {
        displayName: string;
        photoLink?: string;
      };
      createdTime: string;
    }>;
  }>;
  nextPageToken?: string;
}> {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    fields: "comments(id,content,author,createdTime,modifiedTime,resolved,replies),nextPageToken",
    pageSize: "100",
    ...(pageToken && { pageToken }),
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/comments?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Comments API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Получить токен доступа из chrome identity
 */
export async function getAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    browser.identity.getAuthToken({ interactive: false }, (result) => {
      if (browser.runtime.lastError || !result) {
        reject(new Error(browser.runtime.lastError?.message || "No token"));
      } else {
        const token = typeof result === "string" ? result : result.token;
        if (!token) {
          reject(new Error("Token is undefined"));
        } else {
          resolve(token);
        }
      }
    });
  });
}
