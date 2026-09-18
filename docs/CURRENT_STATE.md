# Current Project State

## Current Milestone
**Milestone:** V1 Pricing Foundation & Provider Feasibility Audit Completed. All Pricing Providers Maintained as Stubs.

---

## Completed & Verified Work
- **Application Shell & Navigation:** React 18 + Vite setup with mobile-first layout, desktop responsive breakpoints, TopNav, BottomNav, and client routing (`NavContext`).
- **IndexedDB Persistence:** Native IndexedDB implementation (`storage.ts`) with key-space prefix isolation and automatic migration from legacy `localStorage`.
- **Collection Management:** Full CRUD for binder entries, wishlist, and cart (`collectionService.ts` & `CollectionContext`).
- **Catalog & Artwork Services:** Hybrid catalog (`catalogService.ts`) querying TCGdex with fallback to local IndexedDB cache; artwork resolver (`artworkService.ts`) with procedural SVG fallback.
- **V1 Pricing Foundation (Audited & Verified):**
  - **IndexedDB Storage Isolation:** Confirmed prefix isolation (`cached_prices_store:<cardId>` and `cached_observations_store:<cardId>`) in the shared IndexedDB store; pricing operations cannot mutate user collection data.
  - **Offline & Stale Fallback:** `getPriceReference` falls back to cached references or cached observations when offline or on provider fetch failure.
  - **Currency Normalization:** Implemented via static rates in `CURRENCY_CONVERSION_TO_USD`; original `PriceObservation` source values and currencies are preserved without mutation.
  - **Median Aggregation:** Implemented mathematical median calculation (`v1-median`).
  - **Outlier Filtering:** Filters observations outside $0.4\times$ to $2.5\times$ of the preliminary median when $N \ge 4$.
  - **Multi-Factor Confidence Scoring:** Evaluates diversity (providers/marketplaces), agreement (max deviation $\le 35\%$ for High, $\le 60\%$ for Medium), and freshness ratio ($\ge 50\%$ within 24 hours).
  - **Provider Isolation:** Uses `Promise.allSettled` in `getPriceReference` so individual provider failures do not affect others.
  - **Pricing Provider Feasibility Audit:** Evaluated `TickerMint`, `PkmnPrices`, `JustTCG`, and `Scrydex`. Confirmed that direct frontend-only integration is blocked by required API key authentication, WAF bot protection, and ₱0 operating cost / static PWA constraints.
  - **Provider Stubs:** All four pricing provider adapters (`JustTCG`, `PkmnPrices`, `Scrydex`, `TickerMint`) implement the `PricingProvider` interface, return empty arrays (`[]`), and perform zero network requests. Terminology strictly uses **Pocket Market Reference**.
  - **Verification:** `npm run typecheck` (PASSED), `npm run build` (PASSED).

---

## In-Progress Work
- None currently. V1 pricing foundation and feasibility audits are successfully completed.

---

## Not-Yet-Started Work / Planned Features
- **UI Integration of Pricing:** Hooking `pricingService.getPriceReference()` into UI components when cached/derived references exist.
- **Optional Card Scanner:** Camera/OCR card identification (`ScannerProvider`).
- **Cloud Synchronization & Server-Side Proxy:** Optional future cross-device sync or backend proxy for authenticated pricing provider APIs (out of scope for V1).

---

## Known Limitations & V1 Simplifications
- **Static Currency Conversion:** Uses hardcoded exchange rates (`CURRENCY_CONVERSION_TO_USD`) rather than a live forex rate API.
- **Broad Outlier Thresholds:** Uses fixed $0.4\times$ to $2.5\times$ preliminary median multipliers for outlier pruning.
- **Heuristic Confidence:** Confidence scores rely on fixed threshold heuristics rather than statistical variance models.
- **Pricing Provider Stubs:** All pricing providers (`TickerMint`, `PkmnPrices`, `JustTCG`, `Scrydex`) return `[]` because direct client-side integration violates ₱0 / static PWA security constraints (API key exposure). Therefore, `getPriceReference()` relies on cached observations or returns `null` in V1.

---

## Known Technical Debt
- `src/data/mockCatalog.ts`: Unused leftover mock data file from the early prototyping phase (cleaned/purged dynamically by `catalogService.ts`).

---

## Current Blockers
- None. (Pricing provider direct frontend integration is intentionally deferred / maintained as stubs due to V1 architecture constraints).

---

## Recommended Immediate Next Step
- Proceed with UI display integration of Pocket Market Reference values or optional card scanner features, ensuring stubs and offline fallback behaviors remain intact.
