# Development Workflow & AI Guidelines

This document establishes the expected workflow for future AI-assisted development on Pocket Market Binder.

---

### 1. Core Workflow Rules
- **Inspect Before Changing:** Always read and inspect relevant files before proposing or implementing edits.
- **Understand Existing Architecture:** Do not introduce new abstractions or layers unless required by a concrete, approved requirement.
- **Prefer Existing Patterns:** Follow existing conventions, TypeScript types, and service patterns established in the repository.
- **Focused Milestones:** Make changes in small, well-defined milestones rather than large sweeping rewrites.
- **Do Not Fabricate Data:** Never inject fake pricing observations or mock catalog records into working code; use proper stubs or verified APIs.
- **Preserve Offline/Local-First Behavior:** Ensure all user collection actions (binder, wishlist, cart) continue to work offline via IndexedDB.
- **Keep Provider-Specific Logic Isolated:** Never leak provider API calls or provider-specific logic into UI components or core services; use adapter interfaces (`CatalogProvider`, `PricingProvider`).
- **Run Verification Commands:** Always run `npm run typecheck` and `npm run build` after relevant code changes.
- **Audit Architectural Boundaries:** Verify that architectural boundaries remain intact after major milestones.
- **Keep Documentation Updated:** Update `/docs/` when architecture, data models, or core decisions change.
- **Source of Truth Hierarchy:** Never assume an AI conversation history is authoritative over the repository (see AI Handoff).
