import type { Card, EnergyType, Rarity } from '@/types';
import { MOCK_CATALOG } from '@/data/mockCatalog';

/**
 * Catalog service.
 *
 * Today it reads from a local mock array. The interface is shaped so that an
 * external card/pricing provider can be dropped in later (the methods would
 * become async without changing call-site signatures beyond `await`).
 */

const byId = new Map<string, Card>(MOCK_CATALOG.map((c) => [c.id, c]));

export interface CatalogFilters {
  query?: string;
  energyType?: EnergyType | 'all';
  rarity?: Rarity | 'all';
}

export interface CatalogService {
  getAll(): Card[];
  getById(id: string): Card | undefined;
  search(filters: CatalogFilters): Card[];
}

function matchesQuery(card: Card, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    card.name.toLowerCase().includes(needle) ||
    card.genus.toLowerCase().includes(needle) ||
    card.energyType.includes(needle) ||
    card.rarity.includes(needle) ||
    `${card.setCode}-${card.setNumber}`.toLowerCase().includes(needle)
  );
}

class MockCatalogService implements CatalogService {
  getAll(): Card[] {
    return MOCK_CATALOG;
  }

  getById(id: string): Card | undefined {
    return byId.get(id);
  }

  search(filters: CatalogFilters): Card[] {
    return MOCK_CATALOG.filter((c) => {
      if (filters.energyType && filters.energyType !== 'all' && c.energyType !== filters.energyType) return false;
      if (filters.rarity && filters.rarity !== 'all' && c.rarity !== filters.rarity) return false;
      if (filters.query && !matchesQuery(c, filters.query)) return false;
      return true;
    });
  }
}

export const catalogService: CatalogService = new MockCatalogService();
