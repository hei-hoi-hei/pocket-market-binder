import { outboxManager } from './engine/outboxManager';
import { SyncStore } from './types/sync.types';

export async function recordSyncChange(store: SyncStore, recordId: string, data: any, isDeleted: boolean = false) {
  await outboxManager.enqueue({
    store,
    recordId,
    record: {
      recordId,
      updatedAt: Date.now(),
      deviceId: 'local-browser',
      isDeleted,
      data
    }
  });
}
