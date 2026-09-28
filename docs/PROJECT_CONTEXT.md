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
  5. How does a prospective purchase (seller price) compare against the market reference?

## Current Technology Stack
- **Frontend Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS (with custom design tokens for parchment, leather, and energy types)
- **Icons:** Lucide React
- **Storage:** Native IndexedDB (via a custom `KVStore` abstraction layer with automatic legacy `localStorage` migration)
- **Catalog/Artwork API:** TCGdex API (with hybrid in-memory and IndexedDB caching)

## Major Product Goals
- **Local-First Architecture:** User collection data is fully owned and stored client-side in IndexedDB.
- **Operating Cost Target:** ₱0 (no paid APIs, paid databases, authentication servers, or paid hosting).
- **Offline Resilience:** Local collection data remains available without network access. Uncached catalog cards and live external pricing require connectivity; offline completeness is not implied.
- **Robust Pricing Engine:** Aggregates market observations through a versioned median calculation algorithm with multi-factor confidence scoring.

## Important Constraints
- **Zero Cost:** Must operate entirely at ₱0. Free tiers of public APIs are permitted only when their terms allow.
- **No Mandatory Backend:** Operates as a static PWA.
- **No Mandatory Authentication or Backend:** Local collection use must not require an account or sync. Sync infrastructure is partial and remains optional/future scope pending an explicit product decision.

## What the Project Explicitly Is NOT Trying To Do
- Not a commercial marketplace or trading platform.
- Not an official Pokémon product or affiliate.
- Not an investment portfolio tracker or financial advisory tool.
- Scanner/recognition is an active product requirement and implementation track, but is not complete: browser image acquisition exists partially; production recognition, candidate review, catalog identity resolution, and collection integration are unfinished.

## Current Overall Development Status
- **Implemented & Verified:** Core PWA shell, responsive navigation, IndexedDB persistence, collection management (binder, wishlist, cart), TCGdex catalog search and detail views, artwork resolution, and the V1 Pricing Foundation (provider interfaces, currency normalization, median aggregation, outlier filtering, multi-factor confidence, provider isolation, and stubbed adapters).
- **Partially Implemented / Unfinished:** Pricing consolidation foundation exists, but live provider coverage is limited and the TCGdex pricing response extraction needs verification. Scanner acquisition is present; recognition and downstream stages remain unfinished.
- **Optional / Future Scope:** Synchronization remains optional pending a product decision. The local-first Binder does not depend on it.
