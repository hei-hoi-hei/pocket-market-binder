# Post-V1 Optional Account & Cross-Device Sync Specification

This document provides a formal implementation specification for the post-V1 synchronization system of Pocket Market Binder.

---

## 1. Scope & Status

*   **Status:** **READ-ONLY SPECIFICATION.** No implementation has been performed.
*   **Objective:** Define a robust, record-level synchronization mechanism using Last-Write-Wins (LWW) and Tombstones.
*   **V1 Integrity:** V1.0.0 remains frozen. This spec defines the *future* state of the application's persistence and synchronization layers.

---

## 2. Decision Record: Record-Level LWW + Tombstones

The system shall move from "Array-Blob Storage" to "Record-Level Storage" for synchronized data.

*   **Logic:** Instead of replacing the entire `binder` array, the system tracks individual record changes.
*   **Conflict Resolution:** Deterministic Last-Write-Wins (LWW) based on `updatedAt` and `deviceId`.
*   **Deletions:** Use an `isDeleted` flag (Tombstone) to propagate deletions across devices.

---

## 3. Data Schema Evolution (Conceptual)

To support synchronization, the following fields must be introduced to user-owned records (`BinderEntry`, `WishlistEntry`, `CartEntry`).

| Field Name | Type | Required? | Purpose |
| :--- | :--- | :--- | :--- |
| **`recordId`** | `string` | **Required** | Stable UUID for the record. |
| **`updatedAt`** | `number` | **Required** | Millisecond timestamp of the last mutation. |
| **`deviceId`** | `string` | **Required** | Unique identifier of the device making the change. |
| **`isDeleted`** | `boolean` | Optional | Tombstone flag (defaults to `false`). |

### 3.1 User Record Identity
*   **Binder/Wishlist:** In V1, these are logically unique per `cardId`. In Post-V1, a `recordId` is still assigned to each entry for sync tracking, but the application logic should enforce uniqueness on `cardId` per user account.
*   **Cart/Acquisitions:** Post-V1 allows multiple records for the same `cardId` (e.g., separate purchase events). `recordId` becomes the primary unique key.

---

## 4. Provider-Neutral Sync Contract

The Sync Engine shall interact with a `SyncProvider` interface.

```typescript
interface SyncProvider {
  /** Authentication & User Context */
  signIn(): Promise<User | null>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  onAuthStateChange(callback: (user: User | null) => void): void;

  /** Data Synchronization */
  pushChanges(changes: SyncChange[]): Promise<SyncResult>;
  pullChanges(cursor: SyncCursor): Promise<SyncDelta>;
  
  /** Provider Health */
  getProviderStatus(): ProviderStatus;
}

type SyncChange = {
  store: 'binder' | 'wishlist' | 'cart';
  record: any; // User record with sync metadata
};

type SyncCursor = string | number; // e.g., max updatedAt seen
```



---

## 5. Supabase Implementation Details

### 5.1 Security & RLS
*   **User Isolation:** Row Level Security (RLS) ensures `auth.uid() = user_id`.
*   **Credentials:** Uses the browser-safe `SUPABASE_ANON_KEY`.
*   **No Secrets:** Service-role keys must **NEVER** be included in the client bundle.

### 5.2 Database Schema
Tables: `binder`, `wishlist`, `cart`.
Columns: `user_id` (UUID), `record_id` (UUID, PK), `card_id` (string), `quantity` (int), `seller_price` (numeric), `added_at` (bigint), `updated_at` (bigint), `device_id` (text), `is_deleted` (bool).

---

## 6. Conflict Resolution Logic

Deterministic LWW shall be applied when merging two versions of the same `recordId`:

1.  Compare **`updatedAt`**: The higher timestamp wins.
2.  If **`updatedAt`** is equal: Compare **`deviceId`** (lexicographical). The higher string wins.

*This ensures all devices eventually converge to the same state regardless of sync order.*

---

## 7. Tombstones & Deletion Model

1.  **Local Deletion:** When a user removes a card, set `isDeleted = true` and update `updatedAt`.
2.  **Sync:** The tombstone record is pushed to the provider.
3.  **Retention:** Stale tombstones (e.g., > 30 days old) may be physically purged from the remote database and local storage after they have been acknowledged by all known devices (or after a safety window).
4.  **Resurrection:** If a device adds the same card again, it creates a new record or clears the `isDeleted` flag with a newer `updatedAt`.

---

## 8. Initial Account Synchronization

