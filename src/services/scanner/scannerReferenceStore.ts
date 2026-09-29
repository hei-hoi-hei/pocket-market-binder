import {
  getScannerCandidateConfirmationTime,
  isConfirmedScannerCandidate,
  type ConfirmedScannerCandidate,
} from './types';
import {
  openLocalDatabase,
  RECOGNITION_REFERENCES_STORE,
} from '../storage';

export interface ScannerCatalogIdentity {
  catalogProvider: string;
  catalogId: string;
  gameKey?: string;
  name?: string;
  collectorNumber?: string;
  setCode?: string;
  language?: string;
  variant?: string;
}

export interface ReferenceDescriptor {
  kind: string;
  version: string;
  data: Uint8Array;
  dimensions?: number[];
  metadata?: Record<string, string | number | boolean>;
}

export interface ScannerReferenceCreationOptions {
  confirmationMethod: 'candidate-review' | 'manual-catalog-search';
  captureConditions?: string[];
  qualityNotes?: string;
}

export type ScannerReferenceRetirementReason = 'replaced' | 'user-retired';

export interface ScannerRecognitionReference {
  referenceId: string;
  identityKey: string;
  identity: ScannerCatalogIdentity;
  descriptor: ReferenceDescriptor;
  createdAt: string;
  revision: number;
  state: 'active' | 'retired';
  provenance: {
    confirmedBy: 'user';
    confirmationMethod: ScannerReferenceCreationOptions['confirmationMethod'];
    confirmedAt: string;
    recognitionProviders: string[];
  };
  captureConditions?: string[];
  qualityNotes?: string;
  retiredAt?: string;
  retirementReason?: ScannerReferenceRetirementReason;
}

export interface ScannerReferenceStore {
  findByIdentity(identity: ScannerCatalogIdentity): Promise<ScannerRecognitionReference[]>;
  listActive(): Promise<ScannerRecognitionReference[]>;
  saveConfirmedReference(
    candidate: ConfirmedScannerCandidate,
    descriptor: ReferenceDescriptor,
    options: ScannerReferenceCreationOptions,
  ): Promise<ScannerRecognitionReference>;
  replace(
    referenceId: string,
    candidate: ConfirmedScannerCandidate,
    descriptor: ReferenceDescriptor,
    options: ScannerReferenceCreationOptions,
  ): Promise<ScannerRecognitionReference>;
  retire(
    referenceId: string,
    reason?: ScannerReferenceRetirementReason,
  ): Promise<ScannerRecognitionReference>;
  delete(referenceId: string): Promise<void>;
}

interface StoreDependencies {
  openDatabase: typeof openLocalDatabase;
  now: () => Date;
  createId: () => string;
}

const STORE_ERROR = 'The local scanner reference store could not complete the operation.';

function identityKey(identity: ScannerCatalogIdentity): string {
  return JSON.stringify([
    identity.gameKey?.trim() ?? '',
    identity.catalogProvider.trim(),
    identity.catalogId.trim(),
  ]);
}

function validateIdentity(identity: ScannerCatalogIdentity): ScannerCatalogIdentity {
  if (
    !identity.catalogProvider.trim() ||
    !identity.catalogId.trim() ||
    (identity.gameKey !== undefined && !identity.gameKey.trim())
  ) {
    throw new Error('A scanner reference requires a catalog provider and catalog ID namespace.');
  }
  return {
    ...identity,
    catalogProvider: identity.catalogProvider.trim(),
    catalogId: identity.catalogId.trim(),
    ...(identity.gameKey ? { gameKey: identity.gameKey.trim() } : {}),
  };
}

function validateDescriptor(descriptor: ReferenceDescriptor): ReferenceDescriptor {
  if (
    !descriptor.kind.trim() ||
    !descriptor.version.trim() ||
    !(descriptor.data instanceof Uint8Array) ||
    descriptor.data.byteLength === 0
  ) {
    throw new Error('A scanner reference requires a versioned, non-empty descriptor.');
  }
  if (
    descriptor.dimensions?.some((dimension) =>
      !Number.isInteger(dimension) || dimension <= 0,
    )
  ) {
    throw new Error('Descriptor dimensions must be positive integers.');
  }
  for (const value of Object.values(descriptor.metadata ?? {})) {
    if (
      typeof value !== 'string' &&
      typeof value !== 'boolean' &&
      !(typeof value === 'number' && Number.isFinite(value))
    ) {
      throw new Error('Descriptor metadata must contain only scalar values.');
    }
  }
  return {
    ...descriptor,
    data: new Uint8Array(descriptor.data),
    ...(descriptor.dimensions ? { dimensions: [...descriptor.dimensions] } : {}),
    ...(descriptor.metadata ? { metadata: { ...descriptor.metadata } } : {}),
  };
}

