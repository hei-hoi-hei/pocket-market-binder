# Post-V1 Optional Account & Cross-Device Sync Architecture

This document defines the post-V1 architecture for adding optional cross-device synchronization to Pocket Market Binder, while preserving its local-first, offline-persistence core.

---

## 1. Scope & Status

*   **Status:** **READ-ONLY SPECIFICATION.** No implementation has been performed.
*   **Objective:** Define a robust, record-level synchronization mechanism using Last-Write-Wins (LWW) and Tombstones.
*   **V1 Integrity:** V1.0.0 remains frozen. This spec defines the *future* state of the application's persistence and synchronization layers.

---

## 2. Existing V1 Persistence Baseline

As documented in `docs/POST_V1_SCHEMA_INVENTORY.md`:
*   **Source of Truth:** Native IndexedDB (`pocket-market-binder` DB, `kv-store` object store).
*   **Storage Pattern:** Collection data (`binder`, `wishlist`, `cart`) are stored as **complete array blobs**.
*   **Identity:** `cardId` (TCGdex ID) is the stable canonical identifier.
*   **Timestamps:** Only `addedAt` exists for user records. No `updatedAt`.
*   **Deletions:** Hard deletions (array filtering). No tombstones.

---

## 3. Post-V1 Architecture Shift: Record-Level Sync

To support efficient sync and robust conflict resolution, the post-V1 architecture shifts from **array-blob storage** to **individual record-level synchronization**.

### 3.1 Mutable User States (MUST SYNC)
These records represent the user's personal collections and must be synchronized across devices.
*   **Binder/Collection:** Individual binder records with custom pricing and quantities.
*   **Wishlist:** Wishlist tracking records.
*   **Cart/Acquisitions:** Cart items representing pending or past acquisitions.

### 3.2 Local-Only States (LOCAL-ONLY)
Transient or derived data that should not be synchronized:
*   **Catalog Cache:** `cached_cards_store`.
*   **Pricing Cache:** `cached_prices_store`, `cached_observations_store`, `cached_price_verification`.
*   **UI State:** Search queries, temporary filters, route history.

---

## 4. Refined Identity Model

The identity model transitions from purely `cardId` to tracking individual record identifiers (`recordId` as UUID) to support fine-grained merges and acquisitions.

| Identity Concept | V1 Implementation | Post-V1 Proposed for Sync |
| :--- | :--- | :--- |
| **Account Identity** | None | Auth Provider UID (e.g., Supabase Auth ID) |
| **Device Identity** | None | Cryptographically secure UUID generated once per client |
| **Record Identity** | `cardId` | `recordId` (UUID) per entry |
| **Change Identity** | None | `updatedAt` (ms timestamp) |
| **Deletion Identity** | None | `isDeleted` (boolean Tombstone) + `updatedAt` |

---

## 5. Conflict Resolution Strategy

The Sync Engine implements a deterministic **Last-Write-Wins (LWW)** resolution scheme:
1.  Compare `updatedAt` timestamps. The record with the higher timestamp wins.
2.  If timestamps are identical, lexicographically compare `deviceId`. The larger string value wins.

This guarantees eventual consistency across all devices without requiring complex vector clocks or central locks.

---

## 6. Sync Engine & Flow

The system operates under a local-first paradigm. All user writes are applied immediately to local storage and appended to a persistent `sync_queue` (Outbox).

```text
       User Action (UI)
              │
              ▼
   ┌──────────────────────┐
   │  collectionService   │
   └──────────┬───────────┘
              │
     ┌────────┴────────┐
     ▼                 ▼
┌──────────┐     ┌────────────┐
│IndexedDB │     │ Sync Queue │
└──────────┘     └─────┬──────┘
                       │ (Async)
                       ▼
               ┌──────────────┐
               │ Sync Engine  │
               └──────┬───────┘
                      │
                      ▼
             ┌────────────────┐
             │  SyncProvider  │ (Interface)
             └────────┬───────┘
                      │
                      ▼
             ┌────────────────┐
             │Supabase Adapter│ (Concrete Implementation)
             └────────────────┘
```

---

## 7. Migration Path from V1

When post-V1 software is launched for the first time, an eager database migration must run:
1.  Scan the existing array-blob stores (`binder`, `wishlist`, `cart`).
2.  Unpack individual entries and generate a unique `recordId` for each.
3.  Set `updatedAt = addedAt` and `deviceId` to the current device's newly generated UUID.
4.  Write the migrated records into the new record-level IndexedDB stores.

---

## 8. Provider-Neutral Portability

The sync architecture is provider-neutral. While **Supabase** is specified as the primary target for launch due to its powerful Postgres core and developer free tier, the `SyncProvider` interface decouples the core logic. Replacing Supabase with Firebase or a self-hosted custom backend requires no modifications to the Sync Engine or collection UI.

---

## 9. Failure Modes & Graceful Degradation

*   **Offline Mode:** App functions perfectly. Outbox queue accumulates modifications.
*   **Authentication Expired:** The Sync Engine enters `AUTH_ERROR` state. The UI displays an warning banner. Local operations continue unblocked.
*   **Backend Project Paused/Down:** Sync Engine retries with exponential backoff and enters the `UNAVAILABLE` state, preserving battery and data.

---

## 10. Explicit Non-Changes to V1

*   **Offline-first remains absolute:** The app is entirely operational offline. Sync is a background enrichment.
*   **No new dependencies in the frozen V1 branch.**
*   **Zero server-side dependencies for pricing.** External catalog API limits and pricing stubs remain unaltered.
