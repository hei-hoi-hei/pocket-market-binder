import type { ConfirmedScannerCandidate } from '@/services/scanner/types';

export interface CatalogIdentityMatch {
  catalogId: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  provider: string;
}

export type CatalogIdentityResult =
  | { status: 'resolved'; candidate: ConfirmedScannerCandidate; match: CatalogIdentityMatch }
  | { status: 'ambiguous'; candidate: ConfirmedScannerCandidate; matches: CatalogIdentityMatch[] }
  | { status: 'no-match'; candidate: ConfirmedScannerCandidate }
  | { status: 'unavailable'; candidate: ConfirmedScannerCandidate; reason: string }
  | { status: 'error'; candidate: ConfirmedScannerCandidate; message: string }
  | { status: 'cancelled'; candidate: ConfirmedScannerCandidate };

export interface CatalogIdentityProvider {
  name: string;
  search(query: string, signal?: AbortSignal): Promise<unknown>;
}
