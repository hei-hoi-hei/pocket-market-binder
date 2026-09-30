import type { CanonicalCardIdentity, Card, CatalogArtworkReference } from '@/types';

export type ArtworkQuality = 'low' | 'high';
export type ArtworkRole = 'primary' | 'fallback';
export type ArtworkVerificationStatus = 'exact' | 'partial' | 'unresolved' | 'rejected';
export type ArtworkUsageStatus = 'eligible' | 'unresolved' | 'ineligible';
export type ArtworkSourceType = 'catalog-artwork';

export interface ArtworkProvenance {
  attribution?: string;
}

export interface ArtworkVerification {
  status: ArtworkVerificationStatus;
  evidence?: string;
}

export interface ArtworkUsageEligibility {
  status: ArtworkUsageStatus;
  evidence?: string;
}

export interface ArtworkQualityInfo {
  width?: number;
  height?: number;
  urlStability?: 'verified-stable' | 'unknown';
}

export interface ArtworkProviderInput {
  identity: CanonicalCardIdentity;
  quality: ArtworkQuality;
  excludedImageUrls: string[];
  catalogArtwork?: CatalogArtworkReference;
}

export interface ArtworkProviderCandidate {
  imageUrl: string;
  sourceCardId?: string;
  matchedIdentity?: CanonicalCardIdentity;
  sourceUrl?: string;
  cachedImageUrl?: string;
  sourceType?: ArtworkSourceType;
  resolution?: ArtworkQuality;
  language?: string;
  variant?: string;
  retrievedAt?: number;
  confidence?: number;
  provenance?: ArtworkProvenance;
  verification?: ArtworkVerification;
  usageEligibility?: ArtworkUsageEligibility;
  quality?: ArtworkQualityInfo;
}

export type ArtworkProviderResult =
  | ({ status: 'available' } & ArtworkProviderCandidate)
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; message: string };

export interface ArtworkProvider {
  readonly source: string;
  readonly allowUnresolvedUsage?: boolean;
  resolve(input: ArtworkProviderInput): Promise<unknown>;
}

export interface ArtworkProviderRegistration {
  provider: ArtworkProvider;
  role: ArtworkRole;
  priority: number;
}

export interface ArtworkCandidate extends ArtworkProviderCandidate {
  source: string;
  requestedIdentity: CanonicalCardIdentity;
  resolvedAt: number;
  role: ArtworkRole;
  sourceType: ArtworkSourceType;
  verification: ArtworkVerification;
  usageEligibility: ArtworkUsageEligibility;
  unresolvedUsageAllowed: boolean;
}

export interface ArtworkAttempt {
  source: string;
  status: 'available' | 'unavailable' | 'excluded' | 'malformed' | 'error';
  message?: string;
}

export type ArtworkResolution =
  | {
      status: 'available';
      imageUrl: string;
      source: string;
      resolvedAt: number;
      role: ArtworkRole;
      candidate: ArtworkCandidate;
      verification: ArtworkVerification;
      usageEligibility: ArtworkUsageEligibility;
      candidates: ArtworkCandidate[];
      attempts: ArtworkAttempt[];
    }
  | {
      status: 'unavailable';
      reason: string;
      candidates: ArtworkCandidate[];
      attempts: ArtworkAttempt[];
    }
  | {
      status: 'error';
      message: string;
      candidates: ArtworkCandidate[];
      attempts: ArtworkAttempt[];
    };

export type ArtworkResolutionState = ArtworkResolution['status'] | 'loading';

export function artworkResolutionState(resolution: ArtworkResolution | null): ArtworkResolutionState {
    return resolution?.status ?? 'loading';
}

export interface ArtworkResolver {
  resolve(
    card: Card,
    quality: ArtworkQuality,
    excludedImageUrls?: string[],
  ): Promise<ArtworkResolution>;
}

