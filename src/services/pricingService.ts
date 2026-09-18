import type { Card } from '@/types';
import { storage } from './storage';
import type { PriceObservation, PriceReference, PricingProvider, ComparableNormalizationOptions } from './providers/pricingProvider';
import type { ConsolidatedPrice } from './engine/types';
import { consolidatePrices } from './engine/consolidationEngine';
import { tickermintProvider } from './providers/tickermintProvider';
import { pkmnpricesProvider } from './providers/pkmnpricesProvider';
import { justtcgProvider } from './providers/justtcgProvider';
import { scrydexProvider } from './providers/scrydexProvider';
import { tcgdexProvider } from './providers/tcgdexProvider';

const CACHED_PRICES_PREFIX = 'cached_prices_store:';
const CACHED_OBS_PREFIX = 'cached_observations_store:';
const CACHED_VERIFICATION_PREFIX = 'cached_price_verification:';

export interface PricingPolicy {
  defaultMaxAgeMs: number;
  maxObservationAgeMs: number;
  calculationCurrency: string;
}

const DEFAULT_POLICY: PricingPolicy = {
  defaultMaxAgeMs: 24 * 60 * 60 * 1000,
  maxObservationAgeMs: 7 * 24 * 60 * 60 * 1000,
  calculationCurrency: 'USD',
};

export class PricingService {
  private providers: PricingProvider[] = [];
  private policy: PricingPolicy;

  constructor(policy: Partial<PricingPolicy> = {}) {
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

  async getConsolidatedPrice(
    card: Card,
    options?: { maxAgeMs?: number; forceRefresh?: boolean; normalization?: ComparableNormalizationOptions }
  ): Promise<ConsolidatedPrice> {
    if (!card || !card.id) return consolidatePrices([], 'USD');
    const key = `${CACHED_OBS_PREFIX}${card.id}`;
    let obs: PriceObservation[] = [];

    if (typeof navigator !== 'undefined' && navigator.onLine && this.providers.length > 0) {
      try {
        const primary = this.providers.filter((p) => !p.isSecondary);
        const results = await Promise.allSettled(primary.map((p) => p.fetchPrices(card)));
        for (const res of results) {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) obs.push(...res.value);
        }
        if (obs.length > 0) {
          storage.set(key, obs).catch(() => {});
          return consolidatePrices(obs, this.policy.calculationCurrency, options?.normalization);
        }
      } catch {}
    }

    try {
      const cached = await storage.get<PriceObservation[]>(key);
      if (cached && cached.length > 0) obs = cached;
    } catch {}
    return consolidatePrices(obs, this.policy.calculationCurrency, options?.normalization);
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

    let validObs = observations.filter(
      (o) => o.price > 0 && (now - o.observedAt) <= this.policy.maxObservationAgeMs
    );
    if (validObs.length === 0) {
      validObs = observations.filter((o) => o.price > 0);
    }
    if (validObs.length === 0) return null;

    const consolidated = consolidatePrices(validObs, this.policy.calculationCurrency, normalizationOptions);
    if (consolidated.value === null) return null;

    const activeProviders = Array.from(new Set(consolidated.observations.map((o) => o.source)));
    const activeMarketplaces = Array.from(new Set(consolidated.observations.map((o) => o.market)));
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
      sourceCount: consolidated.comparableObservationCount,
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
          let freshRef = this.aggregateObservations(card.id, newObservations, options?.normalization);

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
            freshRef = this.aggregateObservations(card.id, newObservations, options?.normalization);
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
    } catch {}

    return null;
  }
}

export const pricingService = new PricingService();

