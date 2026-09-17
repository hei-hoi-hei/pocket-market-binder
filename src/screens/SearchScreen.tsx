import { useMemo, useState } from 'react';
import { Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react';
import type { EnergyType, Rarity } from '@/types';
import { catalogService } from '@/services/catalogService';
import type { CatalogFilters } from '@/services/catalogService';
import { CardGrid } from '@/components/CardGrid';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ENERGY_STYLES, RARITY_STYLES, rarityLabel } from '@/utils/format';

const ENERGY_OPTIONS: (EnergyType | 'all')[] = ['all', 'fire', 'water', 'grass', 'electric', 'psychic', 'dark', 'steel', 'dragon'];
const RARITY_OPTIONS: (Rarity | 'all')[] = ['all', 'common', 'uncommon', 'rare', 'holo', 'ultra'];

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const [energy, setEnergy] = useState<EnergyType | 'all'>('all');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const results = useMemo(() => {
    const filters: CatalogFilters = { query, energyType: energy, rarity };
    return catalogService.search(filters);
  }, [query, energy, rarity]);

  const hasActiveFilters = energy !== 'all' || rarity !== 'all';
  const clearFilters = () => { setEnergy('all'); setRarity('all'); };

  return (
    <div className="animate-fade-in">
      <ScreenHeader title="Search" icon={<SearchIcon className="w-7 h-7 text-leather-600" />}>
        <p className="text-sm text-leather-500">Browse the mock card catalog.</p>
      </ScreenHeader>

      {/* Search bar */}
      <div className="relative mb-3">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-leather-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, genus, type, or set number..."
          className="w-full bg-white border-2 border-parchment-300 rounded-xl pl-10 pr-10 py-3 text-sm font-medium text-leather-800 placeholder:text-leather-400 focus:border-gold-400 focus:outline-none transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-leather-400 hover:text-leather-600"
            aria-label="Clear search"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Filter toggle */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            showFilters || hasActiveFilters ? 'bg-leather-600 text-white' : 'bg-parchment-200 text-leather-700'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-gold-400" />}
        </button>
        <span className="text-xs font-semibold text-leather-500">{results.length} result{results.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white rounded-xl p-3 shadow-sm border border-parchment-200 mb-4 animate-scale-in space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-leather-500 mb-1.5">Energy Type</p>
            <div className="flex gap-1.5 flex-wrap">
              {ENERGY_OPTIONS.map((et) => {
                const isAll = et === 'all';
                const style = !isAll ? ENERGY_STYLES[et] : null;
    const active = energy === et;
    return (
      <button
        key={et}
        onClick={() => setEnergy(et)}
        className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize transition-all active:scale-95 ${
          active
            ? isAll
              ? 'bg-leather-700 text-white'
              : `${style!.bg} ${style!.text} ring-2 ring-offset-1 ring-leather-400`
            : 'bg-parchment-200 text-leather-600 hover:bg-parchment-300'
        }`}
      >
        {isAll ? 'All' : style!.label}
      </button>
    );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-leather-500 mb-1.5">Rarity</p>
            <div className="flex gap-1.5 flex-wrap">
              {RARITY_OPTIONS.map((r) => {
                const isAll = r === 'all';
                const style = !isAll ? RARITY_STYLES[r] : null;
    const active = rarity === r;
    return (
      <button
        key={r}
        onClick={() => setRarity(r)}
        className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all active:scale-95 ${
          active
            ? isAll
              ? 'bg-leather-700 text-white'
              : `${style!.badge} ring-2 ring-offset-1 ring-leather-400`
            : 'bg-parchment-200 text-leather-600 hover:bg-parchment-300'
        }`}
      >
        {isAll ? 'All' : rarityLabel(r)}
      </button>
    );
              })}
            </div>
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs font-semibold text-fire-500 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      )}

      <CardGrid cards={results} showOwned showWishlist emptyMessage="No cards match your search." />
    </div>
  );
}
