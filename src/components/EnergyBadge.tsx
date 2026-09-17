import type { EnergyType } from '@/types';
import { ENERGY_STYLES } from '@/utils/format';

const ENERGY_SYMBOLS: Record<EnergyType, string> = {
  fire: 'R', water: 'W', grass: 'G', electric: 'L', psychic: 'P', dark: 'D', steel: 'S', dragon: 'N',
};

/** Small circular energy-type token. */
export function EnergyBadge({ type, size = 'md' }: { type: EnergyType; size?: 'sm' | 'md' }) {
  const style = ENERGY_STYLES[type];
  const dims = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs';
  return (
    <span
      className={`${dims} ${style.bg} ${style.text} rounded-full inline-flex items-center justify-center font-bold ${style.glow}`}
      title={style.label}
    >
      {ENERGY_SYMBOLS[type]}
    </span>
  );
}
