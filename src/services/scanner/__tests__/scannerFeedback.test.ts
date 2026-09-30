import { describe, expect, it } from 'vitest';
import type { ScannerIdentificationResult } from '../types';
import {
  createScannerFeedbackReport,
  getScannerFeedbackMatcherId,
  scannerFeedbackFilename,
  serializeScannerFeedbackReport,
} from '../scannerFeedback';

const successResult: ScannerIdentificationResult = {
  status: 'success',
  source: 'fusion',
  candidates: [{
    catalogProvider: 'tcgdex',
    catalogId: 'sv03.5-025',
    gameKey: 'pokemon',
    name: 'Pikachu',
    providers: ['local-reference'],
  }],
};

const fixedDate = () => new Date('2026-09-30T12:34:56.000Z');

function createReport(
  outcome: Parameters<typeof createScannerFeedbackReport>[0]['outcome'],
  result: ScannerIdentificationResult = successResult,
  extra: Partial<Parameters<typeof createScannerFeedbackReport>[0]> = {},
) {
  return createScannerFeedbackReport({
    result,
    outcome,
    matcherId: 'local-reference',
    ...extra,
  }, fixedDate);
}

describe('scanner feedback report', () => {
  it('identifies the matcher from normalized result provenance', () => {
    expect(getScannerFeedbackMatcherId(successResult)).toBe('local-reference');
    expect(getScannerFeedbackMatcherId({ status: 'no-match', candidates: [], source: 'offline' }))
      .toBe('offline');
    expect(getScannerFeedbackMatcherId({
      status: 'unavailable',
      reason: 'No engine configured.',
      providerResults: [{ provider: 'local-reference', status: 'unavailable', candidateCount: 0 }],
    })).toBe('local-reference');
  });

  it('records a correct candidate and only the normalized diagnostic metadata', () => {
    const report = createReport('correct', successResult, {
      processingDurationMs: 12.6,
      imageDimensions: { width: 3024, height: 4032 },
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      reportedAt: '2026-09-30T12:34:56.000Z',
      scannerVersion: 'local-reference-phash-dct-64-v1',
      matcherId: 'local-reference',
      outcome: 'correct',
      resultType: 'success',
      predictedCatalogId: 'sv03.5-025',
      predictedCatalogProvider: 'tcgdex',
      candidateCount: 1,
      processingDurationMs: 13,
      imageDimensions: { width: 3024, height: 4032 },
    });
    expect(report).not.toHaveProperty('confirmedIdentity');
  });

  it('adds only an explicitly supplied catalog identity to incorrect feedback', () => {
    const report = createReport('incorrect', successResult, {
      confirmedIdentity: {
        catalogProvider: 'tcgdex',
        catalogId: 'sv03.5-026',
        gameKey: 'pokemon',
        language: 'en',
        variant: 'normal',
      },
    });

    expect(report.confirmedIdentity).toEqual({
      catalogProvider: 'tcgdex',
      catalogId: 'sv03.5-026',
      gameKey: 'pokemon',
      language: 'en',
      variant: 'normal',
    });
    expect(createReport('incorrect').confirmedIdentity).toBeUndefined();
  });

  it('records no-match feedback distinctly from a successful empty result', () => {
    const noMatchResult: ScannerIdentificationResult = { status: 'no-match', candidates: [] };
    const report = createReport('no-match', noMatchResult);

    expect(report).toMatchObject({ outcome: 'no-match', resultType: 'no-match', candidateCount: 0 });
    expect(report).not.toHaveProperty('predictedCatalogId');
  });

  it('records processing errors by category without including raw error messages', () => {
    const errorResult: ScannerIdentificationResult = {
      status: 'error',
      message: 'private path C:\\Users\\someone\\photo.jpg failed',
      retryable: true,
    };
    const report = createReport('processing-error', errorResult);
    const serialized = serializeScannerFeedbackReport(report);

    expect(report).toMatchObject({
      outcome: 'processing-error',
      resultType: 'error',
      errorCategory: 'recognition-failed',
    });
    expect(serialized).not.toContain('private path');
    expect(serialized).not.toContain('photo.jpg');
  });

  it('records cancellation separately from processing errors', () => {
    const cancelledResult: ScannerIdentificationResult = {
      status: 'error',
      message: 'Recognition was cancelled.',
      retryable: false,
    };

    expect(createReport('cancelled', cancelledResult)).toMatchObject({
      outcome: 'cancelled',
      resultType: 'error',
      errorCategory: 'recognition-cancelled',
    });
    expect(createReport('cancelled').errorCategory).toBe('user-cancelled-review');
  });

  it('serializes without photo, blob, filename, candidate name, or user identity fields', () => {
    const serialized = serializeScannerFeedbackReport(createReport('correct'));

    expect(serialized).toContain('"predictedCatalogId": "sv03.5-025"');
    expect(serialized).not.toMatch(/"(?:photo|image|blob|fileName|name|email|accountId)"\s*:/i);
    expect(serialized).not.toContain('Pikachu');
  });

  it('builds a stable timestamp-based JSON filename', () => {
    expect(scannerFeedbackFilename(createReport('correct')))
      .toBe('pocket-market-scanner-feedback-2026-09-30T12-34-56-000Z.json');
  });
});
