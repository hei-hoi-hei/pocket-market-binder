// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { closeLocalDatabase, storage } from '@/services/storage';
import { closeSyncDatabase } from '@/services/sync/syncDatabase';
import type { BinderEntry } from '@/types';

const scannerMocks = vi.hoisted(() => ({
  identify: vi.fn(),
  provider: { name: 'local-reference' },
  nativeCameraAvailable: vi.fn(() => false),
  takeNativePhoto: vi.fn(),
  chooseNativePhotoFromGallery: vi.fn(),
}));

const catalogMocks = vi.hoisted(() => ({
  getAll: vi.fn(async () => []),
  getById: vi.fn(async () => undefined),
  search: vi.fn(async () => []),
}));

vi.mock('@/services/scanner/scannerOrchestration', () => ({
  identifyImageWithProviders: scannerMocks.identify,
}));

vi.mock('@/services/scanner/scannerProviders', () => ({
  createScannerProviders: () => [scannerMocks.provider],
}));

vi.mock('@/services/scanner/capacitorCameraAcquisition', () => ({
  isNativeCameraAvailable: scannerMocks.nativeCameraAvailable,
  takeNativePhoto: scannerMocks.takeNativePhoto,
  chooseNativePhotoFromGallery: scannerMocks.chooseNativePhotoFromGallery,
  consumeRestoredCameraAcquisition: () => null,
  subscribeToRestoredCameraAcquisition: () => () => undefined,
}));

vi.mock('@/services/catalogService', () => ({ catalogService: catalogMocks }));

