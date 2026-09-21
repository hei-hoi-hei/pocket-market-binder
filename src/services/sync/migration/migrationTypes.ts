export type MigrationStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface MigrationResult {
  status: MigrationStatus;
  itemsProcessed: number;
  storesMigrated: string[];
  errors: string[];
  startTime: number;
  endTime?: number;
}

export interface MigrationError {
  store: string;
  message: string;
  timestamp: number;
}
