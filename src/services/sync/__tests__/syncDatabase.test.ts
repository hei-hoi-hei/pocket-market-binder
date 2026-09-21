import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DB_NAME = 'pocket-market-sync';

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Sync database deletion was blocked'));
  });
}

function createVersionOneDatabase(storeNames: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      for (const storeName of storeNames) {
        request.result.createObjectStore(storeName, {
          keyPath: storeName === 'outbox' ? 'id' : 'recordId',
          autoIncrement: storeName === 'outbox',
        });
      }
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

describe('sync IndexedDB schema', () => {
  let closeSyncDatabase: () => void;

  beforeEach(async () => {
    vi.resetModules();
    await deleteDatabase();
  });

  afterEach(() => closeSyncDatabase?.());

  it('creates every required store for a fresh database', async () => {
    const schema = await import('../syncDatabase');
    closeSyncDatabase = schema.closeSyncDatabase;

    const db = await schema.openSyncDatabase();

    expect(db.version).toBe(2);
    expect([...db.objectStoreNames]).toEqual(expect.arrayContaining(['sync-records', 'outbox']));
  });

  it('upgrades a partial version-1 database without losing sync records', async () => {
    await createVersionOneDatabase(['sync-records']);
    const existing = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const seed = existing.transaction('sync-records', 'readwrite');
    seed.objectStore('sync-records').put({ recordId: 'legacy-record', updatedAt: 1 });
    await transactionComplete(seed);
    existing.close();

    const schema = await import('../syncDatabase');
    closeSyncDatabase = schema.closeSyncDatabase;
    const db = await schema.openSyncDatabase();
    const read = db.transaction('sync-records', 'readonly').objectStore('sync-records').get('legacy-record');
    const legacyRecord = await new Promise<any>((resolve, reject) => {
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });

    expect(db.version).toBe(2);
    expect([...db.objectStoreNames]).toEqual(expect.arrayContaining(['sync-records', 'outbox']));
    expect(legacyRecord).toMatchObject({ recordId: 'legacy-record', updatedAt: 1 });
  });

  it('adds sync records when a version-1 database was initialized by the outbox', async () => {
    await createVersionOneDatabase(['outbox']);
    const schema = await import('../syncDatabase');
    closeSyncDatabase = schema.closeSyncDatabase;

    const db = await schema.openSyncDatabase();

    expect(db.version).toBe(2);
    expect([...db.objectStoreNames]).toEqual(expect.arrayContaining(['sync-records', 'outbox']));
  });

  it('supports outbox create, read, and delete operations', async () => {
    const { outboxManager } = await import('../engine/outboxManager');
    ({ closeSyncDatabase } = await import('../syncDatabase'));

    await outboxManager.enqueue({
      store: 'binder',
      recordId: 'card-1',
      record: { recordId: 'card-1', updatedAt: 1, deviceId: 'test', isDeleted: false, data: {} },
    });
    const entries = await outboxManager.getNextBatch(10);
    await outboxManager.removeEntries(entries.map((entry) => entry.id!));

    expect(entries).toHaveLength(1);
    await expect(outboxManager.getNextBatch(10)).resolves.toEqual([]);
  });

  it('keeps a local collection mutation functional when sync is unavailable', async () => {
    const localStore = new Map<string, unknown>();
    vi.doMock('../../storage', () => ({
      storage: {
        get: async (key: string) => localStore.get(key) ?? null,
        set: async (key: string, value: unknown) => { localStore.set(key, value); },
        remove: async (key: string) => { localStore.delete(key); },
      },
    }));

    const { addToBinder } = await import('../../collectionService');
    const { outboxManager } = await import('../engine/outboxManager');
    ({ closeSyncDatabase } = await import('../syncDatabase'));

    await expect(addToBinder('offline-card')).resolves.toEqual([
      { cardId: 'offline-card', quantity: 1, addedAt: expect.any(Number) },
    ]);
    await expect(outboxManager.getNextBatch(10)).resolves.toHaveLength(1);
  });
});
