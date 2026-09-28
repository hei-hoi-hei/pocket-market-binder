# Pocket Market Binder — Repository Status Snapshot

This file is a concise pointer to the authoritative project baseline. The detailed and current state is maintained in [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md); product direction and implementation evidence guidance are in [docs/REFERENCE_BRIEF.md](docs/REFERENCE_BRIEF.md).

## Current status

The repository is stable and buildable, with core collection workflows implemented and additional product areas partially implemented or unfinished. Do not describe V1 as 100% complete.

- **Version:** `1.0.0` (`package.json`)
- **Scanner phase:** Phase A provider-agnostic recognition boundary and explicit no-network fallback implemented; no recognition engine is configured, so the fallback truthfully returns unavailable without fabricating candidates.
- **Core:** Binder, wishlist, cart, quantities, manual search, IndexedDB persistence, and PWA shell are implemented.
- **Catalog/artwork:** TCGdex remains the current catalog/identity authority. The artwork resolver supports a provider list, explicit exact-printing/usage states, provider-failure isolation, deterministic candidate selection, provenance, and alternate TCGdex image quality. TCGdex is the only configured production provider and explicitly allows unresolved-usage display for compatibility; this is not a rights claim. Other providers require eligible usage unless explicitly configured otherwise, and explicitly ineligible candidates are rejected. The bounded evidence for 30 missing-image records in `30th-c` is in [docs/ARTWORK_SOURCE_INVESTIGATION.md](docs/ARTWORK_SOURCE_INVESTIGATION.md).
- **Pricing:** The current consolidation engine and attribution foundations exist; live source coverage is limited and TCGdex response extraction requires verification. Future source-pool participation and outlier policy do not change current behavior; the future statistical method remains undecided.
- **Scanner:** Active product requirement. Browser image acquisition, a provider-agnostic recognition boundary, and an explicit offline/no-network fallback exist. The fallback needs no credentials, makes no network request, and returns unavailable because no local recognition engine is configured. Offline OCR/ML, production network-provider selection, candidate review, catalog resolution, native camera, and automatic collection actions remain deferred; manual catalog search remains available.
- **Synchronization:** Partial infrastructure; optional/future scope pending an explicit product decision. Local collection use does not depend on it.
- **Native packaging:** Capacitor configuration exists; no Android/iOS project or APK is present.

## Verification baseline

At the 2026-09-28 reorientation checkpoint, `npm test` passed (36 tests), `npm run typecheck` passed, and `npm run build` passed. These checks establish test/build health, not completion of unimplemented product workflows.

See [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) for lifecycle status, known gaps, and next-step ordering.
