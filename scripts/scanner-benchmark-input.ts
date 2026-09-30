import { basename, dirname, isAbsolute, resolve } from 'node:path';

export interface NormalizedRectangle {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ScannerBenchmarkFixture {
  id?: string;
  expectedOutcome?: 'match' | 'no-match';
  physicalCardId?: string;
  captureDeviceId?: string;
  collectorId?: string;
  split?: ScannerBenchmarkSplit;
  name: string;
  collectorNumber: string;
  setCode: string;
  layout: string;
  condition: string;
  captureConditions?: string[];
  cardCharacteristics?: string[];
  language?: string;
  imagePath?: string;
  imageWidth?: number;
  imageHeight?: number;
  nameRegion?: NormalizedRectangle;
  collectorNumberRegion?: NormalizedRectangle;
}

export type ScannerBenchmarkSplit = 'reference' | 'held-out';

export type ScannerBenchmarkFixtureReport = Omit<ScannerBenchmarkFixture, 'id' | 'imagePath'> & {
  expectedCatalogId?: string;
};

export interface ScannerBenchmarkSummaryRow {
  expectedCatalogId?: string;
  expectedOutcome?: 'match' | 'no-match';
  physicalCardId?: string;
  split?: ScannerBenchmarkSplit;
  captureDeviceId?: string;
  collectorId?: string;
  layout: string;
  condition: string;
  captureConditions?: readonly string[];
  matchingStatus: string;
  candidates: readonly Pick<ScannerBenchmarkCandidate, 'id' | 'score'>[];
  correctCandidatePresent: boolean;
  correctTop1Match: boolean;
  top1Mismatch: boolean;
  ambiguousTopRank: boolean;
  falsePositive: boolean;
}

export interface ScannerCandidateAssessment {
  correctCandidatePresent: boolean;
  correctCandidateRank: number | null;
  correctTop1Match: boolean;
  top1Mismatch: boolean;
  falsePositive: boolean;
}

const REQUIRED_TEXT_FIELDS = ['id', 'name', 'collectorNumber', 'setCode', 'layout', 'condition'] as const;
const OPTIONAL_TEXT_FIELDS = [
  'imagePath',
  'language',
  'physicalCardId',
  'captureDeviceId',
  'collectorId',
] as const;
const OPTIONAL_DIMENSION_FIELDS = ['imageWidth', 'imageHeight'] as const;
const OPTIONAL_REGION_FIELDS = ['nameRegion', 'collectorNumberRegion'] as const;
const OPTIONAL_LABEL_ARRAY_FIELDS = ['captureConditions', 'cardCharacteristics'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNormalizedRectangle(value: unknown): value is NormalizedRectangle {
  if (!isRecord(value)) return false;
  const { left, top, width, height } = value;
  return [left, top, width, height].every(
    (coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate),
  ) &&
    left >= 0 &&
    top >= 0 &&
    width > 0 &&
    height > 0 &&
    left + width <= 1 &&
    top + height <= 1;
}

function isValidFixture(value: unknown): value is ScannerBenchmarkFixture {
  if (!isRecord(value)) return false;
  const expectedOutcome = value.expectedOutcome ?? 'match';
  if (expectedOutcome !== 'match' && expectedOutcome !== 'no-match') return false;
  if (value.split !== undefined && value.split !== 'reference' && value.split !== 'held-out') return false;
  if (
    REQUIRED_TEXT_FIELDS.filter((field) => field !== 'id' && field !== 'setCode')
      .some((field) => typeof value[field] !== 'string' || !value[field].trim())
  ) {
    return false;
  }
  if (value.id !== undefined && (typeof value.id !== 'string' || !value.id.trim())) return false;
  if (typeof value.setCode !== 'string') return false;
  if (expectedOutcome === 'match' && !value.id) return false;
  if (expectedOutcome === 'no-match' && (!value.imagePath || value.id !== undefined)) return false;
  if (OPTIONAL_TEXT_FIELDS.some((field) =>
    value[field] !== undefined && (typeof value[field] !== 'string' || !value[field].trim()),
  )) {
    return false;
  }
  if (OPTIONAL_LABEL_ARRAY_FIELDS.some((field) =>
    value[field] !== undefined &&
      (!Array.isArray(value[field]) ||
        value[field].some((label) => typeof label !== 'string' || !label.trim())),
  )) {
    return false;
  }
  if (OPTIONAL_DIMENSION_FIELDS.some((field) =>
    value[field] !== undefined &&
      (typeof value[field] !== 'number' || !Number.isInteger(value[field]) || value[field] <= 0),
  )) {
    return false;
  }
  if (OPTIONAL_REGION_FIELDS.some((field) =>
    value[field] !== undefined && !isNormalizedRectangle(value[field]),
  )) {
    return false;
  }
  if (value.imagePath && (
    !value.imageWidth ||
    !value.imageHeight ||
    !value.physicalCardId ||
    !value.captureDeviceId ||
    !value.collectorId ||
    !Array.isArray(value.captureConditions) ||
    value.captureConditions.length === 0 ||
    !value.split
  )) return false;
  if (!value.imagePath && (
    value.imageWidth !== undefined ||
    value.imageHeight !== undefined ||
    value.physicalCardId !== undefined ||
    value.captureDeviceId !== undefined ||
    value.collectorId !== undefined ||
    value.split !== undefined
  )) return false;

  return true;
}

export function parseScannerBenchmarkFixtures(value: unknown): ScannerBenchmarkFixture[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((fixture) => !isValidFixture(fixture))) {
    throw new Error(
      'Scanner benchmark fixtures must be a non-empty JSON array with valid expected clues and image metadata.',
    );
  }
  const fixtures = value as ScannerBenchmarkFixture[];
  const physicalCardSplits = new Map<string, ScannerBenchmarkSplit>();
  const catalogIdentitySplits = new Map<string, ScannerBenchmarkSplit>();
  for (const fixture of fixtures) {
    if (!fixture.split) continue;
    if (fixture.physicalCardId) {
      const previousPhysicalSplit = physicalCardSplits.get(fixture.physicalCardId);
      if (previousPhysicalSplit && previousPhysicalSplit !== fixture.split) {
        throw new Error('A physical card cannot appear in both reference and held-out benchmark splits.');
      }
      physicalCardSplits.set(fixture.physicalCardId, fixture.split);
    }
    if (fixture.id && fixture.expectedOutcome !== 'no-match') {
      const previousCatalogSplit = catalogIdentitySplits.get(fixture.id);
      if (previousCatalogSplit && previousCatalogSplit !== fixture.split) {
        throw new Error('An expected catalog identity cannot appear in both reference and held-out benchmark splits.');
      }
      catalogIdentitySplits.set(fixture.id, fixture.split);
    }
  }
  return fixtures;
}

export function describeScannerBenchmarkFixture(
  fixture: ScannerBenchmarkFixture,
): ScannerBenchmarkFixtureReport {
  const { id: expectedCatalogId, ...metadataWithImagePath } = fixture;
  const metadata = { ...metadataWithImagePath };
  delete metadata.imagePath;
  return {
    ...metadata,
    ...(expectedCatalogId ? { expectedCatalogId } : {}),
  };
}

export function resolveFixtureImagePath(fixture: ScannerBenchmarkFixture, manifestPath: string): string | undefined {
  if (!fixture.imagePath) return undefined;
  return isAbsolute(fixture.imagePath)
    ? resolve(fixture.imagePath)
    : resolve(dirname(manifestPath), fixture.imagePath);
}

export function describeFixtureImage(fixture: ScannerBenchmarkFixture): string {
  if (fixture.imagePath) return `local/${basename(fixture.imagePath)}`;
  if (!fixture.id) throw new Error('A remote benchmark fixture requires an expected catalog ID.');
  return `tcgdex/${fixture.id}`;
}

export function assessScannerCandidates(
  expectedOutcome: ScannerBenchmarkFixture['expectedOutcome'],
  expectedCatalogId: string | undefined,
  candidateIds: readonly string[],
): ScannerCandidateAssessment {
  const isMatch = expectedOutcome !== 'no-match';
  const candidateIndex = isMatch && expectedCatalogId
    ? candidateIds.indexOf(expectedCatalogId)
    : -1;
  const correctTop1Match = isMatch && Boolean(expectedCatalogId) && candidateIds[0] === expectedCatalogId;

  return {
    correctCandidatePresent: candidateIndex >= 0,
    correctCandidateRank: candidateIndex >= 0 ? candidateIndex + 1 : null,
    correctTop1Match,
    top1Mismatch: isMatch && candidateIds.length > 0 && !correctTop1Match,
    falsePositive: !isMatch && candidateIds.length > 0,
  };
}

export interface ScannerBenchmarkSummaryCounts {
  totalPhotos: number;
  localPhotos: number;
  distinctPhysicalCards: number;
  distinctCaptureDevices: number;
  distinctCollectors: number;
  distinctLayouts: number;
  distinctExpectedCatalogCards: number;
  knownMatchPhotos: number;
  noMatchPhotos: number;
  candidateBearingPhotos: number;
  correctCandidatePresent: number;
  correctTop1Matches: number;
  noCandidateResults: number;
  ambiguousTopRankResults: number;
  falsePositives: number;
  top1Mismatches: number;
  matchingStatusCounts: Record<string, number>;
}

export function hasAmbiguousTopRank(
  candidates: readonly Pick<ScannerBenchmarkCandidate, 'score'>[],
): boolean {
  return candidates.length > 1 && candidates[0].score === candidates[1].score;
}

export interface ScannerBenchmarkSummary extends ScannerBenchmarkSummaryCounts {
  bySplit: Record<ScannerBenchmarkSplit | 'unassigned', ScannerBenchmarkSummaryCounts>;
  byCaptureCondition: Record<string, ScannerBenchmarkSummaryCounts>;
  byCaptureDevice: Record<string, ScannerBenchmarkSummaryCounts>;
  byCollector: Record<string, ScannerBenchmarkSummaryCounts>;
  byLayout: Record<string, ScannerBenchmarkSummaryCounts>;
  catalogIdentityOverlapAcrossSplits: number;
}

function summarizeRows(rows: readonly ScannerBenchmarkSummaryRow[]): ScannerBenchmarkSummaryCounts {
  const matchingStatusCounts: Record<string, number> = {};
  for (const row of rows) {
    matchingStatusCounts[row.matchingStatus] = (matchingStatusCounts[row.matchingStatus] ?? 0) + 1;
  }
  return {
    totalPhotos: rows.length,
    localPhotos: rows.filter((row) => Boolean(row.physicalCardId)).length,
    distinctPhysicalCards: new Set(rows.map((row) => row.physicalCardId).filter(Boolean)).size,
    distinctCaptureDevices: new Set(rows.map((row) => row.captureDeviceId).filter(Boolean)).size,
    distinctCollectors: new Set(rows.map((row) => row.collectorId).filter(Boolean)).size,
    distinctLayouts: new Set(rows.map((row) => row.layout).filter(Boolean)).size,
    distinctExpectedCatalogCards: new Set(rows.map((row) => row.expectedCatalogId).filter(Boolean)).size,
    knownMatchPhotos: rows.filter((row) => row.expectedOutcome !== 'no-match').length,
    noMatchPhotos: rows.filter((row) => row.expectedOutcome === 'no-match').length,
    candidateBearingPhotos: rows.filter((row) => row.candidates.length > 0).length,
    correctCandidatePresent: rows.filter((row) => row.correctCandidatePresent).length,
    correctTop1Matches: rows.filter((row) => row.correctTop1Match).length,
    noCandidateResults: rows.filter((row) => row.candidates.length === 0).length,
    ambiguousTopRankResults: rows.filter((row) => row.ambiguousTopRank).length,
    falsePositives: rows.filter((row) => row.falsePositive).length,
    top1Mismatches: rows.filter((row) => row.top1Mismatch).length,
    matchingStatusCounts,
  };
}

function summarizeByLabels(
  rows: readonly ScannerBenchmarkSummaryRow[],
  getLabels: (row: ScannerBenchmarkSummaryRow) => readonly string[],
): Record<string, ScannerBenchmarkSummaryCounts> {
  const groups = new Map<string, ScannerBenchmarkSummaryRow[]>();
  for (const row of rows) {
    for (const label of new Set(getLabels(row))) {
      groups.set(label, [...(groups.get(label) ?? []), row]);
    }
  }
  return Object.fromEntries([...groups].map(([label, groupRows]) => [
    label,
    summarizeRows(groupRows),
  ]));
}

export function summarizeScannerBenchmarkResults(
  rows: readonly ScannerBenchmarkSummaryRow[],
): ScannerBenchmarkSummary {
  const splitNames: Array<ScannerBenchmarkSplit | 'unassigned'> = [
    'reference',
    'held-out',
    'unassigned',
  ];
  const bySplit = Object.fromEntries(splitNames.map((split) => [
    split,
    summarizeRows(rows.filter((row) => (row.split ?? 'unassigned') === split)),
  ])) as ScannerBenchmarkSummary['bySplit'];
  const byCaptureCondition = summarizeByLabels(rows, (row) =>
    row.captureConditions?.length ? row.captureConditions : [row.condition],
  );
  const byCaptureDevice = summarizeByLabels(rows, (row) =>
    row.captureDeviceId ? [row.captureDeviceId] : [],
  );
  const byCollector = summarizeByLabels(rows, (row) =>
    row.collectorId ? [row.collectorId] : [],
  );
  const byLayout = summarizeByLabels(rows, (row) => [row.layout]);
  const referenceCatalogIds = new Set(rows
    .filter((row) => row.split === 'reference' && row.expectedOutcome !== 'no-match' && row.expectedCatalogId)
    .map((row) => row.expectedCatalogId!));
  const heldOutCatalogIds = new Set(rows
    .filter((row) => row.split === 'held-out' && row.expectedOutcome !== 'no-match' && row.expectedCatalogId)
    .map((row) => row.expectedCatalogId!));

  return {
    ...summarizeRows(rows),
    bySplit,
    byCaptureCondition,
    byCaptureDevice,
    byCollector,
    byLayout,
    catalogIdentityOverlapAcrossSplits: [...referenceCatalogIds]
      .filter((catalogId) => heldOutCatalogIds.has(catalogId)).length,
  };
}

export function resolveOcrRegion(
  region: NormalizedRectangle | undefined,
  imageWidth: number,
  imageHeight: number,
  defaultRegion: NormalizedRectangle,
): { left: number; top: number; width: number; height: number } {
  const normalized = region ?? defaultRegion;
  return {
    left: Math.round(normalized.left * imageWidth),
    top: Math.round(normalized.top * imageHeight),
    width: Math.max(1, Math.round(normalized.width * imageWidth)),
    height: Math.max(1, Math.round(normalized.height * imageHeight)),
  };
}
