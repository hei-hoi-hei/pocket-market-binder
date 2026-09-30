import { getSyncBoundary } from '../sync/syncBoundary';
import { scannerReferenceStore, type ReferenceDescriptor, type ScannerReferenceStore } from './scannerReferenceStore';
import type {
  ScannerCandidate,
  ScannerEvidence,
  ScannerIdentificationInput,
  ScannerProvider,
} from './types';

export const LOCAL_PHASH_VERSION = 'phash-dct-64-v1';
export const LOCAL_REFERENCE_MAX_DISTANCE = 8;
const HASH_SIZE = 8;
const SAMPLE_SIZE = 32;

export interface GrayscalePixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

type ImageDescriptorGenerator = (image: Blob) => Promise<ReferenceDescriptor>;

function grayscalePixels(imageData: ImageData): GrayscalePixels {
  const data = new Uint8ClampedArray(SAMPLE_SIZE * SAMPLE_SIZE);
  for (let i = 0; i < data.length; i += 1) {
    const offset = i * 4;
    data[i] = Math.round(
      imageData.data[offset] * 0.299 +
      imageData.data[offset + 1] * 0.587 +
      imageData.data[offset + 2] * 0.114,
    );
  }
  return { width: SAMPLE_SIZE, height: SAMPLE_SIZE, data };
}

async function readImagePixels(image: Blob): Promise<GrayscalePixels> {
  if (!image.type.startsWith('image/') || image.size === 0) {
    throw new Error('Choose a non-empty image file before matching local references.');
  }
  if (typeof document === 'undefined') {
    throw new Error('Local image matching requires a browser canvas.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser cannot process local images for matching.');

  if (typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(image);
    } catch {
      throw new Error('The selected image could not be decoded for local matching.');
    }
    try {
      if (bitmap.width <= 0 || bitmap.height <= 0) {
        throw new Error('The selected image has invalid dimensions.');
      }
      context.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      return grayscalePixels(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE));
    } finally {
      bitmap.close();
    }
  }

  const objectUrl = URL.createObjectURL(image);
  try {
    const decodedImage = new Image();
    decodedImage.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      decodedImage.onload = () => resolve();
      decodedImage.onerror = () => reject(new Error('The selected image could not be decoded.'));
    });
    if (decodedImage.naturalWidth <= 0 || decodedImage.naturalHeight <= 0) {
      throw new Error('The selected image has invalid dimensions.');
    }
    context.drawImage(decodedImage, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    return grayscalePixels(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE));
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function createPerceptualHashDescriptorFromPixels(
  pixels: GrayscalePixels,
): ReferenceDescriptor {
  if (
    pixels.width !== SAMPLE_SIZE ||
    pixels.height !== SAMPLE_SIZE ||
    pixels.data.length !== SAMPLE_SIZE * SAMPLE_SIZE
  ) {
    throw new Error('Perceptual hashing requires a 32 by 32 grayscale image.');
  }

  let sum = 0;
  for (const pixel of pixels.data) sum += pixel;
  const mean = sum / pixels.data.length;
  const variance = pixels.data.reduce((total, pixel) => total + (pixel - mean) ** 2, 0) /
    pixels.data.length;
  if (variance < 1) {
    throw new Error('The selected image has insufficient visual detail for a local reference hash.');
  }

  const cosines = Array.from({ length: HASH_SIZE }, (_, frequency) =>
    Array.from({ length: SAMPLE_SIZE }, (_, position) =>
      Math.cos(((2 * position + 1) * frequency * Math.PI) / (2 * SAMPLE_SIZE)),
    ),
  );
  const coefficients: number[] = [];
  for (let v = 0; v < HASH_SIZE; v += 1) {
    for (let u = 0; u < HASH_SIZE; u += 1) {
      let coefficient = 0;
      for (let y = 0; y < SAMPLE_SIZE; y += 1) {
        for (let x = 0; x < SAMPLE_SIZE; x += 1) {
          coefficient += pixels.data[y * SAMPLE_SIZE + x] * cosines[u][x] * cosines[v][y];
        }
      }
      const horizontalScale = u === 0 ? Math.sqrt(1 / SAMPLE_SIZE) : Math.sqrt(2 / SAMPLE_SIZE);
      const verticalScale = v === 0 ? Math.sqrt(1 / SAMPLE_SIZE) : Math.sqrt(2 / SAMPLE_SIZE);
      coefficient *= horizontalScale * verticalScale;
      coefficients.push(coefficient);
    }
  }

  const lowFrequency = coefficients.slice(0, HASH_SIZE * HASH_SIZE).slice(1).sort((a, b) => a - b);
  const median = lowFrequency[Math.floor(lowFrequency.length / 2)];
  let hash = 0n;
  for (const coefficient of coefficients.slice(0, HASH_SIZE * HASH_SIZE)) {
    hash = (hash << 1n) | (coefficient > median ? 1n : 0n);
  }

  return {
    representation: 'compact-descriptor',
    kind: 'perceptual-hash',
    version: LOCAL_PHASH_VERSION,
    value: hash.toString(16).padStart(16, '0'),
    dimensions: [SAMPLE_SIZE, SAMPLE_SIZE],
    metadata: { colorSpace: 'grayscale', algorithm: 'dct' },
  };
}