function canonicalIdentity(card: Card): CanonicalCardIdentity {
  const identity = card.identity ?? {};
  const usable = (value: string | undefined): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;
  const provider = usable(card.catalogArtwork?.provider);
  const providerCardId = usable(card.catalogArtwork?.providerCardId);
  const providerIds = identity.providerIds ? { ...identity.providerIds } : {};
  if (provider && providerCardId) {
    const ids = providerIds[provider] ?? [];
    providerIds[provider] = ids.includes(providerCardId) ? [...ids] : [...ids, providerCardId];
  }
  return {
    ...identity,
    setId: usable(identity.setId) ?? usable(card.setCode),
    setName: usable(identity.setName) ?? usable(card.setName),
    cardNumber: usable(identity.cardNumber) ?? usable(card.setNumber),
    name: usable(identity.name) ?? usable(card.name),
    printing: usable(identity.printing),
    variant: usable(identity.variant),
    language: usable(identity.language),
    rarity: identity.rarity ?? card.rarity,
    variants: identity.variants ?? (card.variants ? { ...card.variants } : undefined),
    providerIds: Object.keys(providerIds).length > 0 ? providerIds : undefined,
  };
}

function copyIdentity(identity: CanonicalCardIdentity): CanonicalCardIdentity {
  const legacyTcgdexId = Reflect.get(identity, 'tcgdexId');
  const copied: CanonicalCardIdentity = {
    ...identity,
    variants: identity.variants ? { ...identity.variants } : undefined,
    providerIds: identity.providerIds
      ? Object.fromEntries(
          Object.entries(identity.providerIds).map(([provider, ids]) => [provider, ids ? [...ids] : undefined]),
        )
      : undefined,
  };
  Reflect.deleteProperty(copied, 'tcgdexId');
  Reflect.deleteProperty(copied, 'imageUrl');
  if (typeof legacyTcgdexId === 'string' && legacyTcgdexId.trim()) {
    const tcgdexIds = copied.providerIds?.tcgdex ?? [];
    if (!tcgdexIds.includes(legacyTcgdexId.trim())) {
      copied.providerIds = {
        ...copied.providerIds,
        tcgdex: [...tcgdexIds, legacyTcgdexId.trim()],
      };
    }

  }
  return copied;
}

function conflictingIdentityFields(
  requested: CanonicalCardIdentity,
  matched: CanonicalCardIdentity,
): string[] {
  const fields: Array<keyof CanonicalCardIdentity> = [
    'setId',
    'setName',
    'cardNumber',
    'name',
    'printing',
    'variant',
    'language',
    'rarity',
  ];
  const fieldConflicts = fields.filter((field) => {
    const requestedValue = requested[field];
    const matchedValue = matched[field];
    return typeof requestedValue === 'string' && requestedValue.trim()
      && typeof matchedValue === 'string' && matchedValue.trim()
      && requestedValue.trim().toLocaleLowerCase() !== matchedValue.trim().toLocaleLowerCase();
  }).map(String).concat(
    requested.variants && matched.variants
      ? (Object.keys(requested.variants) as Array<keyof NonNullable<CanonicalCardIdentity['variants']>>)
        .filter((variant) => requested.variants?.[variant] !== undefined
          && matched.variants?.[variant] !== undefined
          && requested.variants[variant] !== matched.variants[variant])
        .map((variant) => `variants.${variant}`)
      : [],
  );
  const providerIdConflicts = Object.entries(requested.providerIds ?? {})
    .flatMap(([provider, requestedIds]) => {
      const matchedIds = matched.providerIds?.[provider];
      if (!requestedIds?.length || !matchedIds?.length
        || requestedIds.some((id) => matchedIds.includes(id))) return [];
      return [`providerIds.${provider}`];
    });
  return [...fieldConflicts, ...providerIdConflicts];
}

