import { useState, useEffect } from 'react';
import { Heart, Search } from 'lucide-react';
import type { Card } from '@/types';
import type { PriceReference } from '@/services/providers/pricingProvider';
import { useCollection } from '@/context/CollectionContext';
import { useNav } from '@/context/NavContext';
import { catalogService } from '@/services/catalogService';
import { pricingService } from '@/services/pricingService';
import { CardGrid } from '@/components/CardGrid';
import { CollectionSortControl, type CollectionSortOption } from '@/components/CollectionSortControl';
import { ScreenHeader } from '@/components/ScreenHeader';
import { sortWishlistCards, type CollectionSortMode } from '@/utils/collectionSorting';

interface WishlistCard {
  card: Card;
  addedAt: number;
  marketPrice: number | null;
}

const WISHLIST_SORT_OPTIONS: CollectionSortOption[] = [
  { value: 'recently-added', label: 'Recently added' },
  { value: 'name-asc', label: 'Card name A → Z' },
  { value: 'name-desc', label: 'Card name Z → A' },
  { value: 'set-asc', label: 'Set A → Z' },
  { value: 'set-desc', label: 'Set Z → A' },
  { value: 'collector-number', label: 'Collector number' },
  { value: 'price-asc', label: 'Price: Low → High' },
  { value: 'price-desc', label: 'Price: High → Low' },
];

export function WishlistScreen() {
  const { wishlist } = useCollection();
  const { go } = useNav();
  const [cards, setCards] = useState<WishlistCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<CollectionSortMode>('name-asc');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const resolved = await Promise.all(wishlist.map(async (entry) => {
        const [card, priceReference] = await Promise.all([
          catalogService.getById(entry.cardId),
          pricingService.getCachedPriceReference(entry.cardId),
        ]);
        return card
          ? { card, addedAt: entry.addedAt, marketPrice: validPrice(priceReference) }
          : null;
      }));
      if (active) {
        setCards(resolved.filter((item): item is WishlistCard => item !== null));
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [wishlist]);

  const sortedCards = sortWishlistCards(cards, sortMode);
  const handleSortChange = (mode: CollectionSortMode) => {
    setSortMode(mode);
  };

  return (
    <div className="animate-fade-in">
      <ScreenHeader title="Wishlist" icon={<Heart className="w-7 h-7 text-psychic-500" />}>
        <p className="text-sm text-leather-500">Cards you're hunting for.</p>
      </ScreenHeader>

      {!loading && cards.length > 0 && (
        <div className="mb-3">
          <CollectionSortControl value={sortMode} options={WISHLIST_SORT_OPTIONS} onChange={handleSortChange} />
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-leather-500">Loading wishlist...</div>
      ) : sortedCards.length > 0 ? (
        <CardGrid cards={sortedCards.map(({ card }) => card)} showOwned showWishlist />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-psychic-400/20 flex items-center justify-center mb-3">
            <Heart className="w-8 h-8 text-psychic-400" />
          </div>
          <p className="text-leather-500 text-sm mb-3">Your wishlist is empty.</p>
          <button
            onClick={() => go('search')}
            className="bg-leather-600 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-leather-500 transition-colors active:scale-95"
          >
            <Search className="w-4 h-4" /> Browse Cards
          </button>
        </div>
      )}
    </div>
  );
}

function validPrice(reference: PriceReference | null): number | null {
  const value = reference?.referencePrice;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
