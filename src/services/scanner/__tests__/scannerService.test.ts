import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBinder, getCart, getWishlist } from '../../collectionService';
import {
  identifyImage,
  identifyImageWithFallback,
  normalizeScannerResult,
  offlineScannerProvider,
} from '../scannerService';
import type { ScannerProvider } from '../types';

const store = vi.hoisted(() => new Map<string, unknown>());

vi.mock('../../storage', () => ({
  storage: {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: unknown) => { store.set(key, value); },
    remove: async (key: string) => { store.delete(key); },
  },
}));

const image = new Blob(['card image'], { type: 'image/jpeg' });

describe('scanner recognition boundary', () => {
  beforeEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  it('normalizes catalog suggestions, clues, evidence, regions, confidence, and metadata', () => {
    expect(normalizeScannerResult({
      status: 'success',
      source: 'local-recognizer',
      candidates: [{
        catalogId: 'base1-25',
        name: '  Pikachu  ',
        collectorNumber: ' 025 ',
        setCode: ' base1 ',
        region: { left: 0.1, top: 0.2, width: 0.5, height: 0.3 },
        confidence: 0.86,
        evidence: [{ label: 'printed name', value: ' Pikachu ', confidence: 0.92 }],
        metadata: { engine: 'local-test', wordCount: 4 },
      }],
    })).toEqual({
      status: 'success',
      source: 'local-recognizer',
      candidates: [{
        catalogId: 'base1-25',
        name: 'Pikachu',
        collectorNumber: '025',
        setCode: 'base1',
        region: { left: 0.1, top: 0.2, width: 0.5, height: 0.3 },
        confidence: 0.86,
        evidence: [{ label: 'printed name', value: 'Pikachu', confidence: 0.92 }],
        metadata: { engine: 'local-test', wordCount: 4 },
      }],
    });
  });

  it('preserves an ID-only suggestion as unverified candidate data', () => {
    expect(normalizeScannerResult({
      status: 'success',
      candidates: [{ catalogId: 'base1-25' }],
    })).toEqual({
      status: 'success',
      candidates: [{ catalogId: 'base1-25' }],
    });
  });

  it('preserves multiple recognition candidates in provider order', () => {
    expect(normalizeScannerResult({
      status: 'success',
      candidates: [
        { name: 'Pikachu', confidence: 0.71 },
        { name: 'Pikachu V', collectorNumber: '043', confidence: 0.58 },
      ],
    })).toEqual({
      status: 'success',
      candidates: [
        { name: 'Pikachu', confidence: 0.71 },
        { name: 'Pikachu V', collectorNumber: '043', confidence: 0.58 },
      ],
    });
  });

  it('preserves low confidence and explicit unknown results', () => {
    expect(normalizeScannerResult({
      status: 'success',
      candidates: [{ name: 'Pikachu', confidence: 0.12 }],
    })).toEqual({
      status: 'success',
      candidates: [{ name: 'Pikachu', confidence: 0.12 }],
    });
    expect(normalizeScannerResult({ status: 'no-match' })).toEqual({
      status: 'no-match',
      candidates: [],
    });
    expect(normalizeScannerResult({ status: 'unavailable', reason: 'No recognition provider configured.' })).toEqual({
      status: 'unavailable',
      reason: 'No recognition provider configured.',
    });
    expect(normalizeScannerResult({
      status: 'unavailable',
      reason: 'No offline recognition engine is configured.',
      source: 'offline',
    })).toEqual({
      status: 'unavailable',
      reason: 'No offline recognition engine is configured.',
      source: 'offline',
    });
  });

  it('returns an explicit error for malformed provider responses', () => {
    expect(normalizeScannerResult({
      status: 'success',
      candidates: [{ name: 'Pikachu', confidence: 1.4 }],
    })).toEqual({
      status: 'error',
      message: 'The scanner provider returned an invalid result.',
      retryable: true,
    });
  });

  it('rejects malformed catalog IDs and regions outside normalized image bounds', () => {
    for (const candidate of [
      { catalogId: 42, name: 'Pikachu' },
      { name: 'Pikachu', region: { left: 0.9, top: 0.2, width: 0.2, height: 0.3 } },
      { name: 'Pikachu', region: { left: 0, top: 0, width: 0, height: 0.3 } },
    ]) {
      expect(normalizeScannerResult({ status: 'success', candidates: [candidate] })).toEqual({
        status: 'error',
        message: 'The scanner provider returned an invalid result.',
        retryable: true,
      });
    }
  });

  it('surfaces provider failures as retryable recognition errors', async () => {
    const provider: ScannerProvider = {
      name: 'test-provider',
      identify: vi.fn().mockRejectedValue(new Error('Recognition worker failed.')),
    };

    await expect(identifyImage(provider, image)).resolves.toEqual({
      status: 'error',
      message: 'Recognition worker failed.',
      retryable: true,
      source: 'test-provider',
    });
  });

  it('does not mutate Binder state when returning recognition candidates', async () => {
    const existingBinder = [{ cardId: 'catalog-card-1', quantity: 2, addedAt: 1 }];
    store.set('binder', existingBinder);
    const provider: ScannerProvider = {
      name: 'test-provider',
      identify: async () => ({
        status: 'success',
        candidates: [{ name: 'Pikachu', confidence: 0.8 }],
      }),
    };

    const result = await identifyImage(provider, image);

    expect(result).toMatchObject({ status: 'success', source: 'test-provider' });
    expect(await getBinder()).toEqual(existingBinder);
    expect(store.get('binder')).toEqual(existingBinder);
  });

  it('runs the offline provider without network configuration or network requests', async () => {
    const fetchRequest = vi.fn();
    const xhrRequest = vi.fn();
    const webSocketRequest = vi.fn();
    vi.stubGlobal('fetch', fetchRequest);
    vi.stubGlobal('XMLHttpRequest', xhrRequest);
    vi.stubGlobal('WebSocket', webSocketRequest);

    await expect(identifyImage(offlineScannerProvider, image)).resolves.toEqual({
      status: 'unavailable',
      reason: 'No offline recognition engine is configured.',
      source: 'offline',
    });

    expect(offlineScannerProvider.name).toBe('offline');
    expect(fetchRequest).not.toHaveBeenCalled();
    expect(xhrRequest).not.toHaveBeenCalled();
    expect(webSocketRequest).not.toHaveBeenCalled();
  });

  it('does not fabricate recognition candidates or catalog identity offline', async () => {
    const result = await identifyImage(offlineScannerProvider, image);

    expect(result).toEqual({
      status: 'unavailable',
      reason: 'No offline recognition engine is configured.',
      source: 'offline',
    });
    expect(result).not.toHaveProperty('candidates');
    expect(result).not.toHaveProperty('cardId');
  });

  it('uses the offline provider when no recognition provider is configured', async () => {
    await expect(identifyImageWithFallback([], image)).resolves.toEqual({
      status: 'unavailable',
      reason: 'No offline recognition engine is configured.',
      source: 'offline',
    });
  });

  it('returns cancellation while a configured provider never settles without invoking offline fallback', async () => {
    const controller = new AbortController();
    const provider: ScannerProvider = {
      name: 'stalled-provider',
      identify: vi.fn(() => new Promise<unknown>(() => {})),
    };
    const offlineIdentify = vi.spyOn(offlineScannerProvider, 'identify');

    const resultPromise = identifyImageWithFallback([provider], image, controller.signal);
    expect(provider.identify).toHaveBeenCalledOnce();
    controller.abort();

    await expect(resultPromise).resolves.toEqual({
      status: 'error',
      message: 'Recognition was cancelled.',
      retryable: false,
    });
    expect(offlineIdentify).not.toHaveBeenCalled();
    offlineIdentify.mockRestore();
  });

  it('preserves configured-provider success and no-match as terminal fallback-chain results', async () => {
    const successProvider: ScannerProvider = {
      name: 'recognizer',
      identify: vi.fn().mockResolvedValue({
        status: 'success',
        candidates: [{ name: 'Pikachu', confidence: 0.2 }],
      }),
    };
    const noMatchProvider: ScannerProvider = {
      name: 'recognizer',
      identify: vi.fn().mockResolvedValue({ status: 'no-match' }),
    };
    const offlineIdentify = vi.spyOn(offlineScannerProvider, 'identify');

    await expect(identifyImageWithFallback([successProvider], image)).resolves.toEqual({
      status: 'success',
      candidates: [{ name: 'Pikachu', confidence: 0.2 }],
      source: 'recognizer',
    });
    await expect(identifyImageWithFallback([noMatchProvider], image)).resolves.toEqual({
      status: 'no-match',
      candidates: [],
      source: 'recognizer',
    });
    expect(offlineIdentify).not.toHaveBeenCalled();
    offlineIdentify.mockRestore();
  });

  it('falls through a failed provider and preserves its specific failure with the offline result', async () => {
    const provider: ScannerProvider = {
      name: 'configured-provider',
      identify: vi.fn().mockRejectedValue(new Error('Provider returned HTTP 503.')),
    };

    await expect(identifyImageWithFallback([provider], image)).resolves.toEqual({
      status: 'unavailable',
      reason: 'No offline recognition engine is configured. configured-provider failed: Provider returned HTTP 503.',
      source: 'offline',
    });
    expect(provider.identify).toHaveBeenCalledOnce();
  });

  it('continues from an unavailable provider without labeling it a network failure', async () => {
    const provider: ScannerProvider = {
      name: 'local-provider',
      identify: vi.fn().mockResolvedValue({
        status: 'unavailable',
        reason: 'The local model is not installed.',
      }),
    };

    await expect(identifyImageWithFallback([provider], image)).resolves.toEqual({
      status: 'unavailable',
      reason: 'No offline recognition engine is configured. local-provider is unavailable: The local model is not installed.',
      source: 'offline',
    });
  });

  it('does not mutate Binder, Wishlist, or Cart when recognition falls back offline', async () => {
    const existingBinder = [{ cardId: 'catalog-card-1', quantity: 2, addedAt: 1 }];
    const existingWishlist = [{ cardId: 'catalog-card-2', addedAt: 2 }];
    const existingCart = [{ cardId: 'catalog-card-3', quantity: 1, addedAt: 3 }];
    store.set('binder', existingBinder);
    store.set('wishlist', existingWishlist);
    store.set('cart', existingCart);

    await expect(identifyImageWithFallback([], image)).resolves.toMatchObject({
      status: 'unavailable',
      source: 'offline',
    });

    expect(await getBinder()).toEqual(existingBinder);
    expect(await getWishlist()).toEqual(existingWishlist);
    expect(await getCart()).toEqual(existingCart);
    expect(store.get('binder')).toEqual(existingBinder);
    expect(store.get('wishlist')).toEqual(existingWishlist);
    expect(store.get('cart')).toEqual(existingCart);
    expect([...store.keys()].sort()).toEqual(['binder', 'cart', 'wishlist']);
  });

  it('rejects empty or non-image blobs before invoking a provider', async () => {
    const provider: ScannerProvider = { name: 'test-provider', identify: vi.fn() };

    await expect(identifyImage(provider, new Blob(['text'], { type: 'text/plain' }))).resolves.toMatchObject({
      status: 'error',
      retryable: false,
    });
    await expect(identifyImage(provider, new Blob([], { type: 'image/png' }))).resolves.toMatchObject({
      status: 'error',
      retryable: false,
    });

    expect(provider.identify).not.toHaveBeenCalled();
  });

  it('rejects invalid images before invoking any fallback provider', async () => {
    const provider: ScannerProvider = { name: 'test-provider', identify: vi.fn() };
    const offlineIdentify = vi.spyOn(offlineScannerProvider, 'identify');

    await expect(identifyImageWithFallback([provider], new Blob(['text'], { type: 'text/plain' })))
      .resolves.toMatchObject({ status: 'error', retryable: false });

    expect(provider.identify).not.toHaveBeenCalled();
    expect(offlineIdentify).not.toHaveBeenCalled();
    offlineIdentify.mockRestore();
  });
});
