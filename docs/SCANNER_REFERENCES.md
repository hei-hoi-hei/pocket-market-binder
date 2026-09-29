# Local scanner references

Local recognition references are optional descriptors derived from a user photo to help future scans of a user-confirmed card. They are separate from Binder records and never establish or mutate Binder identity.

The reference store accepts a versioned compact-descriptor representation (currently a fixed-width perceptual-hash value) and a source-scoped catalog identity (`catalogProvider` + `catalogId`, with optional `gameKey`). New records cannot store arbitrary binary or Blob payloads as descriptors; existing legacy binary descriptors are readable only as local records and cannot be marked account-owned. Catalog IDs are not assumed to be globally unique. The store does not create descriptors or include a visual recognizer.

A candidate must pass through explicit user confirmation before reference creation. Creation is a separate opt-in action; the original photo is not retained automatically. References can be listed, found by identity, replaced, retired, or deleted. Only active references are returned for matching. Provenance records the user confirmation method and recognition sources when available.

References carry an ownership scope: `local` is device-local, while `account` marks user-owned reference metadata/descriptors as a candidate for future account sync. New references default to `local`; older records without this field are read as `local` and are not rewritten. Account scope does not identify or imply a particular authenticated account.

The provider-neutral sync boundary classifies Binder records, scanner references, and persisted application preferences as user-owned. Account-scoped references contain recognition descriptors and metadata only; raw scanner photos remain excluded. Preferences such as the currently persisted currency setting are still stored locally as before; classification does not activate sync. Device state and catalog caches remain local-only. Scanner raw photos, temporary scan files, unconfirmed candidates, recognition model caches, and third-party image archives are explicitly excluded from sync.

V1 references remain in the app's local IndexedDB database and are not included in Binder collection data or transmitted. No server/shared reference store, photo upload, third-party image corpus, or automatic scan retention is provided. Google authentication and backend sync are future work; account ownership alone does not transmit data, and any future sync requires a separate authenticated sync implementation.
