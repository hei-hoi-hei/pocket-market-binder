import type {
  ScannerCandidate,
  ScannerEvidence,
  ScannerEvidenceStrength,
  ScannerIdentificationResult,
  ScannerProvider,
  ScannerProviderObservation,
} from './types';
import { identifyImage, offlineScannerProvider } from './scannerService';

export interface ScannerProviderRun {
  provider: string;
  result: ScannerIdentificationResult;
}

function normalizedPart(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function getIdentityKey(candidate: ScannerCandidate, provider: string): string {
  if (candidate.catalogProvider && candidate.catalogId && candidate.gameKey) {
    return `catalog:${normalizedPart(candidate.gameKey)}:${normalizedPart(candidate.catalogProvider)}:${normalizedPart(candidate.catalogId)}:${normalizedPart(candidate.language)}:${normalizedPart(candidate.variant)}`;
  }
  if (candidate.catalogProvider && candidate.catalogId) {
    return `provider:${normalizedPart(provider)}:catalog:${normalizedPart(candidate.catalogProvider)}:${normalizedPart(candidate.catalogId)}:${normalizedPart(candidate.language)}:${normalizedPart(candidate.variant)}`;
  }
  if (candidate.catalogId) {
    return `provider:${normalizedPart(provider)}:${normalizedPart(candidate.catalogId)}:${normalizedPart(candidate.language)}:${normalizedPart(candidate.variant)}`;
  }

  const completePrinting = [
    candidate.gameKey,
    candidate.name,
    candidate.setCode,
    candidate.collectorNumber,
    candidate.language,
    candidate.variant,
  ];
  if (completePrinting.every((part) => Boolean(part?.trim()))) {
    return `printing:${completePrinting.map((part) => normalizedPart(part)).join(':')}`;
  }

  return `provider:${normalizedPart(provider)}:candidate:${[
    candidate.gameKey,
    candidate.name,
    candidate.setCode,
    candidate.collectorNumber,
    candidate.language,
    candidate.variant,
  ].map(normalizedPart).join(':')}`;
}

function evidenceForCandidate(candidate: ScannerCandidate, provider: string): ScannerEvidence[] {
  if (!candidate.evidence?.length) {
    return [{
      label: 'provider candidate',
      value: candidate.name ?? candidate.catalogId ?? 'Candidate returned',
      provider,
      type: 'candidate-match',
      relation: 'supports',
      strength: 'weak',
    }];
  }

  return candidate.evidence.map((evidence) => ({
    ...evidence,
    provider: evidence.provider ?? provider,
    type: evidence.type ?? evidence.label,
    relation: evidence.relation ?? 'supports',
    strength: evidence.strength ?? 'weak',
  }));
}

function getProviderObservation(run: ScannerProviderRun): ScannerProviderObservation {
  const { result, provider } = run;
  if (result.status === 'success') {
    return { provider, status: 'supporting', candidateCount: result.candidates.length };
  }
  if (result.status === 'no-match') {
    return { provider, status: 'missing', candidateCount: 0 };
  }
  if (result.status === 'unavailable') {
    return { provider, status: 'unavailable', candidateCount: 0, reason: result.reason };
  }
  return { provider, status: 'error', candidateCount: 0, reason: result.message };
}

function getEvidenceRank(candidate: ScannerCandidate): number {
  const rank: Record<ScannerEvidenceStrength, number> = {
    weak: 1,
    partial: 2,
    strong: 3,
    exact: 4,
    unavailable: 0,
    contradictory: 0,
  };
  return Math.max(0, ...(candidate.evidence ?? [])
    .filter((evidence) => evidence.relation === undefined || evidence.relation === 'supports')
    .map((evidence) => rank[evidence.strength ?? 'weak']));
}

function hasContradiction(candidate: ScannerCandidate): boolean {
  return candidate.evidence?.some((evidence) => evidence.relation === 'contradicts') ?? false;
}

function fuseCandidates(runs: readonly ScannerProviderRun[]): ScannerCandidate[] {
  const merged = new Map<string, ScannerCandidate>();
  const providerForIdentity = new Map<string, Set<string>>();

  for (const { provider, result } of runs) {
    if (result.status !== 'success') continue;
    for (const candidate of result.candidates) {
      const identityKey = getIdentityKey(candidate, provider);
      const evidence = evidenceForCandidate(candidate, provider);
      const previous = merged.get(identityKey);
      const providers = providerForIdentity.get(identityKey) ?? new Set<string>();
      providers.add(provider);
      providerForIdentity.set(identityKey, providers);

      if (previous) {
        merged.set(identityKey, {
          ...previous,
          ...Object.fromEntries(Object.entries(candidate).filter(([key, value]) =>
            value !== undefined && previous[key as keyof ScannerCandidate] === undefined)),
          identityKey,
          providers: [...providers].sort(compareStrings),
          providerMetadata: {
            ...(previous.providerMetadata ?? {}),
            ...(candidate.providerMetadata ?? {}),
            ...(candidate.metadata ? { [provider]: candidate.metadata } : {}),
          },
          evidence: [...(previous.evidence ?? []), ...evidence],
        });
      } else {
        merged.set(identityKey, {
          ...candidate,
          identityKey,
          provider,
          providers: [provider],
          ...(candidate.metadata ? { providerMetadata: { [provider]: candidate.metadata } } : {}),
          evidence,
        });
      }
    }
  }

  const candidates = [...merged.values()];
  for (const candidate of candidates) {
    const presentProviders = new Set(candidate.providers ?? []);
    for (const { provider, result } of runs) {
      if (presentProviders.has(provider)) continue;
      const observation = getProviderObservation({ provider, result });
      const unavailable = observation.status === 'unavailable' || observation.status === 'error';
      candidate.evidence = [
        ...(candidate.evidence ?? []),
        {
          label: 'provider result',
          value: observation.reason ?? 'No evidence returned for this candidate',
          provider,
          type: 'provider-result',
          relation: 'unavailable',
          strength: 'unavailable',
          ...(unavailable ? { metadata: { providerStatus: observation.status } } : {}),
        },
      ];
    }
  }

  return candidates.sort((left, right) =>
    getEvidenceRank(right) - getEvidenceRank(left) ||
    (right.providers?.length ?? 0) - (left.providers?.length ?? 0) ||
    Number(hasContradiction(left)) - Number(hasContradiction(right)) ||
    compareStrings(left.identityKey ?? '', right.identityKey ?? ''),
  );
}

export function fuseScannerResults(runs: readonly ScannerProviderRun[]): ScannerIdentificationResult {
  const providerResults = runs.map(getProviderObservation);
  const candidates = fuseCandidates(runs);

  if (candidates.length > 0) {
    const decision = candidates.length > 5 || candidates.some(hasContradiction)
      ? 'insufficient'
      : candidates.length === 1
        ? getEvidenceRank(candidates[0]) >= 3 ? 'strong-candidate' : 'insufficient'
        : 'candidate-confirmation';
    return { status: 'success', candidates, source: 'fusion', decision, providerResults };
  }

  const errors = runs.filter(({ result }) => result.status === 'error' || result.status === 'unavailable');
  if (errors.length === runs.length && errors[0]) {
    const reason = errors.map(({ provider, result }) => {
      const detail = result.status === 'error'
        ? result.message
        : result.status === 'unavailable'
          ? result.reason
          : 'No candidate evidence available';
      return `${provider}: ${detail}`;
    }).join('; ');
    return { status: 'unavailable', reason, source: 'fusion', decision: 'insufficient', providerResults };
  }

  return { status: 'no-match', candidates: [], source: 'fusion', decision: 'insufficient', providerResults };
}

export async function identifyImageWithProviders(
  providers: readonly ScannerProvider[],
  image: Blob,
  signal?: AbortSignal,
): Promise<ScannerIdentificationResult> {
  const configuredProviders = providers.length > 0 ? providers : [offlineScannerProvider];
  const runs = await Promise.all(configuredProviders.map(async (provider) => ({
    provider: provider.name,
    result: await identifyImage(provider, image, signal),
  })));
  if (signal?.aborted) return runs[0]?.result ?? identifyImage(offlineScannerProvider, image, signal);
  return fuseScannerResults(runs);
}