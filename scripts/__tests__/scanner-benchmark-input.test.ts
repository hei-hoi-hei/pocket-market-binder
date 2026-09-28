import { describe, expect, it } from 'vitest';
import {
  describeFixtureImage,
  parseScannerBenchmarkFixtures,
  resolveFixtureImagePath,
  resolveOcrRegion,
} from '../scanner-benchmark-input';
import type { ScannerBenchmarkFixture } from '../scanner-benchmark-input';

const localFixture: ScannerBenchmarkFixture = {
  id: 'sv03.5-006',
  name: 'Charizard ex',
  collectorNumber: '006',
  setCode: 'sv03.5',
  layout: 'modern ex',
  condition: 'indoor warm light, slight rotation, dark background',
  imagePath: 'photos/card-01.jpg',
  imageWidth: 3024,
  imageHeight: 4032,
  nameRegion: { left: 0.08, top: 0.04, width: 0.84, height: 0.16 },
  collectorNumberRegion: { left: 0.04, top: 0.82, width: 0.92, height: 0.14 },
};

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
});
