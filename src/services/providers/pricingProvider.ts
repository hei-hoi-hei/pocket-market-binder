import type { Card } from '@/types';

export type PricingProviderName = 'tickermint' | 'pkmnprices' | 'justtcg' | 'scrydex' | 'tcgdex';

export type CardCondition = 'near_mint' | 'lightly_played' | 'moderately_played' | 'heavily_played' | 'damaged' | 'ungraded' | 'graded';

export type CardVariant = 'normal' | 'reverse' | 'holo' | 'firstEdition';

export interface PriceObservation {
  cardId: string;
  variant?: CardVariant;
  condition?: CardCondition;
  isGraded?: boolean;
  language?: string;
  
  source: PricingProviderName;
  market: string; // e.g., 'tcgplayer', 'cardmarket'

  price: number;
  currency: string;
  priceType: 'market' | 'trend' | 'average' | 'low' | 'high';

  observedAt: number; // timestamp when observed by the provider/marketplace
  fetchedAt: number;  // timestamp when retrieved by our adapter

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
  variant?: CardVariant;
  condition?: CardCondition;
  isGraded?: boolean;
  language?: string;
  priceType?: 'market' | 'trend' | 'average' | 'low' | 'high';
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
