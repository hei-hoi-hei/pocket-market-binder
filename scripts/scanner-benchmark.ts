import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { createWorker } from 'tesseract.js';
import defaultFixtures from './scanner-benchmark-fixtures.json';
import { matchTextEvidence, type ScannerTextEvidence } from './scanner-benchmark-matcher';
import {
  describeFixtureImage,
  parseScannerBenchmarkFixtures,
  resolveFixtureImagePath,
  resolveOcrRegion,
  type NormalizedRectangle,
  type ScannerBenchmarkFixture,
} from './scanner-benchmark-input';

type Fixture = ScannerBenchmarkFixture;

interface OcrEvidence {
  name: string;
  collectorNumber: string;
  wholeCard: string;
}

interface BenchmarkResult extends Fixture {
  sourceUrl: string;
  imageWidth: number;
  imageHeight: number;
  nameOcr: string;
  collectorOcr: string;
  wholeCardOcr: string;
  nameExact: boolean;
  nameNormalized: boolean;
  collectorExact: boolean;
  collectorNormalized: boolean;
  query: string;
  ocrUsable: boolean;
  candidateCount: number;
  correctCandidatePresent: boolean;
  correctCandidateRank: number | null;
  ocrElapsedMs: number;
  repeatRecognitionMs: number;
  workerInitializationMs: number;
}

const CACHE_DIR = resolve('benchmark-cache');
const RESULTS_DIR = resolve('benchmark-results');
const RESULTS_PATH = resolve(RESULTS_DIR, 'scanner-benchmark-results.json');
const CARD_WIDTH = 734;
const CARD_HEIGHT = 1024;
const DEFAULT_NAME_REGION: NormalizedRectangle = { left: 0, top: 0, width: 1, height: 230 / CARD_HEIGHT };
const DEFAULT_COLLECTOR_REGION: NormalizedRectangle = {
  left: 0,
  top: 800 / CARD_HEIGHT,
  width: 1,
  height: (CARD_HEIGHT - 800) / CARD_HEIGHT,
};

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function normalizeCollectorNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function fixtureImageUrl(fixture: Fixture): string {
  const language = fixture.id.startsWith('base')
    ? 'base'
    : fixture.id.startsWith('swsh')
      ? 'swsh'
      : fixture.id.startsWith('svp') || fixture.id.startsWith('sv')
        ? 'sv'
        : 'tcgp';
  const [setId, localId] = fixture.id.split('-');
  return `https://assets.tcgdex.net/en/${language}/${setId}/${localId}/high.webp`;
}

