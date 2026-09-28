# Pocket Market Binder — Repository Status Snapshot

This file is a concise pointer to the authoritative project baseline. The detailed and current state is maintained in [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md); product direction and implementation evidence guidance are in [docs/REFERENCE_BRIEF.md](docs/REFERENCE_BRIEF.md).

## Current status

The repository is stable and buildable, with core collection workflows implemented and additional product areas partially implemented or unfinished. Do not describe V1 as 100% complete.

- **Version:** `1.0.0` (`package.json`)
- **Scanner phase:** Phase A provider-agnostic recognition boundary implemented; no production recognition provider is selected or registered.
- **Core:** Binder, wishlist, cart, quantities, manual search, IndexedDB persistence, and PWA shell are implemented.
- **Catalog/artwork:** TCGdex Pokémon catalog integration and catalog-backed artwork are present; the broader multi-provider resolver is not.
- **Pricing:** Consolidation and attribution foundations exist; live source coverage is limited and TCGdex response extraction requires verification.
- **Scanner:** Active product requirement. Browser image acquisition and a provider-agnostic recognition boundary exist; production recognition, live candidate generation, review, catalog resolution, and collection actions are unfinished.
- **Synchronization:** Partial infrastructure; optional/future scope pending an explicit product decision. Local collection use does not depend on it.
- **Native packaging:** Capacitor configuration exists; no Android/iOS project or APK is present.

## Verification baseline

At the 2026-09-28 reorientation checkpoint, `npm test` passed (36 tests), `npm run typecheck` passed, and `npm run build` passed. These checks establish test/build health, not completion of unimplemented product workflows.

See [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) for lifecycle status, known gaps, and next-step ordering.
