export type AuthToken = {
  token: string;
};

const AUTH_REQUIRED_ERROR = "AUTH_REQUIRED";

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

export async function tryGetAuthTokenSilently(): Promise<AuthToken | null> {
  try {
    const result = await browser.identity.getAuthToken({ interactive: false });
    return normalizeAuthToken(result);
  } catch {
    return null;
  }
}

export async function getAccessTokenSilently(): Promise<AuthToken> {
  const token = await tryGetAuthTokenSilently();
  if (!token) {
    throw new Error(AUTH_REQUIRED_ERROR);
  }

  return token;
}

export async function startInteractiveSignIn(): Promise<AuthToken> {
  const result = await browser.identity.getAuthToken({ interactive: true });
  const token = normalizeAuthToken(result);

  if (!token) {
    throw new Error("Интерактивная авторизация не вернула токен");
  }

  return token;
}