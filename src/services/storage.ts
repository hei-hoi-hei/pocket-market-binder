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
  remove(key: string): Promise<void>;
}

const DB_NAME = 'pocket-market-binder';
const STORE_NAME = 'kv-store';
const DB_VERSION = 1;
const OLD_PREFIX = 'pmb:';

class IndexedDBStore implements KVStore {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
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
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });

    return this.initPromise;
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
      const db = await this.getDB();
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
      const db = await this.getDB();
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

  async remove(key: string): Promise<void> {
    try {
      const db = await this.getDB();
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

// Trigger migration in the background
idbStore.migrateIfNeeded().catch(() => {});

export const storage: KVStore = idbStore;

