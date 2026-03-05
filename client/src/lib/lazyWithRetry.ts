import { lazy, type ComponentType, type LazyExoticComponent } from "react";

function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk \d+ failed/i.test(
    message
  );
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  key: string
): LazyExoticComponent<T> {
  return lazy(async () => {
    const storageKey = `lazy-retry:${key}`;
    const hasRetried =
      typeof window !== "undefined" && window.sessionStorage.getItem(storageKey) === "1";

    try {
      const mod = await importer();
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(storageKey);
      }
      return mod;
    } catch (error) {
      if (typeof window !== "undefined" && isChunkLoadError(error) && !hasRetried) {
        window.sessionStorage.setItem(storageKey, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }

      throw error;
    }
  });
}
