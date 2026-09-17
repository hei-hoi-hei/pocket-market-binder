import type { Card } from '@/types';

/**
 * Service to resolve artwork URLs for cards.
 * Provides a provider-agnostic interface to allow adding future artwork sources.
 */
export const artworkService = {
  /**
   * Resolves the best available artwork URL for a card.
   * Currently uses TCGdex as the primary source.
   */
  resolve(card: Card, quality: 'low' | 'high'): string | null {
    const url = quality === 'high' 
      ? (card.imageUrlHigh || card.imageUrlLow) 
      : (card.imageUrlLow || card.imageUrlHigh);

    return url && url.length > 0 ? url : null;
  }
};
