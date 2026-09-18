# Release Notes

## [1.0.0] - 2026-09-18

### Initial V1.0.0 Release

Pocket Market Binder V1.0.0 delivers a complete, offline-first digital card collection companion and virtual binder platform.

#### Key Highlights & Shipped Features
- **Core Virtual Binder & Collection Management:**
  - Full CRUD support for owned collection entries, card quantities, and duplicate counts.
  - Interactive binder visual grid and list view with responsive mobile-first layouts.
  - Dedicated wishlist and shopping cart with separate user-recorded purchase pricing.
- **TCGdex Catalog Integration:**
  - Hybrid in-memory and IndexedDB catalog caching.
  - Search, energy/rarity filters, set browsing, and card detail screens.
- **V1 Consolidation Pricing Engine:**
  - Implemented `v1-median` mathematical consolidation engine for multi-source price observations.
  - Outlier filtering ($0.4\times$ to $2.5\times$ preliminary median), static currency normalization (USD/EUR), and multi-factor confidence scoring (`high`, `medium`, `low`).
  - Strict key-space prefix isolation between pricing observation caches and user collection records.
  - Safe adapter stubs for secondary pricing providers without exposing client-side credentials.
- **Card Identity & Modular Verification:**
  - Established canonical identity architecture linking TCGdex identifiers with secondary provider references.
  - Verification cache prefix isolation (`identity_verification:`) preventing storage collisions.
- **PWA & Local-First Storage:**
  - Service worker shell caching for offline functionality.
  - Native IndexedDB persistence with automated legacy storage migration.
- **Open-Source Code Release:**
  - Released core software under the MIT License with clear boundaries defining third-party data, image assets, and intellectual property.

#### Deferred to Future Milestones
- Cloud account authentication and multi-device synchronization.
- Backend server proxy for authenticated pricing provider APIs.
- Secondary TCG catalog implementations.
