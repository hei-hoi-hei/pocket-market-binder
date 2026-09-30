# Data Sources & Providers

This document inventories external data sources and providers used, planned, or stubbed in Pocket Market Binder.

For a broader candidate inventory across pricing and artwork, including access, source-independence, and reuse considerations, see [Source Universe & Provider Strategy](./SOURCE_UNIVERSE.md). A listed candidate is not an integrated or approved provider.

---

### 1. TCGdex API
- **Purpose:** Card catalog metadata, search, and artwork resolution (`imageUrlLow`, `imageUrlHigh`).
- **Current Implementation Status:** Implemented & Verified (`tcgdexProvider.ts`, `catalogService.ts`, `artworkService.ts`).
- **Where it is used in the codebase:** `src/services/catalogService.ts`, `src/services/providers/tcgdexProvider.ts`.
- **Network Requests:** Makes live network requests (`https://api.tcgdex.net/v2/en`) when online and when the local cache (`cached_cards_store`) is empty or during searches.
- **API Reference:** [TCGdex API Documentation](https://tcgdex.dev/).
- **Limitations & Assumptions:** TCGdex is the current configured Pokémon catalog and artwork provider by implementation choice, not the owner of the artwork architecture or normalized identity. Its public access and software/data repository licensing do not by themselves establish permission to cache or redistribute card artwork. The client relies on API availability and falls back to IndexedDB catalog cache where applicable.
- **Pricing:** Detailed card responses expose pricing under `pricing`, with separate `cardmarket` and `tcgplayer` objects. The adapter maps Cardmarket `avg`, `low`, `trend`, and their `-holo` counterparts; it maps TCGplayer `lowPrice`, `midPrice`, `highPrice`, `marketPrice`, and `directLowPrice` under the documented `normal`/`reverse`/`holo` variants and the observed `holofoil` variant. The documented currencies are EUR and USD, respectively, and each market's `updated` value supplies `observedAt`. The response `id` must match the requested card ID; available `idProduct`/`productId` values are retained as listing provenance.
- **Market Reference comparability:** The displayed reference requires the observation's `cardId` (the local canonical Card key, not an arbitrary provider ID) to match the displayed card. If the canonical identity specifies a recognized printing variant, only that variant is used; otherwise only untagged or explicitly `normal` observations are eligible. Graded observations are excluded; explicit incompatible conditions are excluded when a condition is requested, while missing condition metadata remains permitted. Transaction classes are distinct. The default market-value calculation uses only observations tagged `price-guide`; callers must explicitly select a single other class to calculate from completed sales, active listings, retail asks, buylist offers, or unknown-class data. Cross-class aggregation is not supported. The default TCGdex reference fields are Cardmarket `trend`/`trend-holo` and TCGplayer `marketPrice`; average, low, high, direct-low, and other metrics remain visible as raw observations but are not blended into the default reference. Exact duplicate observations are deduplicated while distinct listing IDs/timestamps remain distinct.
- **Freshness and calculation:** The Market Reference uses the configured seven-day `maxObservationAgeMs` window on provider observations' `observedAt` timestamps. Fresh positive comparable observations are converted to canonical USD through the currency service's static fallback rates, then consolidated with the existing median. The user's locally stored display-currency preference converts the final USD reference for display; this is not live FX. Unsupported currencies or unavailable rates are excluded with an explicit reason. Stale observations are excluded; if no fresh comparable observations remain, no current Market Reference is shown. No timestamps are invented. Divergence is reported at the existing 30%/60% spread thresholds; outliers are not deleted from the median.
- **Provenance and explanation:** All fetched/cached provider observations remain available to the details panel, including exclusions and their known exclusion reason. The panel shows provider, marketplace, price type, original amount/currency, observation and fetch dates, and available variant, condition/grading, and listing identifier. The expandable “Why this price?” summary is generated from the actual comparable observations, freshness state, divergence status, and exclusions.
- **Pricing evidence:** The response shape was checked against the [TCGdex Markets Integration documentation](https://tcgdex.dev/markets-prices) and a live detailed response for [`base1-1`](https://api.tcgdex.net/v2/en/cards/base1-1) on 2026-09-29. Fixture tests preserve the captured response fields and the documented normal/reverse variant example.
- **Pricing limitations:** Historical Cardmarket averages (`avg1`, `avg7`, `avg30` and holo equivalents) are not mapped as current observations. Missing/invalid timestamps, unsupported currencies, malformed structures, non-positive/non-finite prices, unknown market/variant keys, and mismatched card IDs produce no observation for that value/market. This relevance/freshness policy does not make pricing complete: TCGdex is the only configured live pricing adapter; secondary adapters remain stubs. Currency conversion remains static and the median remains a calculated reference, not an objectively accurate market value. Price metrics excluded from the default reference remain available for provenance but do not contribute to its calculation.

### 2. JustTCG (Pricing Provider)
- **Purpose:** Market price observations.
- **Current Implementation Status:** Stubbed (`justtcgProvider.ts`).
- **Where it is used in the codebase:** `src/services/providers/justtcgProvider.ts`, registered in `pricingService.ts`.
- **Network Requests:** None (`[]`).
- **Feasibility Audit Result:** Requires authenticated API keys (`x-api-key`) and non-commercial terms restrictions. Incompatible with direct frontend-only static PWA deployment without a backend proxy.
- **Limitations & Assumptions:** Maintained as a safe adapter stub. Terminology strictly uses **Pocket Market Reference**.

### 3. PkmnPrices (Pricing Provider)
- **Purpose:** Market price observations.
- **Current Implementation Status:** Stubbed (`pkmnpricesProvider.ts`).
- **Where it is used in the codebase:** `src/services/providers/pkmnpricesProvider.ts`, registered in `pricingService.ts`.
- **Network Requests:** None (`[]`).
- **Feasibility Audit Result:** Requires authenticated API keys (`X-API-Key`) and paid plans for production/commercial usage. Incompatible with direct frontend-only static PWA deployment at ₱0 cost.
- **Limitations & Assumptions:** Maintained as a safe adapter stub.

### 4. Scrydex (Pricing Provider)
- **Purpose:** Market price observations.
- **Current Implementation Status:** Stubbed (`scrydexProvider.ts`).
- **Where it is used in the codebase:** `src/services/providers/scrydexProvider.ts`, registered in `pricingService.ts`.
- **Network Requests:** None (`[]`).
- **Feasibility Audit Result:** Requires authenticated API credentials and credit quotas. Incompatible with direct client-side integration.
- **Limitations & Assumptions:** Maintained as a safe adapter stub.

### 5. TickerMint (Pricing Provider)
- **Purpose:** Market price observations.
- **Current Implementation Status:** Stubbed (`tickermintProvider.ts`).
- **Where it is used in the codebase:** `src/services/providers/tickermintProvider.ts`, registered in `pricingService.ts`.
- **Network Requests:** None (`[]`).
- **Feasibility Audit Result:** Protected by Cloudflare WAF bot mitigation and lacks a verifiable public API contract for client-side integration.
- **Limitations & Assumptions:** Maintained as a safe adapter stub returning empty arrays.
