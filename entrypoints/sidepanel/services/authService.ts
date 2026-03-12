export type AuthToken = {
  token: string;
};

export const OAUTH_SCOPE_DRIVE_WRITE = "https://www.googleapis.com/auth/drive";
export const OAUTH_SCOPE_DRIVE_METADATA_READONLY =
  "https://www.googleapis.com/auth/drive.metadata.readonly";
export const OAUTH_SCOPE_DRIVE_ACTIVITY_READONLY =
  "https://www.googleapis.com/auth/drive.activity.readonly";

const AUTH_REQUIRED_ERROR = "AUTH_REQUIRED";
const GRANTED_SCOPES_STORAGE_KEY = "oauth_granted_scopes_v1";

type StoredGrantedScopes = {
  scopes: string[];
  updatedAt: number;
};

type TokenInfoResponse = {
  scope?: string;
};

function normalizeAuthToken(
  result: Browser.identity.GetAuthTokenResult | string | null | undefined,
): AuthToken | null {
  if (!result) {
    return null;
  }

  if (typeof result === "string") {
    return result ? { token: result } : null;
  }

  if (typeof result.token === "string" && result.token.length > 0) {
    return { token: result.token };
  }

  return null;
}

function normalizeScopes(rawScopes: string): string[] {
  return rawScopes
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
}

function createTokenDetails(
  interactive: boolean,
  scopes?: string[],
): Browser.identity.TokenDetails {
  const normalizedScopes = (scopes ?? []).filter((scope) => scope.length > 0);

  if (normalizedScopes.length === 0) {
    return { interactive };
  }

  return {
    interactive,
    scopes: normalizedScopes,
  };
}

async function readStoredGrantedScopes(): Promise<StoredGrantedScopes | null> {
  const stored = await browser.storage.local.get(GRANTED_SCOPES_STORAGE_KEY);
  const candidate = stored[GRANTED_SCOPES_STORAGE_KEY] as
    | StoredGrantedScopes
    | undefined;

  if (!candidate || !Array.isArray(candidate.scopes)) {
    return null;
  }

  return {
    scopes: candidate.scopes.filter((scope) => typeof scope === "string"),
    updatedAt:
      typeof candidate.updatedAt === "number"
        ? candidate.updatedAt
        : Date.now(),
  };
}

export async function getCachedGrantedScopes(): Promise<string[]> {
  const stored = await readStoredGrantedScopes();
  return stored?.scopes ?? [];
}

async function writeStoredGrantedScopes(scopes: string[]): Promise<void> {
  const payload: StoredGrantedScopes = {
    scopes,
    updatedAt: Date.now(),
  };

  await browser.storage.local.set({
    [GRANTED_SCOPES_STORAGE_KEY]: payload,
  });
}

async function fetchGrantedScopesForToken(token: string): Promise<string[]> {
  const params = new URLSearchParams({ access_token: token });
  const response = await fetch(
    `https://www.googleapis.com/oauth2/v1/tokeninfo?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Не удалось получить список scopes (${response.status})`);
  }

  const data = (await response.json()) as TokenInfoResponse;
  return normalizeScopes(data.scope ?? "");
}

async function refreshGrantedScopesForToken(
  token: AuthToken,
): Promise<string[]> {
  const scopes = await fetchGrantedScopesForToken(token.token);
  await writeStoredGrantedScopes(scopes);
  return scopes;
}

async function collectGrantedScopesFromAvailableTokens(): Promise<string[]> {
  const knownScopes = [
    OAUTH_SCOPE_DRIVE_WRITE,
    OAUTH_SCOPE_DRIVE_METADATA_READONLY,
    OAUTH_SCOPE_DRIVE_ACTIVITY_READONLY,
  ];

  const aggregated = new Set<string>();

  for (const scope of knownScopes) {
    const token = await tryGetAuthTokenSilently([scope]);
    if (!token) {
      continue;
    }

    try {
      const tokenScopes = await fetchGrantedScopesForToken(token.token);
      for (const grantedScope of tokenScopes) {
        aggregated.add(grantedScope);
      }
    } catch {
      // Ignore per-scope tokeninfo failures and continue with other tokens.
    }
  }

  const fallbackToken = await tryGetAuthTokenSilently();
  if (fallbackToken) {
    try {
      const fallbackScopes = await fetchGrantedScopesForToken(
        fallbackToken.token,
      );
      for (const grantedScope of fallbackScopes) {
        aggregated.add(grantedScope);
      }
    } catch {
      // Ignore fallback tokeninfo failure; caller will use whatever was aggregated.
    }
  }

  return [...aggregated];
}

export async function getGrantedScopes(
  forceRefresh = false,
): Promise<string[]> {
  const stored = await readStoredGrantedScopes();
  if (stored && !forceRefresh) {
    return stored.scopes;
  }

  try {
    const scopes = await collectGrantedScopesFromAvailableTokens();
    if (scopes.length > 0) {
      await writeStoredGrantedScopes(scopes);
      return scopes;
    }

    return stored?.scopes ?? [];
  } catch {
    return stored?.scopes ?? [];
  }
}

export function hasGrantedScope(
  grantedScopes: string[],
  requiredScope: string,
): boolean {
  return grantedScopes.includes(requiredScope);
}

export function isAuthRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === AUTH_REQUIRED_ERROR;
}

export function isAuthFlowCancelledError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("cancel") ||
    message.includes("canceled") ||
    message.includes("did not approve") ||
    message.includes("user rejected") ||
    message.includes("user closed")
  );
}

export async function tryGetAuthTokenSilently(
  scopes?: string[],
): Promise<AuthToken | null> {
  try {
    const result = await browser.identity.getAuthToken(
      createTokenDetails(false, scopes),
    );
    return normalizeAuthToken(result);
  } catch {
    return null;
  }
}

export async function getAccessTokenSilently(
  scopes?: string[],
): Promise<AuthToken> {
  const token = await tryGetAuthTokenSilently(scopes);
  if (!token) {
    throw new Error(AUTH_REQUIRED_ERROR);
  }

  return token;
}

export async function startInteractiveSignIn(
  scopes?: string[],
): Promise<AuthToken> {
  const result = await browser.identity.getAuthToken(
    createTokenDetails(true, scopes),
  );
  const token = normalizeAuthToken(result);

  if (!token) {
    throw new Error("Интерактивная авторизация не вернула токен");
  }

  try {
    await refreshGrantedScopesForToken(token);
  } catch {
    // Ignore scope refresh failures here; capability layer handles fallback.
  }

  return token;
}
