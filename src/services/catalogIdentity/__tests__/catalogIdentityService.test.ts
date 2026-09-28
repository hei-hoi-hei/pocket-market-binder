import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { ConfirmedScannerCandidate, ScannerCandidate } from '@/services/scanner/types';
import {
  createCatalogIdentityProvider,
  resolveCatalogIdentity,
} from '../catalogIdentityService';
import type { CatalogIdentityProvider } from '../types';
import type {
  CatalogCard,
  ICatalogProvider,
} from '@/services/catalog/types/catalogProvider.types';

const candidateEvidence = [
  { label: 'printed name', value: 'Pikachu', confidence: 0.91 },
  { label: 'collector number', value: '025' },
];

const candidate = {
  name: 'Pikachu',
  collectorNumber: '025',
  setCode: 'SVP',
  confidence: 0.72,
  evidence: candidateEvidence,
} as ConfirmedScannerCandidate;

function catalogRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'svp-025',
    name: 'Pikachu',
    setCode: 'SVP',
    number: '025',
    ...overrides,
  };
}

function provider(search: CatalogIdentityProvider['search']): CatalogIdentityProvider {
  return { name: 'fixture-catalog', search };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveCatalogIdentity', () => {
  it('resolves one exact existing catalog record and preserves recognition evidence', async () => {
    const result = await resolveCatalogIdentity(candidate, provider(async () => [catalogRecord()]));

    expect(result).toEqual({
      status: 'resolved',
      candidate,
      match: {
        catalogId: 'svp-025',
        name: 'Pikachu',
        setCode: 'SVP',
        collectorNumber: '025',
        provider: 'fixture-catalog',
      },
    });
    expect(result.candidate.evidence).toBe(candidateEvidence);
    expect(result.status === 'resolved' && result.match.catalogId).toBe('svp-025');
  });

  it('returns multiple exact records as ambiguous instead of selecting one', async () => {
    const result = await resolveCatalogIdentity(candidate, provider(async () => [
      catalogRecord(),
      catalogRecord({ id: 'svp-025-alt' }),
    ]));

    expect(result.status).toBe('ambiguous');
    expect(result.status === 'ambiguous' && result.matches.map((match) => match.catalogId))
      .toEqual(['svp-025', 'svp-025-alt']);
  });

  it('returns no-match without fabricating an ID when clues do not match', async () => {
    const result = await resolveCatalogIdentity(candidate, provider(async () => [
      catalogRecord({ id: 'wrong-card', name: 'Raichu' }),
    ]));

    expect(result.status).toBe('no-match');
    expect(result).not.toHaveProperty('match');
    expect(result.candidate).toBe(candidate);
  });

  it('reports an unavailable resolver truthfully', async () => {
    const result = await resolveCatalogIdentity(candidate);

    expect(result).toMatchObject({
      status: 'unavailable',
      reason: 'No catalog identity provider is configured.',
      candidate,
    });
  });

  it('rejects malformed provider results', async () => {
    const result = await resolveCatalogIdentity(candidate, provider(async () => [
      catalogRecord(),
      { id: '', name: 'Malformed', setCode: 'SVP', number: '025' },
    ]));

    expect(result).toMatchObject({ status: 'error', candidate });
    expect(result.status === 'error' && result.message).toContain('malformed results');
  });

  it('preserves provider failures as errors', async () => {
    const result = await resolveCatalogIdentity(candidate, provider(async () => {
      throw new Error('Catalog request failed');
    }));

    expect(result).toEqual({
      status: 'error',
      candidate,
      message: 'Catalog request failed',
    });
  });

  it('cancels while an uncooperative provider is in flight', async () => {
    const controller = new AbortController();
    const search = vi.fn(() => new Promise<unknown>(() => {}));
    const removeAbortListener = vi.spyOn(controller.signal, 'removeEventListener');
    const pending = resolveCatalogIdentity(candidate, provider(search), controller.signal);

    controller.abort();

    await expect(pending).resolves.toEqual({ status: 'cancelled', candidate });
    expect(search).toHaveBeenCalledOnce();
    expect(removeAbortListener).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('does not call a provider when required identity clues are incomplete', async () => {
    const incomplete = { name: 'Pikachu', evidence: candidateEvidence } as ConfirmedScannerCandidate;
    const search = vi.fn(async () => [catalogRecord()]);

    const result = await resolveCatalogIdentity(incomplete, provider(search));

    expect(result.status).toBe('unavailable');
    expect(search).not.toHaveBeenCalled();
    expect(result.candidate.evidence).toBe(candidateEvidence);
  });

  it('requires the confirmed-candidate type at the service boundary', () => {
    type CandidateArgument = Parameters<typeof resolveCatalogIdentity>[0];
    type UnconfirmedCandidate = ScannerCandidate;

    expectTypeOf<CandidateArgument>().toEqualTypeOf<ConfirmedScannerCandidate>();
    expectTypeOf<UnconfirmedCandidate>().not.toMatchTypeOf<CandidateArgument>();
  });

  it('adapts the existing catalog provider interface without persisting or mutating collections', async () => {
    const searchCards = vi.fn(async (): Promise<CatalogCard[]> => [{
      id: 'svp-025',
      name: 'Pikachu',
      set: 'Scarlet & Violet Promo',
      setCode: 'SVP',
      number: '025',
      images: {},
      rarity: 'promo',
      category: 'pokemon',
    }]);
    const catalogProvider: ICatalogProvider = {
      searchCards,
      getSets: async () => [],
      getCardById: async () => null,
    };
    const fetchRequest = vi.fn();
    const storageWrite = vi.fn();
    const indexedDbOpen = vi.fn();
    vi.stubGlobal('fetch', fetchRequest);
    vi.stubGlobal('localStorage', { setItem: storageWrite });
    vi.stubGlobal('indexedDB', { open: indexedDbOpen });

    const result = await resolveCatalogIdentity(
      candidate,
      createCatalogIdentityProvider(catalogProvider, 'fixture-catalog'),
    );

    expect(result.status).toBe('resolved');
    expect(searchCards).toHaveBeenCalledWith('Pikachu');
    expect(fetchRequest).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();
    expect(indexedDbOpen).not.toHaveBeenCalled();
    expect(searchCards).toHaveBeenCalledTimes(1);
  });

  it('does not invent identity fields from scanner clues', async () => {
    const result = await resolveCatalogIdentity(candidate, provider(async () => []));

    expect(result.status).toBe('no-match');
    expect(result).not.toHaveProperty('match');
    expect(result.candidate).toMatchObject({
      name: 'Pikachu',
      collectorNumber: '025',
      setCode: 'SVP',
      evidence: candidateEvidence,
    });
  });

  it('does not call the provider when cancellation has already occurred', async () => {
    const controller = new AbortController();
    controller.abort();
    const search = vi.fn(async () => [catalogRecord()]);

    await expect(resolveCatalogIdentity(candidate, provider(search), controller.signal))
      .resolves.toEqual({ status: 'cancelled', candidate });
    expect(search).not.toHaveBeenCalled();
  });

  it('distinguishes an explicit unavailable response from malformed data', async () => {
    const result = await resolveCatalogIdentity(candidate, provider(async () => ({
      status: 'unavailable',
      reason: 'Catalog source is offline.',
    })));

    expect(result).toEqual({
      status: 'unavailable',
      candidate,
      reason: 'Catalog source is offline.',
    });
  });
});
