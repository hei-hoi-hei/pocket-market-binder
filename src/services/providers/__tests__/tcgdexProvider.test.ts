import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import livePricingFixture from './fixtures/tcgdex-live-base1-1.json';
import documentedPricingFixture from './fixtures/tcgdex-documented-pricing.json';
import { extractTCGdexObservations, mapTCGdexToCard, TCGdexProvider } from '../tcgdexProvider';

const FETCHED_AT = Date.parse('2026-09-29T00:00:00.000Z');

describe('extractTCGdexObservations', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FETCHED_AT);
  });

  describe('mapTCGdexToCard', () => {
    it('keeps TCGdex IDs and artwork namespaced as catalog-provider data', () => {
      const card = mapTCGdexToCard({
        id: 'jp-set-042',
        name: 'Alakazam',
        localId: '042',
        image: 'https://assets.tcgdex.net/ja/jp/jp-set/042',
        set: { id: 'jp-set', name: 'Japanese Set' },
        variants: { normal: true, reverse: true, holo: false, firstEdition: false },
      });

      expect(card.catalogArtwork).toEqual({
        provider: 'tcgdex',
        providerCardId: 'jp-set-042',
        printingIdentity: {
          setId: 'jp-set',
          setName: 'Japanese Set',
          cardNumber: '042',
          name: 'Alakazam',
          rarity: 'other',
          variants: { normal: true, reverse: true, holo: false, firstEdition: false },
          providerIds: { tcgdex: ['jp-set-042'] },
        },
        imageUrls: {
          low: 'https://assets.tcgdex.net/ja/jp/jp-set/042/low.webp',
          high: 'https://assets.tcgdex.net/ja/jp/jp-set/042/high.webp',
        },
      });
      expect(card.identity).toMatchObject({
        variants: { normal: true, reverse: true, holo: false, firstEdition: false },
        providerIds: { tcgdex: ['jp-set-042'] },
      });
      expect(card.identity).not.toHaveProperty('tcgdexId');
      expect(card.identity).not.toHaveProperty('imageUrl');
    });
  });

  it('preserves source-provided printing fields on catalog search results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{
      id: 'sv3pt5-1',
      name: 'Bulbasaur',
      localId: '1',
      set: { id: 'sv3pt5', name: '151' },
      image: 'https://assets.tcgdex.net/en/sv/sv3pt5/1',
      variants: { normal: true, reverse: true, holo: false, firstEdition: false },
    }]), { status: 200 }));
    const provider = new TCGdexProvider();

    const [card] = await provider.searchCards('Bulbasaur');

    expect(card.identity).toMatchObject({
      name: 'Bulbasaur',
      setId: 'sv3pt5',
      setName: '151',
      cardNumber: '1',
      variants: { normal: true, reverse: true, holo: false, firstEdition: false },
      providerIds: { tcgdex: ['sv3pt5-1'] },
    });
    expect(card.catalogArtwork?.printingIdentity).toMatchObject({
      setId: 'sv3pt5',
      cardNumber: '1',
      variants: { normal: true, reverse: true, holo: false, firstEdition: false },
      providerIds: { tcgdex: ['sv3pt5-1'] },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps the verified live detailed response into attributed market observations', () => {
    const observations = extractTCGdexObservations('base1-1', livePricingFixture);

    expect(observations).toEqual([
      {
        cardId: 'base1-1',
        source: 'tcgdex',
        transactionType: 'price-guide',
        market: 'cardmarket',
        price: 68.73,
        currency: 'EUR',
        priceType: 'average',
        observedAt: Date.parse('2026-09-28T10:33:27.643Z'),
        fetchedAt: FETCHED_AT,
        metadata: { field: 'avg', providerListingId: 273696 },
      },
      {
        cardId: 'base1-1',
        source: 'tcgdex',
        transactionType: 'price-guide',
        market: 'cardmarket',
        price: 7,
        currency: 'EUR',
        priceType: 'low',
        observedAt: Date.parse('2026-09-28T10:33:27.643Z'),
        fetchedAt: FETCHED_AT,
        metadata: { field: 'low', providerListingId: 273696 },
      },
      {
        cardId: 'base1-1',
        source: 'tcgdex',
        transactionType: 'price-guide',
        market: 'cardmarket',
        price: 42.38,
        currency: 'EUR',
        priceType: 'trend',
        observedAt: Date.parse('2026-09-28T10:33:27.643Z'),
        fetchedAt: FETCHED_AT,
        metadata: { field: 'trend', providerListingId: 273696 },
      },
      {
        cardId: 'base1-1',
        variant: 'holo',
        source: 'tcgdex',
        transactionType: 'price-guide',
        market: 'cardmarket',
        price: 19.66,
        currency: 'EUR',
        priceType: 'trend',
        observedAt: Date.parse('2026-09-28T10:33:27.643Z'),
        fetchedAt: FETCHED_AT,
        metadata: { field: 'trend-holo', providerListingId: 273696 },
      },
      {
        cardId: 'base1-1',
        variant: 'holo',
        source: 'tcgdex',
        transactionType: 'price-guide',
        market: 'tcgplayer',
        price: 43.99,
        currency: 'USD',
        priceType: 'low',
        observedAt: Date.parse('2026-09-28T10:33:26.618Z'),
        fetchedAt: FETCHED_AT,
        metadata: { field: 'lowPrice', providerListingId: 42346 },
      },
      {
        cardId: 'base1-1',
        variant: 'holo',
        source: 'tcgdex',
        transactionType: 'price-guide',
        market: 'tcgplayer',
        price: 64.86,
        currency: 'USD',
        priceType: 'average',
        observedAt: Date.parse('2026-09-28T10:33:26.618Z'),
        fetchedAt: FETCHED_AT,
        metadata: { field: 'midPrice', providerListingId: 42346 },
      },
      {
        cardId: 'base1-1',
        variant: 'holo',
        source: 'tcgdex',
        transactionType: 'price-guide',
        market: 'tcgplayer',
        price: 9999,
        currency: 'USD',
        priceType: 'high',
        observedAt: Date.parse('2026-09-28T10:33:26.618Z'),
        fetchedAt: FETCHED_AT,
        metadata: { field: 'highPrice', providerListingId: 42346 },
      },
      {
        cardId: 'base1-1',
        variant: 'holo',
        source: 'tcgdex',
        transactionType: 'price-guide',
        market: 'tcgplayer',
        price: 67.18,
        currency: 'USD',
        priceType: 'market',
        observedAt: Date.parse('2026-09-28T10:33:26.618Z'),
        fetchedAt: FETCHED_AT,
        metadata: { field: 'marketPrice', providerListingId: 42346 },
      },
      {
        cardId: 'base1-1',
        variant: 'holo',
        source: 'tcgdex',
        transactionType: 'price-guide',
        market: 'tcgplayer',
        price: 384.99,
        currency: 'USD',
        priceType: 'low',
        observedAt: Date.parse('2026-09-28T10:33:26.618Z'),
        fetchedAt: FETCHED_AT,
        metadata: { field: 'directLowPrice', providerListingId: 42346 },
      },
    ]);
  });

  it('maps the documented normal and reverse TCGplayer structures and Cardmarket fields', () => {
    const observations = extractTCGdexObservations('swsh3-136', documentedPricingFixture);

    expect(observations).toHaveLength(16);
    expect(observations.filter((observation) => observation.market === 'tcgplayer')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardId: 'swsh3-136',
          variant: 'normal',
          market: 'tcgplayer',
          price: 0.09,
          currency: 'USD',
          priceType: 'market',
          observedAt: Date.parse('2025-08-05T20:07:54.000Z'),
          fetchedAt: FETCHED_AT,
          metadata: { field: 'marketPrice' },
        }),
        expect.objectContaining({
          cardId: 'swsh3-136',
          variant: 'reverse',
          market: 'tcgplayer',
          price: 0.23,
          currency: 'USD',
          priceType: 'market',
          observedAt: Date.parse('2025-08-05T20:07:54.000Z'),
          fetchedAt: FETCHED_AT,
          metadata: { field: 'marketPrice' },
        }),
      ]),
    );
    expect(observations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metadata: { field: 'avg1' } }),
        expect.objectContaining({ metadata: { field: 'avg7' } }),
        expect.objectContaining({ metadata: { field: 'avg30' } }),
      ]),
    );
  });

  it('returns no observations when pricing is absent or its response identity mismatches', () => {
    expect(extractTCGdexObservations('base1-1', { id: 'base1-1' })).toEqual([]);
    expect(extractTCGdexObservations('other-card', livePricingFixture)).toEqual([]);
  });

  it('keeps valid fields when optional price fields are absent', () => {
    const response = {
      id: 'base1-1',
      pricing: {
        cardmarket: {
          updated: '2026-09-28T10:33:27.643Z',
          unit: 'EUR',
          avg: 2.5,
        },
      },
    };

    expect(extractTCGdexObservations('base1-1', response)).toEqual([
      {
        cardId: 'base1-1',
        source: 'tcgdex',
        transactionType: 'price-guide',
        market: 'cardmarket',
        price: 2.5,
        currency: 'EUR',
        priceType: 'average',
        observedAt: Date.parse('2026-09-28T10:33:27.643Z'),
        fetchedAt: FETCHED_AT,
        metadata: { field: 'avg' },
      },
    ]);
  });

  it('rejects malformed values, currencies, and timestamps without fabricating observations', () => {
    const response = {
      id: 'base1-1',
      pricing: {
        cardmarket: {
          updated: 'not-a-date',
          unit: 'EUR',
          avg: 10,
        },
        tcgplayer: {
          updated: '2026-09-28T10:33:26.618Z',
          unit: 'CAD',
          normal: { marketPrice: 10 },
        },
      },
    };

    expect(extractTCGdexObservations('base1-1', response)).toEqual([]);
  });

  it('rejects non-positive, non-finite, and non-numeric prices', () => {
    const response = {
      id: 'base1-1',
      pricing: {
        cardmarket: {
          updated: '2026-09-28T10:33:27.643Z',
          unit: 'EUR',
          avg: 0,
          low: -1,
          trend: '4.25',
          'avg-holo': Number.POSITIVE_INFINITY,
        },
      },
    };

    expect(extractTCGdexObservations('base1-1', response)).toEqual([]);
  });

  it('ignores unknown markets, variants, and unexpected response structures', () => {
    const response = {
      id: 'base1-1',
      pricing: {
        unsupported: { updated: '2026-09-28T10:33:27.643Z', unit: 'USD', market: 10 },
        tcgplayer: {
          updated: '2026-09-28T10:33:26.618Z',
          unit: 'USD',
          unknownVariant: { marketPrice: 10 },
        },
      },
    };

    expect(extractTCGdexObservations('base1-1', response)).toEqual([]);
    expect(extractTCGdexObservations('base1-1', null)).toEqual([]);
    expect(extractTCGdexObservations('base1-1', [])).toEqual([]);
    expect(extractTCGdexObservations('base1-1', { id: 'base1-1', pricing: [] })).toEqual([]);
  });

  it('returns no observations for a malformed market object without blocking other valid markets', () => {
    const response = {
      id: 'base1-1',
      pricing: {
        cardmarket: { updated: 'invalid', unit: 'EUR', avg: 10 },
        tcgplayer: {
          updated: '2026-09-28T10:33:26.618Z',
          unit: 'USD',
          normal: { marketPrice: 4.5 },
        },
      },
    };

    expect(extractTCGdexObservations('base1-1', response)).toEqual([
      {
        cardId: 'base1-1',
        variant: 'normal',
        source: 'tcgdex',
        transactionType: 'price-guide',
        market: 'tcgplayer',
        price: 4.5,
        currency: 'USD',
        priceType: 'market',
        observedAt: Date.parse('2026-09-28T10:33:26.618Z'),
        fetchedAt: FETCHED_AT,
        metadata: { field: 'marketPrice' },
      },
    ]);
  });
});
