# Architecture

## Current Application Architecture
The application follows a clean layered architecture separating UI components, React state context, application services, persistence adapters, and external APIs:

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
│          IndexedDB          ││       External APIs          │
│  (kv-store object store)    ││  (TCGdex API, Pricing Stubs) │
└─────────────────────────────└──────────────────────────────┘
```

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
3. Services interact with IndexedDB (`storage.ts`) or remote providers (`tcgdexProvider`).
4. State updates trigger React re-renders.

## Persistence & IndexedDB Isolation
- Uses native IndexedDB (`pocket-market-binder` database, `kv-store` object store) with automatic legacy `localStorage` migration.
- Key spaces are prefix-isolated:
  - Unprefixed: `binder`, `wishlist`, `cart`
  - Catalog cache: `cached_cards_store`
  - Pricing references: `cached_prices_store:<cardId>`
  - Pricing observations: `cached_observations_store:<cardId>`
- Storage errors in pricing cannot destroy or mutate user collection data.

## Pricing Architecture (V1 Median Engine)
Implemented in `pricingService.ts`:
1. **Collection:** Gathers observations via `Promise.allSettled` for provider independence.
2. **Filtering:** Removes invalid prices and observations older than `maxObservationAgeMs`.
3. **Currency Normalization:** Converts observation prices to target currency (USD) using static rates (`CURRENCY_CONVERSION_TO_USD`). Original `PriceObservation` values are never mutated.
4. **Outlier Filtering:** For $N \ge 4$, filters out observations outside $0.4\times$ to $2.5\times$ of the preliminary median.
5. **Median Calculation:** Computes mathematical median of filtered normalized prices.
6. **Confidence Evaluation:** Evaluates multi-factor confidence (`high`, `medium`, `low`) based on diversity, agreement (max deviation), and freshness ratio.

## Offline & Local-First Behavior
- Fully functional without an internet connection. Catalog searches fall back to IndexedDB cache; pricing references fall back to cached `PriceReference` or derived observations.
