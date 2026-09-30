import { createLocalReferenceScannerProvider } from './localReferenceMatcher';
import type { ScannerProvider } from './types';

export function createScannerProviders(): ScannerProvider[] {
  return [createLocalReferenceScannerProvider()];
}
