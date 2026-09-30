import type { CanonicalCardIdentity, Card } from '@/types';

export type ArtworkQuality = 'low' | 'high';
export type ArtworkRole = 'primary' | 'fallback';
export type ArtworkVerificationStatus = 'exact' | 'partial' | 'unresolved' | 'rejected';
export type ArtworkUsageStatus = 'eligible' | 'unresolved' | 'ineligible';

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
  imageUrls: {
    low?: string;
    high?: string;
  };
}

export interface ArtworkProviderCandidate {
  imageUrl: string;
  sourceCardId?: string;
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
  return card.identity ?? {
    tcgdexId: card.id,
    setId: card.setCode,
    setName: card.setName,
    cardNumber: card.setNumber,
    name: card.name,
    rarity: card.rarity,
  };
}

function copyIdentity(identity: CanonicalCardIdentity): CanonicalCardIdentity {
  return {
    ...identity,
    providerIds: identity.providerIds
      ? Object.fromEntries(
          Object.entries(identity.providerIds).map(([provider, ids]) => [provider, ids ? [...ids] : undefined]),
        )
      : undefined,
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

  const verification = normalizeVerification(value.verification);
  const usageEligibility = normalizeUsageEligibility(value.usageEligibility);
  const quality = normalizeQuality(value.quality);
  if (!verification || !usageEligibility || quality === null) return null;

  return {
    imageUrl: value.imageUrl,
    sourceCardId: value.sourceCardId as string | undefined,
    source: provider.source.trim(),
    requestedIdentity: copyIdentity(requestedIdentity),
    resolvedAt,
    role,
    unresolvedUsageAllowed,
    verification,
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
        imageUrls: { low: card.imageUrlLow, high: card.imageUrlHigh },
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

  async resolve({ identity, imageUrls, quality, excludedImageUrls }: ArtworkProviderInput): Promise<ArtworkProviderResult> {
    const preferred = quality === 'high'
      ? [imageUrls.high, imageUrls.low]
      : [imageUrls.low, imageUrls.high];
    const candidates = preferred.filter((url): url is string => Boolean(url?.trim()));
    let foundMalformedUrl = false;
    let foundPlaceholderUrl = false;
    for (const imageUrl of candidates) {
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
        verification: {
          status: 'exact',
          evidence: `Artwork URL is mapped from the TCGdex catalog record for ${identity.tcgdexId}.`,
        },
        usageEligibility: { status: 'unresolved' },
      };
    }

    if (candidates.length === 0) {
      return { status: 'unavailable', reason: 'TCGdex has no artwork URL for this card.' };
    }
    if (candidates.every((imageUrl) => excludedImageUrls.includes(imageUrl))) {
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
