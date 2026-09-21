import { OutboxEntry } from '../types/sync.types';
import { openSyncDatabase, OUTBOX_STORE } from '../syncDatabase';

class OutboxManager {
  private async getDB(): Promise<IDBDatabase> {
    return openSyncDatabase();
  }

  /**
   * Adds a new entry to the outbox.
   */
  async enqueue(entry: Omit<OutboxEntry, 'id' | 'timestamp'>): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(OUTBOX_STORE, 'readwrite');
      const store = transaction.objectStore(OUTBOX_STORE);
      const fullEntry: OutboxEntry = {
        ...entry,
        timestamp: Date.now(),
      };
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      
      store.add(fullEntry);
    });
  }

  /**
   * Retrieves the next batch of entries from the outbox.
   */
  async getNextBatch(limit: number): Promise<OutboxEntry[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(OUTBOX_STORE, 'readonly');
      const store = transaction.objectStore(OUTBOX_STORE);
      const request = store.getAll(null, limit);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Removes processed entries from the outbox.
   */
  async removeEntries(ids: number[]): Promise<void> {
    const db = await this.getDB();
    if (ids.length === 0) return;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(OUTBOX_STORE, 'readwrite');
      const store = transaction.objectStore(OUTBOX_STORE);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));

      ids.forEach((id) => {
        store.delete(id);
      });
    });
  }

  /**
   * Clears the outbox (used during logout).
   */
  async clear(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(OUTBOX_STORE, 'readwrite');
      const store = transaction.objectStore(OUTBOX_STORE);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

export const outboxManager = new OutboxManager();
