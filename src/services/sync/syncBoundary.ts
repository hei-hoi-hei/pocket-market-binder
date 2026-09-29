export type SyncOwnershipScope = 'local' | 'account';

export type SyncDataCategory =
  | 'binder'
  | 'wishlist'
  | 'cart'
  | 'application-preference'
  | 'scanner-reference'
  | 'device-state'
  | 'catalog-cache'
  | 'scanner-raw-photo'
  | 'temporary-scan-file'
  | 'unconfirmed-scanner-candidate'
  | 'recognition-model-cache'
  | 'third-party-image-archive';

export type SyncDataClassification = 'user-owned' | 'local-only' | 'excluded';

const syncDataClassifications: Record<SyncDataCategory, SyncDataClassification> = {
  binder: 'user-owned',
  wishlist: 'user-owned',
  cart: 'user-owned',
  'application-preference': 'user-owned',
  'scanner-reference': 'user-owned',
  'device-state': 'local-only',
  'catalog-cache': 'local-only',
  'scanner-raw-photo': 'excluded',
  'temporary-scan-file': 'excluded',
  'unconfirmed-scanner-candidate': 'excluded',
  'recognition-model-cache': 'excluded',
  'third-party-image-archive': 'excluded',
};

export interface SyncBoundary {
  category: SyncDataCategory;
  classification: SyncDataClassification;
  ownershipScope: SyncOwnershipScope;
  eligibleForFutureAccountSync: boolean;
}

export function getSyncBoundary(
  category: SyncDataCategory,
  ownershipScope: SyncOwnershipScope = 'local',
): SyncBoundary {
  if (!Object.prototype.hasOwnProperty.call(syncDataClassifications, category)) {
    throw new Error(`Unknown sync data category: ${String(category)}`);
  }
  const classification = syncDataClassifications[category];
  if (ownershipScope !== 'local' && ownershipScope !== 'account') {
    throw new Error(`Invalid sync ownership scope: ${String(ownershipScope)}`);
  }
  if (classification !== 'user-owned' && ownershipScope === 'account') {
    throw new Error(`${category} data cannot be account-owned.`);
  }

  return {
    category,
    classification,
    ownershipScope,
    eligibleForFutureAccountSync:
      classification === 'user-owned' && ownershipScope === 'account',
  };
}
