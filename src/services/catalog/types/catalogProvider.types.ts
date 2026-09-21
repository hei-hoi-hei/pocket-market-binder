export interface CatalogCard {
  id: string;
  name: string;
  set: string; // set code or name
  number: string;
  images: {
    low?: string;
    high?: string;
  };
  rarity: string;
  category: string;
  [key: string]: any;
}

export interface CatalogSet {
  id: string;
  name: string;
  series?: string;
  totalCards?: number;
  releaseDate?: string;
  symbolUrl?: string;
}

export interface ICatalogProvider {
  searchCards(query: string, filters?: Record<string, any>): Promise<CatalogCard[]>;
  getSets(): Promise<CatalogSet[]>;
  getCardById(id: string): Promise<CatalogCard | null>;
}