async function loadFixtureImage(
  fixture: Fixture,
  manifestPath: string,
): Promise<{ buffer: Buffer; sourceUrl: string }> {
  const localImagePath = resolveFixtureImagePath(fixture, manifestPath);
  if (localImagePath) {
    return {
      buffer: await readFile(localImagePath),
      sourceUrl: describeFixtureImage(fixture),
    };
  }

  const sourceUrl = fixtureImageUrl(fixture);
  const cachePath = resolve(CACHE_DIR, `${fixture.id.replace(/[^a-zA-Z0-9.-]/g, '_')}.webp`);
  try {
    return { buffer: await readFile(cachePath), sourceUrl };
  } catch {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`Fixture download failed (${response.status}): ${sourceUrl}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, buffer);
    return { buffer, sourceUrl };
  }
}

async function recognizeFixture(
  worker: Awaited<ReturnType<typeof createWorker>>,
  image: Buffer,
  fixture: Fixture,
): Promise<OcrEvidence> {
  const imageWidth = fixture.imageWidth ?? CARD_WIDTH;
  const imageHeight = fixture.imageHeight ?? CARD_HEIGHT;
  const nameRegion = resolveOcrRegion(
    fixture.nameRegion,
    imageWidth,
    imageHeight,
    DEFAULT_NAME_REGION,
  );
  const collectorNumberRegion = resolveOcrRegion(
    fixture.collectorNumberRegion,
    imageWidth,
    imageHeight,
    DEFAULT_COLLECTOR_REGION,
  );
  const [name, collectorNumber, wholeCard] = await Promise.all([
    worker.recognize(image, { rectangle: nameRegion }),
    worker.recognize(image, { rectangle: collectorNumberRegion }),
    worker.recognize(image),
  ]);
  return {
    name: name.data.text.trim(),
    collectorNumber: collectorNumber.data.text.trim(),
    wholeCard: wholeCard.data.text.trim(),
  };
}

async function cancellationProbe(image: Buffer): Promise<{ terminated: boolean; elapsedMs: number }> {
  void image;
  const worker = await createWorker('eng');
  const start = performance.now();
  await worker.terminate();
  return { terminated: true, elapsedMs: Math.round(performance.now() - start) };
}

async function main(): Promise<void> {
  const fixtureArgument = process.argv.indexOf('--fixtures');
  if (fixtureArgument >= 0 && !process.argv[fixtureArgument + 1]) {
    throw new Error('Provide a JSON manifest path after --fixtures.');
  }
  const manifestPath = fixtureArgument >= 0
    ? resolve(process.argv[fixtureArgument + 1])
    : resolve('scripts/scanner-benchmark-fixtures.json');
  const rawFixtures: unknown = fixtureArgument >= 0
    ? JSON.parse(await readFile(manifestPath, 'utf8'))
    : defaultFixtures;
  const fixtures = parseScannerBenchmarkFixtures(rawFixtures);

  await mkdir(RESULTS_DIR, { recursive: true });
  const workerStart = performance.now();
  const worker = await createWorker('eng');
  const workerInitializationMs = Math.round(performance.now() - workerStart);
  const results: BenchmarkResult[] = [];

  try {
    for (const fixture of fixtures) {
      const { buffer, sourceUrl } = await loadFixtureImage(fixture, manifestPath);
      const ocrStart = performance.now();
      const evidence = await recognizeFixture(worker, buffer, fixture);
      const ocrElapsedMs = Math.round(performance.now() - ocrStart);
      const repeatStart = performance.now();
      await worker.recognize(buffer);
      const repeatRecognitionMs = Math.round(performance.now() - repeatStart);
      const normalizedName = normalizeText(evidence.name);
      const normalizedExpectedName = normalizeText(fixture.name);
      const normalizedCollector = normalizeCollectorNumber(evidence.collectorNumber);
      const normalizedExpectedCollector = normalizeCollectorNumber(fixture.collectorNumber);
      const ocrEvidence: ScannerTextEvidence = {
        name: evidence.name,
        collectorNumber: evidence.collectorNumber,
        rawText: evidence.wholeCard,
      };
      const ranked = await matchTextEvidence(ocrEvidence);
      const correctCandidateRank = ranked.findIndex(({ card }) => card.id === fixture.id);
      const fixtureReport = { ...fixture };
      delete fixtureReport.imagePath;
      results.push({
        ...fixtureReport,
        sourceUrl,
        imageWidth: fixture.imageWidth ?? CARD_WIDTH,
        imageHeight: fixture.imageHeight ?? CARD_HEIGHT,
        nameOcr: evidence.name,
        collectorOcr: evidence.collectorNumber,
        wholeCardOcr: evidence.wholeCard,
        nameExact: evidence.name === fixture.name,
        nameNormalized: normalizedName === normalizedExpectedName,
        collectorExact: evidence.collectorNumber === fixture.collectorNumber,
        collectorNormalized: normalizedCollector === normalizedExpectedCollector,
        query: evidence.name,
        ocrUsable: Boolean(normalizedName || normalizedCollector),
        candidateCount: ranked.length,
        correctCandidatePresent: correctCandidateRank >= 0,
        correctCandidateRank: correctCandidateRank >= 0 ? correctCandidateRank + 1 : null,
        ocrElapsedMs,
        repeatRecognitionMs,
        workerInitializationMs,
      });
    }
  } finally {
    await worker.terminate();
  }

  const firstFixture = fixtures[0] as Fixture;
  const cancellationImage = await loadFixtureImage(firstFixture, manifestPath);
  const cancellation = await cancellationProbe(cancellationImage.buffer);
  const controlledCases = await runControlledMatcherCases();
  const report = {
    generatedAt: new Date().toISOString(),
    desktopOnly: true,
    cancellation,
    controlledCases,
    results,
  };
  await writeFile(RESULTS_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`Results written to ${basename(RESULTS_PATH)}`);
}

async function runControlledMatcherCases(): Promise<Array<Record<string, unknown>>> {
  const cases: Array<{ name: string; collectorNumber?: string; setCode?: string; expectedId: string }> = [
    { name: 'Charizard', collectorNumber: '4', setCode: 'base4', expectedId: 'base4-4' },
    { name: 'Charizard ex', collectorNumber: '006', setCode: 'sv03.5', expectedId: 'sv03.5-006' },
    { name: 'Charizard ex', expectedId: 'sv03.5-006' },
  ];

  const results: Array<Record<string, unknown>> = [];
  for (const testCase of cases) {
    const ranked = await matchTextEvidence(testCase);
    const rank = ranked.findIndex(({ card }) => card.id === testCase.expectedId);
    results.push({
      evidence: testCase,
      candidateCount: ranked.length,
      correctCandidatePresent: rank >= 0,
      correctCandidateRank: rank >= 0 ? rank + 1 : null,
      topCandidates: ranked.slice(0, 5).map(({ card, score }) => ({ id: card.id, name: card.name, score })),
    });
  }
  return results;
}

await main();
