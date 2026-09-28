import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBinder } from '../../collectionService';
import { identifyImage, normalizeScannerResult } from '../scannerService';
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
  });

  it('normalizes recognized clues, confidence, evidence, and provider metadata', () => {
    expect(normalizeScannerResult({
      status: 'success',
      candidates: [{
        name: '  Pikachu  ',
        collectorNumber: ' 025 ',
        confidence: 0.86,
        evidence: [{ label: 'printed name', value: ' Pikachu ', confidence: 0.92 }],
        metadata: { engine: 'local-test', wordCount: 4 },
        cardId: 'provider-specific-card-id',
      }],
    })).toEqual({
      status: 'success',
      candidates: [{
        name: 'Pikachu',
        collectorNumber: '025',
        confidence: 0.86,
        evidence: [{ label: 'printed name', value: 'Pikachu', confidence: 0.92 }],
        metadata: { engine: 'local-test', wordCount: 4 },
      }],
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

  it('surfaces provider failures as retryable recognition errors', async () => {
    const provider: ScannerProvider = {
      name: 'test-provider',
      identify: vi.fn().mockRejectedValue(new Error('Recognition worker failed.')),
    };

    await expect(identifyImage(provider, image)).resolves.toEqual({
      status: 'error',
      message: 'Recognition worker failed.',
      retryable: true,
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

    expect(result.status).toBe('success');
    expect(await getBinder()).toEqual(existingBinder);
    expect(store.get('binder')).toEqual(existingBinder);
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
});
