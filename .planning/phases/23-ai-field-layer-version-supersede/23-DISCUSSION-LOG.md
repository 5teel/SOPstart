# Phase 23: AI Field Layer + Version Supersede - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 23-ai-field-layer-version-supersede
**Areas discussed:** AI write approval model, Cmd+K (REMOVED mid-discussion), Supersede/diff/restore, Worker sign-off chain

---

## AI write approval model

| Option | Description | Selected |
|--------|-------------|----------|
| Tiered | Low-stakes auto-apply; safety/published need approval | ✓ |
| Approve everything | Every write is a proposal | |
| Auto-apply + undo | Immediate writes + audit/undo | |

**Write posture:** Tiered.
**High-stakes (approval-gated):** Published-SOP content + any field on a published SOP + member roles/permissions. (Dept/visibility tags, drafts, settings auto-apply — NOT selected for gating.)
**Approval UX:** Inline accept/reject diff at the field (central queue rejected).

---

## Cmd+K capabilities & scope — REMOVED

**User halted the questions and directed: "remove the Cmd+K palette."** Cmd+K was removed from the product entirely (not deferred): `CommandPalette.tsx`, `CmdKProvider.tsx`, `sops/layout.tsx`, and the `cmdk` dep deleted (commit `d06066b`). AFL-AI-04 dropped from scope. No further questions asked for this area.

---

## Supersede / diff / restore flow

| Option | Description | Selected |
|--------|-------------|----------|
| Edit-into-draft clone | Clone published → draft → builder → publish supersedes | ✓ |
| Re-upload document | New doc → re-parse → publish | |
| Both paths | | |

**New version:** Edit-into-draft clone (re-upload still available, clone is primary).
**Restore:** Restore-as-new-version (append-only; reactivate-in-place rejected).
**Update indicator:** Any new published version (material-change classification rejected).

---

## Worker sign-off chain

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse ack + completion (per-step) | | |
| Explicit per-step sign | | |
| Single end sign-off | One signature at completion | ✓ |

**What signs:** Single end sign-off at completion.
**Chain scope:** Worker + supervisor (two links); multi-role COMPL-01 deferred.
**Identity (user free-text):** Roster name-select — all users loaded into a user DB; the worker **selects their name from a list at login** (simple select, no password); records/signatures logged against that user. Follow-ups: sign-in **replaces login for workers** (passwordless); supervisor counter-sign **also via name-select**.

**Notes:** D-11 (passwordless roster login) is a deliberate floor-usability tradeoff and the phase's highest-risk item — it must be reconciled with Supabase auth + RLS during research (flagged in CONTEXT).

## Claude's Discretion

- Diff rendering/granularity within the block-diff approach.
- Internal field-registry abstraction shape (must be unified + v5.0-consumable).

## Deferred / Removed Ideas

- Cmd+K command palette — REMOVED from the product (not deferred).
- Conversational/agent UI surface for the field layer — v5.0.
- Multi-role competency chain (COMPL-01) — deferred requirement.
- Central "AI proposals" review queue — inline-only chosen.
- Material-change classification for update indicator.
