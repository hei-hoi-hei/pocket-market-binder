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

export async function matchTextEvidence(evidence: ScannerTextEvidence): Promise<RankedCandidate[]> {
  if (!evidence.name?.trim()) return [];
  const candidates = await tcgdexProvider.searchCards(evidence.name);
  return rankCandidates(candidates, evidence);
}
