// Exponential backoff retry utility for transient operations (read, search, cart-add).
// CRITICAL: Must never be applied to payment execution or order placement commands.

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 500;
  const backoffFactor = options.backoffFactor ?? 2;

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    attempt += 1;
    try {
      return await operation();
    } catch (err) {
      const isTransient = options.shouldRetry ? options.shouldRetry(err) : true;
      if (attempt >= maxRetries || !isTransient) {
        throw err;
      }
      console.warn(
        `[Retry] Operation '${operationName}' failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`,
        err
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= backoffFactor;
    }
  }
}
