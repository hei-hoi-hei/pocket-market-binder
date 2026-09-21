import { 
  SyncProvider, 
  SyncChange, 
  SyncResult, 
  SyncCursor, 
  SyncDelta, 
  User, 
  ProviderStatus 
} from '../../types/sync.types';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';

export class SupabaseSyncProvider implements SyncProvider {
  async signIn(): Promise<User | null> {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.signInAnonymously();
    return user ? { id: user.id, email: user.email ?? undefined } : null;
  }

  async signOut(): Promise<void> {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async getCurrentUser(): Promise<User | null> {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user ? { id: user.id, email: user.email ?? undefined } : null;
  }

  onAuthStateChange(callback: (user: User | null) => void): void {
    if (!supabase) return;
    supabase.auth.onAuthStateChange((_event: any, session: Session | null) => {
      callback(session?.user ? { id: session.user.id, email: session.user.email ?? undefined } : null);
    });
  }

  async pushChanges(changes: SyncChange[]): Promise<SyncResult> {
    if (!supabase) return { success: false, error: 'No client', processedIds: [] };

    const { error } = await supabase
      .from('sync_records')
      .upsert(changes.map(c => ({
        record_id: c.record.recordId,
        store: c.store,
        data: c.record.data,
        updated_at: c.record.updatedAt,
        device_id: c.record.deviceId,
        is_deleted: c.record.isDeleted
      })));

    return { 
      success: !error, 
      error: error?.message, 
      processedIds: changes.map(c => c.record.recordId) 
    };
  }

  async pullChanges(cursor: SyncCursor): Promise<SyncDelta> {
    if (!supabase) return { changes: [], newCursor: cursor };

    const { data, error } = await supabase
      .from('sync_records')
      .select('*')
      .gt('updated_at', cursor);

    if (error || !data) return { changes: [], newCursor: cursor };

    const records = data as any[];
    return {
      changes: records.map(row => ({
        store: row.store,
        record: {
          recordId: row.record_id,
          updatedAt: row.updated_at,
          deviceId: row.device_id,
          isDeleted: row.is_deleted,
          data: row.data
        }
      })),
      newCursor: Math.max(...records.map(r => r.updated_at), Number(cursor))
    };
  }

  getProviderStatus(): ProviderStatus {
    // If we're offline, regardless of config, we are OFFLINE
    if (!navigator.onLine) return 'OFFLINE';
    if (!supabase) return 'UNAVAILABLE';
    return 'SYNCED';
  }
}
