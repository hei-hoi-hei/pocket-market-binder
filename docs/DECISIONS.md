# Architectural & Product Decisions

This document records established architectural and product decisions for Pocket Market Binder.

---

### 1. IndexedDB Is the Collection Source of Truth
- **Decision:** User-owned collection data (binder, quantities, wishlist, shopping cart, cached cards, cached prices) is stored in native IndexedDB.
- **Current Status:** Implemented & Verified.
- **Rationale:** Required to support local-first operation, offline resilience, and a ₱0 operating cost.
- **Consequences / Trade-offs:** Client-side persistence only; no built-in cross-device synchronization.
- **Scope:** Long-term core architecture.

### 2. No Authentication in V1
- **Decision:** Do not implement user accounts, logins, or authentication.
- **Current Status:** Implemented & Verified.
- **Rationale:** Pocket Market Binder is primarily a personal collection companion. Avoiding authentication eliminates backend infrastructure, password management, and security complexity.
- **Consequences / Trade-offs:** Single-device storage only; multi-user or cloud sync is deferred.
- **Scope:** V1-specific.

### 3. No Mandatory Backend (Static PWA)
- **Decision:** The core application must not require a backend server and runs as a static PWA.
- **Current Status:** Implemented & Verified.
- **Rationale:** Keeps operating costs at ₱0 and allows free static hosting (e.g., GitHub Pages).
- **Consequences / Trade-offs:** External API interactions (such as TCGdex) occur directly from the client, requiring proper CORS handling and rate-limit management.
- **Scope:** Long-term core architecture.

### 4. External APIs Are Optional Dependencies
- **Decision:** External APIs must never be required for basic collection functionality.
- **Current Status:** Implemented & Verified.
- **Rationale:** Users must be able to view their binder, update quantities, search cached cards, and manage their wishlist and cart even when offline or when external services fail.
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
