# AI Handoff & Source of Truth

This is the primary entry-point document for any future AI agent working on Pocket Market Binder.

---

## 1. Required Reading Order
Before making any changes or answering architecture questions, read the documentation under `/docs/` in this exact order:
1. `PROJECT_CONTEXT.md`
2. `CURRENT_STATE.md`
3. `ARCHITECTURE.md`
4. `DECISIONS.md`
5. `DATA_SOURCES.md`
6. `DEVELOPMENT_WORKFLOW.md`

---

## 2. Source of Truth Hierarchy
If there is a conflict between sources, adhere strictly to this hierarchy:
1. **Actual repository code and tests** (`src/`)
2. **Project documentation under `/docs/`**
3. **Existing external source/API documentation**
4. **Current AI conversation**
5. **AI assumptions**

*Never assume an AI conversation history is authoritative over the repository.* If a conflict arises, investigate the codebase rather than silently relying on assumptions.

---

## 3. Current Project State Summary
- Core PWA shell, navigation, IndexedDB persistence, collection management (binder, wishlist, cart), TCGdex catalog search, and artwork resolution are **Implemented & Verified**.
- V1 Pricing Foundation (provider interfaces, currency normalization, median aggregation, outlier filtering, confidence evaluation, `Promise.allSettled` isolation, and storage prefix isolation) is **Audited & Verified**.
- All four pricing provider adapters (`JustTCG`, `PkmnPrices`, `Scrydex`, `TickerMint`) are **Stubs** returning empty arrays with zero network calls.
- **Pricing Provider Feasibility Status:** All four external pricing APIs (`TickerMint`, `PkmnPrices`, `JustTCG`, `Scrydex`) require authenticated API keys or are protected by WAF bot mitigation. Because Pocket Market Binder is a frontend-only static PWA with a ₱0 operating cost target and no backend server, direct client-side integration of these APIs is blocked due to secret exposure risks. **Future AI agents must not attempt to implement live API calls inside these provider adapters without an approved server-side proxy architecture (which is out of scope for V1).** All four adapters must remain safe stubs returning `[]`.
- **Pricing Terminology:** Strictly use **Pocket Market Reference** (or `v1-median` reference) rather than "real-time price".

---

## 4. Important Architectural Rules
- **Local-First / Offline-First:** The app must function without internet. IndexedDB is the source of truth for user collection data.
- **Provider Isolation:** Never embed provider-specific logic in UI components or core services. Always use adapter interfaces (`CatalogProvider`, `PricingProvider`).
- **Storage Isolation:** Pricing cache keys must use prefixes (`cached_prices_store:`, `cached_observations_store:`) to prevent collision or mutation of user collection data (`binder`, `wishlist`, `cart`).
- **No Direct API Calls from UI:** UI components must call application services (`collectionService`, `catalogService`, `pricingService`), never external APIs directly.

---

## 5. Important Constraints
- **Operating Cost:** ₱0. No paid APIs, paid databases, authentication servers, or paid hosting.
- **No Authentication:** V1 has no user accounts or login systems.
- **Preserve Stubs & Fallbacks:** Never remove offline fallback mechanisms or stub behaviors without verified replacements.

---

## 6. How to Safely Make Changes
1. Inspect the codebase first.
2. Make minimal, focused changes aligned with existing patterns.
3. Do not refactor unrelated modules or introduce unauthorized dependencies.
4. Verify your work by running:
   - `npm run typecheck`
   - `npm run build`
5. Ensure build and typecheck pass without errors.
