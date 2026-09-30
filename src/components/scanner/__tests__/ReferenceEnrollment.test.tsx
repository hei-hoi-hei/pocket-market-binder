// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@/types';
import { closeLocalDatabase, storage } from '@/services/storage';
import { confirmScannerCandidate, isConfirmedScannerCandidate } from '@/services/scanner/types';
import type { ScannerCandidate } from '@/services/scanner/types';
import { identifyImageWithProviders } from '@/services/scanner/scannerOrchestration';
import { createLocalReferenceScannerProvider, LOCAL_PHASH_VERSION } from '@/services/scanner/localReferenceMatcher';
import {
  scannerReferenceStore,
  type ReferenceDescriptor,
  type ScannerCatalogIdentity,
  type ScannerRecognitionReference,
} from '@/services/scanner/scannerReferenceStore';
import { ReferenceEnrollment } from '../ReferenceEnrollment';

const enrollmentMocks = vi.hoisted(() => ({
  search: vi.fn(),
  createDescriptor: vi.fn(),
}));

vi.mock('@/services/catalogService', () => ({
  catalogService: { search: enrollmentMocks.search },
}));

vi.mock('@/services/scanner/localReferenceMatcher', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/scanner/localReferenceMatcher')>();
  return { ...original, createPerceptualHashDescriptor: enrollmentMocks.createDescriptor };
});

const DATABASE_NAME = 'pocket-market-binder';
const photo = new Blob(['private test photo bytes'], { type: 'image/jpeg' });
const descriptor: ReferenceDescriptor = {
  representation: 'compact-descriptor',
  kind: 'perceptual-hash',
  version: LOCAL_PHASH_VERSION,
  value: '0123456789abcdef',
  dimensions: [32, 32],
  metadata: { colorSpace: 'grayscale', algorithm: 'dct' },
};
const card: Card = {
  id: 'base1-2',
  name: 'Ivysaur',
  category: 'pokemon',
  rarity: 'uncommon',
  setCode: 'base1',
  setName: 'Base Set',
  setNumber: '2',
  variants: { normal: true, holo: true },
  catalogArtwork: {
    provider: 'tcgdex',
    providerCardId: 'base1-2',
    printingIdentity: {
      setId: 'base1',
      cardNumber: '2',
      name: 'Ivysaur',
      providerIds: { tcgdex: ['base1-2'] },
    },
    imageUrls: {},
  },
  identity: {
    setId: 'base1',
    cardNumber: '2',
    name: 'Ivysaur',
    language: 'en',
    variants: { normal: true, holo: true },
    providerIds: { tcgdex: ['base1-2'] },
  },
};

function cardSummary(value: Card): string {
  return `${value.setName ?? value.setCode} #${value.setNumber}`;
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('App database deletion was blocked'));
  });
}

function candidate(variant = 'normal'): ScannerCandidate & ScannerCatalogIdentity {
  return {
    catalogProvider: 'tcgdex',
    catalogId: card.id,
    gameKey: 'pokemon',
    name: card.name,
    collectorNumber: card.setNumber,
    setCode: card.setCode,
    language: 'en',
    variant,
    provider: 'manual-catalog-search',
    providers: ['manual-catalog-search'],
  };
}

function makeReference(
  referenceId: string,
  state: 'active' | 'retired',
  referenceDescriptor = descriptor,
  variant = 'normal',
): ScannerRecognitionReference {
  const identity = {
    catalogProvider: 'tcgdex',
    catalogId: card.id,
    gameKey: 'pokemon',
    name: card.name,
    collectorNumber: card.setNumber,
    setCode: card.setCode,
    language: 'en',
    variant,
  };
  return {
    referenceId,
    identityKey: JSON.stringify(['pokemon', 'tcgdex', card.id, 'en', variant]),
    identity,
    descriptor: referenceDescriptor,
    ownershipScope: 'local',
    createdAt: '2026-09-30T00:00:00.000Z',
    revision: state === 'active' ? 1 : 2,
    state,
    provenance: {
      confirmedBy: 'user',
      confirmationMethod: 'manual-catalog-search',
      confirmedAt: '2026-09-30T00:00:00.000Z',
      recognitionProviders: ['manual-catalog-search'],
    },
    ...(state === 'retired'
      ? { retiredAt: '2026-09-30T01:00:00.000Z', retirementReason: 'user-retired' as const }
      : {}),
  };
}

