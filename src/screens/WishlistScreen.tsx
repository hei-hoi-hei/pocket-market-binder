import { Heart, Search } from 'lucide-react';
import { useCollection } from '@/context/CollectionContext';
import { useNav } from '@/context/NavContext';
import { catalogService } from '@/services/catalogService';
import { CardGrid } from '@/components/CardGrid';
import { ScreenHeader } from '@/components/ScreenHeader';

export function WishlistScreen() {
  const { wishlist } = useCollection();
  const { go } = useNav();
  const cards = wishlist
    .map((e) => catalogService.getById(e.cardId))
    .filter((c): c is NonNullable<typeof c> => c !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="animate-fade-in">
      <ScreenHeader title="Wishlist" icon={<Heart className="w-7 h-7 text-psychic-500" />}>
        <p className="text-sm text-leather-500">Cards you're hunting for.</p>
      </ScreenHeader>

      {cards.length > 0 ? (
        <CardGrid cards={cards} showOwned showWishlist />
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
