# Data Sources & Providers

This document inventories external data sources and providers used, planned, or stubbed in Pocket Market Binder.

---

### 1. TCGdex API
- **Purpose:** Card catalog metadata, search, and artwork resolution (`imageUrlLow`, `imageUrlHigh`).
- **Current Implementation Status:** Implemented & Verified (`tcgdexProvider.ts`, `catalogService.ts`, `artworkService.ts`).
- **Where it is used in the codebase:** `src/services/catalogService.ts`, `src/services/providers/tcgdexProvider.ts`.
- **Network Requests:** Makes live network requests (`https://api.tcgdex.net/v2/en`) when online and when the local cache (`cached_cards_store`) is empty or during searches.
- **API Reference:** [TCGdex API Documentation](https://api.tcgdex.net/v2/en) (Public free API).
- **Limitations & Assumptions:** Relies on public API availability; offline fallback gracefully falls back to IndexedDB local cache.
- **Pricing:** Detailed card responses expose pricing under `pricing`, with separate `cardmarket` and `tcgplayer` objects. The adapter maps Cardmarket `avg`, `low`, `trend`, and their `-holo` counterparts; it maps TCGplayer `lowPrice`, `midPrice`, `highPrice`, `marketPrice`, and `directLowPrice` under the documented `normal`/`reverse`/`holo` variants and the observed `holofoil` variant. The documented currencies are EUR and USD, respectively, and each market's `updated` value supplies `observedAt`. The response `id` must match the requested card ID; available `idProduct`/`productId` values are retained as listing provenance.
- **Pricing evidence:** The response shape was checked against the [TCGdex Markets Integration documentation](https://tcgdex.dev/markets-prices) and a live detailed response for [`base1-1`](https://api.tcgdex.net/v2/en/cards/base1-1) on 2026-09-29. Fixture tests preserve the captured response fields and the documented normal/reverse variant example.
- **Pricing limitations:** Historical Cardmarket averages (`avg1`, `avg7`, `avg30` and holo equivalents) are not mapped as current observations. Missing/invalid timestamps, unsupported currencies, malformed structures, non-positive/non-finite prices, unknown market/variant keys, and mismatched card IDs produce no observation for that value/market. This adapter improvement does not make pricing complete: TCGdex is the only configured live pricing adapter; secondary adapters remain stubs, and the existing consolidation policy is unchanged.

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