export async function createPerceptualHashDescriptor(image: Blob): Promise<ReferenceDescriptor> {
  return createPerceptualHashDescriptorFromPixels(await readImagePixels(image));
}

function isSupportedDescriptor(
  descriptor: unknown,
): descriptor is ReferenceDescriptor {
  if (typeof descriptor !== 'object' || descriptor === null) return false;
  const value = descriptor as Partial<ReferenceDescriptor>;
  return value.representation === 'compact-descriptor' &&
    value.kind === 'perceptual-hash' &&
    value.version === LOCAL_PHASH_VERSION &&
    typeof value.value === 'string' &&
    /^[\da-f]{16}$/i.test(value.value);
}

function hammingDistance(left: string, right: string): number {
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    let differingBits = parseInt(left[index], 16) ^ parseInt(right[index], 16);
    while (differingBits !== 0) {
      distance += differingBits & 1;
      differingBits >>>= 1;
    }
  }
  return distance;
}

function identityKey(candidate: ScannerCandidate): string {
  return JSON.stringify([
    candidate.gameKey ?? '',
    candidate.catalogProvider ?? '',
    candidate.catalogId ?? '',
    candidate.language ?? '',
    candidate.variant ?? '',
  ]);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

interface RankedReference {
  candidate: ScannerCandidate;
  distance: number;
  referenceId: string;
}

export function createLocalReferenceScannerProvider(
  store: Pick<ScannerReferenceStore, 'listActive'> = scannerReferenceStore,
  describeImage: ImageDescriptorGenerator = createPerceptualHashDescriptor,
): ScannerProvider {
  return {
    name: 'local-reference',
    async identify(input: ScannerIdentificationInput) {
      if (input.signal?.aborted) {
        return { status: 'error', message: 'Recognition was cancelled.', retryable: false };
      }
      const scanDescriptor = await describeImage(input.image);
      if (!isSupportedDescriptor(scanDescriptor)) {
        throw new Error('Local reference matching received an unsupported descriptor representation.');
      }
      if (input.signal?.aborted) {
        return { status: 'error', message: 'Recognition was cancelled.', retryable: false };
      }

      const references = await store.listActive();
      if (input.signal?.aborted) {
        return { status: 'error', message: 'Recognition was cancelled.', retryable: false };
      }
      const bestByIdentity = new Map<string, RankedReference>();
      for (const reference of references) {
        getSyncBoundary('scanner-reference', reference.ownershipScope);
        if (!isSupportedDescriptor(reference.descriptor)) continue;

        const distance = hammingDistance(scanDescriptor.value, reference.descriptor.value);
        if (distance > LOCAL_REFERENCE_MAX_DISTANCE) continue;
        const candidate: ScannerCandidate = {
          ...reference.identity,
          provider: 'local-reference',
          providers: ['local-reference'],
        };
        const key = identityKey(candidate);
        const previous = bestByIdentity.get(key);
        if (!previous || distance < previous.distance ||
          (distance === previous.distance && reference.referenceId < previous.referenceId)) {
          bestByIdentity.set(key, {
            candidate,
            distance,
            referenceId: reference.referenceId,
          });
        }
      }

      const ranked = [...bestByIdentity.values()]
        .sort((left, right) =>
          left.distance - right.distance ||
          compareStrings(identityKey(left.candidate), identityKey(right.candidate)),
        )
        .slice(0, 5)
        .map(({ candidate, distance, referenceId }) => {
          const evidence: ScannerEvidence = {
            label: 'local reference distance',
            value: `Hamming distance ${distance} of 64 bits`,
            provider: 'local-reference',
            type: 'perceptual-hash-distance',
            relation: 'supports',
            strength: 'partial',
            metadata: { distanceBits: distance, referenceId, hashVersion: LOCAL_PHASH_VERSION },
          };
          return { ...candidate, evidence: [evidence] };
        });

      return ranked.length > 0
        ? { status: 'success', candidates: ranked }
        : { status: 'no-match', candidates: [] };
    },
  };
}
