export type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storage(): BrowserStorage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readBrowserStorage(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeBrowserStorage(key: string, value: string): boolean {
  try {
    storage()?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeBrowserStorage(key: string): boolean {
  try {
    storage()?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
