import type { Card } from '@/types';

export type PricingProviderName = string;

export type CardCondition = 'near_mint' | 'lightly_played' | 'moderately_played' | 'heavily_played' | 'damaged' | 'ungraded' | 'graded';

export type CardVariant = 'normal' | 'reverse' | 'holo' | 'firstEdition';

export type PricingSourceType =
  | 'marketplace'
  | 'retailer'
  | 'dealer'
  | 'auction'
  | 'aggregator'
  | 'community-reference'
  | 'other';

export type PriceTransactionType =
  | 'completed-sale'
  | 'active-listing'
  | 'retail-asking'
  | 'buylist'
  | 'price-guide'
  | 'unknown';

export type PriceListingStatus = 'active' | 'sold' | 'ended' | 'not-applicable' | 'unknown';
export type PriceSourceConfidence = 'high' | 'medium' | 'low' | 'unknown';

export interface PriceObservationProvenance {
  sourceUrl?: string;
  sourceRecordId?: string;
  sourceRelationship?: 'direct' | 'aggregated' | 'derived' | 'unknown';
  upstreamSources?: string[];
}

export interface PriceObservation {
  /** Local canonical Card key; adapters must verify the exact printing before assigning it. */
  cardId: string;
  variant?: CardVariant;
  condition?: CardCondition;
  isGraded?: boolean;
  language?: string;
  marketCountry?: string;
  marketRegion?: string;

  source: PricingProviderName;
  sourceType?: PricingSourceType;
  market: string; // e.g., 'tcgplayer', 'cardmarket', or a regional marketplace
  transactionType?: PriceTransactionType;
  listingStatus?: PriceListingStatus;

  price: number;
  currency: string;
  priceType: 'market' | 'trend' | 'average' | 'low' | 'high';

  observedAt: number; // timestamp when observed by the provider/marketplace
  fetchedAt: number;  // timestamp when retrieved by our adapter
  sourceConfidence?: PriceSourceConfidence;
  confidenceEvidence?: string;
  provenance?: PriceObservationProvenance;

  metadata?: Record<string, unknown>;
}

export type PriceAnalysisStatus =
  | 'normal'
  | 'review'
  | 'high_divergence'
  | 'insufficient_data';

export interface PriceAnalysis {
  status: PriceAnalysisStatus;
  comparableObservationCount: number;
  requiresVerification: boolean;
  reason?: string;
  verifiedAt?: number;
  verificationProvider?: string;
}

export interface ComparableNormalizationOptions {
  cardId?: string;
  variant?: CardVariant;
  variantSpecified?: boolean;
  condition?: CardCondition;
  isGraded?: boolean;
  language?: string;
  /** Defaults to price-guide; one transaction class is consolidated at a time. */
  transactionType?: PriceTransactionType;
  listingStatus?: PriceListingStatus;
  priceType?: 'market' | 'trend' | 'average' | 'low' | 'high';
  maxObservationAgeMs?: number;
  now?: number;
}

export interface PriceReference {
  cardId: string;
  referencePrice: number; // Calculated/reference price in base currency (e.g. USD)
  currency: string;       // Base reference currency ('USD')
  methodologyVersion: string; // e.g. 'v1-median'
  confidence: 'high' | 'medium' | 'low';
  sourceCount: number;    // Number of distinct provider observations used
  activeProviders: string[]; // List of providers that contributed
  activeMarketplaces: string[]; // List of distinct marketplaces represented
  updatedAt: number;      // timestamp of calculation
  
  analysis?: PriceAnalysis; // Added for divergence tracking
}

export interface PricingProvider {
  name: PricingProviderName;
  isSecondary?: boolean;
  fetchPrices(card: Card): Promise<PriceObservation[]>;
}
