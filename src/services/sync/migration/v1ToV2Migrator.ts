import { SyncRecord, SyncStore } from '../types/sync.types';
import { MigrationResult, MigrationStatus } from './migrationTypes';
import { storage } from '../../../services/storage';
import { openSyncDatabase, SYNC_RECORDS_STORE } from '../syncDatabase';

export class V1ToV2Migrator {
  private async getSyncDB(): Promise<IDBDatabase> {
    return openSyncDatabase();
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
        const transaction = db.transaction(SYNC_RECORDS_STORE, 'readwrite');
        const store = transaction.objectStore(SYNC_RECORDS_STORE);

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
