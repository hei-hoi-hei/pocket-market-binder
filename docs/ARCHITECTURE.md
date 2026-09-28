# Architecture

## Current Application Architecture
The current application follows a clean layered architecture separating UI components, React state context, application services, IndexedDB, and external APIs. The V1 target adds the PMB shared-reference API/cache between external providers and device clients; this target backend is not yet implemented:

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
│          IndexedDB          ││       PMB Backend / API      │
│  (user state + local cache) ││   (shared reference cache)   │
└─────────────────────────────└──────────────────────────────┘
                                      ↑
                               External Providers
                         (TCGdex / pricing / artwork)
```

Target request paths:

```text
Cold:              User → PMB → Provider → PMB → User
Warm server cache: User → PMB → User
Warm device cache: User → IndexedDB → User
```

The PMB backend is a shared data/cache layer, not the owner of Binder/Wishlist/Cart. Its V1 responsibilities are provider-response normalization, source/provenance and freshness/versioning, request deduplication, rate limiting, shared-cache serving, and a stable client-facing API. This should avoid repeating upstream work and avoid waiting on slow providers when a cache entry can satisfy the request.

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

### Source pools and canonical local truth

External providers are interchangeable sources, not permanent architectural authorities. A provider may be unavailable, rate-limited, discontinued, change its API or terms, require credentials, or lack a particular printing. Where a domain supports it, the application should be able to consider alternative sources without invalidating local collection state.

```text
Canonical Card Identity
        │
        ├── Artwork Source Pool
        │       ↓
        │   Verify exact printing
        │       ↓
        │   Verify usage eligibility
        │       ↓
        │   Select best eligible artwork
        │       ↓
        │   Preserve provenance
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
- The application maintains canonical card identity; TCGdex remains the current catalog/identity authority.
- Artwork and pricing providers supply external candidates or observations and must not silently replace canonical identity.
- A provider failure must not prevent local collection access or mutation.

**Implemented artwork source-pool foundation**

The resolver accepts a provider list, normalizes candidate provenance, isolates provider failures, and applies deterministic selection. Exact-printing verification must be explicit and supported with evidence; candidates with partial, unresolved, or rejected printing verification are not selected. Explicitly ineligible usage is rejected. Eligible usage is selectable; unresolved usage is selectable only when the provider is explicitly configured with the unresolved-usage compatibility option. TCGdex is explicitly configured for that compatibility to preserve existing display while its usage status remains unresolved. This is not a rights determination.

TCGdex remains the sole configured production artwork provider. Its URLs are associated with the TCGdex catalog record for the requested canonical identity; this is the current exact-printing evidence. No claim is made about TCGdex artwork usage rights. Candidate resolution does not mutate canonical identity or collection data.

**Additional artwork source selection**

Additional providers require evidence for exact printing and, by default, explicit eligible usage/display status. An unresolved usage status is not selectable for a provider unless the provider is explicitly configured to allow unresolved-usage compatibility. Among candidates that pass printing verification and usage policy, selection uses deterministic, observable quality and stability information rather than an unsupported numeric score. Preserve provider/source identity, requested canonical identity, source card ID where available, evidence, URL, quality, and retrieval time. If no candidate can be selected, retain the UI placeholder; never guess a different printing.

No secondary artwork source is approved or integrated. The bounded evidence for `30th-c-001` through `30th-c-030` is recorded in [ARTWORK_SOURCE_INVESTIGATION.md](./ARTWORK_SOURCE_INVESTIGATION.md); its findings do not establish artwork rights.

**Future pricing source participation**

Pricing sources supply observations, not the application's final market estimate. The design should be able to compare approximately three or four reliable sources when available, without requiring an exact provider count. Participation can vary per card and observation availability. Four or three comparable observations may support a multi-source estimate; two indicate reduced evidence; one is a single-source indication, not a statistically robust average; zero means no current estimate.

Before consolidation, verify exact printing and variant and normalize comparable dimensions such as condition, grading, language, market/listing type, and currency where data permits. Retain raw observations and source provenance. Outlier treatment must be transparent and deterministic, consider comparability first, preserve unusual observations, and not discard a legitimate premium solely because it is high.

The future consolidation methodology is not selected by this source-pool direction. The current implementation's median and outlier behavior above remains the verified code status until a separate pricing implementation decision changes it. Useful future provenance includes source/provider, source identity, observed price, currency, condition, variant/printing, market/listing type, source reference, and retrieval/observation timestamps.

## Offline & Local-First Behavior
- User collection data is stored locally and local collection actions do not depend on provider connectivity.
- Catalog searches can use cached cards; uncached card data and live pricing require network access.
- Pricing can fall back to cached references or observations where available. This does not establish complete offline provider coverage.
