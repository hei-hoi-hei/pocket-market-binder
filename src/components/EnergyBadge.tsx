import { getCardTypeStyle } from '@/utils/format';

interface Props {
  type: string;
  size?: 'sm' | 'md';
}

/** Small circular energy-type token. */
export function EnergyBadge({ type, size = 'md' }: Props) {
  const style = getCardTypeStyle({ category: 'pokemon', types: [type] });
  const dims = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs';

  return (
    <span
      className={`${dims} ${style.bg} ${style.text} rounded-full inline-flex items-center justify-center font-bold ${style.glow}`}
      title={style.label}
    >
      {style.label[0]}
    </span>
  );
}

