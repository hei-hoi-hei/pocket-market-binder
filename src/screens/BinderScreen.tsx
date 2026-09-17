import { BookOpen, Layers, Coins } from 'lucide-react';
import { useCollection } from '@/context/CollectionContext';
import { CardGrid } from '@/components/CardGrid';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatCard } from '@/components/StatCard';
import { formatPrice } from '@/utils/format';

export function BinderScreen() {
  const { ownedCards, stats, loading } = useCollection();
  const cards = ownedCards.map((o) => o.card);

  return (
    <div className="animate-fade-in">
      <ScreenHeader
        title="My Binder"
        icon={<BookOpen className="w-7 h-7 text-leather-600" />}
      >
        <p className="text-sm text-leather-500">Your collection laid out like binder pages.</p>
      </ScreenHeader>

      {stats && stats.totalCards > 0 && (
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <StatCard label="Unique" value={stats.uniqueCards} icon={Layers} accent="text-water-500" />
          <StatCard label="Total" value={stats.totalCards} icon={BookOpen} accent="text-grass-500" />
          <StatCard label="Value" value={formatPrice(stats.collectionValue)} icon={Coins} accent="text-gold-500" sub="Reference" />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-parchment-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <CardGrid
          cards={cards}
          showOwned
          showWishlist
          emptyMessage="Your binder is empty. Browse cards and add some to start your collection."
        />
      )}
    </div>
  );
}
