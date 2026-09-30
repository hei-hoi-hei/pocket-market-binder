/**
 * Storage abstraction.
 *
 * Replaced localStorage with a native IndexedDB implementation for
 * better persistence and larger capacity, as required by the
 * local-first architecture.
 */

export interface KVStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  setMany(entries: ReadonlyArray<readonly [key: string, value: unknown]>): Promise<void>;
  remove(key: string): Promise<void>;
}

const DB_NAME = 'pocket-market-binder';
const STORE_NAME = 'kv-store';
export const RECOGNITION_REFERENCES_STORE = 'scanner-recognition-references';
const DB_VERSION = 2;
const OLD_PREFIX = 'pmb:';

class IndexedDBStore implements KVStore {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  async openDatabase(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.initPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.db.onversionchange = () => this.close();
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(RECOGNITION_REFERENCES_STORE)) {
          const references = db.createObjectStore(RECOGNITION_REFERENCES_STORE, {
            keyPath: 'referenceId',
          });
          references.createIndex('identityKey', 'identityKey', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  close(): void {
    this.db?.close();
    this.db = null;
    this.initPromise = null;
  }

  /**
   * One-time migration from localStorage for the prototype phase.
   * Checks for old data and moves it to IndexedDB.
   */
  async migrateIfNeeded(): Promise<void> {
    const keys = ['binder', 'wishlist', 'cart'];
    for (const key of keys) {
      const oldKey = OLD_PREFIX + key;
      const val = localStorage.getItem(oldKey);
      if (val) {
        try {
          const parsed = JSON.parse(val);
          await this.set(key, parsed);
          localStorage.removeItem(oldKey);
          console.log(`Migrated ${key} from localStorage to IndexedDB.`);
        } catch (e) {
          console.error(`Failed to migrate ${key}:`, e);
        }
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.openDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result ?? null);
      });
    } catch (error) {
      console.error('IndexedDB get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.openDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error('IndexedDB set error:', error);
    }
  }

  async setMany(entries: ReadonlyArray<readonly [key: string, value: unknown]>): Promise<void> {
    const db = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction(STORE_NAME, 'readwrite');
      } catch (error: unknown) {
        reject(error);
        return;
      }

      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      transaction.onerror = () => fail(
        transaction.error ?? new Error('IndexedDB batch write failed.'),
      );
      transaction.onabort = () => fail(
        transaction.error ?? new Error('IndexedDB batch write was aborted.'),
      );

      try {
        const store = transaction.objectStore(STORE_NAME);
        for (const [key, value] of entries) store.put(value, key);
      } catch (error: unknown) {
        try {
          transaction.abort();
        } catch {
          // The transaction may already have been aborted by IndexedDB.
        }
        fail(error);
      }
    });
  }

  async remove(key: string): Promise<void> {
    try {
      const db = await this.openDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error('IndexedDB remove error:', error);
    }
  }
}

const idbStore = new IndexedDBStore();

export function openLocalDatabase(): Promise<IDBDatabase> {
  return idbStore.openDatabase();
}

export function closeLocalDatabase(): void {
  idbStore.close();
}

// Trigger migration in the background
idbStore.migrateIfNeeded().catch(() => {});

export const storage: KVStore = idbStore;
