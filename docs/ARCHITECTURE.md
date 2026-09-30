# Architecture

## Current Application Architecture
The current application follows a clean layered architecture separating UI components, React state context, application services, IndexedDB, and external APIs. V1 is local-first and does not require a PMB backend:

```text
┌─────────────────────────────────────────────────────────────┐
│                          UI / PWA                           │
│  (Home / Binder / Search / Card Detail / Wishlist / Cart)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       React Contexts                        │
│             (CollectionContext, NavContext)                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Application Service Layer                  │
│   (collectionService, catalogService, pricingService,       │
│    storage, artworkService)                                 │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌─────────────────────────────┐┌──────────────────────────────┐
│          IndexedDB          ││ Optional Future Backend/API │
│  (user state + local cache) ││   (shared reference cache)   │
└─────────────────────────────└──────────────────────────────┘
                                      ↑
                               External Providers
                         (TCGdex / pricing / artwork)
```

Request paths:

```text
Cold:              User → Provider adapter → User/device cache
Warm device cache: User → IndexedDB → User
```

A shared reference backend/cache is an optional future extension, not a V1
requirement. If implemented later, it must remain distinct from locally owned
Binder/Wishlist/Cart state.

## Major Modules and Responsibilities
- `src/components/`: Reusable UI elements (cards, grids, stat displays, steppers, navigation).
- `src/screens/`: Page-level components (`HomeScreen`, `BinderScreen`, `SearchScreen`, `CardDetailScreen`, `WishlistScreen`, `CartScreen`).
- `src/context/`: State management (`CollectionContext`, `NavContext`).
- `src/services/`: Core application services (`collectionService`, `catalogService`, `pricingService`, `storage`, `artworkService`).
- `src/services/providers/`: Provider adapters (`tcgdexProvider`, `tickermintProvider`, `pkmnpricesProvider`, `justtcgProvider`, `scrydexProvider`, `pricingProvider`).
- `src/types/`: Core domain TypeScript interfaces.
- `src/utils/`: Formatting and utility functions.

## Data Flow & State Management
1. UI interacts with React Context hooks (`useCollection`, `useNav`).
2. Context invokes application services.
3. Services interact with IndexedDB (`storage.ts`) or external source adapters.
4. State updates trigger React re-renders.

## Persistence & IndexedDB Isolation
- Uses native IndexedDB (`pocket-market-binder` database, `kv-store` object store) with automatic legacy `localStorage` migration.
- Key spaces are prefix-isolated:
  - User-owned durable state: `binder`, `wishlist`, `cart`, quantities and user metadata/preferences
  - Local catalog/reference cache: `cached_cards_store`
  - Local pricing references: `cached_prices_store:<cardId>`
  - Local pricing observations: `cached_observations_store:<cardId>`
- Storage errors in pricing cannot destroy or mutate user collection data.

Keep three classes distinct: user-owned durable state; shared reusable reference cache (catalog metadata, normalized provider data, and artwork only when legally/technically eligible); and disposable temporary/request cache (search responses, transient provider results, short-lived lookups, and recognition attempts/results). IndexedDB collection state is not disposable cache.

### Backup/restore

V1 backup/restore is a separate user-data pipeline, not a copy of the PMB shared reference cache. It preserves user-owned Binder, Wishlist, Cart, quantities, notes/metadata, preferences, and a schema/version for migration. Manual export/import exists; robust versioned restore and automatic/remote backup where feasible remain planned work. Cached artwork, catalog payloads, and disposable provider responses are normally rehydratable and need not be included. Multi-device live collection sync is a separate optional decision.

## Pricing Architecture (V1 Median Engine)
The consolidation engine and observation model exist in `pricingService.ts`, but live source coverage is limited. Several adapters are stubs and the current TCGdex extraction requires verification against the actual detailed response shape.

Implemented engine behavior:
1. **Collection:** Gathers observations via `Promise.allSettled` for provider independence.
2. **Filtering:** Removes invalid prices and observations older than `maxObservationAgeMs`.
3. **Currency Normalization:** Converts observation prices to target currency (USD) using static rates (`CURRENCY_CONVERSION_TO_USD`). Original `PriceObservation` values are never mutated.
4. **Outlier Filtering:** For $N \ge 4$, filters out observations outside $0.4\times$ to $2.5\times$ of the preliminary median.
5. **Median Calculation:** Computes mathematical median of filtered normalized prices.
6. **Confidence Evaluation:** Evaluates multi-factor confidence (`high`, `medium`, `low`) based on diversity, agreement (max deviation), and freshness ratio.

The behavior above describes the **current implementation**, not a final multi-source pricing design. The architectural direction is multiple replaceable sources feeding attributable observations into an application-derived Binder estimate. Collection data remains local authority; a provider outage is an external-data problem, not a collection-data problem.

Default market-value consolidation uses only `price-guide` observations. Other
transaction classes (completed sales, active listings, retail asking prices,
and buylist offers) are excluded unless the caller explicitly selects that
single class; incompatible classes are never blended by default.

### Source pools and canonical local truth

