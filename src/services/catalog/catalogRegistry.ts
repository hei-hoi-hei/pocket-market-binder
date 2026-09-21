import { ICatalogProvider } from './types/catalogProvider.types';
import { PokemonCatalogProvider } from './providers/pokemonCatalogProvider';

class CatalogRegistry {
  private providers = new Map<string, ICatalogProvider>();
  private defaultCategory = 'pokemon';

  constructor() {
    // Register default V1 provider
    this.register('pokemon', new PokemonCatalogProvider());
  }

  register(category: string, provider: ICatalogProvider) {
    this.providers.set(category.toLowerCase(), provider);
  }

  getProvider(category?: string): ICatalogProvider {
    const key = (category || this.defaultCategory).toLowerCase();
    const provider = this.providers.get(key);
    if (!provider) {
      // Fallback to default if not found
      return this.providers.get(this.defaultCategory)!;
    }
    return provider;
  }

  getAllCategories(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const catalogRegistry = new CatalogRegistry();
