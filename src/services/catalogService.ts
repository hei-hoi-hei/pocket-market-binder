import type { Card } from '@/types';
import { storage } from './storage';
import { catalogRegistry } from './catalog/catalogRegistry';

export interface CatalogFilters {
  query?: string;
  type?: string | 'all';
  rarity?: string | 'all';
  category?: string; // Added for multi-catalog support
}

export interface CatalogService {
  getAll(category?: string): Promise<Card[]>;
  getById(id: string, category?: string): Promise<Card | undefined>;
  search(filters: CatalogFilters): Promise<Card[]>;
}

const CACHED_CARDS_KEY = 'cached_cards_store';

type LegacyCatalogImageFields = {
  images?: {
    low?: string;
    high?: string;
  };
};

function normalizeCardImageFields(card: Card): Card {
  const legacyImages = (card as Card & LegacyCatalogImageFields).images;
  const imageUrlLow = card.imageUrlLow || legacyImages?.low;
  const imageUrlHigh = card.imageUrlHigh || legacyImages?.high;

  if (imageUrlLow === card.imageUrlLow && imageUrlHigh === card.imageUrlHigh) {
    return card;
  }

  return { ...card, imageUrlLow, imageUrlHigh };
}

function matchesQuery(card: Card, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    card.name.toLowerCase().includes(needle) ||
    (card.genus?.toLowerCase().includes(needle) ?? false) ||
    (card.types?.some((t) => t.toLowerCase().includes(needle)) ?? false) ||
    card.rarity.toLowerCase().includes(needle) ||
    `${card.setCode}-${card.setNumber}`.toLowerCase().includes(needle)
  );
}

class HybridCatalogService implements CatalogService {
  private memoryCache = new Map<string, Card>();
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Load previously cached cards from IndexedDB
    try {
      const persisted = await storage.get<Card[]>(CACHED_CARDS_KEY);
      if (persisted && Array.isArray(persisted)) {
        // Purge stale mock cards (IDs starting with PM-)
        const clean = persisted.filter((card) => !card.id.startsWith('PM-'));
        const normalized = clean.map(normalizeCardImageFields);
        const cacheWasRepaired = normalized.some((card, index) => card !== clean[index]);
        
        for (const card of normalized) {
          this.memoryCache.set(card.id, card);
        }

        // Persist removed mocks and repaired legacy image fields so the cache
        // remains valid on subsequent offline loads.
        if (clean.length !== persisted.length || cacheWasRepaired) {
          await storage.set(CACHED_CARDS_KEY, normalized);
        }
      }
    } catch {
      // IndexedDB failure shouldn't prevent catalog use
    }
  }

  private async persistCard(card: Card): Promise<void> {
    this.memoryCache.set(card.id, card);
    try {
      const allCached = Array.from(this.memoryCache.values());
      await storage.set(CACHED_CARDS_KEY, allCached);
    } catch {
      // Storage errors are non-fatal
    }
  }

  async getAll(category?: string): Promise<Card[]> {
    await this.ensureInitialized();
    const provider = catalogRegistry.getProvider(category);
    
    if (this.memoryCache.size === 0 && navigator.onLine) {
      try {
        const remoteCards = await provider.searchCards('');
        for (const card of remoteCards) {
          // Cast CatalogCard to Card - valid for Pokemon provider as it includes all Card fields
          const fullCard = normalizeCardImageFields(card as unknown as Card);
          this.memoryCache.set(fullCard.id, fullCard);
        }
      } catch {}
    }
    return Array.from(this.memoryCache.values());
  }

  async getById(id: string, category?: string): Promise<Card | undefined> {
    await this.ensureInitialized();

    // 1. Check in-memory / local storage first
    const cached = this.memoryCache.get(id);
    if (cached) return cached;

    // 2. Fetch full detail from provider if available
    const provider = catalogRegistry.getProvider(category);
    try {
      const remote = await provider.getCardById(id);
      if (remote) {
        const fullCard = normalizeCardImageFields(remote as unknown as Card);
        await this.persistCard(fullCard);
        return fullCard;
      }
    } catch {
      // Remote fetch failed, fall back to offline cache
    }

    return undefined;
  }

  async search(filters: CatalogFilters): Promise<Card[]> {
    await this.ensureInitialized();
    const provider = catalogRegistry.getProvider(filters.category);

    // Attempt remote search / fetch if online
    if (navigator.onLine) {
      try {
        const remoteCards = await provider.searchCards(filters.query || '');
        // Persist newly discovered cards
        for (const card of remoteCards) {
          const fullCard = normalizeCardImageFields(card as unknown as Card);
          if (!this.memoryCache.has(fullCard.id)) {
            this.memoryCache.set(fullCard.id, fullCard);
          }
        }
        // Save batch to IndexedDB non-blocking
        storage.set(CACHED_CARDS_KEY, Array.from(this.memoryCache.values())).catch(() => {});
      } catch {
        // Offline or API error, gracefully fall back to local cache
      }
    }

    // Filter across all locally known / cached cards
    const results = Array.from(this.memoryCache.values()).filter((c) => {
      // If category filter is provided, restrict to that category
      if (filters.category && c.category !== filters.category) return false;

      if (filters.type && filters.type !== 'all') {
        const needle = filters.type.toLowerCase();
        if (!c.types?.some((t) => t.toLowerCase() === needle)) return false;
      }
      if (filters.rarity && filters.rarity !== 'all') {
        if (c.rarity.toLowerCase() !== filters.rarity.toLowerCase()) return false;
      }
      if (filters.query && !matchesQuery(c, filters.query)) return false;
      return true;
    });

    return results;
  }
}

export const catalogService: CatalogService = new HybridCatalogService();
