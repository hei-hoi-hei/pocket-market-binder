export interface ScannerEvidence {
  label: string;
  value: string;
  /** Legacy provider score; not a calibrated probability. */
  confidence?: number;
  provider?: string;
  type?: string;
  relation?: 'supports' | 'contradicts' | 'unavailable' | 'inconclusive';
  strength?: ScannerEvidenceStrength;
  metadata?: Record<string, string | number | boolean>;
}

export type ScannerEvidenceStrength =
  | 'weak'
  | 'partial'
  | 'strong'
  | 'exact'
  | 'unavailable'
  | 'contradictory';

export type ScannerDecision = 'strong-candidate' | 'candidate-confirmation' | 'insufficient';

export interface ScannerProviderObservation {
  provider: string;
  status: 'supporting' | 'missing' | 'unavailable' | 'error';
  candidateCount: number;
  reason?: string;
}

export interface ScannerCandidateRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ScannerCandidate {
  /** Suggested canonical catalog ID, not a verified or accepted identity. */
  catalogId?: string;
  /** Catalog namespace for catalogId; recognition provider IDs are never assumed global. */
  catalogProvider?: string;
  /** Generic game namespace used only when enough printing fields are present. */
  gameKey?: string;
  name?: string;
  collectorNumber?: string;
  setCode?: string;
  language?: string;
  variant?: string;
  /** Provider that generated this candidate; fused candidates retain all providers below. */
  provider?: string;
  providers?: string[];
  /** Stable, source-scoped identity assigned by the fusion layer. */
  identityKey?: string;
  /** Normalized [0, 1] rectangle relative to the original image. */
  region?: ScannerCandidateRegion;
  /** Legacy provider score normalized to 0..1; not a calibrated probability. */
  confidence?: number;
  evidence?: ScannerEvidence[];
  metadata?: Record<string, string | number | boolean>;
  providerMetadata?: Record<string, Record<string, string | number | boolean>>;
}

const confirmedScannerCandidateBrand: unique symbol = Symbol('confirmedScannerCandidate');
const scannerCandidateConfirmations = new WeakMap<object, string>();

export type ConfirmedScannerCandidate = ScannerCandidate & {
  readonly [confirmedScannerCandidateBrand]: true;
};

export function confirmScannerCandidate(candidate: ScannerCandidate): ConfirmedScannerCandidate {
  const confirmedCandidate = { ...candidate } as ConfirmedScannerCandidate;
  Object.defineProperty(confirmedCandidate, confirmedScannerCandidateBrand, { value: true });
  scannerCandidateConfirmations.set(confirmedCandidate, new Date().toISOString());
  return confirmedCandidate;
}

export function getScannerCandidateConfirmationTime(
  candidate: ConfirmedScannerCandidate,
): string | undefined {
  return scannerCandidateConfirmations.get(candidate);
}

export function isConfirmedScannerCandidate(value: unknown): value is ConfirmedScannerCandidate {
  return typeof value === 'object' &&
    value !== null &&
    scannerCandidateConfirmations.has(value);
}

export interface ScannerIdentificationInput {
  image: Blob;
  signal?: AbortSignal;
}

export type ScannerIdentificationResult =
  | {
      status: 'success';
      candidates: ScannerCandidate[];
      source?: string;
      decision?: ScannerDecision;
      providerResults?: ScannerProviderObservation[];
    }
  | {
      status: 'no-match';
      candidates: [];
      source?: string;
      decision?: ScannerDecision;
      providerResults?: ScannerProviderObservation[];
    }
  | {
      status: 'unavailable';
      reason: string;
      source?: string;
      decision?: ScannerDecision;
      providerResults?: ScannerProviderObservation[];
    }
  | {
      status: 'error';
      message: string;
      retryable?: boolean;
      source?: string;
      decision?: ScannerDecision;
      providerResults?: ScannerProviderObservation[];
    };

export interface ScannerProvider {
  name: string;
  /** Providers must process the image transiently and must not upload, persist, or mutate collection data. */
  identify(input: ScannerIdentificationInput): Promise<unknown>;
}