External providers are interchangeable sources, not permanent architectural authorities. A provider may be unavailable, rate-limited, discontinued, change its API or terms, require credentials, or lack a particular printing. Where a domain supports it, the application should be able to consider alternative sources without invalidating local collection state.

```text
Canonical Card Identity
        │
        ├── Artwork Resolver
        │       ↓
        │   Primary TCGdex artwork
        │       ↓ if unusable
        │   Code-registered secondary artwork providers, by explicit priority
        │       ↓ first verified and eligible result
        │   Preserve provider provenance
        │       ↓ if none is usable
        │   Generated UI placeholder (not a provider result or catalog record)
        │
        └── Pricing Source Pool
                ↓
            Verify exact printing
                ↓
            Normalize observations
                ↓
            Detect/handle outliers
                ↓
            Consolidate into Binder estimate
                ↓
            Preserve source observations
```

The artwork resolver implements this provider-pool boundary. The pricing source-pool flow remains future architecture direction; generalized cross-domain source orchestration and dynamic failover are not implemented.

**Collection and identity boundaries**

- Binder, Wishlist, and Cart remain locally owned collection state.
- The application maintains normalized card identity. TCGdex supplies the current Pokémon catalog records, but its provider ID is namespaced metadata and is not required by the normalized identity contract.
- Canonical identity preserves available set, card number, name, printing/variant, language, rarity, and namespaced provider IDs; partial identity is completed only from fields present on the originating `Card`.
- Artwork and pricing providers supply external candidates or observations and must not silently replace canonical identity.
- A provider failure must not prevent local collection access or mutation.

See [SOURCE_UNIVERSE.md](./SOURCE_UNIVERSE.md) for the candidate-source audit, integration status, source independence cautions, and provider selection criteria.

**Implemented artwork source-pool foundation**

The resolver runs providers sequentially using explicit, unique priority registrations; registration-array position and candidate image quality do not override provider priority. It advances after lookup failure, malformed or rejected artwork, excluded URLs, or candidates that fail exact-printing/usage checks, and selects the first usable result. Exact-printing verification must be explicit and supported with evidence; candidates with partial, unresolved, or rejected printing verification are not selected. Explicitly ineligible usage is rejected. Eligible usage is selectable; unresolved usage is selectable only when the provider is explicitly configured with the unresolved-usage compatibility option. TCGdex is explicitly configured for that compatibility to preserve existing display while its usage status remains unresolved. This is not a rights determination.

TCGdex remains the sole configured production artwork provider. Its URLs are associated with the TCGdex catalog record for the requested canonical identity; this is the current exact-printing evidence. No claim is made about TCGdex artwork usage rights. Candidate resolution does not mutate canonical identity or collection data.

**Additional artwork source selection**

Secondary artwork providers receive the already-known canonical card identity and operate only as artwork lookups; they do not replace or duplicate the catalog provider, and their lookup IDs need not be TCGdex IDs. TCGdex URLs are carried as a source-tagged catalog-artwork reference rather than as an identity field. Additional providers require evidence for exact printing and, by default, explicit eligible usage/display status. An unresolved usage status is not selectable for a provider unless the provider is explicitly configured to allow unresolved-usage compatibility. Quality and stability metadata are retained but do not reorder provider priority. Preserve provider/source identity, requested canonical identity, source card ID where available, evidence, URL, quality, and any provider-supplied retrieval timestamp separately from the resolver timestamp. Catalog artwork is distinct from recognition/reference images and user photographs. If no candidate can be selected, retain the generated UI placeholder; never guess a different printing.

No secondary artwork source is approved or integrated. The bounded evidence for `30th-c-001` through `30th-c-030` is recorded in [ARTWORK_SOURCE_INVESTIGATION.md](./ARTWORK_SOURCE_INVESTIGATION.md); its findings do not establish artwork rights.

**Future pricing source participation**

Pricing sources supply attributable observations, not the application's final market estimate. The observation contract can represent source class, country/region, language, variant, condition, transaction type, listing status, source confidence, and lineage where known. The default market-value calculation accepts only `price-guide` observations; callers may explicitly select one other transaction class, and cross-class consolidation is not supported. One provider's multiple market fields or copied/aggregated data must not automatically count as independent evidence. Future source participation may vary by card and observation availability; source independence is not redesigned here.

Before consolidation, verify exact printing and variant and normalize comparable dimensions such as condition, grading, language, market/listing type, and currency where data permits. Retain raw observations and source provenance. Outlier treatment must be transparent and deterministic, consider comparability first, preserve unusual observations, and not discard a legitimate premium solely because it is high.

The current implementation's median and outlier behavior remains the verified code status. Useful provenance includes source/provider, source identity, observed price, currency, condition, variant/printing, market/listing type, source reference, and retrieval/observation timestamps.

## Offline & Local-First Behavior
- User collection data is stored locally and local collection actions do not depend on provider connectivity.
- Catalog searches can use cached cards; uncached card data and live pricing require network access.
- Pricing can fall back to cached references or observations where available. This does not establish complete offline provider coverage.
