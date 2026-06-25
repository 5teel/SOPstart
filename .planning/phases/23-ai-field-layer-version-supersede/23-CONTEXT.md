# Phase 23: AI Field Layer + Version Supersede - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Two bundles:

1. **X-03 — Universal AI field layer (backbone).** A single, unified mechanism by which every editable field in the app registers an AI **read** API and (for most fields) an AI **write** API, so a future agent can fetch and propose/apply values without per-feature bespoke code (AFL-AI-01/02/03). This phase ships the **registry + read/write APIs + the tiered approval model** — i.e. the architectural backbone the v5.0 conversational app will consume. It does **NOT** ship a user-facing command surface this phase (Cmd+K / AFL-AI-04 was **removed from the product** on 2026-06-25 — see Deferred/Removed).

2. **G-01 — Version supersede + worker sign-off (standalone).** Formal supersede flow, version diff, one-click restore, a worker "updated since last completion" indicator, and a per-instance worker sign-off chain where completing the SOP IS the legal signature (AFL-VER-01..05).

**Out of scope (carried forward / locked):**
- In-place editing of *published* SOPs (REQUIREMENTS.md L224) — the supersede flow is the only publish-edit path.
- Multi-role competency chain COMPL-01 (worker→trainer→verifier→manager) — deferred.
- Any Cmd+K / command-palette UI — removed from the product entirely.
- A user-facing conversational surface for the AI field layer — that's v5.0.
</domain>

<decisions>
## Implementation Decisions

### X-03 — AI write safety model
- **D-01:** Write posture is **tiered** — low-stakes fields auto-apply; high-stakes fields require explicit admin approval.
- **D-02:** Approval-gated (high-stakes) tier = **anything on a published SOP** (content, metadata, assignments) **+ member roles/permissions**. Everything else (drafts, department/visibility tags, settings) auto-applies.
- **D-03:** Approval UX is **inline accept/reject** — the proposed change appears at the field as a diff with Accept / Reject (no central queue this phase).
- **D-04:** X-03 ships as **backbone only** — the unified field registry (AFL-AI-03) + read API (AFL-AI-01) + write API with the D-01/D-02/D-03 approval model (AFL-AI-02). **No user-facing surface this phase** (Cmd+K removed). The registry must be designed so v5.0's conversational app can drive it.

### G-01 — Version supersede / diff / restore
- **D-05:** New superseding version is created via an **"edit-into-draft clone"** — one click clones the published SOP into a new editable DRAFT; admin edits it in the existing builder; publishing supersedes the prior version. (Re-upload remains available via the existing MGMT-05 path but the clone flow is the primary supersede entry point.)
- **D-06:** **Restore = restore-as-new-version** — restoring an old version creates a NEW current version copying the old content. History is **append-only**; nothing is rewritten or reactivated in place.
- **D-07:** Diff is side-by-side; **reuse `diff-block-content.ts`** (block/section content diff). Exact presentation is planner discretion.
- **D-08:** "Updated since last completion" indicator (AFL-VER-04) triggers on **any new published version** newer than the worker's last completion — badge on the SOP card + walkthrough entry. (No material-change classification — deliberately simple.)

### G-01 — Worker sign-off chain
- **D-09:** Sign-off is a **single end sign-off at completion** (not per-step). Completing the SOP captures the worker's signature for the whole instance.
- **D-10:** Chain scope this phase = **worker + supervisor** (two links): worker signs at completion, supervisor counter-signs (fold in the existing supervisor review). Multi-role COMPL-01 stays deferred.
- **D-11:** **Identity = roster name-select.** All org users are loaded into a roster; a worker **selects their name from a list to sign in** — this **replaces password/magic-link login for workers** (no password). The supervisor counter-signature is **also via name-select** (convenience-first, consistent with workers). All usage + signatures are logged against the selected user. This is a deliberate floor-usability-over-cryptographic-strength tradeoff for shared devices.

### Claude's Discretion
- Exact diff rendering/granularity (D-07) within the block-diff approach.
- Internal shape of the field-registry abstraction (AFL-AI-03), provided it's unified and v5.0-consumable.

