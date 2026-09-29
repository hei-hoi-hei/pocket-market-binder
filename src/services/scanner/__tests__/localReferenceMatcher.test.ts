import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { identifyImageWithProviders } from '../scannerOrchestration';
import type {
  ReferenceDescriptor,
  ScannerRecognitionReference,
  ScannerReferenceStore,
} from '../scannerReferenceStore';
import {
  createLocalReferenceScannerProvider,
  createPerceptualHashDescriptor,
  createPerceptualHashDescriptorFromPixels,
  LOCAL_PHASH_VERSION,
} from '../localReferenceMatcher';
import type { GrayscalePixels } from '../localReferenceMatcher';
import { isConfirmedScannerCandidate } from '../types';

const appStorage = vi.hoisted(() => new Map<string, unknown>());

vi.mock('../../storage', () => ({
  openLocalDatabase: async () => {
    throw new Error('Unexpected database access in matcher test.');
  },
  RECOGNITION_REFERENCES_STORE: 'scanner-recognition-references',
  storage: {
    get: async (key: string) => appStorage.get(key) ?? null,
    set: async (key: string, value: unknown) => { appStorage.set(key, value); },
    remove: async (key: string) => { appStorage.delete(key); },
  },
}));

const pixels: GrayscalePixels = {
  width: 32,
  height: 32,
  data: new Uint8ClampedArray(Array.from({ length: 32 * 32 }, (_, index) =>
    ((index % 32) < 16 ? 20 : 220) + (Math.floor(index / 32) % 8),
  )),
};

const scanDescriptor: ReferenceDescriptor = {
  representation: 'compact-descriptor',
  kind: 'perceptual-hash',
  version: LOCAL_PHASH_VERSION,
  value: '0000000000000000',
};

function reference(
  referenceId: string,
  catalogId: string,
  value: string,
  ownershipScope: 'local' | 'account' = 'local',
  descriptorVersion = LOCAL_PHASH_VERSION,
  catalogProvider = 'catalog-a',
): ScannerRecognitionReference {
  return {
    referenceId,
    identityKey: JSON.stringify(['pokemon', catalogProvider, catalogId]),
    identity: {
      catalogProvider,
      catalogId,
      gameKey: 'pokemon',
      name: catalogId,
      collectorNumber: '001',
      setCode: 'set-a',
    },
    descriptor: {
      representation: 'compact-descriptor',
      kind: 'perceptual-hash',
      version: descriptorVersion,
      value,
    },
    ownershipScope,
    createdAt: '2026-01-01T00:00:00.000Z',
    revision: 1,
    state: 'active',
    provenance: {
      confirmedBy: 'user',
      confirmationMethod: 'candidate-review',
      confirmedAt: '2026-01-01T00:00:00.000Z',
      recognitionProviders: ['manual-catalog-search'],
    },
  };
}

function createProvider(references: ScannerRecognitionReference[]) {
  const listActive = vi.fn(async () => references);
  const store: Pick<ScannerReferenceStore, 'listActive'> = { listActive };
  const descriptors = new Map<string, ReferenceDescriptor>([['scan', scanDescriptor]]);
  const provider = createLocalReferenceScannerProvider(
    store,
    async (image) => {
      const descriptor = descriptors.get(await image.text());
      if (!descriptor) throw new Error('No descriptor fixture for input.');
      return descriptor;
    },
  );
  return { provider, listActive, descriptors };
}

