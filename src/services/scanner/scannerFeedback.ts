import type { ScannerIdentificationResult } from './types';

export const SCANNER_FEEDBACK_SCHEMA_VERSION = 1 as const;
export const SCANNER_FEEDBACK_SCANNER_VERSION = 'local-reference-phash-dct-64-v1';

export type ScannerFeedbackOutcome =
  | 'correct'
  | 'incorrect'
  | 'no-match'
  | 'processing-error'
  | 'cancelled';

export type ScannerFeedbackErrorCategory =
  | 'recognition-unavailable'
  | 'recognition-failed'
  | 'recognition-cancelled'
  | 'user-cancelled-review'
  | 'tester-reported-error';

export interface ScannerFeedbackCatalogIdentity {
  catalogProvider: string;
  catalogId: string;
  gameKey?: string;
  language?: string;
  variant?: string;
}

export interface ScannerFeedbackImageDimensions {
  width: number;
  height: number;
}

export interface ScannerFeedbackReport {
  schemaVersion: typeof SCANNER_FEEDBACK_SCHEMA_VERSION;
  reportedAt: string;
  scannerVersion: string;
  matcherId: string;
  outcome: ScannerFeedbackOutcome;
  resultType: ScannerIdentificationResult['status'];
  predictedCatalogId?: string;
  predictedCatalogProvider?: string;
  confirmedIdentity?: ScannerFeedbackCatalogIdentity;
  candidateCount: number;
  processingDurationMs?: number;
  imageDimensions?: ScannerFeedbackImageDimensions;
  errorCategory?: ScannerFeedbackErrorCategory;
}

export interface CreateScannerFeedbackReportInput {
  result: ScannerIdentificationResult;
  outcome: ScannerFeedbackOutcome;
  matcherId: string;
  confirmedIdentity?: ScannerFeedbackCatalogIdentity;
  processingDurationMs?: number;
  imageDimensions?: ScannerFeedbackImageDimensions;
}

function safeIdentifier(value: string | undefined, fallback = ''): string {
  const normalized = value?.trim() ?? '';
  return /^[a-z\d][a-z\d._:/-]{0,127}$/i.test(normalized) ? normalized : fallback;
}

export function getScannerFeedbackMatcherId(result: ScannerIdentificationResult): string {
  const candidate = result.status === 'success' ? result.candidates[0] : undefined;
  const provider = candidate?.providers?.[0] ?? candidate?.provider ?? result.providerResults?.[0]?.provider;
  return safeIdentifier(provider ?? result.source, 'unknown');
}

function validDimensions(
  dimensions: ScannerFeedbackImageDimensions | undefined,
): ScannerFeedbackImageDimensions | undefined {
  if (
    !dimensions ||
    !Number.isInteger(dimensions.width) || dimensions.width <= 0 ||
    !Number.isInteger(dimensions.height) || dimensions.height <= 0
  ) {
    return undefined;
  }
  return { width: dimensions.width, height: dimensions.height };
}

function confirmedIdentityForReport(
  outcome: ScannerFeedbackOutcome,
  identity: ScannerFeedbackCatalogIdentity | undefined,
): ScannerFeedbackCatalogIdentity | undefined {
  if (outcome !== 'incorrect' || !identity) {
    return undefined;
  }
  const catalogProvider = safeIdentifier(identity.catalogProvider);
  const catalogId = safeIdentifier(identity.catalogId);
  if (!catalogProvider || !catalogId) return undefined;
  return {
    catalogProvider,
    catalogId,
    ...(safeIdentifier(identity.gameKey) ? { gameKey: safeIdentifier(identity.gameKey) } : {}),
    ...(safeIdentifier(identity.language) ? { language: safeIdentifier(identity.language) } : {}),
    ...(safeIdentifier(identity.variant) ? { variant: safeIdentifier(identity.variant) } : {}),
  };
}

function errorCategoryForReport(
  outcome: ScannerFeedbackOutcome,
  result: ScannerIdentificationResult,
): ScannerFeedbackErrorCategory | undefined {
  if (outcome === 'cancelled') {
    return result.status === 'error' && result.message === 'Recognition was cancelled.'
      ? 'recognition-cancelled'
      : 'user-cancelled-review';
  }
  if (outcome !== 'processing-error') return undefined;
  if (result.status === 'unavailable') return 'recognition-unavailable';
  if (result.status === 'error') {
    return result.message === 'Recognition was cancelled.'
      ? 'recognition-cancelled'
      : 'recognition-failed';
  }
  return 'tester-reported-error';
}

export function createScannerFeedbackReport(
  input: CreateScannerFeedbackReportInput,
  now: () => Date = () => new Date(),
): ScannerFeedbackReport {
  const candidates = input.result.status === 'success' ? input.result.candidates : [];
  const predictedCandidate = candidates[0];
  const processingDurationMs = input.processingDurationMs;
  return {
    schemaVersion: SCANNER_FEEDBACK_SCHEMA_VERSION,
    reportedAt: now().toISOString(),
    scannerVersion: SCANNER_FEEDBACK_SCANNER_VERSION,
    matcherId: safeIdentifier(input.matcherId, 'unknown'),
    outcome: input.outcome,
    resultType: input.result.status,
    ...(predictedCandidate?.catalogId
      ? { predictedCatalogId: safeIdentifier(predictedCandidate.catalogId) || undefined }
      : {}),
    ...(predictedCandidate?.catalogProvider
      ? { predictedCatalogProvider: safeIdentifier(predictedCandidate.catalogProvider) || undefined }
      : {}),
    ...(confirmedIdentityForReport(input.outcome, input.confirmedIdentity)
      ? { confirmedIdentity: confirmedIdentityForReport(input.outcome, input.confirmedIdentity) }
      : {}),
    candidateCount: candidates.length,
    ...(typeof processingDurationMs === 'number' && Number.isFinite(processingDurationMs) && processingDurationMs >= 0
      ? { processingDurationMs: Math.round(processingDurationMs) }
      : {}),
    ...(validDimensions(input.imageDimensions)
      ? { imageDimensions: validDimensions(input.imageDimensions) }
      : {}),
    ...(errorCategoryForReport(input.outcome, input.result)
      ? { errorCategory: errorCategoryForReport(input.outcome, input.result) }
      : {}),
  };
}

export function serializeScannerFeedbackReport(report: ScannerFeedbackReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function scannerFeedbackFilename(report: ScannerFeedbackReport): string {
  const timestamp = report.reportedAt.replace(/[:.]/g, '-');
  return `pocket-market-scanner-feedback-${timestamp}.json`;
}
