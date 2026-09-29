import { describe, expect, it } from 'vitest';
import { getSyncBoundary, type SyncDataCategory } from '../syncBoundary';

describe('sync data boundary', () => {
  it('marks scanner references and application preferences as user-owned', () => {
    expect(getSyncBoundary('scanner-reference')).toMatchObject({
      classification: 'user-owned',
      ownershipScope: 'local',
      eligibleForFutureAccountSync: false,
    });
    expect(getSyncBoundary('application-preference', 'account')).toMatchObject({
      classification: 'user-owned',
      ownershipScope: 'account',
      eligibleForFutureAccountSync: true,
    });
  });

  it('marks device state and catalog caches as local-only', () => {
    expect(getSyncBoundary('device-state').classification).toBe('local-only');
    expect(getSyncBoundary('catalog-cache').classification).toBe('local-only');
  });

  it.each([
    'scanner-raw-photo',
    'temporary-scan-file',
    'unconfirmed-scanner-candidate',
    'recognition-model-cache',
    'third-party-image-archive',
  ] satisfies SyncDataCategory[])('rejects account ownership for excluded %s data', (category) => {
    expect(getSyncBoundary(category).classification).toBe('excluded');
    expect(() => getSyncBoundary(category, 'account')).toThrow(/cannot be account-owned/);
  });

  it('rejects account ownership for local-only data', () => {
    expect(() => getSyncBoundary('device-state', 'account')).toThrow(/cannot be account-owned/);
  });

  it('rejects unknown runtime categories', () => {
    expect(() => getSyncBoundary('toString' as SyncDataCategory)).toThrow(/Unknown sync data category/);
  });
});
