import type { Card, CanonicalCardIdentity } from '@/types';
import { storage } from './storage';
import type { IdentityVerificationProvider, CardVerificationResult } from './providers/identityProvider';

const CACHED_IDENTITY_VERIFICATION_PREFIX = 'identity_verification:';

export class IdentityService {
  private providers: IdentityVerificationProvider[] = [];

  registerProvider(provider: IdentityVerificationProvider): void {
    this.providers.push(provider);
  }

  /**
   * Logic to determine when secondary verification is warranted.
   */
  shouldVerifySecondary(card: Card): boolean {
    // If we have very little info, or it's a high-value card that needs confirmation
    // For V1, we'll trigger it if the identity is missing or incomplete
    if (!card.identity) return true;
    
    // If it's a search result from TCGdex that is simplified, we might want to verify
    if (!card.imageUrlHigh && !card.attacks) return true;

    return false;
  }

  async verifyCard(card: Card): Promise<CardVerificationResult[]> {
    const cacheKey = `${CACHED_IDENTITY_VERIFICATION_PREFIX}${card.id}`;
    
    // Check cache
    const cached = await storage.get<CardVerificationResult[]>(cacheKey);
    if (cached) return cached;

    if (!navigator.onLine) return [];

    const results: CardVerificationResult[] = [];
    
    // Only query if warranted
    if (this.shouldVerifySecondary(card)) {
      const clues = {
        name: card.name,
        setNumber: card.setNumber,
        setCode: card.setCode,
        setName: card.setName,
        rarity: card.rarity,
        imageUrl: card.imageUrlHigh || card.imageUrlLow,
      };

      const verificationPromises = this.providers.map(p => 
        p.verifyIdentity(clues).catch(err => {
          console.error(`Identity provider ${p.name} failed:`, err);
          return null;
        })
      );

      const resolvedResults = await Promise.all(verificationPromises);
      for (const res of resolvedResults) {
        if (res) results.push(res);
      }

      if (results.length > 0) {
        await storage.set(cacheKey, results);
      }
    }

    return results;
  }

  /**
   * Merges verification results into a canonical identity.
   */
  applyVerification(identity: CanonicalCardIdentity, results: CardVerificationResult[]): CanonicalCardIdentity {
    const updated = { ...identity, providerIds: { ...identity.providerIds } };
    
    for (const res of results) {
      if (res.matchedProviderId) {
        const provider = res.provider.toLowerCase();
        const existing = updated.providerIds![provider] || [];
        if (!existing.includes(res.matchedProviderId)) {
          updated.providerIds![provider] = [...existing, res.matchedProviderId];
        }
      }
    }
    
    return updated;
  }
}

export const identityService = new IdentityService();
