import { Minus, Plus } from 'lucide-react';

interface Props {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  label?: string;
}

/** A compact +/- stepper with a quantity readout. */
export function QuantityStepper({
  value,
  onDecrease,
  onIncrease,
  min = 0,
  max = 99,
  size = 'md',
  label,
}: Props) {
  const btn = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const icon = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const canDec = value > min;
  const canInc = value < max;

  return (
    <div className="inline-flex items-center gap-2">
      {label && <span className="text-xs font-semibold text-leather-500 mr-1">{label}</span>}
      <button
        type="button"
        onClick={onDecrease}
        disabled={!canDec}
        className={`${btn} rounded-full bg-parchment-200 text-leather-700 flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:active:scale-100 hover:bg-parchment-300`}
        aria-label="Decrease quantity"
      >
        <Minus className={icon} />
      </button>
      <span className={`font-display tabular-nums text-leather-800 ${size === 'sm' ? 'text-lg' : 'text-xl'} min-w-[1.5em] text-center`}>
        {value}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        disabled={!canInc}
        className={`${btn} rounded-full bg-leather-600 text-white flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:active:scale-100 hover:bg-leather-500`}
        aria-label="Increase quantity"
      >
        <Plus className={icon} />
      </button>
    </div>
  );
}
