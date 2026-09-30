import { describe, expect, it } from 'vitest';
import { createScannerProviders } from '../scannerProviders';

describe('scanner provider configuration', () => {
  it('keeps local-reference matching available through the provider boundary', () => {
    expect(createScannerProviders().map((provider) => provider.name)).toContain('local-reference');
  });
});
