# Local scanner references

Local recognition references are optional descriptors derived from a user photo to help future scans of a user-confirmed card. They are separate from Binder records and never establish or mutate Binder identity.

The reference store accepts a versioned, provider-neutral descriptor payload and a source-scoped catalog identity (`catalogProvider` + `catalogId`, with optional `gameKey`). Catalog IDs are not assumed to be globally unique. The store does not create descriptors or include a visual recognizer.

A candidate must pass through explicit user confirmation before reference creation. Creation is a separate opt-in action; the original photo is not retained automatically. References can be listed, found by identity, replaced, retired, or deleted. Only active references are returned for matching. Provenance records the user confirmation method and recognition sources when available.

V1 references remain in the app's local IndexedDB database and are not included in Binder sync. No server/shared reference store, photo upload, third-party image corpus, or automatic scan retention is provided.
