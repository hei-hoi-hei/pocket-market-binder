import { describe, it, expect, vi } from 'vitest';
import { SupabaseSyncProvider } from '../providers/supabase/supabaseProvider';
import { supabase } from '../providers/supabase/supabaseClient';

describe('Supabase Sync E2E Mock', () => {
  it('should reflect OFFLINE status when navigator is offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    const provider = new SupabaseSyncProvider();
    expect(provider.getProviderStatus()).toBe('OFFLINE');
  });

  it('should reflect SYNCED status when navigator is online and client is present', () => {
    vi.stubGlobal('navigator', { onLine: true });
    // Assuming supabase client is present from env
    const provider = new SupabaseSyncProvider();
    if (supabase) {
        expect(provider.getProviderStatus()).toBe('SYNCED');
    } else {
        expect(provider.getProviderStatus()).toBe('UNAVAILABLE');
    }
  });
});
