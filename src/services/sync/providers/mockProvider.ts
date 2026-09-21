import { 
  SyncProvider, 
  SyncChange, 
  SyncResult, 
  SyncCursor, 
  SyncDelta, 
  User, 
  ProviderStatus,
  SyncRecord
} from '../types/sync.types';

export class MockProvider implements SyncProvider {
  private currentUser: User | null = null;
  private authCallbacks: ((user: User | null) => void)[] = [];
  
  // In-memory "remote" storage: recordId -> SyncRecord
  private remoteStore: Map<string, SyncChange> = new Map();
  private lastUpdate = 0;

  async signIn(): Promise<User | null> {
    this.currentUser = { id: 'mock-user-123', email: 'mock@example.com' };
    this.notifyAuthChange();
    return this.currentUser;
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    this.notifyAuthChange();
  }

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }

  onAuthStateChange(callback: (user: User | null) => void): void {
    this.authCallbacks.push(callback);
  }

  private notifyAuthChange(): void {
    this.authCallbacks.forEach(cb => cb(this.currentUser));
  }

  async pushChanges(changes: SyncChange[]): Promise<SyncResult> {
    if (!this.currentUser) {
      return { success: false, error: 'Not authenticated', processedIds: [] };
    }

    const processedIds: string[] = [];
    for (const change of changes) {
      this.remoteStore.set(change.record.recordId, change);
      processedIds.push(change.record.recordId);
      this.lastUpdate = Math.max(this.lastUpdate, change.record.updatedAt);
    }

    return { success: true, processedIds };
  }

  async pullChanges(cursor: SyncCursor): Promise<SyncDelta> {
    const cursorTime = typeof cursor === 'number' ? cursor : 0;
    
    const changes = Array.from(this.remoteStore.values())
      .filter(change => change.record.updatedAt > cursorTime);

    return {
      changes,
      newCursor: this.lastUpdate
    };
  }

  getProviderStatus(): ProviderStatus {
    if (!this.currentUser) return 'LOCAL_ONLY';
    return 'SYNCED';
  }
}

export const mockProvider = new MockProvider();
