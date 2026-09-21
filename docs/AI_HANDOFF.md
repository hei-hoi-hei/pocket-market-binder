# AI Handoff — Historical Release Note

> **Historical document.** The authoritative current state is [CURRENT_STATE.md](./CURRENT_STATE.md). Do not treat the claims below as a complete description of the current implementation.

This document records the V1.0.0 release-candidate handoff that described synchronization, migration, Supabase integration, and QA work as complete. The current repository baseline subsequently reconciled those claims and found synchronization behavior to be partial: pulled changes, cursor persistence, conflict wiring, account lifecycle, and truthful sync status remain incomplete.

Future coding agents must:

1. Read [CURRENT_STATE.md](./CURRENT_STATE.md) first.
2. Read [POCKET_MARKET_BINDER_BUILD_PLAN.md](./POCKET_MARKET_BINDER_BUILD_PLAN.md) before selecting a phase.
3. Read [POCKET_MARKET_BINDER_ARCHITECTURE_DECISIONS.md](./POCKET_MARKET_BINDER_ARCHITECTURE_DECISIONS.md) before changing architecture.
4. Distinguish implemented, partial, in-progress, deferred, missing/committed, optional/future, unknown, and intentionally removed work.
5. Never infer that an absent feature is out of scope.
6. Treat committed V1 requirements that are not implemented as unfinished V1 work, not automatically V2 or future work.
7. Preserve modular providers, free-first operation, and optional BYO credentials.
8. Keep provider fallback distinct from provider enrichment.
9. Do not narrow the overall architecture into TCGdex-specific assumptions.
10. Preserve the scanner flow: image → provider → candidates → confirmation → binder.
11. Verify existing work before implementing replacements.

ChatGPT, OpenAI, Cline, Copilot, and other AI references in project materials describe development tooling. Embedded ChatGPT, OpenAI integration, AI credential management, AI-powered card identification, and AI-dependent Binder functionality are not V1 product requirements.

The original release verification claims remain useful historical context, but they do not supersede the reconciled current-state document.
