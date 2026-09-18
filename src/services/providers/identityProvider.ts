import type { Rarity } from '@/types';

export interface IdentityVerificationClues {
  name: string;
  setNumber: string;
  setCode?: string;
  setName?: string;
  rarity?: Rarity;
  language?: string;
  imageUrl?: string;
}

export interface CardVerificationResult {
  provider: string;
  canonicalCardId?: string;
  matchedProviderId?: string;
  confidence?: 'high' | 'medium' | 'low';
  evidence: {
    nameMatch?: boolean;
    collectorNumberMatch?: boolean;
    setMatch?: boolean;
    rarityMatch?: boolean;
    imageMatch?: boolean;
    other?: Record<string, unknown>;
  };
  observedAt: number;
}

export interface IdentityVerificationProvider {
  name: string;
  verifyIdentity(clues: IdentityVerificationClues): Promise<CardVerificationResult>;
}