describe('production scanner-to-Binder wiring', () => {
  let container: HTMLDivElement;
  let root: Root;
  let rootMounted: boolean;

  beforeEach(async () => {
    closeLocalDatabase();
    closeSyncDatabase();
    await storage.set('binder', []);
    scannerMocks.identify.mockReset().mockResolvedValue({
      status: 'success',
      candidates: [{
        catalogProvider: 'tcgdex',
        catalogId: 'sv01-001',
        gameKey: 'pokemon',
        name: 'Pikachu',
        collectorNumber: '001',
        setCode: 'sv01',
        providers: ['local-reference'],
      }],
    });
    scannerMocks.nativeCameraAvailable.mockReset().mockReturnValue(false);
    scannerMocks.takeNativePhoto.mockReset();
    scannerMocks.chooseNativePhotoFromGallery.mockReset();
    catalogMocks.getAll.mockReset().mockResolvedValue([]);
    catalogMocks.getById.mockReset().mockResolvedValue(undefined);
    catalogMocks.search.mockReset().mockResolvedValue([]);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:scanner-image'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('scrollTo', vi.fn());
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    rootMounted = true;
  });

  afterEach(async () => {
    if (rootMounted) await act(async () => root.unmount());
    container.remove();
    closeLocalDatabase();
    closeSyncDatabase();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function openScanner(): Promise<HTMLInputElement> {
    await act(async () => root.render(createElement(App)));
    const scanButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Scan Card'));
    if (!scanButton) throw new Error('Home screen scanner action was not rendered.');
    await act(async () => scanButton.click());
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error('Scanner file input was not rendered.');
    return fileInput;
  }

  async function selectFile(fileInput: HTMLInputElement, fileName: string): Promise<File> {
    const file = new File(['card photo'], fileName, { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    await act(async () => fileInput.dispatchEvent(new Event('change', { bubbles: true })));
    return file;
  }

  function findButton(label: string): HTMLButtonElement | undefined {
    return [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes(label));
  }

  async function matchLocalReferences(): Promise<void> {
    const matchButton = findButton('Recognize Card');
    if (!matchButton) throw new Error('Scanner match action was not rendered.');
    await act(async () => {
      matchButton.click();
      await Promise.resolve();
    });
  }

  it('persists exactly one Binder entry only after explicit candidate confirmation', async () => {
    const fileInput = await openScanner();
    await selectFile(fileInput, 'card.jpg');

    expect(await storage.get<BinderEntry[]>('binder')).toEqual([]);
    expect(scannerMocks.identify).not.toHaveBeenCalled();

    await matchLocalReferences();

    expect(container.textContent).toContain('Candidate Review');
    expect(await storage.get<BinderEntry[]>('binder')).toEqual([]);

    const candidateChoice = container.querySelector<HTMLInputElement>('input[type="radio"]');
    if (!candidateChoice) throw new Error('Candidate selection was not rendered.');
    await act(async () => candidateChoice.click());
    expect(await storage.get<BinderEntry[]>('binder')).toEqual([]);

    const confirmButton = findButton('Confirm selected candidate');
    if (!confirmButton) throw new Error('Explicit candidate confirmation was not rendered.');
    await act(async () => confirmButton.click());

    await vi.waitFor(async () => {
      expect(await storage.get<BinderEntry[]>('binder')).toEqual([
        expect.objectContaining({ cardId: 'sv01-001', quantity: 1 }),
      ]);
    });
    expect(scannerMocks.identify).toHaveBeenCalledOnce();
    expect(catalogMocks.search).not.toHaveBeenCalled();
  });

  it('does not add to the Binder for no-match, canceled replacement, or clear', async () => {
    scannerMocks.identify.mockResolvedValue({ status: 'no-match', candidates: [] });
    scannerMocks.nativeCameraAvailable.mockReturnValue(true);
    scannerMocks.takeNativePhoto.mockResolvedValue({ status: 'cancelled' });
    const fileInput = await openScanner();
    await selectFile(fileInput, 'no-match.jpg');
    await matchLocalReferences();

    expect(container.textContent).toContain('No recognition candidates were returned');
    expect(findButton('Confirm selected candidate')).toBeUndefined();
    expect(await storage.get<BinderEntry[]>('binder')).toEqual([]);

    const takeNewPhoto = findButton('Take New Photo');
    if (!takeNewPhoto) throw new Error('Native replacement action was not rendered.');
    await act(async () => {
      takeNewPhoto.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Selected: no-match.jpg');
    expect(await storage.get<BinderEntry[]>('binder')).toEqual([]);

    const removeButton = findButton('Remove Picture');
    if (!removeButton) throw new Error('Clear image action was not rendered.');
    await act(async () => removeButton.click());
    expect(container.textContent).not.toContain('Selected: no-match.jpg');
    expect(await storage.get<BinderEntry[]>('binder')).toEqual([]);
  });

  it('does not insert when recognition for a replaced image resolves late', async () => {
    let resolveImageA!: (result: { status: 'success'; candidates: Array<Record<string, unknown>> }) => void;
    scannerMocks.identify.mockImplementationOnce(() => new Promise((resolve) => {
      resolveImageA = resolve;
    }));
    const fileInput = await openScanner();
    await selectFile(fileInput, 'image-a.jpg');
    await matchLocalReferences();
    const signalA = scannerMocks.identify.mock.calls[0][2] as AbortSignal;

    await selectFile(fileInput, 'image-b.jpg');
    expect(signalA.aborted).toBe(true);
    await act(async () => {
      resolveImageA({
        status: 'success',
        candidates: [{
          catalogProvider: 'tcgdex',
          catalogId: 'sv01-stale',
          name: 'Stale candidate',
        }],
      });
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Selected: image-b.jpg');
    expect(container.textContent).not.toContain('Stale candidate');
    expect(await storage.get<BinderEntry[]>('binder')).toEqual([]);
  });

  it('routes a future provider candidate with a supported catalog identity after explicit confirmation', async () => {
    scannerMocks.identify.mockResolvedValue({
      status: 'success',
      candidates: [{
        catalogProvider: 'tcgdex',
        catalogId: 'sv01-visual',
        name: 'Future visual provider card',
        provider: 'future-visual',
        providers: ['future-visual'],
      }],
    });
    const fileInput = await openScanner();
    await selectFile(fileInput, 'future-provider.jpg');
    await matchLocalReferences();
    expect(await storage.get<BinderEntry[]>('binder')).toEqual([]);
    const candidateChoice = container.querySelector<HTMLInputElement>('input[type="radio"]');
    if (!candidateChoice) throw new Error('Candidate selection was not rendered.');
    await act(async () => candidateChoice.click());
    const confirmButton = findButton('Confirm selected candidate');
    if (!confirmButton) throw new Error('Explicit candidate confirmation was not rendered.');
    await act(async () => confirmButton.click());

    await vi.waitFor(async () => {
      expect(await storage.get<BinderEntry[]>('binder')).toEqual([
        expect.objectContaining({ cardId: 'sv01-visual', quantity: 1 }),
      ]);
    });
  });

  it('does not route a confirmed candidate with an unsupported catalog namespace to Binder', async () => {
    scannerMocks.identify.mockResolvedValue({
      status: 'success',
      candidates: [{
        catalogProvider: 'unsupported-catalog',
        catalogId: 'card-unknown',
        name: 'Unsupported catalog card',
        provider: 'future-visual',
        providers: ['future-visual'],
      }],
    });
    const fileInput = await openScanner();
    await selectFile(fileInput, 'unsupported-catalog.jpg');
    await matchLocalReferences();
    const candidateChoice = container.querySelector<HTMLInputElement>('input[type="radio"]');
    if (!candidateChoice) throw new Error('Candidate selection was not rendered.');
    await act(async () => candidateChoice.click());
    const confirmButton = findButton('Confirm selected candidate');
    if (!confirmButton) throw new Error('Explicit candidate confirmation was not rendered.');
    await act(async () => confirmButton.click());

    expect(await storage.get<BinderEntry[]>('binder')).toEqual([]);
  });
});