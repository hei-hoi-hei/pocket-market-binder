import type { ScannerCandidate } from '@/services/scanner/types';

export interface CandidateReviewState {
  selectedIndex: number | null;
  confirmedIndex: number | null;
  cancelled: boolean;
}

export type CandidateReviewAction =
  | { type: 'select'; index: number }
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'retry' }
  | { type: 'reset' };

export const initialCandidateReviewState: CandidateReviewState = {
  selectedIndex: null,
  confirmedIndex: null,
  cancelled: false,
};

export function getSelectedCandidate(
  candidates: readonly ScannerCandidate[],
  selectedIndex: number | null,
): ScannerCandidate | undefined {
  return selectedIndex === null ? undefined : candidates[selectedIndex];
}

export function confirmCandidateReviewSelection(
  candidates: readonly ScannerCandidate[],
  selectedIndex: number | null,
  onConfirm: (candidate: ScannerCandidate) => void,
): ScannerCandidate | undefined {
  const candidate = getSelectedCandidate(candidates, selectedIndex);
  if (candidate) onConfirm(candidate);
  return candidate;
}

export function candidateReviewReducer(
  state: CandidateReviewState,
  action: CandidateReviewAction,
): CandidateReviewState {
  switch (action.type) {
    case 'select':
      return { selectedIndex: action.index, confirmedIndex: null, cancelled: false };
    case 'confirm':
      return state.selectedIndex === null
        ? state
        : { ...state, confirmedIndex: state.selectedIndex, cancelled: false };
    case 'cancel':
      return { ...initialCandidateReviewState, cancelled: true };
    case 'retry':
    case 'reset':
      return initialCandidateReviewState;
    default:
      return state;
  }
}
