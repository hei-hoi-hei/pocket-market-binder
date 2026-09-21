import { ICatalogProvider, CatalogCard, CatalogSet } from '../types/catalogProvider.types';
import { tcgdexProvider, mapTCGdexToCard } from '../../providers/tcgdexProvider';
import type { Card } from '@/types';

export class PokemonCatalogProvider implements ICatalogProvider {
  private baseUrl = 'https://api.tcgdex.net/v2/en';

  async searchCards(query: string, _filters?: Record<string, any>): Promise<CatalogCard[]> {
    const cards = await tcgdexProvider.searchCards(query);
    return cards.map(c => this.mapToCatalogCard(c));
  }

  async getSets(): Promise<CatalogSet[]> {
    try {
      const res = await fetch(`${this.baseUrl}/sets`);
      if (!res.ok) return [];
      const list = await res.json();
      if (!Array.isArray(list)) return [];
      
      return list.map((s: any) => ({
        id: s.id,
        name: s.name,
        series: s.serie,
        totalCards: s.cardCount?.total,
        releaseDate: undefined, // TCGdex sets list doesn't always have release date
        symbolUrl: s.logo ? `${s.logo}.webp` : undefined
      }));
    } catch {
      return [];
    }
  }

  async getCardById(id: string): Promise<CatalogCard | null> {
    const card = await tcgdexProvider.getCardById(id);
    if (!card) return null;
    return this.mapToCatalogCard(card);
  }

  /**
   * Internal helper to convert domain Card back to lightweight CatalogCard
   * or handle raw data if we were doing direct fetches.
   */
  private mapToCatalogCard(card: Card): CatalogCard {
    const { id, name, setCode, setName, setNumber, imageUrlLow, imageUrlHigh, rarity, category, ...rest } = card;
    return {
      id,
      name,
      set: setName || setCode,
      number: setNumber,
      // Keep the canonical Card fields available to consumers that use this
      // lightweight catalog shape as a Card.
      imageUrlLow,
      imageUrlHigh,
      images: {
        low: imageUrlLow,
        high: imageUrlHigh
      },
      rarity,
      category,
      ...rest
    };
  }
}