function findButton(container: HTMLDivElement, text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((button) => button.textContent?.includes(text));
}

describe('ReferenceEnrollment', () => {
  let container: HTMLDivElement;
  let root: Root;
  let rootMounted: boolean;
  let closeOnCancel: ReturnType<typeof vi.fn>;
  let confirmDialog: { mockReturnValue(value: boolean): unknown };

  beforeEach(async () => {
    closeLocalDatabase();
    await deleteDatabase();
    await storage.set('binder', [{ cardId: 'existing-binder-card', quantity: 2, addedAt: 1 }]);
    enrollmentMocks.search.mockReset().mockResolvedValue([card]);
    enrollmentMocks.createDescriptor.mockReset().mockResolvedValue(descriptor);
    confirmDialog = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    rootMounted = true;
    closeOnCancel = vi.fn();
  });

  afterEach(async () => {
    if (rootMounted) await act(async () => root.unmount());
    container.remove();
    closeLocalDatabase();
    await deleteDatabase();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function renderEnrollment(image: Blob | null = photo): Promise<void> {
    await act(async () => root.render(createElement(ReferenceEnrollment, { image, onClose: closeOnCancel })));
  }

  async function searchAndSelectCard(variant = 'normal'): Promise<void> {
    const input = container.querySelector<HTMLInputElement>('#reference-catalog-search');
    if (!input) throw new Error('Catalog search input was not rendered.');
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!valueSetter) throw new Error('Input value setter is unavailable.');
    await act(async () => {
      valueSetter.call(input, 'Ivysaur');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const searchButton = findButton(container, 'Search cards');
    if (!searchButton) throw new Error('Catalog search action was not rendered.');
    await act(async () => {
      searchButton.click();
      await Promise.resolve();
    });
    const selectButtonName = `Select ${card.name}, ${cardSummary(card)}`;
    await vi.waitFor(() => expect(container.querySelector(`button[aria-label="${selectButtonName}"]`)).not.toBeNull());
    const selectButton = container.querySelector<HTMLButtonElement>(`button[aria-label="${selectButtonName}"]`);
    if (!selectButton) throw new Error('Catalog card was not selectable.');
    await act(async () => selectButton.click());

    const variantSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Printing / variant"]');
    if (variantSelect) {
      await act(async () => {
        variantSelect.value = variant;
        variantSelect.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
    }
    await vi.waitFor(() => expect(container.textContent).not.toContain('Checking existing references...'));
  }

  it('saves a confirmed manually identified photo as a compact reference and makes it matchable', async () => {
    const originalBinder = await storage.get('binder');
    await renderEnrollment(photo);
    await searchAndSelectCard('normal');

    const saveButton = findButton(container, 'Confirm card and save reference');
    if (!saveButton) throw new Error('Reference save action was not rendered.');
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
    });

    expect(confirmDialog).toHaveBeenCalledWith(expect.stringContaining('is the exact card in the photo'));
    expect(enrollmentMocks.createDescriptor).toHaveBeenCalledWith(photo);
    const references = await scannerReferenceStore.listByIdentity(candidate('normal'));
    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({
      identity: {
        catalogProvider: 'tcgdex',
        catalogId: 'base1-2',
        gameKey: 'pokemon',
        language: 'en',
        variant: 'normal',
      },
      descriptor,
      provenance: { confirmationMethod: 'manual-catalog-search', confirmedBy: 'user' },
    });
    expect(references[0]).not.toHaveProperty('photo');
    expect(references[0]).not.toHaveProperty('image');
    expect(JSON.stringify(references[0])).not.toContain('private test photo bytes');
    await expect(storage.get('binder')).resolves.toEqual(originalBinder);

    const matcher = createLocalReferenceScannerProvider(scannerReferenceStore, async () => descriptor);
    await expect(identifyImageWithProviders([matcher], photo)).resolves.toMatchObject({
      status: 'success',
      candidates: [{ catalogProvider: 'tcgdex', catalogId: 'base1-2', variant: 'normal' }],
    });
  });

  it('requires the final explicit save confirmation', async () => {
    confirmDialog.mockReturnValue(false);
    await renderEnrollment(photo);
    await searchAndSelectCard('normal');
    const saveButton = findButton(container, 'Confirm card and save reference');
    if (!saveButton) throw new Error('Reference save action was not rendered.');

    await act(async () => saveButton.click());

    expect(enrollmentMocks.createDescriptor).not.toHaveBeenCalled();
    await expect(scannerReferenceStore.listActive()).resolves.toEqual([]);
  });

  it('handles missing and invalid images without searching or saving', async () => {
    await renderEnrollment(null);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Choose a valid card photo');
    expect(container.querySelector('#reference-catalog-search')).toBeNull();

    await act(async () => root.render(createElement(ReferenceEnrollment, {
      image: new Blob(['not an image'], { type: 'text/plain' }),
      onClose: closeOnCancel,
    })));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Choose a valid card photo');
    expect(enrollmentMocks.search).not.toHaveBeenCalled();
  });

  it('requires a manually selected catalog card before saving', async () => {
    await renderEnrollment(photo);
    const input = container.querySelector<HTMLInputElement>('#reference-catalog-search');
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!input || !valueSetter) throw new Error('Catalog search input was not rendered.');
    await act(async () => {
      valueSetter.call(input, 'Ivysaur');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const searchButton = findButton(container, 'Search cards');
    if (!searchButton) throw new Error('Catalog search action was not rendered.');
    await act(async () => { searchButton.click(); await Promise.resolve(); });
    expect(container.textContent).toContain('Ivysaur');
    expect(findButton(container, 'Confirm card and save reference')).toBeUndefined();
    expect(enrollmentMocks.createDescriptor).not.toHaveBeenCalled();
  });

  it('reports reference save failures without persisting the photo or changing Binder', async () => {
    const originalBinder = await storage.get('binder');
    vi.spyOn(scannerReferenceStore, 'saveConfirmedReference').mockRejectedValueOnce(new Error('IndexedDB write failed.'));
    await renderEnrollment(photo);
    await searchAndSelectCard('normal');
    const saveButton = findButton(container, 'Confirm card and save reference');
    if (!saveButton) throw new Error('Reference save action was not rendered.');

    await act(async () => saveButton.click());
    await vi.waitFor(() => expect(container.textContent).toContain('Could not save the recognition reference'));

    await expect(scannerReferenceStore.listActive()).resolves.toEqual([]);
    await expect(storage.get('binder')).resolves.toEqual(originalBinder);
  });

  it('shows the existing-reference message and does not save an active duplicate', async () => {
    const existing = await scannerReferenceStore.saveConfirmedReference(
      confirmScannerCandidate(candidate('normal')),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );
    await renderEnrollment(photo);
    await searchAndSelectCard('normal');

    expect(container.textContent).toContain('This card already has a recognition reference.');
    expect(findButton(container, 'Confirm card and save reference')).toBeUndefined();
    await expect(scannerReferenceStore.listByIdentity(candidate('normal'))).resolves.toEqual([existing]);
  });

  it('offers explicit reactivation or replacement for an inactive reference', async () => {
    const existing = await scannerReferenceStore.saveConfirmedReference(
      confirmScannerCandidate(candidate('normal')),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );
    await scannerReferenceStore.retire(existing.referenceId);
    await renderEnrollment(photo);
    await searchAndSelectCard('normal');

    expect(container.textContent).toContain('An inactive recognition reference exists.');
    expect(findButton(container, 'Reactivate existing reference')).toBeDefined();
    expect(findButton(container, 'Replace existing recognition reference')).toBeDefined();
    expect(findButton(container, 'Confirm card and save reference')).toBeUndefined();
  });

  it('reactivates an existing reference without changing its descriptor', async () => {
    const existing = await scannerReferenceStore.saveConfirmedReference(
      confirmScannerCandidate(candidate('normal')),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );
    await scannerReferenceStore.retire(existing.referenceId);
    await renderEnrollment(photo);
    await searchAndSelectCard('normal');
    const reactivateButton = findButton(container, 'Reactivate existing reference');
    if (!reactivateButton) throw new Error('Reference reactivation action was not rendered.');

    await act(async () => { reactivateButton.click(); await Promise.resolve(); });

    expect(confirmDialog).toHaveBeenCalledWith(expect.stringContaining('Reactivate the existing recognition reference'));
    const active = await scannerReferenceStore.findByIdentity(candidate('normal'));
    expect(active).toHaveLength(1);
    expect(active[0].referenceId).toBe(existing.referenceId);
    expect(active[0].descriptor).toEqual(descriptor);
  });

  it('requires confirmation to replace an inactive reference and leaves one active result', async () => {
    const existing = await scannerReferenceStore.saveConfirmedReference(
      confirmScannerCandidate(candidate('normal')),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );
    await scannerReferenceStore.retire(existing.referenceId);
    const replacementDescriptor = { ...descriptor, value: 'fedcba9876543210' };
    enrollmentMocks.createDescriptor.mockResolvedValue(replacementDescriptor);
    await renderEnrollment(photo);
    await searchAndSelectCard('normal');
    const replaceButton = findButton(container, 'Replace existing recognition reference');
    if (!replaceButton) throw new Error('Reference replacement action was not rendered.');

    await act(async () => { replaceButton.click(); await Promise.resolve(); });

    expect(confirmDialog).toHaveBeenCalledWith(expect.stringContaining('Replace the existing recognition reference'));
    const active = await scannerReferenceStore.findByIdentity(candidate('normal'));
    const history = await scannerReferenceStore.listByIdentity(candidate('normal'));
    expect(active).toHaveLength(1);
    expect(active[0].descriptor).toEqual(replacementDescriptor);
    expect(history).toHaveLength(2);
    expect(history.find((reference) => reference.referenceId === existing.referenceId))
      .toMatchObject({ state: 'retired', descriptor });
  });

  it('leaves inactive references unchanged when reactivation or replacement is cancelled', async () => {
    const existing = await scannerReferenceStore.saveConfirmedReference(
      confirmScannerCandidate(candidate('normal')),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );
    const retired = await scannerReferenceStore.retire(existing.referenceId);
    await renderEnrollment(photo);
    await searchAndSelectCard('normal');
    confirmDialog.mockReturnValue(false);

    const reactivateButton = findButton(container, 'Reactivate existing reference');
    if (!reactivateButton) throw new Error('Reference reactivation action was not rendered.');
    await act(async () => reactivateButton.click());
    await expect(scannerReferenceStore.listByIdentity(candidate('normal'))).resolves.toEqual([retired]);

    const replaceButton = findButton(container, 'Replace existing recognition reference');
    if (!replaceButton) throw new Error('Reference replacement action was not rendered.');
    await act(async () => replaceButton.click());
    expect(enrollmentMocks.createDescriptor).not.toHaveBeenCalled();
    await expect(scannerReferenceStore.listByIdentity(candidate('normal'))).resolves.toEqual([retired]);
  });
});
