import { Coins } from 'lucide-react';
import type { CollectionStats } from '@/types';
import { formatPrice } from '@/utils/format';
import { StatCard } from './StatCard';

export function CollectionValueStat({ stats }: { stats: CollectionStats }) {
  const binderItems = stats.pricedItems + stats.unpricedItems;
  const empty = !stats.pricingPending && binderItems === 0;
  const value = stats.pricingPending
    ? 'Checking...'
    : stats.collectionValue === null
      ? 'Unavailable'
      : formatPrice(stats.collectionValue);
  const coverage = stats.pricingPending
    ? 'Checking Market References'
    : empty
      ? 'No cards'
      : `${stats.pricedItems} of ${binderItems} cards priced`;

  return (
    <StatCard
      label={empty ? 'Value' : 'Priced value'}
      value={value}
      icon={Coins}
      accent="text-gold-500"
      sub={coverage}
    />
  );
}