function normalizeMatchedIdentity(value: unknown): CanonicalCardIdentity | null {
  if (!isRecord(value)) return null;
  const textFields = ['setId', 'setName', 'cardNumber', 'name', 'printing', 'variant', 'language'] as const;
  for (const field of textFields) {
    if (value[field] !== undefined && (typeof value[field] !== 'string' || !value[field].trim())) return null;
  }
  const rarities = ['common', 'uncommon', 'rare', 'holo', 'ultra', 'secret', 'other'];
  if (value.rarity !== undefined && !rarities.includes(value.rarity as string)) return null;

  let variants: CanonicalCardIdentity['variants'];
  if (value.variants !== undefined) {
    if (!isRecord(value.variants)
      || Object.values(value.variants).some((enabled) => typeof enabled !== 'boolean')) return null;
    variants = {
      normal: value.variants.normal as boolean | undefined,
      reverse: value.variants.reverse as boolean | undefined,
      holo: value.variants.holo as boolean | undefined,
      firstEdition: value.variants.firstEdition as boolean | undefined,
    };
  }

  let providerIds: CanonicalCardIdentity['providerIds'];
  if (value.providerIds !== undefined) {
    if (!isRecord(value.providerIds)
      || Object.values(value.providerIds).some((ids) =>
        ids !== undefined && (!Array.isArray(ids)
          || ids.some((id) => typeof id !== 'string' || !id.trim())))) return null;
    providerIds = Object.fromEntries(
      Object.entries(value.providerIds).map(([provider, ids]) => [
        provider,
        ids === undefined ? undefined : [...ids as string[]],
      ]),
    );
  }
  return {
    ...Object.fromEntries(textFields.map((field) => [field, value[field]])),
    rarity: value.rarity as CanonicalCardIdentity['rarity'],
    variants,
    providerIds,
  };
}

function isUsableArtworkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function isKnownPlaceholderArtworkUrl(value: string): boolean {
  return /(?:^|[/_-])(?:placeholder|no[-_]?image|default[-_]?image)(?:[/_.-]|$)/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeVerification(value: unknown): ArtworkVerification | null {
  if (value === undefined) return { status: 'unresolved' };
  if (!isRecord(value)) return null;
  const allowedStatuses: ArtworkVerificationStatus[] = ['exact', 'partial', 'unresolved', 'rejected'];
  if (!allowedStatuses.includes(value.status as ArtworkVerificationStatus)) return null;
  if (value.evidence !== undefined && typeof value.evidence !== 'string') return null;
  const evidence = typeof value.evidence === 'string' ? value.evidence.trim() : undefined;
  if (value.status === 'exact' && !evidence) return { status: 'unresolved' };
  return { status: value.status as ArtworkVerificationStatus, evidence };
}

function normalizeUsageEligibility(value: unknown): ArtworkUsageEligibility | null {
  if (value === undefined) return { status: 'unresolved' };
  if (!isRecord(value)) return null;
  const allowedStatuses: ArtworkUsageStatus[] = ['eligible', 'unresolved', 'ineligible'];
  if (!allowedStatuses.includes(value.status as ArtworkUsageStatus)) return null;
  if (value.evidence !== undefined && typeof value.evidence !== 'string') return null;
  const evidence = typeof value.evidence === 'string' ? value.evidence.trim() : undefined;
  if (value.status === 'eligible' && !evidence) return { status: 'unresolved' };
  return { status: value.status as ArtworkUsageStatus, evidence };
}

function normalizeQuality(value: unknown): ArtworkQualityInfo | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  for (const dimension of ['width', 'height'] as const) {
    if (value[dimension] !== undefined
      && (typeof value[dimension] !== 'number' || !Number.isFinite(value[dimension]) || value[dimension] <= 0)) {
      return null;
    }
  }
  if (value.urlStability !== undefined
    && value.urlStability !== 'verified-stable'
    && value.urlStability !== 'unknown') {
    return null;
  }
  return {
    width: value.width as number | undefined,
    height: value.height as number | undefined,
    urlStability: value.urlStability as ArtworkQualityInfo['urlStability'],
  };
}

function normalizeOptionalText(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim();
}

function normalizeProvenance(value: unknown): ArtworkProvenance | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  const attribution = normalizeOptionalText(value.attribution);
  return attribution === null ? null : { ...(attribution ? { attribution } : {}) };
}

