import type { Card } from '@/types';
import { tcgdexProvider } from '@/services/providers/tcgdexProvider';

export interface ScannerTextEvidence {
  name?: string;
  collectorNumber?: string;
  setCode?: string;
  rawText?: string;
}

export interface RankedCandidate {
  card: Card;
  score: number;
}

export interface ScannerBenchmarkCandidate {
  rank: number;
  id: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  score: number;
}

export type ScannerBenchmarkMatchStatus =
  | 'not-queried-no-ocr-name'
  | 'candidates-returned'
  | 'no-candidates-or-tcgdex-failure';

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function normalizeCollectorNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function rankCandidates(candidates: Card[], evidence: ScannerTextEvidence): RankedCandidate[] {
  const name = normalizeText(evidence.name ?? '');
  const collectorNumber = normalizeCollectorNumber(evidence.collectorNumber ?? '');
  const setCode = normalizeText(evidence.setCode ?? '');

  return candidates
    .map((card) => {
      const candidateName = normalizeText(card.name);
      const candidateCollectorNumber = normalizeCollectorNumber(card.setNumber);
      const candidateSetCode = normalizeText(card.setCode);
      const nameExact = Boolean(name) && candidateName === name;
      const nameContained = Boolean(name) && (candidateName.includes(name) || name.includes(candidateName));
      const numberExact = Boolean(collectorNumber) && candidateCollectorNumber === collectorNumber;
      const setExact = Boolean(setCode) && candidateSetCode === setCode;

      return {
        card,
        score: Number(nameExact) * 4 + Number(nameContained) * 2 + Number(numberExact) * 3 + Number(setExact) * 2,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function describeRankedCandidates(
  candidates: readonly {
    card: Pick<Card, 'id' | 'name' | 'setCode' | 'setNumber'>;
    score: number;
  }[],
): ScannerBenchmarkCandidate[] {
  return candidates.map(({ card, score }, index) => ({
    rank: index + 1,
    id: card.id,
    name: card.name,
    setCode: card.setCode,
    collectorNumber: card.setNumber,
    score,
  }));
}

export function getScannerBenchmarkMatchStatus(
  ocrName: string,
  candidateCount: number,
): ScannerBenchmarkMatchStatus {
  if (!ocrName.trim()) return 'not-queried-no-ocr-name';
  return candidateCount > 0 ? 'candidates-returned' : 'no-candidates-or-tcgdex-failure';
}

export async function matchTextEvidence(evidence: ScannerTextEvidence): Promise<RankedCandidate[]> {
  if (!evidence.name?.trim()) return [];
  const candidates = await tcgdexProvider.searchCards(evidence.name);
  return rankCandidates(candidates, evidence);
}
