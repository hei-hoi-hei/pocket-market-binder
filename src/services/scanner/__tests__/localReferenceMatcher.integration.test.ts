import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeLocalDatabase, storage } from '../../storage';
import { identifyImageWithProviders } from '../scannerOrchestration';
import {
  createLocalReferenceScannerProvider,
  createPerceptualHashDescriptor,
  LOCAL_PHASH_VERSION,
  type GrayscalePixels,
} from '../localReferenceMatcher';
import { createScannerReferenceStore } from '../scannerReferenceStore';
import { confirmScannerCandidate } from '../types';

const DB_NAME = 'pocket-market-binder';

const pixels: GrayscalePixels = {
  width: 32,
  height: 32,
  data: new Uint8ClampedArray(Array.from({ length: 32 * 32 }, (_, index) =>
    ((index % 32) < 16 ? 20 : 220) + (Math.floor(index / 32) % 8),
  )),
};

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('App database deletion was blocked'));
  });
}

function rgbaPixels(grayscale: Uint8ClampedArray): Uint8ClampedArray {
  const data = new Uint8ClampedArray(grayscale.length * 4);
  for (let index = 0; index < grayscale.length; index += 1) {
    const offset = index * 4;
    data[offset] = grayscale[index];
    data[offset + 1] = grayscale[index];
    data[offset + 2] = grayscale[index];
    data[offset + 3] = 255;
  }
  return data;
}

describe('local reference descriptor-to-match integration', () => {
  beforeEach(async () => {
    closeLocalDatabase();
    await deleteDatabase();
  });

  afterEach(async () => {
    closeLocalDatabase();
    await deleteDatabase();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('generates a descriptor from local canvas pixels and matches a stored account-owned reference without network access', async () => {
    const canvasPixels = rgbaPixels(pixels.data);
    const context = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: canvasPixels })),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    };
    const bitmap = { width: 640, height: 800, close: vi.fn() };
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const image = new Blob(['local image bytes'], { type: 'image/png' });
    const descriptor = await createPerceptualHashDescriptor(image);
    expect(descriptor).toMatchObject({
      representation: 'compact-descriptor',
      kind: 'perceptual-hash',
      version: LOCAL_PHASH_VERSION,
      value: expect.stringMatching(/^[\da-f]{16}$/),
    });
    expect(bitmap.close).toHaveBeenCalledOnce();

    const store = createScannerReferenceStore({ createId: () => 'account-reference' });
    const stored = await store.saveConfirmedReference(
      confirmScannerCandidate({
        catalogProvider: 'catalog-a',
        catalogId: 'card-25',
        gameKey: 'pokemon',
        name: 'Pikachu',
      }),
      descriptor,
      {
        confirmationMethod: 'candidate-review',
        ownershipScope: 'account',
      },
    );
    await storage.set('binder', [{ cardId: 'existing-card', quantity: 1, addedAt: 1 }]);
    const provider = createLocalReferenceScannerProvider(store);
    const result = await identifyImageWithProviders([provider], image);

    expect(result).toMatchObject({
      status: 'success',
      candidates: [{
        catalogProvider: 'catalog-a',
        catalogId: 'card-25',
        gameKey: 'pokemon',
        providers: ['local-reference'],
      }],
    });
    expect(await store.listActive()).toEqual([stored]);
    expect(stored).not.toHaveProperty('image');
    expect(await storage.get('binder')).toEqual([
      { cardId: 'existing-card', quantity: 1, addedAt: 1 },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
