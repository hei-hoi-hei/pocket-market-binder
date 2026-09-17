import { Sparkles, BookOpen, Search, Heart, ShoppingCart, TrendingUp, Layers, Coins } from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { useCollection } from '@/context/CollectionContext';
import { catalogService } from '@/services/catalogService';
import { CardThumb } from '@/components/CardThumb';
import { StatCard } from '@/components/StatCard';
import { formatPrice, ENERGY_STYLES } from '@/utils/format';
import type { EnergyType } from '@/types';

export function HomeScreen() {
  const { go } = useNav();
  const { stats, ownedCards } = useCollection();
  const featured = catalogService.getAll().slice(0, 6);
  const recent = ownedCards.slice(-4).reverse();

  return (
    <div className="animate-fade-in space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-leather-700 via-leather-600 to-leather-800 p-5 text-white shadow-card">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gold-500/20 blur-2xl" />
        <div className="absolute -left-6 -bottom-10 w-28 h-28 rounded-full bg-water-500/15 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-gold-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-gold-400">Pocket Market Binder</span>
          </div>
          <h2 className="font-display text-3xl leading-tight mb-1">Your Card Collection</h2>
          <p className="text-sm text-parchment-200 mb-4">Browse, collect, and track your TCG cards in a digital binder.</p>
          <div className="flex gap-2">
            <button
              onClick={() => go('search')}
              className="bg-gold-400 text-leather-800 font-bold text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-gold-500 transition-colors active:scale-95"
            >
              <Search className="w-4 h-4" /> Browse Cards
            </button>
            <button
              onClick={() => go('binder')}
              className="bg-leather-800/40 border border-parchment-300/30 text-white font-bold text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-leather-800/60 transition-colors active:scale-95"
            >
              <BookOpen className="w-4 h-4" /> My Binder
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      {stats && (
        <section>
          <h3 className="text-sm font-bold uppercase tracking-wide text-leather-500 mb-2">Collection at a Glance</h3>
          <div className="grid grid-cols-3 gap-2.5">
            <StatCard label="Unique" value={stats.uniqueCards} icon={Layers} accent="text-water-500" />
            <StatCard label="Total" value={stats.totalCards} icon={BookOpen} accent="text-grass-500" />
            <StatCard label="Value" value={formatPrice(stats.collectionValue)} icon={Coins} accent="text-gold-500" sub="Reference" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
            <StatCard label="Wishlist" value={stats.wishlistCount} icon={Heart} accent="text-psychic-500" />
            <StatCard label="In Cart" value={stats.cartCount} icon={ShoppingCart} accent="text-fire-500" />
          </div>
        </section>
      )}

      {/* Rarity breakdown */}
      {stats && stats.totalCards > 0 && (
        <section className="bg-white rounded-xl p-4 shadow-sm border border-parchment-200">
          <h3 className="text-sm font-bold uppercase tracking-wide text-leather-500 mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> By Rarity
          </h3>
          <div className="space-y-2">
            {(['common', 'uncommon', 'rare', 'holo', 'ultra'] as const).map((r) => {
              const count = stats.byRarity[r] ?? 0;
              const pct = stats.totalCards > 0 ? (count / stats.totalCards) * 100 : 0;
              const colors: Record<string, string> = {
                common: 'bg-parchment-300', uncommon: 'bg-grass-400', rare: 'bg-water-400',
                holo: 'bg-gradient-to-r from-gold-400 to-psychic-400', ultra: 'bg-gradient-to-r from-dragon-500 to-gold-500',
              };
              return (
                <div key={r} className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-leather-600 capitalize w-20">{r}</span>
                  <div className="flex-1 h-2.5 bg-parchment-200 rounded-full overflow-hidden">
                    <div className={`h-full ${colors[r]} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-leather-700 w-6 text-right tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recently added */}
      {recent.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-leather-500">Recently Added</h3>
            <button onClick={() => go('binder')} className="text-xs font-semibold text-gold-600 hover:underline">View all</button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {recent.map(({ card }) => (
              <CardThumb key={card.id} card={card} showWishlist />
            ))}
          </div>
        </section>
      )}

      {/* Featured catalog */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-leather-500">Featured Cards</h3>
          <button onClick={() => go('search')} className="text-xs font-semibold text-gold-600 hover:underline">Browse all</button>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
          {featured.map((card) => (
            <div key={card.id} className="flex-shrink-0 w-32">
              <CardThumb card={card} showWishlist />
            </div>
          ))}
        </div>
      </section>

      {/* Energy type quick filter */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-wide text-leather-500 mb-2">Explore by Energy</h3>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(ENERGY_STYLES) as EnergyType[]).map((et) => {
            const style = ENERGY_STYLES[et];
            return (
              <button
                key={et}
                onClick={() => go('search')}
                className={`${style.bg} ${style.text} px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 hover:scale-105 transition-transform active:scale-95`}
              >
                {style.label}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
