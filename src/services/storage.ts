/**
 * Storage abstraction.
 *
 * Today this is a thin localStorage wrapper. The interface is deliberately
 * async-shaped so it can be swapped for an IndexedDB implementation later
 * without touching any consuming code.
 */

export interface KVStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

const PREFIX = 'pmb:';

class LocalStorageStore implements KVStore {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* quota or private mode — fail silently for prototype */
    }
  }

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* noop */
    }
  }
}

// Single shared instance. A future IndexedDB implementation would replace this.
export const storage: KVStore = new LocalStorageStore();