### ⚠ Key research/planning risk (MUST resolve before/within planning)
- **D-11 (roster name-select replacing worker login) collides with the current Supabase auth + RLS model.** Workers are currently authenticated individuals; RLS gates org/sub-trade/department visibility off `auth.uid()`. A passwordless "pick your name" sign-in means the worker is NOT an individually-authenticated Supabase user. Research MUST determine: how the shared device establishes an org-scoped session, how RLS still enforces org/department isolation, how the selected identity is bound to completion/signature records, and the security posture/carve-out this implies. This is the highest-uncertainty item in the phase.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope
- `.planning/REQUIREMENTS.md` § "AI Field Layer + Version Supersede (Phase 23)" (L429) — AFL-AI-01/02/03 (AFL-AI-04 **REMOVED**), AFL-VER-01..05. Also L224 (published-edit out), L123 (section locking + optimistic version column), L201 (COMPL-01 deferred multi-role chain).
- `.planning/ROADMAP.md` Phase 23 line (L60) — goal + the Cmd+K removal note.

### Existing code to build on (version/diff/restore — G-01)
- `src/actions/versioning.ts` — current versioning actions (AFL-VER-01/03 base).
- `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` — version history UI surface.
- `src/lib/builder/diff-block-content.ts` (+ `.test.ts`) — block-content diff utility for AFL-VER-02.

### Existing code to build on (completion/sign-off — G-01)
- `src/actions/completions.ts`, `src/stores/completionStore.ts`, `src/hooks/useCompletions.ts`, `src/lib/validators/completions.ts` — completion records; AFL-VER-05 sign-off extends these.
- `src/app/(protected)/activity/` + `activity/[completionId]` — supervisor review (the 2nd sign-off link, D-10).

### Auth / RLS (critical for D-11)
- `src/lib/supabase/*` (client/server/middleware) + `supabase/migrations/` RLS policies (esp. 00030/00031 org + sub-trade gates) — must be reconciled with roster name-select login.

### AI field layer (X-03) — greenfield
- No existing field-registry mechanism — AFL-AI-03 is net-new. No external spec/ADR yet; decisions above are the source of truth.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `diff-block-content.ts`: block-level content diff — directly powers AFL-VER-02 side-by-side diff.
- `versioning.ts` + versions page: existing version model/UI — extend for supersede (D-05) + restore-as-new (D-06).
- `completions.ts` / `completionStore` / activity review: completion + supervisor-review base — extend for the worker+supervisor sign-off chain (D-09/D-10).

### Established Patterns
- Server actions in `src/actions/` for mutations; Zod validators in `src/lib/validators/`.
- Append-only audit posture for completions/versions (reinforced by D-06).
- Published-edit is forbidden — clone-to-draft is the sanctioned edit path (D-05).

### Integration Points
- AI field write layer (X-03) must hook the same server-action/validator mutation path so the tiered approval gate (D-02) wraps existing writes rather than bypassing them.
- Roster name-select (D-11) intersects `(protected)/layout.tsx` auth resolution + RLS — the riskiest integration.

### Greenfield
- AFL-AI-01/02/03 unified field registry — no analog exists; design from scratch, v5.0-consumable.
</code_context>

<specifics>
## Specific Ideas

- Worker sign-in: "very simple — just select your name from a list." No passwords for workers. (D-11)
- Approval as an **inline diff at the field**, not a separate inbox. (D-03)
- Restore must never rewrite history — always forward as a new version. (D-06)
</specifics>

<deferred>
## Deferred / Removed Ideas

- **Cmd+K command palette (AFL-AI-04) — REMOVED from the product** 2026-06-25 (not merely deferred). Existing `/sops` palette + `cmdk` dep deleted (commit `d06066b`). Do not reintroduce without explicit instruction.
- **Conversational/agent UI surface for the AI field layer** — v5.0; this phase builds only the backbone.
- **Multi-role competency sign-off chain (COMPL-01:** worker→trainer→verifier→manager) — separate deferred requirement; this phase does worker + supervisor only.
- **Material-change classification** for the update indicator — chose simple "any new published version" (D-08) instead.
- **Central "AI proposals" review queue** — chose inline-only (D-03); a queue could be a later enhancement.

</deferred>

---

*Phase: 23-ai-field-layer-version-supersede*
*Context gathered: 2026-06-25*
