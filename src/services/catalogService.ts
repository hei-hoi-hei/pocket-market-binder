import type { Card } from '@/types';
import { storage } from './storage';
import { MOCK_CATALOG } from '@/data/mockCatalog';
import { tcgdexProvider } from './providers/tcgdexProvider';

export interface CatalogFilters {
  query?: string;
  type?: string | 'all';
  rarity?: string | 'all';
}

export interface CatalogService {
  getAll(): Promise<Card[]>;
  getById(id: string): Promise<Card | undefined>;
  search(filters: CatalogFilters): Promise<Card[]>;
}

const CACHED_CARDS_KEY = 'cached_cards_store';

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

    // Seed memory cache with mock cards
    for (const card of MOCK_CATALOG) {
      this.memoryCache.set(card.id, card);
    }

    // Load previously cached cards from IndexedDB
    try {
      const persisted = await storage.get<Card[]>(CACHED_CARDS_KEY);
      if (persisted && Array.isArray(persisted)) {
        for (const card of persisted) {
          this.memoryCache.set(card.id, card);
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

  async getAll(): Promise<Card[]> {
    await this.ensureInitialized();
    return Array.from(this.memoryCache.values());
  }

  async getById(id: string): Promise<Card | undefined> {
    await this.ensureInitialized();

    // 1. Check in-memory / local storage first
    const cached = this.memoryCache.get(id);
    if (cached) return cached;

    // 2. Fetch full detail from TCGdex if available
    try {
      const remote = await tcgdexProvider.getCardById(id);
      if (remote) {
        await this.persistCard(remote);
        return remote;
      }
    } catch {
      // Remote fetch failed, fall back to offline cache
    }

    return undefined;
  }

  async search(filters: CatalogFilters): Promise<Card[]> {
    await this.ensureInitialized();

    // Attempt remote search if online and query exists
    if (navigator.onLine && filters.query && filters.query.trim().length >= 2) {
      try {
        const remoteCards = await tcgdexProvider.searchCards(filters.query);
        // Persist newly discovered cards
        for (const card of remoteCards) {
          if (!this.memoryCache.has(card.id)) {
            this.memoryCache.set(card.id, card);
          }
        }
        // Save batch to IndexedDB non-blocking
        storage.set(CACHED_CARDS_KEY, Array.from(this.memoryCache.values())).catch(() => {});
      } catch {
        // Offline or API error, gracefully fall back to local
      }
    }

    // Filter across all locally known / cached cards
    const results = Array.from(this.memoryCache.values()).filter((c) => {
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

