export const WORK_DRAFT_VERSION = 1;
export const WORK_DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export type StoredWorkPage = {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  width?: number;
  height?: number;
  rotation: number;
  fingerprint?: string;
  createdAt: string;
};

export type WorkDraft = {
  version: typeof WORK_DRAFT_VERSION;
  examId: string;
  updatedAt: string;
  expiresAt: string;
  pages: StoredWorkPage[];
};

const databaseName = "iabacu-work-drafts";
const storeName = "drafts";

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error("Stocarea locală nu este disponibilă în acest browser."));
      return;
    }
    const request = window.indexedDB.open(databaseName, WORK_DRAFT_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Nu pot deschide stocarea locală."));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: "examId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      request.onerror = () => reject(request.error ?? new Error("Nu pot salva lucrarea local."));
      request.onsuccess = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error ?? new Error("Nu pot salva lucrarea local."));
    });
  } finally {
    database.close();
  }
}

function isDraft(value: unknown): value is WorkDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<WorkDraft>;
  return (
    draft.version === WORK_DRAFT_VERSION &&
    typeof draft.examId === "string" &&
    typeof draft.updatedAt === "string" &&
    typeof draft.expiresAt === "string" &&
    Array.isArray(draft.pages)
  );
}

export async function loadWorkDraft(examId: string): Promise<WorkDraft | null> {
  const value = await withStore<unknown>("readonly", (store) => store.get(examId));
  if (!isDraft(value)) return null;
  if (Date.parse(value.expiresAt) <= Date.now()) {
    await deleteWorkDraft(examId);
    return null;
  }
  return value;
}

export async function saveWorkDraft(
  examId: string,
  pages: StoredWorkPage[],
  now = Date.now(),
): Promise<WorkDraft> {
  const draft: WorkDraft = {
    version: WORK_DRAFT_VERSION,
    examId,
    updatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + WORK_DRAFT_TTL_MS).toISOString(),
    pages,
  };
  await withStore("readwrite", (store) => store.put(draft));
  return draft;
}

export async function deleteWorkDraft(examId: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(examId));
}

/** A stable byte hash catches exact re-uploads without treating similar work as duplicate. */
export async function fingerprintWorkPage(blob: Blob): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function orderWorkPages<T extends { name: string }>(pages: T[]): T[] {
  return [...pages].toSorted((left, right) =>
    left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }),
  );
}
