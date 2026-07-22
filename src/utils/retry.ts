export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  retries: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Runs `fn`, retrying on failure up to `options.retries` additional times
 * with linear backoff. Throws the last error if all attempts fail.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { retries, baseDelayMs = 1000, onRetry } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt > retries) break;
      onRetry?.(attempt, error);
      await sleep(baseDelayMs * attempt);
    }
  }

  throw lastError;
}