function normalizeCandidate(
  value: unknown,
  provider: ArtworkProvider,
  requestedIdentity: CanonicalCardIdentity,
  role: ArtworkRole,
  unresolvedUsageAllowed: boolean,
  resolvedAt: number,
): ArtworkCandidate | null {
  if (!isRecord(value)
    || typeof value.imageUrl !== 'string'
    || !isUsableArtworkUrl(value.imageUrl)
    || typeof provider.source !== 'string'
    || !provider.source.trim()) {
    return null;
  }
  if (value.sourceCardId !== undefined
    && (typeof value.sourceCardId !== 'string' || !value.sourceCardId.trim())) {
    return null;
  }
  const sourceUrl = normalizeOptionalText(value.sourceUrl);
  const cachedImageUrl = normalizeOptionalText(value.cachedImageUrl);
  const language = normalizeOptionalText(value.language);
  const variant = normalizeOptionalText(value.variant);
  const provenance = normalizeProvenance(value.provenance);
  if (sourceUrl === null || cachedImageUrl === null || language === null || variant === null
    || provenance === null
    || (sourceUrl !== undefined && !isUsableArtworkUrl(sourceUrl))
    || (cachedImageUrl !== undefined && !isUsableArtworkUrl(cachedImageUrl))
    || (value.sourceType !== undefined && value.sourceType !== 'catalog-artwork')
    || (value.resolution !== undefined && value.resolution !== 'low' && value.resolution !== 'high')
    || (value.retrievedAt !== undefined
      && (typeof value.retrievedAt !== 'number' || !Number.isFinite(value.retrievedAt) || value.retrievedAt <= 0))
    || (value.confidence !== undefined
      && (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence)
        || value.confidence < 0 || value.confidence > 1))) {
    return null;
  }

  const verification = normalizeVerification(value.verification);
  const usageEligibility = normalizeUsageEligibility(value.usageEligibility);
  const quality = normalizeQuality(value.quality);
  if (!verification || !usageEligibility || quality === null) return null;
  const matchedIdentity = value.matchedIdentity === undefined
    ? undefined
    : normalizeMatchedIdentity(value.matchedIdentity);
  if (matchedIdentity === null) return null;
  const identityConflicts = matchedIdentity
    ? conflictingIdentityFields(requestedIdentity, matchedIdentity)
    : [];
  const finalVerification = identityConflicts.length > 0
    ? { status: 'rejected' as const, evidence: `Artwork printing metadata conflicts for ${identityConflicts.join(', ')}.` }
    : verification;

  return {
    imageUrl: value.imageUrl,
    sourceCardId: value.sourceCardId as string | undefined,
    sourceUrl,
    cachedImageUrl,
    sourceType: 'catalog-artwork',
    resolution: value.resolution as ArtworkQuality | undefined,
    language,
    variant,
    retrievedAt: value.retrievedAt as number | undefined,
    confidence: value.confidence as number | undefined,
    provenance,
    matchedIdentity,
    source: provider.source.trim(),
    requestedIdentity: copyIdentity(requestedIdentity),
    resolvedAt,
    role,
    unresolvedUsageAllowed,
    verification: finalVerification,
    usageEligibility,
    quality,
  };
}

export class ProviderArtworkResolver implements ArtworkResolver {
  constructor(private readonly registrations: readonly ArtworkProviderRegistration[]) {}

  async resolve(
    card: Card,
    quality: ArtworkQuality,
    excludedImageUrls: string[] = [],
  ): Promise<ArtworkResolution> {
    const identity = canonicalIdentity(card);
    const attempts: ArtworkAttempt[] = [];
    const candidates: ArtworkCandidate[] = [];
    const invalidRegistration = this.validateRegistrations();
    if (invalidRegistration) {
      return {
        status: 'error',
        message: invalidRegistration,
        candidates,
        attempts: this.registrations.map((registration) => ({
          source: typeof registration?.provider?.source === 'string' ? registration.provider.source : 'unknown',
          status: 'malformed',
          message: invalidRegistration,
        })),
      };
    }

    const ordered = [...this.registrations].sort((left, right) => left.priority - right.priority);
    for (const registration of ordered) {
      const { provider, role } = registration;
      const attempt = await this.resolveProvider(
        provider,
        role,
        identity,
        card,
        quality,
        excludedImageUrls,
      );
      attempts.push(attempt);
      if (attempt.candidate) {
        candidates.push(attempt.candidate);
        if (this.isSelectable(attempt.candidate)) {
          return {
            status: 'available',
            imageUrl: attempt.candidate.imageUrl,
            source: attempt.candidate.source,
            resolvedAt: attempt.candidate.resolvedAt,
            role: attempt.candidate.role,
            candidate: attempt.candidate,
            verification: attempt.candidate.verification,
            usageEligibility: attempt.candidate.usageEligibility,
            candidates,
            attempts,
          };
        }
      }
    }

    const failures = attempts.filter((attempt) => attempt.status === 'error' || attempt.status === 'malformed');
    if (failures.length > 0) {
      return {
        status: 'error',
        message: failures.map(({ source, message }) => `${source}: ${message}`).join('; '),
        candidates,
        attempts,
      };
    }

    return {
      status: 'unavailable',
      reason: candidates.length > 0
        ? 'Artwork candidates were found, but none passed exact-printing and usage eligibility selection.'
        : attempts.length > 0
          ? attempts.map(({ source, message }) => `${source}: ${message}`).join('; ')
          : 'No artwork providers are configured.',
      candidates,
      attempts,
    };
  }

