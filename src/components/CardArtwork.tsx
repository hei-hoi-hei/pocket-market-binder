import type { Card } from '@/types';
import { ENERGY_STYLES, seedGradient } from '@/utils/format';

interface Props {
  card: Card;
  className?: string;
  /** When true, the artwork fills the frame without the frame chrome. */
  bare?: boolean;
}

/**
 * Original placeholder card artwork — no copyrighted Pokémon assets.
 * Generates a deterministic geometric "creature silhouette" from the card's
 * art seed plus energy-type gradient. Gives each card a recognizable but
 * non-infringing visual identity.
 */
export function CardArtwork({ card, className = '', bare = false }: Props) {
  const style = ENERGY_STYLES[card.energyType];
  const [c1, c2] = seedGradient(card.artSeed);

  // Deterministic silhouette shape from seed
  const blob = (n: number) => {
    const r = 26 + ((card.artSeed * (n + 1)) % 18);
    const cx = 32 + ((card.artSeed * (n + 3)) % 36);
    const cy = 30 + ((card.artSeed * (n + 5)) % 40);
    return { r, cx, cy };
  };
  const shapes = [blob(0), blob(1), blob(2)];

  const svg = (
    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`bg-${card.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
        <radialGradient id={`hl-${card.id}`} cx="0.35" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#bg-${card.id})`} />
      {/* Energy-type tint overlay */}
      <rect width="100" height="100" fill="currentColor" opacity="0.12" />
      {/* Creature silhouette */}
      <g opacity="0.88">
        {shapes.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="rgba(255,255,255,0.85)" />
        ))}
        {/* Eye dots */}
        <circle cx={38} cy={34} r={3.5} fill="rgba(28,58,58,0.85)" />
        <circle cx={52} cy={34} r={3.5} fill="rgba(28,58,58,0.85)" />
      </g>
      <rect width="100" height="100" fill={`url(#hl-${card.id})`} />
      {/* Energy-type symbol in corner */}
      <g transform="translate(82, 10)">
        <circle r="8" fill="rgba(255,255,255,0.85)" />
        <text x="0" y="3" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor" className={style.text}>
          {style.label[0]}
        </text>
      </g>
    </svg>
  );

  if (bare) {
    return <div className={className} style={{ color: c2 }}>{svg}</div>;
  }

  return (
    <div className={`card-frame ${className}`} style={{ color: c2 }}>
      {svg}
    </div>
  );
}
