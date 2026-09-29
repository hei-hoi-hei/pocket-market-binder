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
  representation: 'compact-descriptor',
  kind: 'perceptual-hash',
  value: '0123456789abcdef',
  version: 'hash-v1',
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

  it('defaults newly created references to local ownership', async () => {
    const saved = await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );

    expect(saved.ownershipScope).toBe('local');
  });

  it('supports account-owned references without assigning an account ID', async () => {
    const saved = await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      descriptor,
      { confirmationMethod: 'candidate-review', ownershipScope: 'account' },
    );

    expect(saved.ownershipScope).toBe('account');
    expect(saved).not.toHaveProperty('accountId');
  });

  it('rejects account-scoped raw-image-like binary payloads', async () => {
    const rawImageLike = {
      kind: 'raw-photo',
      version: 'image-v1',
      data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
    } as unknown as ReferenceDescriptor;

    await expect(store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      rawImageLike,
      { confirmationMethod: 'candidate-review', ownershipScope: 'account' },
    )).rejects.toThrow(/compact descriptor representation/);
    await expect(store.listActive()).resolves.toEqual([]);
  });

  it('does not accept Blob payloads as descriptors', async () => {
    const blobPayload = {
      representation: 'compact-descriptor',
      kind: 'perceptual-hash',
      version: 'hash-v1',
      value: '0123456789abcdef',
      image: new Blob(['photo']),
    } as unknown as ReferenceDescriptor;

    await expect(store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      blobPayload,
      { confirmationMethod: 'candidate-review' },
    )).rejects.toThrow(/compact descriptor representation/);
  });

  it('keeps local and account references distinguishable for the same identity', async () => {
    const local = await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );
    const account = await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      descriptor,
      { confirmationMethod: 'candidate-review', ownershipScope: 'account' },
    );

    await expect(store.findByIdentity(identity(pikachu))).resolves.toEqual([local, account]);
    await expect(store.listActive()).resolves.toEqual([local, account]);
    expect(new Set([local.ownershipScope, account.ownershipScope])).toEqual(
      new Set(['local', 'account']),
    );
  });

  it('loads legacy references without ownership as local without rewriting them', async () => {
    const saved = await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );
    const database = await openLocalDatabase();
    const writeTransaction = database.transaction('scanner-recognition-references', 'readwrite');
    const legacyRecord = { ...saved };
    delete (legacyRecord as Partial<typeof saved>).ownershipScope;
    legacyRecord.descriptor = {
      kind: 'perceptual-hash',
      version: 'hash-v1',
      data: new Uint8Array([1, 2, 3, 4]),
    } as unknown as ReferenceDescriptor;
    writeTransaction.objectStore('scanner-recognition-references').put(legacyRecord);
    await new Promise<void>((resolve, reject) => {
      writeTransaction.oncomplete = () => resolve();
      writeTransaction.onerror = () => reject(writeTransaction.error);
      writeTransaction.onabort = () => reject(writeTransaction.error);
    });

    const loaded = await store.findByIdentity(identity(pikachu));
    expect(loaded[0].ownershipScope).toBe('local');
    expect(loaded[0].descriptor).toMatchObject({
      kind: 'perceptual-hash',
      version: 'hash-v1',
      data: new Uint8Array([1, 2, 3, 4]),
    });

    const readTransaction = database.transaction('scanner-recognition-references', 'readonly');
    const storedRecord = readTransaction.objectStore('scanner-recognition-references').get(saved.referenceId);
    const rawStoredRecord = await new Promise<Record<string, unknown>>((resolve, reject) => {
      storedRecord.onsuccess = () => resolve(storedRecord.result as Record<string, unknown>);
      storedRecord.onerror = () => reject(storedRecord.error);
    });
    expect(rawStoredRecord).not.toHaveProperty('ownershipScope');
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
      { ...descriptor, value: 'fedcba9876543210' },
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

  it('preserves the descriptor representation, version, value, dimensions, and metadata', async () => {
    const saved = await store.saveConfirmedReference(
      confirmScannerCandidate(pikachu),
      descriptor,
      { confirmationMethod: 'candidate-review' },
    );

    expect(saved.descriptor).toEqual(descriptor);
    expect(saved.descriptor).not.toBe(descriptor);
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
