export interface ScannerEvidence {
  label: string;
  value: string;
  confidence?: number;
}

export interface ScannerCandidate {
  name?: string;
  collectorNumber?: string;
  setCode?: string;
  /** A provider score normalized to the inclusive range 0..1. */
  confidence?: number;
  evidence?: ScannerEvidence[];
  metadata?: Record<string, string | number | boolean>;
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
