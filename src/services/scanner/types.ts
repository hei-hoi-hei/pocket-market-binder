export type ScannerConfidence = 'high' | 'medium' | 'low';

export interface ScannerEvidence {
  label: string;
  value: string;
}

export interface ScannerCandidate {
  cardId: string;
  confidence?: ScannerConfidence;
  evidence?: ScannerEvidence[];
}

export interface ScannerIdentificationInput {
  image: Blob;
  signal?: AbortSignal;
}

export type ScannerIdentificationResult =
  | {
      status: 'success';
      candidates: ScannerCandidate[];
    }
  | {
      status: 'no-match';
      candidates: [];
    }
  | {
      status: 'unavailable';
      reason: string;
    }
  | {
      status: 'error';
      message: string;
      retryable?: boolean;
    };

export interface ScannerProvider {
  name: string;
  identify(input: ScannerIdentificationInput): Promise<ScannerIdentificationResult>;
}
