import { useState } from 'react';
import type { Card } from '@/types';
import { getCardTypeStyle, seedGradient } from '@/utils/format';
import { artworkService } from '@/services/artworkService';

interface Props {
  card: Card;
  className?: string;
  bare?: boolean;
  quality?: 'low' | 'high';
}

/**
 * Enhanced card artwork that displays real TCGdex images with a fallback
 * to the procedural silhouette if the image fails to load or is missing.
 */
export function CardArtwork({ card, className = '', bare = false, quality = 'low' }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const style = getCardTypeStyle(card);
  const seed = card.artSeed ?? (card.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
  const [c1, c2] = seedGradient(seed);

  // Deterministic silhouette shape for fallback
  const blob = (n: number) => {
    const r = 26 + ((seed * (n + 1)) % 18);
    const cx = 32 + ((seed * (n + 3)) % 36);
    const cy = 30 + ((seed * (n + 5)) % 40);
    return { r, cx, cy };
  };
  const shapes = [blob(0), blob(1), blob(2)];

  const placeholder = (
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
      <rect width="100" height="100" fill="currentColor" opacity="0.12" />
      <g opacity="0.88">
        {shapes.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="rgba(255,255,255,0.85)" />
        ))}
        <circle cx={38} cy={34} r={3.5} fill="rgba(28,58,58,0.85)" />
        <circle cx={52} cy={34} r={3.5} fill="rgba(28,58,58,0.85)" />
      </g>
      <rect width="100" height="100" fill={`url(#hl-${card.id})`} />
    </svg>
  );

  const imageUrl = artworkService.resolve(card, quality);

  const content = (imageUrl && !imageFailed) ? (
    <img
      src={imageUrl}
      alt={card.name}
      className="w-full h-full object-contain"
      onError={() => setImageFailed(true)}
      loading="lazy"
    />
  ) : (
    placeholder
  );

  if (bare) {
    return <div className={`overflow-hidden ${className}`} style={{ color: c2 }}>{content}</div>;
  }

  return (
    <div className={`card-frame bg-parchment-100 shadow-sm border border-parchment-200 overflow-hidden ${className}`} style={{ color: c2 }}>
      {content}
    </div>
  );
}


