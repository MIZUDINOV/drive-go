import { defer, firstValueFrom, of, throwError, timer } from "rxjs";
import { mergeMap, retry } from "rxjs/operators";

export type TransferHttpRetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_BASE_DELAY_MS = 300;
const DEFAULT_MAX_DELAY_MS = 4000;

class RetryableHttpStatusError extends Error {
  public constructor(public readonly status: number) {
    super(`Retryable HTTP status: ${status}`);
    this.name = "RetryableHttpStatusError";
  }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function backoffDelay(
  retryIndex: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const jitter = Math.floor(Math.random() * 120);
  const raw = baseDelayMs * 2 ** Math.max(0, retryIndex - 1);
  return Math.min(raw + jitter, maxDelayMs);
}

export async function fetchWithRetry(
  request: () => Promise<Response>,
  options: TransferHttpRetryOptions = {},
): Promise<Response> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  return firstValueFrom(
    defer(request).pipe(
      mergeMap((response) => {
        if (isRetryableStatus(response.status)) {
          return throwError(
            () => new RetryableHttpStatusError(response.status),
          );
        }

        return of(response);
      }),
      retry({
        count: maxRetries,
        delay: (error, retryCount) => {
          if (isAbortError(error)) {
            return throwError(() => error);
          }

          if (
            error instanceof RetryableHttpStatusError ||
            error instanceof TypeError
          ) {
            return timer(backoffDelay(retryCount, baseDelayMs, maxDelayMs));
          }

          return throwError(() => error);
        },
      }),
    ),
  );
}
