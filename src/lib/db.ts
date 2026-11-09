// Local-only storage in the browser's IndexedDB. Nothing is sent anywhere.
import type { AppState } from './model';

const DB_NAME = 'practice-finances';
const STORE = 'kv';
const KEY = 'state';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadState(): Promise<AppState | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve((req.result as AppState) ?? null);
    req.onerror = () => reject(req.error);
  });
}

let queue: Promise<void> = Promise.resolve();

/** Saves are queued so they always land in order. */
export function saveState(state: AppState): Promise<void> {
  queue = queue.then(
    () =>
      open().then(
        (db) =>
          new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(state, KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          }),
      ),
    () => undefined,
  );
  return queue;
}
