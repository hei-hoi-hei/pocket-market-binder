import type { Card } from '@/types';
import { storage } from './storage';
import type { CardVariant, PriceObservation, PriceReference, PricingProvider, ComparableNormalizationOptions } from './providers/pricingProvider';
import type { ConsolidatedPrice } from './engine/types';
import { consolidatePrices } from './engine/consolidationEngine';
import { tickermintProvider } from './providers/tickermintProvider';
import { pkmnpricesProvider } from './providers/pkmnpricesProvider';
import { justtcgProvider } from './providers/justtcgProvider';
import { scrydexProvider } from './providers/scrydexProvider';
import { tcgdexProvider } from './providers/tcgdexProvider';
import {
  CANONICAL_CALCULATION_CURRENCY,
  staticFallbackExchangeRateProvider,
  type ExchangeRateProvider,
} from './currencyService';

const CACHED_PRICES_PREFIX = 'cached_prices_store:';
const CACHED_OBS_PREFIX = 'cached_observations_store:';
const CACHED_VERIFICATION_PREFIX = 'cached_price_verification:';
export const DEFAULT_MAX_OBSERVATION_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readCardVariant(value: string | undefined): CardVariant | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  const variants: Record<string, CardVariant> = {
    normal: 'normal',
    reverse: 'reverse',
    reverseholo: 'reverse',
    holo: 'holo',
    holofoil: 'holo',
    firstedition: 'firstEdition',
  };
  return variants[normalized];
}

export interface PricingPolicy {
  defaultMaxAgeMs: number;
  maxObservationAgeMs: number;
}

const DEFAULT_POLICY: PricingPolicy = {
  defaultMaxAgeMs: 24 * 60 * 60 * 1000,
  maxObservationAgeMs: DEFAULT_MAX_OBSERVATION_AGE_MS,
};

export class PricingService {
  private providers: PricingProvider[] = [];
  private policy: PricingPolicy;

  constructor(
    policy: Partial<PricingPolicy> = {},
    private readonly exchangeRateProvider: ExchangeRateProvider = staticFallbackExchangeRateProvider,
  ) {
    this.policy = { ...DEFAULT_POLICY, ...policy };

    // Register standard portfolio providers by default
    this.registerProvider(tcgdexProvider);
    this.registerProvider(tickermintProvider);
    this.registerProvider(pkmnpricesProvider);
    this.registerProvider(justtcgProvider);
    this.registerProvider(scrydexProvider);
  }

  registerProvider(provider: PricingProvider): void {
    const existingIndex = this.providers.findIndex((p) => p.name === provider.name);
    if (existingIndex >= 0) {
      this.providers[existingIndex] = provider;
    } else {
      this.providers.push(provider);
    }
  }

  private normalizationForCard(
    card: Card,
    normalization: ComparableNormalizationOptions | undefined,
    now: number,
  ): ComparableNormalizationOptions {
    return {
      ...normalization,
      cardId: card.id,
      variant: normalization?.variant ?? readCardVariant(card.identity?.variant),
      variantSpecified: normalization?.variantSpecified === true
        || normalization?.variant !== undefined
        || Boolean(card.identity?.variant?.trim()),
      isGraded: false,
      maxObservationAgeMs: this.policy.maxObservationAgeMs,
      now,
    };
  }

  async getConsolidatedPrice(
    card: Card,
    options?: { maxAgeMs?: number; forceRefresh?: boolean; normalization?: ComparableNormalizationOptions }
  ): Promise<ConsolidatedPrice> {
    if (!card || !card.id) {
      return consolidatePrices([], CANONICAL_CALCULATION_CURRENCY, undefined, this.exchangeRateProvider);
    }
    const key = `${CACHED_OBS_PREFIX}${card.id}`;
    let obs: PriceObservation[] = [];
    const normalization = this.normalizationForCard(card, options?.normalization, Date.now());

    if (typeof navigator !== 'undefined' && navigator.onLine && this.providers.length > 0) {
      try {
        const primary = this.providers.filter((p) => !p.isSecondary);
        const results = await Promise.allSettled(primary.map((p) => p.fetchPrices(card)));
        for (const res of results) {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) obs.push(...res.value);
        }
        if (obs.length > 0) {
          storage.set(key, obs).catch(() => {});
          return consolidatePrices(obs, CANONICAL_CALCULATION_CURRENCY, {
            ...normalization,
            now: Date.now(),
          }, this.exchangeRateProvider);
        }
      } catch {
        // Provider failures fall through to the locally cached observations.
      }
    }

