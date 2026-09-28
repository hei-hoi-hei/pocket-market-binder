import { basename, dirname, isAbsolute, resolve } from 'node:path';

export interface NormalizedRectangle {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ScannerBenchmarkFixture {
  id: string;
  name: string;
  collectorNumber: string;
  setCode: string;
  layout: string;
  condition: string;
  imagePath?: string;
  imageWidth?: number;
  imageHeight?: number;
  nameRegion?: NormalizedRectangle;
  collectorNumberRegion?: NormalizedRectangle;
}

const REQUIRED_TEXT_FIELDS = ['id', 'name', 'collectorNumber', 'setCode', 'layout', 'condition'] as const;
const OPTIONAL_TEXT_FIELDS = ['imagePath'] as const;
const OPTIONAL_DIMENSION_FIELDS = ['imageWidth', 'imageHeight'] as const;
const OPTIONAL_REGION_FIELDS = ['nameRegion', 'collectorNumberRegion'] as const;

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
  if (REQUIRED_TEXT_FIELDS.some((field) => typeof value[field] !== 'string' || !value[field].trim())) {
    return false;
  }
  if (OPTIONAL_TEXT_FIELDS.some((field) =>
    value[field] !== undefined && (typeof value[field] !== 'string' || !value[field].trim()),
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
  if (value.imagePath && (!value.imageWidth || !value.imageHeight)) return false;
  if (!value.imagePath && (value.imageWidth !== undefined || value.imageHeight !== undefined)) return false;

  return true;
}

export function parseScannerBenchmarkFixtures(value: unknown): ScannerBenchmarkFixture[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((fixture) => !isValidFixture(fixture))) {
    throw new Error(
      'Scanner benchmark fixtures must be a non-empty JSON array with valid expected clues and image metadata.',
    );
  }
  return value;
}

export function resolveFixtureImagePath(fixture: ScannerBenchmarkFixture, manifestPath: string): string | undefined {
  if (!fixture.imagePath) return undefined;
  return isAbsolute(fixture.imagePath)
    ? resolve(fixture.imagePath)
    : resolve(dirname(manifestPath), fixture.imagePath);
}

export function describeFixtureImage(fixture: ScannerBenchmarkFixture): string {
  return fixture.imagePath ? `local/${basename(fixture.imagePath)}` : `tcgdex/${fixture.id}`;
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
