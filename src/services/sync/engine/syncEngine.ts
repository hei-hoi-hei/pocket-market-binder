import { outboxManager } from './outboxManager';
import { SyncProvider, SyncRecord, SyncStore } from '../types/sync.types';
import { supabase } from '../providers/supabase/supabaseClient';

export class SyncEngine {
  constructor(private provider: SyncProvider) {}

  async sync(): Promise<void> {
    if (this.provider.getProviderStatus() === 'UNAVAILABLE') return;

    // 1. Push Outbox
    const pending = await outboxManager.getNextBatch(50);
    if (pending.length > 0) {
      const result = await this.provider.pushChanges(
        pending.map(e => ({ store: e.store, record: e.record }))
      );
      if (result.success) {
        await outboxManager.removeEntries(pending.map(e => e.id!));
      }
    }

    // 2. Pull Changes (simple cursor based)
    // Note: In real app, we need to track local cursor
    const delta = await this.provider.pullChanges(0); 
    // Merge logic would go here
  }
}
