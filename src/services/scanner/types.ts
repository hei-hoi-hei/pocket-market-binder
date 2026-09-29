export interface ScannerEvidence {
  label: string;
  value: string;
  confidence?: number;
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
  name?: string;
  collectorNumber?: string;
  setCode?: string;
  /** Normalized [0, 1] rectangle relative to the original image. */
  region?: ScannerCandidateRegion;
  /** A provider score normalized to the inclusive range 0..1. */
  confidence?: number;
  evidence?: ScannerEvidence[];
  metadata?: Record<string, string | number | boolean>;
}

declare const confirmedScannerCandidateBrand: unique symbol;

export type ConfirmedScannerCandidate = ScannerCandidate & {
  readonly [confirmedScannerCandidateBrand]: true;
};

export interface ScannerIdentificationInput {
  image: Blob;
  signal?: AbortSignal;
}

export type ScannerIdentificationResult =
  | {
      status: 'success';
      candidates: ScannerCandidate[];
      source?: string;
    }
  | {
      status: 'no-match';
      candidates: [];
      source?: string;
    }
  | {
      status: 'unavailable';
      reason: string;
      source?: string;
    }
  | {
      status: 'error';
      message: string;
      retryable?: boolean;
      source?: string;
    };

export interface ScannerProvider {
  name: string;
  /** Providers must process the image transiently and must not upload, persist, or mutate collection data. */
  identify(input: ScannerIdentificationInput): Promise<unknown>;
}
