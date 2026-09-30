# Project Context

## What the Project Is
Pocket Market Binder is a mobile-first Progressive Web App (PWA) designed as a digital physical binder and collection companion for the Pokémon TCG. It features a game-agnostic core service layer to support potential future TCG expansions.

## Core Purpose and Target Use Case
- **Target User:** Casual Pokémon TCG collectors who find commercial inventory management systems overly complex or investment-focused.
- **Core Purpose:** To make collecting feel like browsing a physical binder. It answers five key questions instantly:
  1. What cards do I have?
  2. How many copies do I own?
  3. How much are they roughly worth (market reference)?
  4. Do I already own this card when searching?
  5. What might acquiring the planned cards cost relative to available market references?

V1 is Card Reference + Market Value + Acquisition Calculator. The existing
virtual cart is for local acquisition-cost planning, not marketplace discovery.
Active listings, sellers/stores, asking prices, and direct purchase links are V2.

## Current Technology Stack
- **Frontend Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS (with custom design tokens for parchment, leather, and energy types)
- **Icons:** Lucide React
- **Storage:** Native IndexedDB (via a custom `KVStore` abstraction layer with automatic legacy `localStorage` migration); a PMB shared-reference backend/API is a V1 architecture requirement, not yet implemented
- **Catalog/Artwork API:** TCGdex API directly today, with hybrid in-memory and IndexedDB caching; the planned PMB API/cache will become the stable client-facing shared reference-data layer

## Major Product Goals
- **Local-First Architecture:** User collection data is fully owned and stored client-side in IndexedDB.
- **V1 Shared Reference Data:** External providers feed a PMB backend/API and shared normalized reference cache, which serves devices and reduces repeated/slow upstream requests. The backend does not own the user's collection; backend and database vendors are unselected.
- **V1 Backup/Restore:** Backup preserves user-owned data and schema/version independently of shared/disposable caches. Manual import/export exists; validated/versioned restore and automatic/remote backup where feasible remain incomplete.
- **Operating Cost Target:** ₱0 (no paid APIs, paid databases, authentication servers, or paid hosting).
- **Offline Resilience:** Local collection data remains available without network access. Uncached catalog cards and live external pricing require connectivity; offline completeness is not implied.
- **Robust Pricing Engine:** Aggregates market observations through a versioned median calculation algorithm with multi-factor confidence scoring.

## Important Constraints
- **Zero Cost:** Must operate entirely at ₱0. Free tiers of public APIs are permitted only when their terms allow.
- The PMB shared-reference backend is part of V1 architecture, but local collection use remains available without it. No backend vendor/database or authentication design is selected; accounts are not required for local use.
- Multi-device collection sync is distinct from shared reference caching and user backup, and remains optional/future pending a separate product decision.

## What the Project Explicitly Is NOT Trying To Do
- Not a commercial marketplace or trading platform.
- Not an official Pokémon product or affiliate.
- Not an investment portfolio tracker or financial advisory tool.
- Scanner/recognition is an active product requirement and implementation track, but is not complete: browser and Android image acquisition, provider-agnostic Candidate Review, and an injectable catalog-identity boundary exist; no production recognition or catalog identity provider is selected. App routes only explicitly confirmed local-reference TCGdex catalog IDs through the existing Binder action; no pre-confirmation mutation occurs. Wishlist/Cart scanner actions remain unfinished.

## Current Overall Development Status
- **Implemented & Verified:** Core PWA shell, responsive navigation, IndexedDB persistence, collection management (binder, wishlist, cart), TCGdex catalog search and detail views, artwork resolution, and the V1 Pricing Foundation (provider interfaces, currency normalization, median aggregation, outlier filtering, multi-factor confidence, provider isolation, and stubbed adapters).
- **Partially Implemented / Unfinished:** Pricing consolidation foundation exists, but live provider coverage is limited and the TCGdex pricing response extraction needs verification. Scanner acquisition and local matching against previously confirmed references are present; recognition of unseen cards and downstream catalog resolution remain unfinished.
- **V1 work remaining:** PMB shared reference backend/cache and robust backup/restore pipeline are not implemented.
- **Optional / Future Scope:** Multi-device collection synchronization remains optional pending a separate product decision. The local-first Binder does not depend on it.
