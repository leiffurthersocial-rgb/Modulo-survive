/**
 * Storage adapters: IndexedDB at runtime, in-memory for tests — the seam for
 * future cloud sync (ARCHITECTURE.md §7).
 */

export interface StorageAdapter {
  get<T>(store: string, key: string): Promise<T | undefined>;
  put<T>(store: string, key: string, value: T): Promise<void>;
  delete(store: string, key: string): Promise<void>;
  keys(store: string): Promise<string[]>;
}

const DB_NAME = 'modulo-survive';
const DB_VERSION = 1;
const STORES = ['worlds', 'settings'];

export class IDBStorage implements StorageAdapter {
  private dbP: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.dbP) {
      this.dbP = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const s of STORES) {
            if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbP;
  }

  private tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    return this.open().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const t = db.transaction(store, mode);
          const req = fn(t.objectStore(store));
          req.onsuccess = () => resolve(req.result as T);
          req.onerror = () => reject(req.error);
        }),
    );
  }

  get<T>(store: string, key: string): Promise<T | undefined> {
    return this.tx<T | undefined>(store, 'readonly', (s) => s.get(key));
  }
  put<T>(store: string, key: string, value: T): Promise<void> {
    return this.tx<void>(store, 'readwrite', (s) => s.put(value, key)).then(() => undefined);
  }
  delete(store: string, key: string): Promise<void> {
    return this.tx<void>(store, 'readwrite', (s) => s.delete(key)).then(() => undefined);
  }
  keys(store: string): Promise<string[]> {
    return this.tx<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()).then((ks) => ks.map(String));
  }
}

export class MemoryStorage implements StorageAdapter {
  private data = new Map<string, Map<string, unknown>>();

  private store(name: string): Map<string, unknown> {
    let s = this.data.get(name);
    if (!s) {
      s = new Map();
      this.data.set(name, s);
    }
    return s;
  }

  async get<T>(store: string, key: string): Promise<T | undefined> {
    return this.store(store).get(key) as T | undefined;
  }
  async put<T>(store: string, key: string, value: T): Promise<void> {
    this.store(store).set(key, value);
  }
  async delete(store: string, key: string): Promise<void> {
    this.store(store).delete(key);
  }
  async keys(store: string): Promise<string[]> {
    return [...this.store(store).keys()];
  }
}

/** Runtime default; swapped in tests. */
export const defaultStorage: StorageAdapter =
  typeof indexedDB !== 'undefined' ? new IDBStorage() : new MemoryStorage();