function validateOptions(options: ScannerReferenceCreationOptions): ScannerReferenceCreationOptions {
  if (!['candidate-review', 'manual-catalog-search'].includes(options.confirmationMethod)) {
    throw new Error('A scanner reference requires an explicit confirmation method.');
  }
  if (
    options.captureConditions?.some((condition) =>
      typeof condition !== 'string' || !condition.trim(),
    )
  ) {
    throw new Error('Capture conditions must be non-empty text labels.');
  }
  if (options.qualityNotes !== undefined && !options.qualityNotes.trim()) {
    throw new Error('Quality notes must not be empty when provided.');
  }
  return {
    ...options,
    ...(options.captureConditions
      ? { captureConditions: options.captureConditions.map((condition) => condition.trim()) }
      : {}),
    ...(options.qualityNotes ? { qualityNotes: options.qualityNotes.trim() } : {}),
  };
}

function cloneReference(reference: ScannerRecognitionReference): ScannerRecognitionReference {
  return {
    ...reference,
    identity: { ...reference.identity },
    descriptor: validateDescriptor(reference.descriptor),
    provenance: {
      ...reference.provenance,
      recognitionProviders: [...reference.provenance.recognitionProviders],
    },
    ...(reference.captureConditions ? { captureConditions: [...reference.captureConditions] } : {}),
  };
}

function transaction<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  execute: (
    objectStore: IDBObjectStore,
    setResult: (value: T) => void,
    fail: (error: unknown) => void,
  ) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let result: T;
    let failed = false;
    let tx: IDBTransaction;
    try {
      tx = database.transaction(RECOGNITION_REFERENCES_STORE, mode);
    } catch (error) {
      reject(error);
      return;
    }

    const fail = (error: unknown) => {
      if (failed) return;
      failed = true;
      try {
        tx.abort();
      } catch {
        // The transaction may already have aborted.
      }
      reject(error instanceof Error ? error : new Error(STORE_ERROR));
    };

    tx.oncomplete = () => {
      if (!failed) resolve(result);
    };
    tx.onerror = () => fail(tx.error ?? new Error(STORE_ERROR));
    tx.onabort = () => fail(tx.error ?? new Error(STORE_ERROR));

    try {
      execute(
        tx.objectStore(RECOGNITION_REFERENCES_STORE),
        (value) => { result = value; },
        fail,
      );
    } catch (error) {
      fail(error);
    }
  });
}

function createReference(
  candidate: ConfirmedScannerCandidate,
  descriptor: ReferenceDescriptor,
  options: ScannerReferenceCreationOptions,
  dependencies: StoreDependencies,
): ScannerRecognitionReference {
  if (!isConfirmedScannerCandidate(candidate)) {
    throw new Error('Only an explicitly user-confirmed scanner candidate can create a reference.');
  }
  const confirmedAt = getScannerCandidateConfirmationTime(candidate);
  if (!confirmedAt) {
    throw new Error('The scanner candidate confirmation is no longer available.');
  }
  if (!candidate.catalogProvider || !candidate.catalogId) {
    throw new Error('A confirmed scanner reference requires a catalog provider and catalog ID.');
  }

  const identity = validateIdentity({
    catalogProvider: candidate.catalogProvider,
    catalogId: candidate.catalogId,
    ...(candidate.gameKey ? { gameKey: candidate.gameKey } : {}),
    ...(candidate.name ? { name: candidate.name } : {}),
    ...(candidate.collectorNumber ? { collectorNumber: candidate.collectorNumber } : {}),
    ...(candidate.setCode ? { setCode: candidate.setCode } : {}),
    ...(candidate.language ? { language: candidate.language } : {}),
    ...(candidate.variant ? { variant: candidate.variant } : {}),
  });
  const validatedOptions = validateOptions(options);
  const createdAt = dependencies.now().toISOString();
  return {
    referenceId: dependencies.createId(),
    identityKey: identityKey(identity),
    identity,
    descriptor: validateDescriptor(descriptor),
    createdAt,
    revision: 1,
    state: 'active',
    provenance: {
      confirmedBy: 'user',
      confirmationMethod: validatedOptions.confirmationMethod,
      confirmedAt,
      recognitionProviders: [...new Set(candidate.providers ?? (candidate.provider ? [candidate.provider] : []))]
        .sort(),
    },
    ...(validatedOptions.captureConditions
      ? { captureConditions: validatedOptions.captureConditions }
      : {}),
    ...(validatedOptions.qualityNotes ? { qualityNotes: validatedOptions.qualityNotes } : {}),
  };
}

