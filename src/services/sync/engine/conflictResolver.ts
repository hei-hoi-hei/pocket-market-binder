import { SyncRecord } from '../types/sync.types';

/**
 * Resolves conflicts between two versions of the same record using
 * Deterministic Last-Write-Wins (LWW).
 * 
 * Logic:
 * 1. Compare updatedAt: The higher timestamp wins.
 * 2. If updatedAt is equal: Compare deviceId (lexicographical). The higher string wins.
 * 
 * @param local The local version of the record
 * @param remote The remote version of the record
 * @returns The winning record
 */
export function resolveConflict<T>(local: SyncRecord<T>, remote: SyncRecord<T>): SyncRecord<T> {
  if (remote.updatedAt > local.updatedAt) {
    return remote;
  }

  if (remote.updatedAt < local.updatedAt) {
    return local;
  }

  // Timestamps are equal, use deviceId as tie-breaker
  if (remote.deviceId > local.deviceId) {
    return remote;
  }

  return local;
}