When a user signs in for the first time on a device with existing local data:

1.  **Local Scan:** Identify all records in IndexedDB.
2.  **Cloud Scan:** Fetch all records from the cloud.
3.  **Merge Strategy:**
    *   If a `recordId` exists only locally: Push to cloud.
    *   If a `recordId` exists only in cloud: Pull to local.
    *   If a `recordId` exists in both: Apply LWW conflict resolution.
4.  **Logical Uniqueness (Binder/Wishlist):** If two records exist for the same `cardId` but have different `recordId`, the UI may prompt for a merge or the system may automatically merge them into a single record with combined quantity, choosing the most recent metadata.

---

## 9. Sync Queue (Outbox)

The system shall maintain a persistent `sync_queue` in IndexedDB.

1.  **Capture:** Every mutation in `collectionService` writes the change to the `sync_queue` *atomically* with the local data update.
2.  **Processing:** The Sync Engine pulls from the queue and attempts to `pushChanges`.
3.  **Acknowledge:** Once the provider confirms success, the change is removed from the queue.
4.  **Retries:** Failed pushes stay in the queue and retry with exponential backoff.



---

## 10. Account Switching & Isolation

1.  **Logout:** All local synchronization metadata (cursors, queues) must be cleared. The app should prompt whether to keep or wipe local data.
2.  **Namespace Isolation:** If multiple users share a device, local storage should ideally be isolated by a hashed user ID prefix (e.g., `user123:binder`).

---

## 11. Failure Scenarios & Expected Behavior

| Scenario | Expected Behavior |
| :--- | :--- |
| **Offline Addition** | Record saved locally; change queued in Outbox. |
| **Simultaneous Edit** | Deterministic LWW resolves the conflict on next sync. |
| **Delete vs Edit** | Tombstone wins if its `updatedAt` is higher. |
| **Browser Storage Loss** | Collection recovered from Cloud upon next sign-in. |
| **Supabase Paused** | App functions locally; sync indicator shows "Offline/Provider Unavailable". |
| **Auth Expired** | Sync paused; user prompted to re-authenticate. |
| **Network Drop during Pull** | Last successful cursor preserved; resume from that point later. |

---

## 12. Provider Health States

1.  **`LOCAL_ONLY`**: No account linked.
2.  **`SYNCED`**: All local changes pushed, all remote changes pulled.
3.  **`SYNCING`**: Active upload/download in progress.
4.  **`OFFLINE`**: Network unavailable; changes queued.
5.  **`UNAVAILABLE`**: Network exists but backend is unreachable or project is paused.
6.  **`AUTH_ERROR`**: Session invalid; re-login required.

---

## 13. Migration Path from V1

1.  **First Launch (Post-V1):**
    *   Read existing "Array-Blobs" (`binder`, `wishlist`, `cart`).
    *   Assign a new `recordId` (UUID) to every entry.
    *   Set `updatedAt = addedAt` and `deviceId = current_device_id`.
    *   Write back to IndexedDB using the new record-based schema.
2.  **Lazy vs Eager:** Migration should be **eager** on first launch to ensure the sync engine has valid metadata for all records.
3.  **Rollback:** V1 software will be unable to read the post-V1 record-based schema.

---

## 14. PMED Portal Reuse

The following architectural patterns shall be documented for potential reuse in the PMED Portal:
*   `SyncProvider` interface definition.
*   LWW merge algorithm.
*   Supabase RLS policies for user isolation.
*   PWA background sync strategies.

**Isolation Rule:** Each application (Pocket Market Binder, PMED Portal) shall use its own Supabase project or distinct schema within a project to avoid cross-contamination.

---

## 15. Export & Recovery

Regardless of sync state, the app shall support:
1.  **JSON Export:** A provider-independent dump of all user collection records + sync metadata.
2.  **CSV Export:** A human-readable summary of the collection.
3.  **Import:** Capability to restore a collection from a JSON dump, treating it as a "bulk sync" event.

---

## 16. Provider Capability Model

Providers can declare supported features:
*   `tombstones: true`
*   `incrementalPull: true`
*   `realtimeSubscriptions: false` (Optional, can be used for instant cross-device updates).

---

## 17. Explicit Non-Changes to V1

*   **No modification of pricing logic.**
*   **No modification of catalog provider integration.**
*   **No new dependencies in the V1 branch.**
*   **No changes to the V1 IndexedDB database version (`1`).** (Sync will require a version upgrade to `2`).
