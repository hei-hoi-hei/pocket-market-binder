import { describe, expect, it, vi } from 'vitest';
import { identifyImageWithProviders, fuseScannerResults } from '../scannerOrchestration';
import type { ScannerProviderRun } from '../scannerOrchestration';
import type { ScannerProvider } from '../types';

const image = new Blob(['test image'], { type: 'image/jpeg' });

function makeProvider(name: string, response: unknown): ScannerProvider {
  return { name, identify: vi.fn().mockResolvedValue(response) };
}

function run(provider: string, result: ScannerProviderRun['result']): ScannerProviderRun {
  return { provider, result };
}

const pikachu = {
  catalogId: 'card-25',
  catalogProvider: 'tcgdex',
  gameKey: 'pokemon',
  name: 'Pikachu',
  setCode: 'set-a',
  collectorNumber: '025',
  language: 'en',
  variant: 'holo',
  evidence: [{ label: 'collector number', value: '025', strength: 'strong' as const }],
};

describe('scanner recognition orchestration', () => {
  it('returns and ranks one provider candidate as a strong suggestion without confirming it', async () => {
    const result = await identifyImageWithProviders([
      makeProvider('ocr', { status: 'success', candidates: [pikachu] }),
    ], image);

    expect(result).toMatchObject({
      status: 'success',
      decision: 'strong-candidate',
      candidates: [{ catalogId: 'card-25', providers: ['ocr'] }],
    });
  });

  it('does not infer strong evidence from a high legacy numeric score', async () => {
    const result = await identifyImageWithProviders([
      makeProvider('ocr', {
        status: 'success',
        candidates: [{ name: 'Pikachu', confidence: 0.99 }],
      }),
    ], image);

    expect(result).toMatchObject({
      status: 'success',
      decision: 'insufficient',
    });
  });

  it('merges candidates with an explicit shared catalog namespace and identity', async () => {
    const visual = makeProvider('visual', {
      status: 'success',
      candidates: [{ ...pikachu, metadata: { model: 'visual-fixture' } }],
    });
    const ocr = makeProvider('ocr', {
      status: 'success',
      candidates: [{ ...pikachu, metadata: { engine: 'ocr-fixture' } }],
    });

    const result = await identifyImageWithProviders([visual, ocr], image);

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].providers).toEqual(['ocr', 'visual']);
    expect(result.candidates[0].evidence?.map((evidence) => evidence.provider)).toEqual(['visual', 'ocr']);
    expect(result.candidates[0].providerMetadata).toEqual({
      visual: { model: 'visual-fixture' },
      ocr: { engine: 'ocr-fixture' },
    });
  });

  it('retains different candidate identities for user selection', async () => {
    const result = await identifyImageWithProviders([
      makeProvider('visual', { status: 'success', candidates: [pikachu] }),
      makeProvider('ocr', { status: 'success', candidates: [{ ...pikachu, catalogId: 'card-26', name: 'Raichu' }] }),
    ], image);

    expect(result).toMatchObject({ status: 'success', decision: 'candidate-confirmation' });
    if (result.status === 'success') expect(result.candidates).toHaveLength(2);
  });

  it('does not merge equal raw catalog IDs across different game namespaces', () => {
    const result = fuseScannerResults([run('visual', {
      status: 'success',
      candidates: [
        { ...pikachu, gameKey: 'game-a' },
        { ...pikachu, gameKey: 'game-b' },
      ],
    })]);

    expect(result.status).toBe('success');
    if (result.status === 'success') expect(result.candidates).toHaveLength(2);
  });

  it('preserves a provider no-match as missing evidence, not a rejection', async () => {
    const result = await identifyImageWithProviders([
      makeProvider('visual', { status: 'success', candidates: [pikachu] }),
      makeProvider('ocr', { status: 'no-match' }),
    ], image);

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].evidence).toContainEqual(expect.objectContaining({
      provider: 'ocr',
      relation: 'unavailable',
      strength: 'unavailable',
    }));
  });

  it('preserves an explicit contradictory observation without eliminating its candidate', async () => {
    const result = await identifyImageWithProviders([
      makeProvider('ocr', {
        status: 'success',
        candidates: [{
          ...pikachu,
          evidence: [{
            label: 'set text',
            value: 'set-b',
            relation: 'contradicts',
            strength: 'contradictory',
          }],
        }],
      }),
    ], image);

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].evidence).toContainEqual(expect.objectContaining({ relation: 'contradicts' }));
    expect(result.decision).toBe('insufficient');
  });

  it('retains candidate and evidence provenance after fusion', async () => {
    const result = await identifyImageWithProviders([
      makeProvider('visual', { status: 'success', candidates: [pikachu] }),
      makeProvider('ocr', { status: 'success', candidates: [pikachu] }),
    ], image);

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.candidates[0].providers).toEqual(['ocr', 'visual']);
    expect(result.candidates[0].evidence?.every((evidence) => evidence.provider)).toBe(true);
  });

  it('orders equal-strength candidates deterministically by normalized identity', () => {
    const result = fuseScannerResults([run('visual', {
      status: 'success',
      candidates: [
        { ...pikachu, catalogId: 'z-card' },
        { ...pikachu, catalogId: 'a-card' },
      ],
    })]);

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.candidates.map((candidate) => candidate.catalogId)).toEqual(['a-card', 'z-card']);
    }
  });

  it('routes an empty recognition result to the insufficient/manual-search state', async () => {
    const result = await identifyImageWithProviders([
      makeProvider('ocr', { status: 'no-match' }),
    ], image);

    expect(result).toMatchObject({
      status: 'no-match',
      decision: 'insufficient',
      providerResults: [{ provider: 'ocr', status: 'missing', candidateCount: 0 }],
    });
  });

  it('keeps provider failures visible when no candidates are available', async () => {
    const result = await identifyImageWithProviders([
      makeProvider('ocr', { status: 'unavailable', reason: 'OCR unavailable' }),
    ], image);

    expect(result).toMatchObject({
      status: 'unavailable',
      decision: 'insufficient',
      providerResults: [{ provider: 'ocr', status: 'unavailable', reason: 'OCR unavailable' }],
    });
  });

  it('keeps recognition separate from collection mutation and confirmation', async () => {
    const result = await identifyImageWithProviders([
      makeProvider('ocr', { status: 'success', candidates: [pikachu] }),
    ], image);

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.candidates[0]).not.toHaveProperty('cardId');
      expect(result.candidates[0]).not.toHaveProperty('quantity');
    }
  });
});