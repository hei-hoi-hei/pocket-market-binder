/**
 * Authoritative schema for the optional synchronization database.
 *
 * Keep every store used by sync here. Opening the same database from separate
 * modules at the same version cannot add stores to an existing database.
 */
export const SYNC_DB_NAME = 'pocket-market-sync';
export const SYNC_DB_VERSION = 2;
export const SYNC_RECORDS_STORE = 'sync-records';
export const OUTBOX_STORE = 'outbox';

let database: IDBDatabase | null = null;
let openPromise: Promise<IDBDatabase> | null = null;

function ensureSchema(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(SYNC_RECORDS_STORE)) {
    db.createObjectStore(SYNC_RECORDS_STORE, { keyPath: 'recordId' });
  }

  if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
    db.createObjectStore(OUTBOX_STORE, { keyPath: 'id', autoIncrement: true });
  }
}

export function openSyncDatabase(): Promise<IDBDatabase> {
  if (database) return Promise.resolve(database);
  if (openPromise) return openPromise;

  openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);

    request.onerror = () => {
      openPromise = null;
      reject(request.error);
    };

    request.onupgradeneeded = () => ensureSchema(request.result);

    request.onsuccess = () => {
      database = request.result;
      database.onversionchange = () => {
        database?.close();
        database = null;
        openPromise = null;
      };
      resolve(database);
    };
  });

  return openPromise;
}

/** Close the shared connection when the host needs to release the database. */
export function closeSyncDatabase(): void {
  database?.close();
  database = null;
  openPromise = null;
}
