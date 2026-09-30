import { describe, expect, it } from 'vitest';
import {
  assessScannerCandidates,
  describeFixtureImage,
  describeScannerBenchmarkFixture,
  hasAmbiguousTopRank,
  parseScannerBenchmarkFixtures,
  resolveFixtureImagePath,
  resolveOcrRegion,
  summarizeScannerBenchmarkResults,
} from '../scanner-benchmark-input';
import type {
  ScannerBenchmarkFixture,
  ScannerBenchmarkSummaryRow,
} from '../scanner-benchmark-input';
import {
  describeRankedCandidates,
  getScannerBenchmarkMatchStatus,
} from '../scanner-benchmark-matcher';

const localFixture: ScannerBenchmarkFixture = {
  id: 'sv03.5-006',
  name: 'Charizard ex',
  collectorNumber: '006',
  physicalCardId: 'specimen-01',
  captureDeviceId: 'device-01',
  collectorId: 'collector-01',
  split: 'reference',
  setCode: 'sv03.5',
  layout: 'modern ex',
  condition: 'indoor warm light, slight rotation, dark background',
  captureConditions: ['lighting-good', 'perspective-slight', 'background-busy', 'sleeved'],
  cardCharacteristics: ['modern-pokemon', 'special-art', 'similar-name-neighbor'],
  language: 'en',
  imagePath: 'photos/card-01.jpg',
  imageWidth: 3024,
  imageHeight: 4032,
  nameRegion: { left: 0.08, top: 0.04, width: 0.84, height: 0.16 },
  collectorNumberRegion: { left: 0.04, top: 0.82, width: 0.92, height: 0.14 },
};

function summaryRow(overrides: Partial<ScannerBenchmarkSummaryRow>): ScannerBenchmarkSummaryRow {
  return {
    layout: 'controlled layout',
    condition: 'controlled scan',
    matchingStatus: 'candidates-returned',
    candidates: [],
    correctCandidatePresent: false,
    correctTop1Match: false,
    top1Mismatch: false,
    ambiguousTopRank: false,
    falsePositive: false,
    ...overrides,
  };
}

