import type { ICatalogProvider } from '@/services/catalog/types/catalogProvider.types';
import type { ConfirmedScannerCandidate } from '@/services/scanner/types';
import type {
  CatalogIdentityMatch,
  CatalogIdentityProvider,
  CatalogIdentityResult,
} from './types';

const INSUFFICIENT_CLUES_REASON =
  'A name, collector number, and set code are required to resolve catalog identity.';
const INVALID_PROVIDER_RESULT = 'The catalog identity provider returned malformed results.';

interface NormalizedCatalogRecord {
  catalogId: string;
  name: string;
  setCode: string;
  collectorNumber: string;
}

interface RequiredCandidateClues {
  name: string;
  setCode: string;
  collectorNumber: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeCatalogRecord(value: unknown): NormalizedCatalogRecord | undefined {
  if (!isRecord(value)) return undefined;

  const catalogId = normalizedText(value.id);
  const name = normalizedText(value.name);
  const setCode = normalizedText(value.setCode);
  const collectorNumber = normalizedText(value.number) ?? normalizedText(value.setNumber);
  if (!catalogId || !name || !setCode || !collectorNumber) return undefined;

  return { catalogId, name, setCode, collectorNumber };
}

function normalizeMatch(record: NormalizedCatalogRecord, provider: string): CatalogIdentityMatch {
  return { ...record, provider };
}

function cancellationResult(candidate: ConfirmedScannerCandidate): CatalogIdentityResult {
  return { status: 'cancelled', candidate };
}

function getRequiredCandidateClues(
  candidate: ConfirmedScannerCandidate,
): RequiredCandidateClues | undefined {
  const name = normalizedText(candidate.name);
  const collectorNumber = normalizedText(candidate.collectorNumber);
  const setCode = normalizedText(candidate.setCode);
  return name && collectorNumber && setCode ? { name, collectorNumber, setCode } : undefined;
}

function matchesCandidate(
  record: NormalizedCatalogRecord,
  clues: RequiredCandidateClues,
): boolean {
  return record.name.toLowerCase() === clues.name.toLowerCase() &&
    record.setCode.toLowerCase() === clues.setCode.toLowerCase() &&
    record.collectorNumber.toLowerCase() === clues.collectorNumber.toLowerCase();
}

async function searchUntilAborted(
  provider: CatalogIdentityProvider,
  query: string,
  candidate: ConfirmedScannerCandidate,
  signal?: AbortSignal,
): Promise<unknown> {
  if (!signal) return provider.search(query);
  if (signal.aborted) return cancellationResult(candidate);

  let onAbort: (() => void) | undefined;
  const aborted = new Promise<CatalogIdentityResult>((resolve) => {
    onAbort = () => resolve(cancellationResult(candidate));
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });

  try {
    return await Promise.race([provider.search(query, signal), aborted]);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}

export async function resolveCatalogIdentity(
  candidate: ConfirmedScannerCandidate,
  provider: CatalogIdentityProvider = unavailableCatalogIdentityProvider,
  signal?: AbortSignal,
): Promise<CatalogIdentityResult> {
  if (signal?.aborted) return cancellationResult(candidate);
  const clues = getRequiredCandidateClues(candidate);
  if (!clues) {
    return { status: 'unavailable', candidate, reason: INSUFFICIENT_CLUES_REASON };
  }
  const providerName = normalizedText(provider.name);
  if (!providerName) {
    return { status: 'error', candidate, message: 'The catalog identity provider has no valid name.' };
  }

  let response: unknown;
  try {
    response = await searchUntilAborted(provider, clues.name, candidate, signal);
  } catch (error) {
    return signal?.aborted
      ? cancellationResult(candidate)
      : {
          status: 'error',
          candidate,
          message: error instanceof Error && error.message
            ? error.message
            : 'The catalog identity provider failed unexpectedly.',
        };
  }

  if (signal?.aborted) return cancellationResult(candidate);
  if (isRecord(response) && (response.status === 'unavailable' || response.status === 'error')) {
    const providerFailure = normalizeProviderFailure(response, candidate);
    return providerFailure ?? { status: 'error', candidate, message: INVALID_PROVIDER_RESULT };
  }
  if (!Array.isArray(response)) {
    return { status: 'error', candidate, message: INVALID_PROVIDER_RESULT };
  }

  const records: NormalizedCatalogRecord[] = [];
  for (const item of response) {
    const record = normalizeCatalogRecord(item);
    if (!record) return { status: 'error', candidate, message: INVALID_PROVIDER_RESULT };
    if (matchesCandidate(record, clues)) records.push(record);
  }

  const uniqueRecords = Array.from(new Map(records.map((record) => [record.catalogId, record])).values());
  const matches = uniqueRecords.map((record) => normalizeMatch(record, providerName));
  if (matches.length === 0) return { status: 'no-match', candidate };
  if (matches.length === 1) return { status: 'resolved', candidate, match: matches[0] };
  return { status: 'ambiguous', candidate, matches };
}

function normalizeProviderFailure(
  value: unknown,
  candidate: ConfirmedScannerCandidate,
): CatalogIdentityResult | undefined {
  if (!isRecord(value)) return undefined;
  if (value.status === 'unavailable' && typeof value.reason === 'string' && value.reason.trim()) {
    return { status: 'unavailable', candidate, reason: value.reason.trim() };
  }
  if (value.status === 'error' && typeof value.message === 'string' && value.message.trim()) {
    return { status: 'error', candidate, message: value.message.trim() };
  }
  return undefined;
}

export function createCatalogIdentityProvider(
  provider: ICatalogProvider,
  name: string,
): CatalogIdentityProvider {
  return {
    name,
    search(query) {
      return provider.searchCards(query);
    },
  };
}

export const unavailableCatalogIdentityProvider: CatalogIdentityProvider = {
  name: 'unavailable',
  async search() {
    return { status: 'unavailable', reason: 'No catalog identity provider is configured.' };
  },
};
