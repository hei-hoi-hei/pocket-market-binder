import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeLocalDatabase,
  openLocalDatabase,
  storage,
} from '../../storage';
import {
  createScannerReferenceStore,
  type ReferenceDescriptor,
  type ScannerCatalogIdentity,
} from '../scannerReferenceStore';
import { confirmScannerCandidate } from '../types';
import type { ScannerCandidate } from '../types';

const DB_NAME = 'pocket-market-binder';

const pikachu: ScannerCandidate = {
  catalogProvider: 'catalog-a',
  catalogId: 'card-25',
  gameKey: 'pokemon',
  name: 'Pikachu',
  collectorNumber: '025',
  setCode: 'set-a',
  language: 'en',
  variant: 'holo',
  providers: ['ocr', 'visual'],
};

const descriptor: ReferenceDescriptor = {
  kind: 'perceptual-hash',
  version: 'hash-v1',
  data: new Uint8Array([1, 2, 3, 4]),
  dimensions: [256],
  metadata: { colorSpace: 'gray', rotation: 0 },
};

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('App database deletion was blocked'));
  });
}

function identity(candidate: ScannerCandidate): ScannerCatalogIdentity {
  return {
    catalogProvider: candidate.catalogProvider!,
    catalogId: candidate.catalogId!,
    gameKey: candidate.gameKey,
  };
}

describe('local scanner reference store', () => {
  let store: ReturnType<typeof createScannerReferenceStore>;
  let nextId: number;
  let closeDatabase: () => void;

  beforeEach(async () => {
    vi.resetModules();
    closeLocalDatabase();
    await deleteDatabase();
    nextId = 0;
    store = createScannerReferenceStore({
      now: () => new Date('2026-09-29T04:00:00.000Z'),
      createId: () => `reference-${++nextId}`,
    });
  });

  afterEach(() => {
    closeDatabase?.();
    closeLocalDatabase();
  });

  it('stores confirmed references in the existing app database schema', async () => {
    const database = await openLocalDatabase();
    closeDatabase = () => database.close();
    expect(database.version).toBe(2);
    expect([...database.objectStoreNames]).toEqual(
      expect.arrayContaining(['kv-store', 'scanner-recognition-references']),
    );
  });

  it('requires explicit user confirmation before creating a reference', async () => {
    const unconfirmed = pikachu as ReturnType<typeof confirmScannerCandidate>;
    await expect(store.saveConfirmedReference(unconfirmed, descriptor, {
      confirmationMethod: 'candidate-review',
    })).rejects.toThrow(/explicitly user-confirmed/);
    await expect(store.listActive()).resolves.toEqual([]);
  });

  it('retrieves active references by source-scoped catalog identity', async () => {
    const saved = await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );

    await expect(store.findByIdentity(identity(pikachu))).resolves.toEqual([saved]);
    await expect(store.listActive()).resolves.toEqual([saved]);
  });

  it('does not treat equal catalog IDs from different namespaces as the same identity', async () => {
    const first = confirmScannerCandidate(pikachu);
    const second = confirmScannerCandidate({
      ...pikachu,
      catalogProvider: 'catalog-b',
    });
    await store.saveConfirmedReference(first, descriptor, {
      confirmationMethod: 'candidate-review',
    });
    const other = await store.saveConfirmedReference(second, descriptor, {
      confirmationMethod: 'candidate-review',
    });

    await expect(store.findByIdentity(identity(pikachu))).resolves.toHaveLength(1);
    await expect(store.findByIdentity({
      ...identity(pikachu),
      catalogProvider: 'catalog-b',
    })).resolves.toEqual([other]);
  });

  it('excludes retired references from active matching', async () => {
    const saved = await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );

    const retired = await store.retire(saved.referenceId);

    expect(retired).toMatchObject({
      state: 'retired',
      retirementReason: 'user-retired',
      revision: 2,
    });
    await expect(store.findByIdentity(identity(pikachu))).resolves.toEqual([]);
    await expect(store.listActive()).resolves.toEqual([]);
  });

  it('deletes a reference from local persistence', async () => {
    const saved = await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );

    await store.delete(saved.referenceId);

    await expect(store.listActive()).resolves.toEqual([]);
  });

  it('allows multiple local references for one confirmed identity', async () => {
    const first = await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );
    const second = await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      { ...descriptor, data: new Uint8Array([5, 6, 7, 8]) },
      { confirmationMethod: 'manual-catalog-search', captureConditions: ['top-loader'] },
    );

    await expect(store.findByIdentity(identity(pikachu))).resolves.toEqual([first, second]);
  });

  it('preserves user-confirmation provenance and capture metadata', async () => {
    const saved = await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      descriptor,
      {
        confirmationMethod: 'manual-catalog-search',
        captureConditions: ['sleeved', 'indoor-light'],
        qualityNotes: 'Text and footer visible',
      },
    );

    expect(saved).toMatchObject({
      createdAt: '2026-09-29T04:00:00.000Z',
      provenance: {
        confirmedBy: 'user',
        confirmationMethod: 'manual-catalog-search',
        recognitionProviders: ['ocr', 'visual'],
      },
      captureConditions: ['sleeved', 'indoor-light'],
      qualityNotes: 'Text and footer visible',
    });
    expect(Date.parse(saved.provenance.confirmedAt)).not.toBeNaN();
  });

  it('preserves descriptor kind, version, bytes, dimensions, and metadata', async () => {
    const saved = await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );

    expect(saved.descriptor).toEqual(descriptor);
    expect(saved.descriptor.data).not.toBe(descriptor.data);
  });

  it('does not mutate Binder persistence when creating a reference', async () => {
    const binder = [{ cardId: 'existing-card', quantity: 2, addedAt: 1 }];
    await storage.set('binder', binder);

    await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );

    await expect(storage.get('binder')).resolves.toEqual(binder);
  });

  it('replaces an active reference atomically without changing its identity', async () => {
    const previous = await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );
    const replacement = await store.replace(
      previous.referenceId,
      confirmScannerCandidate(pikachu),
      { ...descriptor, version: 'hash-v2' },
      { confirmationMethod: 'candidate-review' },
    );

    expect(replacement).toMatchObject({ referenceId: 'reference-2', state: 'active' });
    await expect(store.findByIdentity(identity(pikachu))).resolves.toEqual([replacement]);
    const database = await openLocalDatabase();
    const transaction = database.transaction('scanner-recognition-references', 'readonly');
    const retired = transaction.objectStore('scanner-recognition-references').get(previous.referenceId);
    await expect(new Promise((resolve, reject) => {
      retired.onsuccess = () => resolve(retired.result);
      retired.onerror = () => reject(retired.error);
    })).resolves.toMatchObject({ state: 'retired', retirementReason: 'replaced', revision: 2 });
  });
});