function compareReferences(
  left: ScannerRecognitionReference,
  right: ScannerRecognitionReference,
): number {
  return left.createdAt.localeCompare(right.createdAt) ||
    left.referenceId.localeCompare(right.referenceId);
}

export function createScannerReferenceStore(
  overrides: Partial<StoreDependencies> = {},
): ScannerReferenceStore {
  const dependencies: StoreDependencies = {
    openDatabase: openLocalDatabase,
    now: () => new Date(),
    createId: () => globalThis.crypto.randomUUID(),
    ...overrides,
  };

  return {
    async findByIdentity(identity) {
      const key = identityKey(validateIdentity(identity));
      const database = await dependencies.openDatabase();
      return transaction<ScannerRecognitionReference[]>(database, 'readonly', (store, setResult) => {
        const request = store.index('identityKey').getAll(key);
        request.onsuccess = () => {
          setResult(
            (request.result as ScannerRecognitionReference[])
              .filter((reference) => reference.state === 'active')
              .map(cloneReference)
              .sort(compareReferences),
          );
        };
      });
    },

    async listActive() {
      const database = await dependencies.openDatabase();
      return transaction<ScannerRecognitionReference[]>(database, 'readonly', (store, setResult) => {
        const request = store.getAll();
        request.onsuccess = () => {
          setResult(
            (request.result as ScannerRecognitionReference[])
              .filter((reference) => reference.state === 'active')
              .map(cloneReference)
              .sort(compareReferences),
          );
        };
      });
    },

    async saveConfirmedReference(candidate, descriptor, options) {
      const reference = createReference(candidate, descriptor, options, dependencies);
      const database = await dependencies.openDatabase();
      return transaction<ScannerRecognitionReference>(database, 'readwrite', (store, setResult) => {
        const request = store.add(reference);
        request.onsuccess = () => setResult(cloneReference(reference));
      });
    },

    async replace(referenceId, candidate, descriptor, options) {
      const reference = createReference(candidate, descriptor, options, dependencies);
      if (referenceId === reference.referenceId) {
        throw new Error('A replacement reference must have a new reference ID.');
      }
      const database = await dependencies.openDatabase();
      return transaction<ScannerRecognitionReference>(database, 'readwrite', (store, setResult, fail) => {
        const request = store.get(referenceId);
        request.onsuccess = () => {
          const previous = request.result as ScannerRecognitionReference | undefined;
          if (!previous || previous.state !== 'active') {
            fail(new Error('Only an active local reference can be replaced.'));
            return;
          }
          if (previous.identityKey !== reference.identityKey) {
            fail(new Error('A replacement reference must keep the same catalog identity.'));
            return;
          }
          const now = dependencies.now().toISOString();
          store.put({
            ...previous,
            state: 'retired',
            revision: previous.revision + 1,
            retiredAt: now,
            retirementReason: 'replaced',
          } satisfies ScannerRecognitionReference);
          const addRequest = store.add(reference);
          addRequest.onsuccess = () => setResult(cloneReference(reference));
        };
      });
    },

    async retire(referenceId, reason = 'user-retired') {
      const database = await dependencies.openDatabase();
      return transaction<ScannerRecognitionReference>(database, 'readwrite', (store, setResult, fail) => {
        const request = store.get(referenceId);
        request.onsuccess = () => {
          const reference = request.result as ScannerRecognitionReference | undefined;
          if (!reference) {
            fail(new Error(`Scanner reference not found: ${referenceId}`));
            return;
          }
          if (reference.state === 'retired') {
            setResult(cloneReference(reference));
            return;
          }
          const retired: ScannerRecognitionReference = {
            ...reference,
            state: 'retired',
            revision: reference.revision + 1,
            retiredAt: dependencies.now().toISOString(),
            retirementReason: reason,
          };
          const putRequest = store.put(retired);
          putRequest.onsuccess = () => setResult(cloneReference(retired));
        };
      });
    },

    async delete(referenceId) {
      const database = await dependencies.openDatabase();
      await transaction<void>(database, 'readwrite', (store, setResult) => {
        const request = store.delete(referenceId);
        request.onsuccess = () => setResult(undefined);
      });
    },
  };
}

export const scannerReferenceStore = createScannerReferenceStore();
