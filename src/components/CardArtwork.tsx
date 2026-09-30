import { useEffect, useState } from 'react';
import type { Card } from '@/types';
import { seedGradient } from '@/utils/format';
import {
  artworkService,
  artworkResolutionState,
  isArtworkUrlFailed,
  type ArtworkResolution,
} from '@/services/artworkService';

interface Props {
  card: Card;
  className?: string;
  bare?: boolean;
  quality?: 'low' | 'high';
}

const NO_EXCLUDED_IMAGE_URLS: string[] = [];

/**
 * Enhanced card artwork that displays real TCGdex images with a fallback
 * to the procedural silhouette if the image fails to load or is missing.
 */
export function CardArtwork({ card, className = '', bare = false, quality = 'low' }: Props) {
  const [resolutionState, setResolutionState] = useState<{
    requestKey: string;
    resolution: ArtworkResolution | null;
    excludedImageUrls: string[];
  }>({ requestKey: '', resolution: null, excludedImageUrls: [] });
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const requestKey = JSON.stringify([
    card.id,
    card.identity,
    card.catalogArtwork,
    card.imageUrlLow,
    card.imageUrlHigh,
    quality,
  ]);
  const hasCurrentRequest = resolutionState.requestKey === requestKey;
  const excludedImageUrls = hasCurrentRequest ? resolutionState.excludedImageUrls : NO_EXCLUDED_IMAGE_URLS;
  const excludedImageUrlsKey = excludedImageUrls.join('|');
  const resolution = hasCurrentRequest ? resolutionState.resolution : null;
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

  useEffect(() => {
    if (!hasCurrentRequest) {
      setResolutionState({ requestKey, resolution: null, excludedImageUrls: [] });
      return;
    }

    let active = true;
    void artworkService.resolve(card, quality, excludedImageUrls).then((result) => {
      if (active) {
        setResolutionState((current) => current.requestKey === requestKey
          ? { ...current, resolution: result }
          : current);
      }
    });

    return () => {
      active = false;
    };
  }, [card, excludedImageUrls, excludedImageUrlsKey, hasCurrentRequest, quality, requestKey]);

  const imageUrl = resolution?.status === 'available' ? resolution.imageUrl : null;
  const artworkState = artworkResolutionState(resolution);
  const imageFailed = isArtworkUrlFailed(failedUrl, imageUrl);
  const showArtwork = Boolean(imageUrl && !imageFailed);
  const handleImageError = () => {
    if (!resolution || resolution.status !== 'available' || !imageUrl) return;
    setFailedUrl(imageUrl);
    setResolutionState((current) => current.requestKey === requestKey
      ? {
          ...current,
          resolution: null,
          excludedImageUrls: [...current.excludedImageUrls, imageUrl],
        }
      : current);
  };

  const content = showArtwork && imageUrl ? (
    <img
      key={`${resolution?.status === 'available' ? resolution.source : ''}:${imageUrl}`}
      src={imageUrl}
      alt={card.name}
      className="w-full h-full object-contain"
      onError={handleImageError}
      loading="lazy"
    />
  ) : (
    <div data-artwork-kind="ui-placeholder" className="h-full w-full">
      {placeholder}
    </div>
  );

  if (bare) {
    return (
      <div
        data-artwork-state={artworkState}
        className={`overflow-hidden ${className}`}
        style={{ color: c2 }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      data-artwork-state={artworkState}
      className={`card-frame bg-parchment-100 shadow-sm border border-parchment-200 overflow-hidden ${className}`}
      style={{ color: c2 }}
    >
      {content}
    </div>
  );
}