  private validateRegistrations(): string | null {
    if (this.registrations.length === 0) return null;
    const priorities = new Set<number>();
    let primaryCount = 0;
    for (const registration of this.registrations) {
      if (!registration || !registration.provider
        || (registration.role !== 'primary' && registration.role !== 'fallback')
        || !Number.isSafeInteger(registration.priority)
        || registration.priority < 0) {
        return 'The artwork provider registration is invalid.';
      }
      if (priorities.has(registration.priority)) {
        return 'Artwork provider priorities must be unique.';
      }
      priorities.add(registration.priority);
      if (registration.role === 'primary') {
        primaryCount += 1;
        if (registration.priority !== 0) return 'The primary artwork provider must have priority 0.';
      } else if (registration.priority === 0) {
        return 'Fallback artwork providers must have a positive priority.';
      }
    }
    return primaryCount === 1 ? null : 'Exactly one primary artwork provider must be registered.';
  }

  private isSelectable(candidate: ArtworkCandidate): boolean {
    return candidate.verification.status === 'exact'
      && (candidate.usageEligibility.status === 'eligible'
        || (candidate.usageEligibility.status === 'unresolved' && candidate.unresolvedUsageAllowed));
  }

  private async resolveProvider(
    provider: ArtworkProvider,
    role: ArtworkRole,
    identity: CanonicalCardIdentity,
    card: Card,
    quality: ArtworkQuality,
    excludedImageUrls: string[],
  ): Promise<ArtworkAttempt & { candidate?: ArtworkCandidate }> {
    if (typeof provider.source !== 'string' || !provider.source.trim()
      || typeof provider.resolve !== 'function') {
      return {
        source: 'unknown',
        status: 'malformed',
        message: 'The artwork provider registration is invalid.',
      };
    }

    try {
      const result: unknown = await provider.resolve({
        identity: copyIdentity(identity),
        quality,
        excludedImageUrls: [...excludedImageUrls],
        catalogArtwork: card.catalogArtwork ?? (
          provider.source === 'tcgdex' && (card.imageUrlLow || card.imageUrlHigh)
            ? {
                provider: 'tcgdex',
                compatibility: 'legacy-current-catalog',
                providerCardId: identity.providerIds?.tcgdex?.[0] ?? card.id,
                printingIdentity: copyIdentity(identity),
                imageUrls: { low: card.imageUrlLow, high: card.imageUrlHigh },
              }
            : undefined
        ),
      });

      if (!isRecord(result) || typeof result.status !== 'string') {
        return {
          source: provider.source,
          status: 'malformed',
          message: 'The artwork provider returned an invalid result.',
        };
      }
      if (result.status === 'unavailable') {
        if (typeof result.reason !== 'string' || !result.reason.trim()) {
          return {
            source: provider.source,
            status: 'malformed',
            message: 'The provider returned an invalid unavailable result.',
          };
        }
        const message = result.reason.trim();
        return {
          source: provider.source,
          status: /excluded|failed to load/i.test(message) ? 'excluded' : 'unavailable',
          message,
        };
      }
      if (result.status === 'error') {
        return typeof result.message === 'string' && result.message.trim()
          ? { source: provider.source, status: 'error', message: result.message.trim() }
          : { source: provider.source, status: 'malformed', message: 'The provider returned an invalid error result.' };
      }
      if (result.status !== 'available') {
        return {
          source: provider.source,
          status: 'malformed',
          message: 'The artwork provider returned an unsupported status.',
        };
      }

      const candidate = normalizeCandidate(
        result,
        provider,
        identity,
        role,
        provider.allowUnresolvedUsage === true,
        Date.now(),
      );
      if (!candidate) {
        return {
          source: provider.source,
          status: 'malformed',
          message: 'The artwork provider returned an invalid or unusable candidate.',
        };
      }
      if (excludedImageUrls.includes(candidate.imageUrl)) {
        return {
          source: provider.source,
          status: 'excluded',
          message: 'The artwork URL was excluded after failing to load in the current view.',
        };
      }
      if (isKnownPlaceholderArtworkUrl(candidate.imageUrl)) {
        return {
          source: provider.source,
          status: 'unavailable',
          message: 'The provider URL is a known placeholder, not card artwork.',
        };
      }
      return { source: provider.source, status: 'available', candidate };
    } catch (error) {
      return {
        source: provider.source,
        status: 'error',
        message: error instanceof Error && error.message
          ? error.message
          : 'The artwork provider failed unexpectedly.',
      };
    }
  }
}