    try {
      const cached = await storage.get<PriceObservation[]>(key);
      if (cached && cached.length > 0) obs = cached;
    } catch {
      // Cache read failures are treated as a cache miss.
    }
    return consolidatePrices(obs, CANONICAL_CALCULATION_CURRENCY, {
      ...normalization,
      now: Date.now(),
    }, this.exchangeRateProvider);
  }


  clearProviders(): void {
    this.providers = [];
  }

  getRegisteredProviders(): string[] {
    return this.providers.map((p) => p.name);
  }

  setPolicy(policy: Partial<PricingPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  aggregateObservations(
    cardId: string,
    observations: PriceObservation[],
    normalizationOptions?: ComparableNormalizationOptions
  ): PriceReference | null {
    if (!observations || observations.length === 0) return null;
    const now = Date.now();

    const consolidated = consolidatePrices(observations, CANONICAL_CALCULATION_CURRENCY, {
      ...normalizationOptions,
      cardId,
      maxObservationAgeMs: this.policy.maxObservationAgeMs,
      now,
    }, this.exchangeRateProvider);
    if (consolidated.value === null) return null;

    const activeProviders = Array.from(new Set(consolidated.comparableObservations.map((o) => o.source)));
    const activeMarketplaces = Array.from(new Set(consolidated.comparableObservations.map((o) => o.market)));
    const isDivergent = consolidated.status === 'review' || consolidated.status === 'high_divergence';
    let reason: string | undefined;
    if (consolidated.status === 'high_divergence') {
      reason = 'Significant price outlier detected among providers.';
    } else if (consolidated.status === 'review') {
      reason = 'Moderate price spread between providers.';
    }

    return {
      cardId,
      referencePrice: consolidated.value,
      currency: consolidated.currency,
      methodologyVersion: 'v1-median',
      confidence: consolidated.comparableObservationCount >= 3 ? 'high' : consolidated.comparableObservationCount >= 2 ? 'medium' : 'low',
      sourceCount: consolidated.comparableObservations.length,
      activeProviders,
      activeMarketplaces,
      updatedAt: now,
      analysis: {
        status: consolidated.status,
        comparableObservationCount: consolidated.comparableObservationCount,
        requiresVerification: isDivergent,
        reason,
      },
    };
  }


  async getPriceReference(
    card: Card,
    options?: { maxAgeMs?: number; forceRefresh?: boolean; normalization?: ComparableNormalizationOptions }
  ): Promise<PriceReference | null> {
    if (!card || !card.id) return null;

    const maxAge = options?.maxAgeMs ?? this.policy.defaultMaxAgeMs;
    const forceRefresh = options?.forceRefresh ?? false;
    const refKey = `${CACHED_PRICES_PREFIX}${card.id}`;
    const obsKey = `${CACHED_OBS_PREFIX}${card.id}`;
    const verificationKey = `${CACHED_VERIFICATION_PREFIX}${card.id}`;

    // 1. Check cached PriceReference in IndexedDB
    let cachedRef: PriceReference | null = null;
    try {
      cachedRef = await storage.get<PriceReference>(refKey);
      if (!forceRefresh && cachedRef && (Date.now() - cachedRef.updatedAt) < maxAge) {
        return cachedRef;
      }
    } catch {
      // Storage errors are non-fatal
    }

    // 2. Fetch fresh observations from primary providers if online
    if (typeof navigator !== 'undefined' && navigator.onLine && this.providers.length > 0) {
      try {
        const primaryProviders = this.providers.filter((p) => !p.isSecondary);
        const secondaryProviders = this.providers.filter((p) => p.isSecondary);

        const primaryResults = await Promise.allSettled(
          primaryProviders.map((p) => p.fetchPrices(card))
        );

        const newObservations: PriceObservation[] = [];
        for (const res of primaryResults) {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            newObservations.push(...res.value);
          }
        }

        if (newObservations.length > 0) {
          let freshRef = this.aggregateObservations(
            card.id,
            newObservations,
            this.normalizationForCard(card, options?.normalization, Date.now()),
          );

          // Selective secondary verification if material divergence detected
          if (freshRef?.analysis?.requiresVerification && secondaryProviders.length > 0) {
            const secondaryResults = await Promise.allSettled(
              secondaryProviders.map((p) => p.fetchPrices(card))
            );

            for (const res of secondaryResults) {
              if (res.status === 'fulfilled' && Array.isArray(res.value)) {
                newObservations.push(...res.value);
              }
            }

            // Recalculate reference with secondary observations
            freshRef = this.aggregateObservations(
              card.id,
              newObservations,
              this.normalizationForCard(card, options?.normalization, Date.now()),
            );
            if (freshRef && freshRef.analysis) {
              freshRef.analysis.verifiedAt = Date.now();
              freshRef.analysis.verificationProvider = secondaryProviders.map((p) => p.name).join(', ');
              storage.set(verificationKey, freshRef.analysis).catch(() => {});
            }
          }

          if (freshRef) {
            storage.set(obsKey, newObservations).catch(() => {});
            storage.set(refKey, freshRef).catch(() => {});
            return freshRef;
          }
        }
      } catch {
        // Fallback to cache below
      }
    }

    // 3. Fallback: return stale cached reference if available
    if (cachedRef) {
      return cachedRef;
    }

    // 4. Fallback: check cached observations
    try {
      const cachedObs = await storage.get<PriceObservation[]>(obsKey);
      if (cachedObs && cachedObs.length > 0) {
        const derived = this.aggregateObservations(card.id, cachedObs, options?.normalization);
        if (derived) return derived;
      }
    } catch {
      // Cache read failures are non-fatal for the optional reference lookup.
    }

    return null;
  }

  async getCachedPriceReference(cardId: string): Promise<PriceReference | null> {
    if (!cardId) return null;
    try {
      return await storage.get<PriceReference>(`${CACHED_PRICES_PREFIX}${cardId}`);
    } catch {
      return null;
    }
  }
}

export const pricingService = new PricingService();