describe('scanner benchmark inputs', () => {
  it('accepts fixture metadata with a local photograph and normalized OCR regions', () => {
    expect(parseScannerBenchmarkFixtures([localFixture])).toEqual([localFixture]);
  });

  it('rejects local images without dimensions or invalid OCR regions', () => {
    const withoutWidth = { ...localFixture };
    delete withoutWidth.imageWidth;
    expect(() => parseScannerBenchmarkFixtures([withoutWidth])).toThrow(/valid expected clues and image metadata/);

    expect(() => parseScannerBenchmarkFixtures([{
      ...localFixture,
      nameRegion: { left: 0.8, top: 0.8, width: 0.4, height: 0.4 },
    }])).toThrow(/valid expected clues and image metadata/);
  });

  it('requires a physical-card ID and split for local photos and prevents specimen split leakage', () => {
    expect(() => parseScannerBenchmarkFixtures([{
      ...localFixture,
      physicalCardId: undefined,
    }])).toThrow(/valid expected clues and image metadata/);
    expect(() => parseScannerBenchmarkFixtures([{
      ...localFixture,
      captureDeviceId: undefined,
    }])).toThrow(/valid expected clues and image metadata/);
    expect(() => parseScannerBenchmarkFixtures([{
      ...localFixture,
      collectorId: undefined,
    }])).toThrow(/valid expected clues and image metadata/);
    expect(() => parseScannerBenchmarkFixtures([{
      ...localFixture,
      captureConditions: undefined,
    }])).toThrow(/valid expected clues and image metadata/);
    expect(() => parseScannerBenchmarkFixtures([{
      ...localFixture,
      split: undefined,
    }])).toThrow(/valid expected clues and image metadata/);
    expect(() => parseScannerBenchmarkFixtures([
      localFixture,
      { ...localFixture, imagePath: 'photos/card-02.jpg', split: 'held-out' },
    ])).toThrow(/physical card cannot appear in both/);
    expect(() => parseScannerBenchmarkFixtures([
      localFixture,
      { ...localFixture, id: localFixture.id, physicalCardId: 'specimen-02', split: 'held-out' },
    ])).toThrow(/expected catalog identity cannot appear in both/);
  });

  it('accepts searchable capture/card labels and rejects malformed labels', () => {
    expect(parseScannerBenchmarkFixtures([localFixture])[0]).toMatchObject({
      captureConditions: ['lighting-good', 'perspective-slight', 'background-busy', 'sleeved'],
      cardCharacteristics: ['modern-pokemon', 'special-art', 'similar-name-neighbor'],
      language: 'en',
    });

    expect(() => parseScannerBenchmarkFixtures([{
      ...localFixture,
      captureConditions: ['glare', 42],
    }])).toThrow(/valid expected clues and image metadata/);
  });

  it('accepts local no-match examples without a catalog ID and requires local image data', () => {
    const fixture = { ...localFixture, id: undefined, expectedOutcome: 'no-match' as const };
    expect(parseScannerBenchmarkFixtures([fixture])).toEqual([fixture]);

    expect(() => parseScannerBenchmarkFixtures([{
      ...fixture,
      imagePath: undefined,
    }])).toThrow(/valid expected clues and image metadata/);
    expect(() => parseScannerBenchmarkFixtures([{
      ...localFixture,
      id: undefined,
      expectedOutcome: 'match',
    }])).toThrow(/valid expected clues and image metadata/);
  });

  it('accepts an intentionally unavailable set-code clue without fabricating a value', () => {
    expect(parseScannerBenchmarkFixtures([{
      ...localFixture,
      setCode: '',
    }])).toEqual([{
      ...localFixture,
      setCode: '',
    }]);
  });

  it('scores match rank and no-match false positives from candidate IDs', () => {
    expect(assessScannerCandidates('match', 'card-2', ['card-1', 'card-2', 'card-3']))
      .toEqual({
        correctCandidatePresent: true,
        correctCandidateRank: 2,
        correctTop1Match: false,
        top1Mismatch: true,
        falsePositive: false,
      });
    expect(assessScannerCandidates('no-match', undefined, ['card-1']))
      .toEqual({
        correctCandidatePresent: false,
        correctCandidateRank: null,
        correctTop1Match: false,
        top1Mismatch: false,
        falsePositive: true,
      });
    expect(assessScannerCandidates('no-match', undefined, []))
      .toEqual({
        correctCandidatePresent: false,
        correctCandidateRank: null,
        correctTop1Match: false,
        top1Mismatch: false,
        falsePositive: false,
      });
  });

  it('reports expected identity separately from fixture paths and ranked candidate IDs', () => {
    const reportFixture = describeScannerBenchmarkFixture(localFixture);

    expect(reportFixture).toMatchObject({
      expectedCatalogId: 'sv03.5-006',
      physicalCardId: 'specimen-01',
      captureDeviceId: 'device-01',
      collectorId: 'collector-01',
      split: 'reference',
    });
    expect(reportFixture).not.toHaveProperty('id');
    expect(reportFixture).not.toHaveProperty('imagePath');
  });

  it('summarizes corpus, split, condition, match, mismatch, ambiguity, and no-candidate counts', () => {
    const rows = [
      summaryRow({
        expectedCatalogId: 'card-a',
        expectedOutcome: 'match',
        physicalCardId: 'specimen-1',
        split: 'reference',
        captureDeviceId: 'device-1',
        collectorId: 'collector-1',
        layout: 'older',
        captureConditions: ['glare', 'sleeved'],
        candidates: [{ id: 'card-a', score: 9 }],
        correctCandidatePresent: true,
        correctTop1Match: true,
      }),
      summaryRow({
        expectedCatalogId: 'card-a',
        expectedOutcome: 'match',
        physicalCardId: 'specimen-2',
        split: 'held-out',
        captureDeviceId: 'device-2',
        collectorId: 'collector-2',
        layout: 'modern',
        captureConditions: ['glare'],
        candidates: [{ id: 'card-b', score: 8 }, { id: 'card-a', score: 8 }],
        correctCandidatePresent: true,
        top1Mismatch: true,
        ambiguousTopRank: true,
      }),
      summaryRow({
        expectedOutcome: 'no-match',
        physicalCardId: 'specimen-3',
        split: 'held-out',
        captureDeviceId: 'device-1',
        collectorId: 'collector-2',
        layout: 'modern',
        captureConditions: ['glare'],
        candidates: [{ id: 'card-c', score: 6 }],
        falsePositive: true,
      }),
      summaryRow({
        expectedCatalogId: 'card-d',
        expectedOutcome: 'match',
        physicalCardId: 'specimen-4',
        split: 'held-out',
        captureDeviceId: 'device-2',
        collectorId: 'collector-3',
        layout: 'promo',
        captureConditions: ['lighting-dim'],
        matchingStatus: 'no-candidates-or-tcgdex-failure',
      }),
    ];

    const summary = summarizeScannerBenchmarkResults(rows);

    expect(summary).toMatchObject({
      totalPhotos: 4,
      localPhotos: 4,
      distinctPhysicalCards: 4,
      distinctCaptureDevices: 2,
      distinctCollectors: 3,
      distinctLayouts: 3,
      distinctExpectedCatalogCards: 2,
      knownMatchPhotos: 3,
      noMatchPhotos: 1,
      candidateBearingPhotos: 3,
      correctCandidatePresent: 2,
      correctTop1Matches: 1,
      noCandidateResults: 1,
      ambiguousTopRankResults: 1,
      falsePositives: 1,
      top1Mismatches: 1,
      catalogIdentityOverlapAcrossSplits: 1,
      bySplit: {
        reference: { totalPhotos: 1 },
        'held-out': { totalPhotos: 3 },
        unassigned: { totalPhotos: 0 },
      },
      byCaptureCondition: {
        glare: { totalPhotos: 3, distinctPhysicalCards: 3 },
        sleeved: { totalPhotos: 1 },
        'lighting-dim': { totalPhotos: 1 },
      },
      byCaptureDevice: {
        'device-1': { totalPhotos: 2 },
        'device-2': { totalPhotos: 2 },
      },
      byCollector: {
        'collector-1': { totalPhotos: 1 },
        'collector-2': { totalPhotos: 2 },
        'collector-3': { totalPhotos: 1 },
      },
      byLayout: {
        older: { totalPhotos: 1 },
        modern: { totalPhotos: 2 },
        promo: { totalPhotos: 1 },
      },
    });
    expect(summary.matchingStatusCounts['no-candidates-or-tcgdex-failure']).toBe(1);
  });

  it('resolves local photo paths relative to the manifest and reports only the filename', () => {
    expect(resolveFixtureImagePath(localFixture, 'C:\\benchmark\\fixtures.json'))
      .toBe('C:\\benchmark\\photos\\card-01.jpg');
    expect(describeFixtureImage(localFixture)).toBe('local/card-01.jpg');
  });

  it('scales normalized OCR regions to the photo dimensions', () => {
    expect(resolveOcrRegion(
      localFixture.nameRegion,
      1000,
      2000,
      { left: 0, top: 0, width: 1, height: 0.2 },
    )).toEqual({ left: 80, top: 80, width: 840, height: 320 });
  });

  it('reports ranked catalog candidate details and honest matching status', () => {
    const candidates = describeRankedCandidates([{
      card: {
        id: 'sv03.5-006',
        name: 'Charizard ex',
        setCode: 'sv03.5',
        setNumber: '006',
      },
      score: 9,
    }]);

    expect(candidates).toEqual([{
      rank: 1,
      id: 'sv03.5-006',
      name: 'Charizard ex',
      setCode: 'sv03.5',
      collectorNumber: '006',
      score: 9,
    }]);
    expect(getScannerBenchmarkMatchStatus('Charizard ex', candidates.length))
      .toBe('candidates-returned');
    expect(getScannerBenchmarkMatchStatus('', 0))
      .toBe('not-queried-no-ocr-name');
    expect(getScannerBenchmarkMatchStatus('unreadable text', 0))
      .toBe('no-candidates-or-tcgdex-failure');
  });

  it('marks only an exact tie for top candidate scores as ambiguous', () => {
    expect(hasAmbiguousTopRank([{ score: 8 }, { score: 8 }, { score: 5 }])).toBe(true);
    expect(hasAmbiguousTopRank([{ score: 8 }, { score: 7 }])).toBe(false);
    expect(hasAmbiguousTopRank([{ score: 8 }])).toBe(false);
    expect(hasAmbiguousTopRank([])).toBe(false);
  });
});
