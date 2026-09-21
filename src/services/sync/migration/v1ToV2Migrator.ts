import { SyncRecord, SyncStore } from '../types/sync.types';
import { MigrationResult, MigrationStatus } from './migrationTypes';
import { storage } from '../../../services/storage';

const SYNC_DB_NAME = 'pocket-market-sync';
const SYNC_STORE_NAME = 'sync-records'; // Separate store for V2 data
const SYNC_DB_VERSION = 1;

export class V1ToV2Migrator {
  private async getSyncDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(SYNC_STORE_NAME)) {
          // Store sync records keyed by recordId
          db.createObjectStore(SYNC_STORE_NAME, { keyPath: 'recordId' });
        }
      };
    });
  }

  private generateUUID(): string {
    return crypto.randomUUID();
  }

  async migrate(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      status: 'running',
      itemsProcessed: 0,
      storesMigrated: [],
      errors: [],
      startTime
    };

    const stores: SyncStore[] = ['binder', 'wishlist', 'cart'];
    const db = await this.getSyncDB();

    try {
      for (const storeName of stores) {
        // 1. Read legacy data (V1)
        const legacyData = await storage.get<any[]>(storeName);
        if (!legacyData || !Array.isArray(legacyData)) continue;

        // 2. Convert and Batch Save
        const transaction = db.transaction(SYNC_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SYNC_STORE_NAME);

        for (const item of legacyData) {
          const syncRecord: SyncRecord = {
            recordId: this.generateUUID(),
            updatedAt: item.addedAt || Date.now(), // V1 used addedAt
            deviceId: 'migrated-from-v1',
            isDeleted: false,
            data: item
          };
          store.put(syncRecord);
          result.itemsProcessed++;
        }

        result.storesMigrated.push(storeName);
      }

      result.status = 'completed';
      result.endTime = Date.now();
    } catch (err: any) {
      result.status = 'failed';
      result.errors.push(err.message || 'Unknown migration error');
    }

    return result;
  }
}

export const v1ToV2Migrator = new V1ToV2Migrator();