class TCGdexArtworkProvider implements ArtworkProvider {
  readonly source = 'tcgdex';
  readonly allowUnresolvedUsage = true;

  async resolve({ identity, catalogArtwork, quality, excludedImageUrls }: ArtworkProviderInput): Promise<ArtworkProviderResult> {
    if (!catalogArtwork) {
      return { status: 'unavailable', reason: 'TCGdex has no artwork URL for this card.' };
    }
    if (catalogArtwork.provider !== this.source) {
      return { status: 'unavailable', reason: 'TCGdex catalog artwork is not available for this card.' };
    }
    const { imageUrls } = catalogArtwork;
    const preferred = quality === 'high'
      ? [{ url: imageUrls.high, resolution: 'high' as const }, { url: imageUrls.low, resolution: 'low' as const }]
      : [{ url: imageUrls.low, resolution: 'low' as const }, { url: imageUrls.high, resolution: 'high' as const }];
    const candidates = preferred.filter(({ url }) => Boolean(url?.trim()));
    let foundMalformedUrl = false;
    let foundPlaceholderUrl = false;
    for (const { url: imageUrl, resolution } of candidates) {
      if (!imageUrl) continue;
      if (excludedImageUrls.includes(imageUrl)) continue;
      if (!isUsableArtworkUrl(imageUrl)) {
        foundMalformedUrl = true;
        continue;
      }
      if (isKnownPlaceholderArtworkUrl(imageUrl)) {
        foundPlaceholderUrl = true;
        continue;
      }
      return {
        status: 'available',
        imageUrl,
        sourceUrl: imageUrl,
        sourceCardId: catalogArtwork.providerCardId,
        matchedIdentity: catalogArtwork.printingIdentity,
        resolution,
        language: identity.language,
        variant: identity.variant,
        verification: {
          status: 'exact',
          evidence: catalogArtwork.compatibility === 'legacy-current-catalog'
            ? 'Legacy untagged image URL retained as artwork for the current catalog record.'
            : catalogArtwork.providerCardId
              ? `Artwork URL is mapped from the TCGdex catalog record ${catalogArtwork.providerCardId}.`
              : 'Artwork URL is mapped from the TCGdex catalog record for the requested card.',
        },
        usageEligibility: { status: 'unresolved' },
      };
    }

    if (candidates.length === 0) {
      return { status: 'unavailable', reason: 'TCGdex has no artwork URL for this card.' };
    }
    if (candidates.every(({ url }) => url !== undefined && excludedImageUrls.includes(url))) {
      return { status: 'unavailable', reason: 'All TCGdex artwork URLs failed to load in the current view.' };
    }
    if (foundMalformedUrl) {
      return { status: 'error', message: 'TCGdex returned malformed or unsupported artwork URLs.' };
    }
    if (foundPlaceholderUrl) {
      return { status: 'unavailable', reason: 'TCGdex artwork URLs are known placeholders.' };
    }
    return { status: 'unavailable', reason: 'TCGdex artwork is not available.' };
  }
}

export function isArtworkUrlFailed(failedUrl: string | null, currentUrl: string | null): boolean {
  return Boolean(currentUrl && failedUrl === currentUrl);
}

export const artworkProviders: readonly ArtworkProviderRegistration[] = [
  { provider: new TCGdexArtworkProvider(), role: 'primary', priority: 0 },
];

export const artworkService: ArtworkResolver = new ProviderArtworkResolver(artworkProviders);
