export type OutboxItem = {
  clientId: string;
  conversationId: number;
  body: string;
  replyToId: number | null;
  status: "pending" | "failed";
  createdAt: number;
};

const memory = new Map<string, OutboxItem>();
const DB_NAME = "tm-chat";
const STORE = "outbox";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: "clientId" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveOutbox(item: OutboxItem): Promise<void> {
  memory.set(item.clientId, item);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function removeOutbox(clientId: string): Promise<void> {
  memory.delete(clientId);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(clientId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadOutbox(conversationId: number): Promise<OutboxItem[]> {
  const db = await openDb();
  if (!db) {
    return [...memory.values()].filter((item) => item.conversationId === conversationId);
  }
  const rows = await new Promise<OutboxItem[]>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as OutboxItem[]) ?? []);
      req.onerror = () => resolve([...memory.values()]);
    } catch {
      resolve([...memory.values()]);
    }
  });
  for (const row of rows) memory.set(row.clientId, row);
  return rows.filter((item) => item.conversationId === conversationId);
}

export function newClientId(): string {
  return crypto.randomUUID();
}
