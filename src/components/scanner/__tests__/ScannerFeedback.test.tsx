// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@/types';
import { closeLocalDatabase, storage } from '@/services/storage';
import type { ScannerIdentificationResult } from '@/services/scanner/types';
import { ScannerFeedback } from '../ScannerFeedback';

const catalogMocks = vi.hoisted(() => ({ search: vi.fn() }));

vi.mock('@/services/catalogService', () => ({
  catalogService: { search: catalogMocks.search },
}));

const DATABASE_NAME = 'pocket-market-binder';
const card: Card = {
  id: 'sv03.5-026',
  name: 'Pikachu',
  category: 'pokemon',
  rarity: 'common',
  setCode: 'sv03.5',
  setName: 'Pokemon 151',
  setNumber: '026',
  catalogArtwork: { provider: 'tcgdex', imageUrls: {} },
  identity: { language: 'en', providerIds: { tcgdex: ['sv03.5-026'] } },
};
const successResult: ScannerIdentificationResult = {
  status: 'success',
  candidates: [{
    catalogProvider: 'tcgdex',
    catalogId: 'sv03.5-025',
    gameKey: 'pokemon',
    name: 'Pikachu',
    providers: ['local-reference'],
  }],
};

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('App database deletion was blocked'));
  });
}

function findButton(container: HTMLDivElement, text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((button) => button.textContent?.includes(text));
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!valueSetter) throw new Error('Input value setter is unavailable.');
  valueSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('ScannerFeedback', () => {
  let container: HTMLDivElement;
  let root: Root;
  let rootMounted: boolean;
  let createObjectUrl: ((blob: Blob) => string) & { mock: unknown };
  let revokeObjectUrl: ReturnType<typeof vi.fn>;
  let anchorClick: { mockImplementation(implementation: () => void): unknown };
  let exportedBlob: Blob | undefined;
  let fetchRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    closeLocalDatabase();
    await deleteDatabase();
    await storage.set('binder', [{ cardId: 'owned-card', quantity: 2, addedAt: 1 }]);
    await storage.set('wishlist', [{ cardId: 'wanted-card', addedAt: 1 }]);
    await storage.set('cart', [{ cardId: 'planned-card', quantity: 1, addedAt: 1 }]);
    catalogMocks.search.mockReset().mockResolvedValue([card]);
    exportedBlob = undefined;
    createObjectUrl = vi.fn((blob: Blob) => {
      exportedBlob = blob;
      return 'blob:feedback-export';
    });
    revokeObjectUrl = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl });
    fetchRequest = vi.fn();
    vi.stubGlobal('fetch', fetchRequest);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    rootMounted = true;
  });

  afterEach(async () => {
    if (rootMounted) await act(async () => root.unmount());
    container.remove();
    closeLocalDatabase();
    await deleteDatabase();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function renderFeedback(
    result: ScannerIdentificationResult = successResult,
    allowCancelled = true,
  ): Promise<void> {
    await act(async () => root.render(createElement(ScannerFeedback, {
      result,
      matcherId: 'local-reference',
      processingDurationMs: 18,
      imageDimensions: { width: 1200, height: 1600 },
      allowCancelled,
    })));
  }

  it('exports explicit feedback locally without photos or collection mutation', async () => {
    await renderFeedback();
    expect(container.textContent).toContain('The photo is not attached, stored, or sent.');
    expect(['Correct', 'Wrong card', 'No match', 'Error', 'Cancelled']
      .every((label) => Boolean(findButton(container, label)))).toBe(true);
    expect(catalogMocks.search).not.toHaveBeenCalled();

    const correctButton = findButton(container, 'Correct');
    if (!correctButton) throw new Error('Correct feedback action was not rendered.');
    await act(async () => correctButton.click());
    const downloadButton = findButton(container, 'Download feedback JSON');
    if (!downloadButton) throw new Error('Feedback download action was not rendered.');
    await act(async () => downloadButton.click());

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(exportedBlob?.type).toBe('application/json');
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:feedback-export');
    expect(fetchRequest).not.toHaveBeenCalled();
    const report = JSON.parse(await readBlob(exportedBlob as Blob)) as Record<string, unknown>;
    expect(report).toMatchObject({
      outcome: 'correct',
      resultType: 'success',
      predictedCatalogId: 'sv03.5-025',
      processingDurationMs: 18,
      imageDimensions: { width: 1200, height: 1600 },
    });
    expect(report).not.toHaveProperty('photo');
    expect(report).not.toHaveProperty('image');
    expect(report).not.toHaveProperty('fileName');
    expect(report).not.toHaveProperty('confirmedIdentity');
    expect(container.textContent).toContain('Feedback JSON downloaded locally.');

    await expect(storage.get('binder')).resolves.toEqual([{ cardId: 'owned-card', quantity: 2, addedAt: 1 }]);
    await expect(storage.get('wishlist')).resolves.toEqual([{ cardId: 'wanted-card', addedAt: 1 }]);
    await expect(storage.get('cart')).resolves.toEqual([{ cardId: 'planned-card', quantity: 1, addedAt: 1 }]);
  });

  it('allows an incorrect report to include only an explicitly selected catalog identity', async () => {
    await renderFeedback();
    const wrongCardButton = findButton(container, 'Wrong card');
    if (!wrongCardButton) throw new Error('Wrong-card feedback action was not rendered.');
    await act(async () => wrongCardButton.click());
    expect(catalogMocks.search).not.toHaveBeenCalled();

    const input = container.querySelector<HTMLInputElement>('#scanner-feedback-catalog-search');
    const searchButton = findButton(container, 'Search catalog');
    if (!input || !searchButton) throw new Error('Optional catalog correction search was not rendered.');
    await act(async () => {
      setInputValue(input, 'Pikachu');
      searchButton.click();
      await Promise.resolve();
    });
    expect(catalogMocks.search).toHaveBeenCalledWith({ query: 'Pikachu' });

    const resultButton = findButton(container, 'Pikachu');
    if (!resultButton) throw new Error('Catalog result was not rendered.');
    await act(async () => resultButton.click());
    const downloadButton = findButton(container, 'Download feedback JSON');
    if (!downloadButton) throw new Error('Feedback download action was not rendered.');
    await act(async () => downloadButton.click());

    const serialized = await readBlob(exportedBlob as Blob);
    const report = JSON.parse(serialized) as Record<string, unknown>;
    expect(report).toMatchObject({
      outcome: 'incorrect',
      confirmedIdentity: {
        catalogProvider: 'tcgdex',
        catalogId: 'sv03.5-026',
        gameKey: 'pokemon',
        language: 'en',
      },
    });
    expect(serialized).not.toContain('Pikachu');
  });

  it('exports no-match, processing-error, and cancelled taxonomy selections', async () => {
    await renderFeedback({ status: 'no-match', candidates: [] });
    const noMatchButton = findButton(container, 'No match');
    if (!noMatchButton) throw new Error('No-match feedback action was not rendered.');
    await act(async () => noMatchButton.click());
    const downloadButton = findButton(container, 'Download feedback JSON');
    if (!downloadButton) throw new Error('Feedback download action was not rendered.');
    await act(async () => downloadButton.click());
    expect(JSON.parse(await readBlob(exportedBlob as Blob))).toMatchObject({
      outcome: 'no-match',
      resultType: 'no-match',
      candidateCount: 0,
    });

    await act(async () => root.render(createElement(ScannerFeedback, {
      result: { status: 'error', message: 'private raw error', retryable: true },
      matcherId: 'local-reference',
      allowCancelled: false,
    })));
    const errorButton = findButton(container, 'Error');
    if (!errorButton) throw new Error('Processing-error feedback action was not rendered.');
    await act(async () => errorButton.click());
    const errorDownload = findButton(container, 'Download feedback JSON');
    if (!errorDownload) throw new Error('Feedback download action was not rendered for an error.');
    await act(async () => errorDownload.click());
    const errorReportText = await readBlob(exportedBlob as Blob);
    expect(JSON.parse(errorReportText)).toMatchObject({
      outcome: 'processing-error',
      resultType: 'error',
      errorCategory: 'recognition-failed',
    });
    expect(errorReportText).not.toContain('private raw error');

    await act(async () => root.render(createElement(ScannerFeedback, {
      result: successResult,
      matcherId: 'local-reference',
      allowCancelled: true,
    })));
    const cancelledButton = findButton(container, 'Cancelled');
    if (!cancelledButton) throw new Error('Cancelled feedback action was not rendered.');
    await act(async () => cancelledButton.click());
    const cancelledDownload = findButton(container, 'Download feedback JSON');
    if (!cancelledDownload) throw new Error('Feedback download action was not rendered for cancellation.');
    await act(async () => cancelledDownload.click());
    expect(JSON.parse(await readBlob(exportedBlob as Blob))).toMatchObject({
      outcome: 'cancelled',
      errorCategory: 'user-cancelled-review',
    });
  });
});
