export type SyncStore = 'binder' | 'wishlist' | 'cart';

export interface SyncRecord<T = any> {
  recordId: string;
  updatedAt: number;
  deviceId: string;
  isDeleted: boolean;
  data: T;
}

export interface OutboxEntry {
  id?: number; // Primary key for IndexedDB
  store: SyncStore;
  recordId: string;
  record: SyncRecord;
  timestamp: number;
}

export interface User {
  id: string;
  email?: string;
}

export type ProviderStatus = 
  | 'LOCAL_ONLY' 
  | 'SYNCED' 
  | 'SYNCING' 
  | 'OFFLINE' 
  | 'UNAVAILABLE' 
  | 'AUTH_ERROR';

export interface SyncChange {
  store: SyncStore;
  record: SyncRecord;
}

export interface SyncResult {
  success: boolean;
  error?: string;
  processedIds: string[];
}

export type SyncCursor = string | number;

export interface SyncDelta {
  changes: SyncChange[];
  newCursor: SyncCursor;
}

export interface SyncProvider {
  /** Authentication & User Context */
  signIn(): Promise<User | null>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  onAuthStateChange(callback: (user: User | null) => void): void;

  /** Data Synchronization */
  pushChanges(changes: SyncChange[]): Promise<SyncResult>;
  pullChanges(cursor: SyncCursor): Promise<SyncDelta>;

  /** Provider Health */
  getProviderStatus(): ProviderStatus;
}
