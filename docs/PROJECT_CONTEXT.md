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
- **Offline Resilience:** The application remains fully functional without an internet connection, falling back to local caches for catalog data and pricing references.
- **Robust Pricing Engine:** Aggregates market observations through a versioned median calculation algorithm with multi-factor confidence scoring.

## Important Constraints
- **Zero Cost:** Must operate entirely at ₱0. Free tiers of public APIs are permitted only when their terms allow.
- **No Mandatory Backend:** Operates as a static PWA.
- **No Authentication:** V1 excludes user accounts, logins, and cloud sync.

## What the Project Explicitly Is NOT Trying To Do
- Not a commercial marketplace or trading platform.
- Not an official Pokémon product or affiliate.
- Not an investment portfolio tracker or financial advisory tool.
- Not a card scanning/OCR tool in V1 (scanning is postponed).

## Current Overall Development Status
- **Implemented & Verified:** Core PWA shell, responsive navigation, IndexedDB persistence, collection management (binder, wishlist, cart), TCGdex catalog search and detail views, artwork resolution, and the V1 Pricing Foundation (provider interfaces, currency normalization, median aggregation, outlier filtering, multi-factor confidence, provider isolation, and stubbed adapters).
- **Pending/Future Work:** Real pricing provider API integrations, optional OCR card scanning, and cloud synchronization.