describe('local scanner reference matcher', () => {
  beforeEach(() => {
    appStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('generates a deterministic versioned descriptor from grayscale pixels', () => {
    const first = createPerceptualHashDescriptorFromPixels(pixels);
    const second = createPerceptualHashDescriptorFromPixels(pixels);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      representation: 'compact-descriptor',
      kind: 'perceptual-hash',
      version: LOCAL_PHASH_VERSION,
      dimensions: [32, 32],
      value: '915ee47997126f05',
    });
    expect(first.value).toMatch(/^[\da-f]{16}$/);
  });

  it('rejects malformed, unsupported, or featureless pixel inputs', () => {
    expect(() => createPerceptualHashDescriptorFromPixels({
      ...pixels,
      width: 16,
    })).toThrow(/32 by 32/);
    expect(() => createPerceptualHashDescriptorFromPixels({
      width: 32,
      height: 32,
      data: new Uint8ClampedArray(32 * 32).fill(128),
    })).toThrow(/insufficient visual detail/);
  });

  it('rejects unsupported or empty image blobs before attempting image decoding', async () => {
    await expect(createPerceptualHashDescriptor(
      new Blob(['not an image'], { type: 'text/plain' }),
    )).rejects.toThrow(/non-empty image file/);
    await expect(createPerceptualHashDescriptor(
      new Blob([], { type: 'image/png' }),
    )).rejects.toThrow(/non-empty image file/);
  });

  it('returns no candidates for an empty local reference store', async () => {
    const { provider, listActive } = createProvider([]);

    await expect(identifyImageWithProviders(
      [provider],
      new Blob(['scan'], { type: 'image/jpeg' }),
    )).resolves.toMatchObject({
      status: 'no-match',
      candidates: [],
      providerResults: [{ provider: 'local-reference', candidateCount: 0 }],
    });
    expect(listActive).toHaveBeenCalledOnce();
  });

  it('ranks an exact match ahead of a nearby match and retains catalog provenance', async () => {
    const { provider } = createProvider([
      reference('near-ref', 'near-card', '000000000000000f'),
      reference('exact-ref', 'exact-card', '0000000000000000'),
      reference('far-ref', 'far-card', 'ffffffffffffffff'),
    ]);

    const result = await identifyImageWithProviders(
      [provider],
      new Blob(['scan'], { type: 'image/jpeg' }),
    );

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.candidates.map((candidate) => candidate.catalogId)).toEqual([
      'exact-card',
      'near-card',
    ]);
    expect(result.candidates[0]).toMatchObject({
      catalogProvider: 'catalog-a',
      gameKey: 'pokemon',
      providers: ['local-reference'],
      evidence: [{
        provider: 'local-reference',
        type: 'perceptual-hash-distance',
        relation: 'supports',
        strength: 'partial',
        value: 'Hamming distance 0 of 64 bits',
        metadata: { distanceBits: 0, referenceId: 'exact-ref' },
      }],
    });
    expect(result.candidates[0]).not.toHaveProperty('image');
    expect(result.candidates[0]).not.toHaveProperty('descriptor');
    expect(isConfirmedScannerCandidate(result.candidates[0])).toBe(false);
  });

  it('does not force an unrelated reference into the candidate list', async () => {
    const { provider } = createProvider([
      reference('unrelated', 'unrelated-card', 'ffffffffffffffff'),
    ]);

    await expect(identifyImageWithProviders(
      [provider],
      new Blob(['scan'], { type: 'image/jpeg' }),
    )).resolves.toMatchObject({ status: 'no-match', candidates: [] });
  });

  it('accepts a Hamming distance of 8 and rejects a distance of 9', async () => {
    const { provider } = createProvider([
      reference('distance-8', 'accepted-at-boundary', '00000000000000ff'),
      reference('distance-9', 'rejected-over-boundary', '00000000000001ff'),
    ]);

    const result = await identifyImageWithProviders(
      [provider],
      new Blob(['scan'], { type: 'image/jpeg' }),
    );

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.candidates.map((candidate) => candidate.catalogId))
        .toEqual(['accepted-at-boundary']);
      expect(result.candidates[0].evidence?.[0].metadata?.distanceBits).toBe(8);
    }
  });

  it('uses deterministic identity ordering for equal distances and collapses duplicate references', async () => {
    const { provider } = createProvider([
      reference('z-ref', 'z-card', '0000000000000001'),
      reference('duplicate-ref', 'a-card', '0000000000000001'),
      reference('a-ref', 'a-card', '0000000000000001'),
    ]);

    const result = await identifyImageWithProviders(
      [provider],
      new Blob(['scan'], { type: 'image/jpeg' }),
    );

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.candidates.map((candidate) => candidate.catalogId)).toEqual(['a-card', 'z-card']);
    expect(result.candidates[0].evidence?.[0].metadata?.referenceId).toBe('a-ref');
  });

  it('keeps equal catalog IDs distinct across source namespaces', async () => {
    const { provider } = createProvider([
      reference('source-a', 'same-id', '0000000000000001', 'local', LOCAL_PHASH_VERSION, 'catalog-a'),
      reference('source-b', 'same-id', '0000000000000001', 'local', LOCAL_PHASH_VERSION, 'catalog-b'),
    ]);

    const result = await identifyImageWithProviders(
      [provider],
      new Blob(['scan'], { type: 'image/jpeg' }),
    );

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.candidates.map((candidate) => candidate.catalogProvider))
        .toEqual(['catalog-a', 'catalog-b']);
    }
  });

  it('caps candidates at five after deterministic ranking', async () => {
    const references = Array.from({ length: 7 }, (_, index) =>
      reference(`ref-${index}`, `card-${index}`, '0000000000000001'),
    );
    const { provider } = createProvider(references);

    const result = await identifyImageWithProviders(
      [provider],
      new Blob(['scan'], { type: 'image/jpeg' }),
    );

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.candidates).toHaveLength(5);
      expect(result.candidates.map((candidate) => candidate.catalogId)).toEqual([
        'card-0', 'card-1', 'card-2', 'card-3', 'card-4',
      ]);
    }
  });

  it('matches locally available account-scoped descriptors and excludes unsupported versions', async () => {
    const { provider } = createProvider([
      reference('account-ref', 'account-card', '0000000000000000', 'account'),
      reference('legacy-ref', 'legacy-card', '0000000000000000', 'local', 'hash-v1'),
      reference('local-ref', 'local-card', '0000000000000000'),
    ]);

    const result = await identifyImageWithProviders(
      [provider],
      new Blob(['scan'], { type: 'image/jpeg' }),
    );

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.candidates.map((candidate) => candidate.catalogId)).toEqual([
        'account-card',
        'local-card',
      ]);
      expect(result.candidates[0].catalogProvider).toBe('catalog-a');
    }
  });

  it('does not mutate Binder, wishlist, or cart application state', async () => {
    const binder = [{ cardId: 'existing-card', quantity: 2, addedAt: 1 }];
    const wishlist = [{ cardId: 'wanted-card', addedAt: 2 }];
    const cart = [{ cardId: 'cart-card', quantity: 1, addedAt: 3 }];
    appStorage.set('binder', binder);
    appStorage.set('wishlist', wishlist);
    appStorage.set('cart', cart);
    const { provider } = createProvider([reference('local-ref', 'local-card', '0000000000000000')]);

    await identifyImageWithProviders(
      [provider],
      new Blob(['scan'], { type: 'image/jpeg' }),
    );

    expect(appStorage.get('binder')).toEqual(binder);
    expect(appStorage.get('wishlist')).toEqual(wishlist);
    expect(appStorage.get('cart')).toEqual(cart);
  });
});
