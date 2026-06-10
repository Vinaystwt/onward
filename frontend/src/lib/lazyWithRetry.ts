import { ComponentType, lazy } from "react";

// Retry dynamic imports up to 3 times with back-off.
// If all attempts fail, throw — let the per-route ErrorBoundary show a visible
// error card with a Reload button. Do NOT call location.reload() silently,
// which produces a blank white screen that the user cannot recover from.
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    let attempt = 0;
    let lastErr: unknown;
    while (attempt < 3) {
      try {
        return await factory();
      } catch (e) {
        lastErr = e;
        attempt += 1;
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error("Page chunk failed to load. Check your connection and reload.");
  });
}
