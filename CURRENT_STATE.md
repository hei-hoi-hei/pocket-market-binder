# Pocket Market Binder — Repository Status Snapshot

This file is a concise pointer to the authoritative project baseline. The detailed and current state is maintained in [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md); product direction and implementation evidence guidance are in [docs/REFERENCE_BRIEF.md](docs/REFERENCE_BRIEF.md).

## Current status

The repository is stable and buildable, with core collection workflows implemented and additional product areas partially implemented or unfinished. Do not describe V1 as 100% complete.

- **Version:** `1.0.0` (`package.json`)
- **V1 scope:** Card Reference + Market Value + Acquisition Calculator. The virtual cart is a local, offline acquisition-cost planner; it does not discover sellers or listings. V1 requires no backend, login, paid API, or marketplace scraping. Shared backend/cache and remote backup are optional future extensions.
- **Scanner phase:** Provider-neutral recognition contracts and a service-level no-network fallback are implemented. The production ScannerScreen uses local perceptual matching against user-confirmed references; no OCR/ML or network card-recognition engine is configured, so unseen cards require manual catalog search.
- **Core:** Binder, wishlist, cart, quantities, manual search, IndexedDB persistence, and PWA shell are implemented.
- **Catalog/artwork:** TCGdex is the current configured catalog provider, not the permanent identity authority. The artwork resolver supports a provider list, explicit exact-printing/usage states, provider-failure isolation, deterministic candidate selection, provenance, and alternate TCGdex image quality. Legacy untagged image slots are treated only as current-catalog compatibility data. TCGdex is the only configured production provider and explicitly allows unresolved-usage display for compatibility; this is not a rights claim. Other providers require eligible usage unless explicitly configured otherwise, and explicitly ineligible candidates are rejected. The bounded evidence for 30 missing-image records in `30th-c` is in [docs/ARTWORK_SOURCE_INVESTIGATION.md](docs/ARTWORK_SOURCE_INVESTIGATION.md).
- **Pricing:** The current consolidation engine and attribution foundations exist; live source coverage is limited and TCGdex response extraction requires verification. Future source-pool participation and outlier policy do not change current behavior; the future statistical method remains undecided.
- **Scanner:** Active product requirement. Browser file acquisition and Android Capacitor camera/gallery acquisition share a Blob boundary and local reference-matching path. Candidate Review remains advisory; App routes only an explicitly confirmed local-reference TCGdex ID to the existing Binder action. Local-reference matches are advisory; OCR/ML recognition of unseen cards and live catalog resolution remain unavailable. Manual catalog search remains available.
- **Synchronization:** Partial collection-sync infrastructure; distinct from optional future shared-reference caching and backup. Additional multi-device collection synchronization remains optional/future pending a separate decision.
- **Backup/restore:** Local manual export/import exists; stronger versioned, validated, resilient restore remains incomplete. Remote/automatic backup and cloud sync are optional future extensions, not V1 requirements. Disposable shared/reference caches are not required in backups.
- **Native packaging:** Android Capacitor project and Camera/App plugin acquisition foundation exist; camera results can be restored after process recreation without persisting photos. No APK has been built or device-validated, and no iOS project is present.

## Verification baseline

At the 2026-09-28 reorientation checkpoint, `npm test` passed (36 tests), `npm run typecheck` passed, and `npm run build` passed. These checks establish test/build health, not completion of unimplemented product workflows.

See [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) for lifecycle status, known gaps, and next-step ordering.
