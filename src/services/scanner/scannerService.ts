import type {
  ScannerCandidate,
  ScannerEvidence,
  ScannerIdentificationInput,
  ScannerIdentificationResult,
  ScannerProvider,
} from './types';

const INVALID_PROVIDER_RESULT = 'The scanner provider returned an invalid result.';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalText(record: UnknownRecord, key: string): string | undefined | null {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return null;
  return value.trim() || undefined;
}

function readConfidence(record: UnknownRecord, key: string): number | undefined | null {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return null;
  return value;
}

function normalizeEvidence(value: unknown): ScannerEvidence[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;

  const evidence: ScannerEvidence[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const label = readOptionalText(item, 'label');
    const evidenceValue = readOptionalText(item, 'value');
    const confidence = readConfidence(item, 'confidence');
    if (!label || !evidenceValue || confidence === null) return null;
    evidence.push({
      label,
      value: evidenceValue,
      ...(confidence === undefined ? {} : { confidence }),
    });
  }
  return evidence;
}

function normalizeMetadata(value: unknown): ScannerCandidate['metadata'] | null {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) return null;

  const metadata: NonNullable<ScannerCandidate['metadata']> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry !== 'string' &&
      typeof entry !== 'boolean' &&
      !(typeof entry === 'number' && Number.isFinite(entry))
    ) {
      return null;
    }
    metadata[key] = entry;
  }
  return metadata;
}

function normalizeCandidate(value: unknown): ScannerCandidate | null {
  if (!isRecord(value)) return null;

  const name = readOptionalText(value, 'name');
  const collectorNumber = readOptionalText(value, 'collectorNumber');
  const setCode = readOptionalText(value, 'setCode');
  const confidence = readConfidence(value, 'confidence');
  const evidence = normalizeEvidence(value.evidence);
  const metadata = normalizeMetadata(value.metadata);

  if (
    name === null ||
    collectorNumber === null ||
    setCode === null ||
    confidence === null ||
    evidence === null ||
    metadata === null
  ) {
    return null;
  }
  if (!name && !collectorNumber && !setCode && evidence.length === 0) return null;

  return {
    ...(name ? { name } : {}),
    ...(collectorNumber ? { collectorNumber } : {}),
    ...(setCode ? { setCode } : {}),
    ...(confidence === undefined ? {} : { confidence }),
    ...(evidence.length > 0 ? { evidence } : {}),
    ...(metadata === undefined ? {} : { metadata }),
  };
}

function invalidProviderResult(): ScannerIdentificationResult {
  return { status: 'error', message: INVALID_PROVIDER_RESULT, retryable: true };
}

export function normalizeScannerResult(value: unknown): ScannerIdentificationResult {
  if (!isRecord(value) || typeof value.status !== 'string') return invalidProviderResult();

  switch (value.status) {
    case 'success': {
      if (!Array.isArray(value.candidates)) return invalidProviderResult();
      if (value.candidates.length === 0) return { status: 'no-match', candidates: [] };

      const candidates: ScannerCandidate[] = [];
      for (const valueCandidate of value.candidates) {
        const candidate = normalizeCandidate(valueCandidate);
        if (!candidate) return invalidProviderResult();
        candidates.push(candidate);
      }
      return { status: 'success', candidates };
    }
    case 'no-match':
      if (
        value.candidates !== undefined &&
        (!Array.isArray(value.candidates) || value.candidates.length > 0)
      ) {
        return invalidProviderResult();
      }
      return { status: 'no-match', candidates: [] };
    case 'unavailable': {
      const reason = readOptionalText(value, 'reason');
      return reason ? { status: 'unavailable', reason } : invalidProviderResult();
    }
    case 'error': {
      const message = readOptionalText(value, 'message');
      if (!message) return invalidProviderResult();
      if (value.retryable !== undefined && typeof value.retryable !== 'boolean') {
        return invalidProviderResult();
      }
      return {
        status: 'error',
        message,
        ...(typeof value.retryable === 'boolean' ? { retryable: value.retryable } : {}),
      };
    }
    default:
      return invalidProviderResult();
  }
}

function imageValidationError(image: Blob): ScannerIdentificationResult | null {
  if (image.size <= 0 || !image.type.trim().toLowerCase().startsWith('image/')) {
    return {
      status: 'error',
      message: 'Choose a non-empty image file before scanning.',
      retryable: false,
    };
  }
  return null;
}

function cancellationResult(): ScannerIdentificationResult {
  return { status: 'error', message: 'Recognition was cancelled.', retryable: false };
}

export async function identifyImage(
  provider: ScannerProvider,
  image: Blob,
  signal?: AbortSignal,
): Promise<ScannerIdentificationResult> {
  const invalidImage = imageValidationError(image);
  if (invalidImage) return invalidImage;
  if (signal?.aborted) return cancellationResult();

  const input: ScannerIdentificationInput = { image, ...(signal ? { signal } : {}) };
  try {
    const response = await provider.identify(input);
    return signal?.aborted ? cancellationResult() : normalizeScannerResult(response);
  } catch (error) {
    if (signal?.aborted) return cancellationResult();
    return {
      status: 'error',
      message: error instanceof Error && error.message
        ? error.message
        : 'The scanner provider failed unexpectedly.',
      retryable: true,
    };
  }
}
