# Architectural & Product Decisions

This document records established architectural and product decisions for Pocket Market Binder.

---

### 1. IndexedDB Is the Collection Source of Truth
- **Decision:** User-owned durable data (Binder, Wishlist, Cart, quantities, notes, and preferences) is stored in native IndexedDB, which remains authoritative for that state.
- **Current Status:** Implemented & Verified.
- **Rationale:** Required to support local-first operation, offline resilience, and a ₱0 operating cost.
- **Cache classification:** Earlier wording grouped cached cards and cached prices with collection data. That terminology is superseded: shared reference cache contains catalog metadata, artwork/reference information, and normalized reusable provider data; temporary/request cache contains search responses, transient pricing observations/results where applicable, and recognition attempts/results. Temporary/request cache is disposable. Neither reference-cache class is user-owned collection state or its source of truth.
- **Backup/restore:** Backup and restore of user-owned data is a separate pipeline from reference caching; disposable cache payloads are not required backup contents.
- **Consequences / Trade-offs:** Local collection state remains usable independently of the shared reference backend; multi-device live collection synchronization is a separate decision.
- **Scope:** Long-term core architecture.

### 2. No Authentication in V1
- **Decision:** Do not implement user accounts, logins, or authentication.
- **Current Status:** No authentication system is selected or implemented. Local collection use must not require an account; remote-backup access design remains open.
- **Rationale:** Local collection workflows should remain simple and available without account setup. Any future remote-backup access requirements are a separate design concern.
- **Consequences / Trade-offs:** This decision does not remove the V1 PMB shared-reference backend/API, and it does not decide multi-device collection sync.
- **Scope:** V1-specific.

### 3. Historical Decision: No Mandatory Backend (Superseded for Shared Reference Data)
- **Historical decision:** The core application was intended to run as a static PWA without a backend server.
- **Historical rationale:** Keeps operating costs at ₱0 and allows free static hosting (e.g., GitHub Pages).
- **Historical provider path:** External API interactions (such as TCGdex) were expected to occur directly from the client, requiring proper CORS handling and rate-limit management. This direct-client-to-provider path is superseded for the approved V1 reference-data architecture.
- **Current V1 decision:** External providers → PMB backend/API shared-reference layer → device/local cache → UI. The PMB backend/API is part of V1 architecture for shared reference data; IndexedDB remains authoritative for user-owned collection state. Local collection use must remain available without the backend.
- **Current Status:** Architectural decision only; no backend implementation, vendor, hosting service, or authentication system has been selected.
- **Authority:** See [ARCHITECTURE.md](./ARCHITECTURE.md), [CURRENT_STATE.md](./CURRENT_STATE.md), and [POCKET_MARKET_BINDER_ARCHITECTURE_DECISIONS.md](./POCKET_MARKET_BINDER_ARCHITECTURE_DECISIONS.md) for the current architecture and implementation status.
- **Consequences / Trade-offs:** The shared-reference backend is not a collection authority or a prerequisite for local collection workflows.
- **Scope:** Historical wording superseded by the accepted V1 shared-reference architecture.

### 4. External APIs Are Optional Dependencies
- **Decision:** External APIs must never be required for basic collection functionality.
- **Current Status:** Implemented & Verified.
- **Rationale:** Users must be able to view their binder, update quantities, search locally cached catalog records, and manage their wishlist and cart even when offline or when external services fail. Catalog/reference cache remains distinct from user-owned collection data.
- **Consequences / Trade-offs:** Requires robust local caching and fallback layers.
- **Scope:** Long-term core architecture.

### 5. Provider Abstraction via Adapters
- **Decision:** External services (catalog providers, pricing providers) must be accessed through explicit adapters and interfaces (`CatalogProvider`, `PricingProvider`).
- **Current Status:** Implemented & Verified.
- **Rationale:** Protects application core and UI components from breaking changes when third-party APIs update or change terms.
- **Consequences / Trade-offs:** Requires writing and maintaining adapter boilerplate.
- **Scope:** Long-term core architecture.

### 6. Calculated Market Reference (Pocket Market Reference v1)
- **Decision:** The application calculates a normalized market reference rather than treating any single third-party provider as absolute truth.
- **Current Status:** Implemented & Verified (`v1-median`).
- **Rationale:** Aggregates observations across multiple providers using normalization, outlier filtering, and median calculation to provide a more reliable market reference.
- **Consequences / Trade-offs:** Requires algorithmic tuning and maintenance.
- **Scope:** Long-term core architecture (versioned).

### 7. Source Currency Preservation
- **Decision:** Market prices from external observations are stored in their original source currency. Currency conversion (e.g., to USD calculation currency or presentation currencies) is strictly a calculation/presentation layer concern.
- **Current Status:** Implemented & Verified.
- **Rationale:** Prevents data corruption or loss of fidelity from premature currency conversion.
- **Consequences / Trade-offs:** Conversion rates must be managed in the pricing service.
- **Scope:** Long-term core architecture.
