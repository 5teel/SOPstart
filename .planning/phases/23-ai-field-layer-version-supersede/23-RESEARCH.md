# Phase 23: AI Field Layer + Version Supersede - Research

**Researched:** 2026-06-25
**Domain:** AI field registry (greenfield), version supersede/diff/restore (extend existing), roster-name-select auth (high-risk D-11)
**Confidence:** HIGH (codebase reads) / MEDIUM (D-11 architecture recommendation) / LOW (future v5.0 registry extensibility)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Write posture is tiered — low-stakes fields auto-apply; high-stakes fields require explicit admin approval.
- **D-02:** Approval-gated (high-stakes) tier = anything on a published SOP (content, metadata, assignments) + member roles/permissions. Everything else (drafts, department/visibility tags, settings) auto-applies.
- **D-03:** Approval UX is inline accept/reject — the proposed change appears at the field as a diff with Accept / Reject (no central queue this phase).
- **D-04:** X-03 ships as backbone only — the unified field registry (AFL-AI-03) + read API (AFL-AI-01) + write API with D-01/D-02/D-03 approval model (AFL-AI-02). No user-facing surface this phase (Cmd+K removed). The registry must be designed so v5.0's conversational app can drive it.
- **D-05:** New superseding version is created via "edit-into-draft clone" — one click clones the published SOP into a new editable DRAFT; admin edits it in the existing builder; publishing supersedes the prior version.
- **D-06:** Restore = restore-as-new-version — restoring an old version creates a NEW current version copying the old content. History is append-only; nothing is rewritten or reactivated in place.
- **D-07:** Diff is side-by-side; reuse `diff-block-content.ts`. Exact presentation is planner discretion.
- **D-08:** "Updated since last completion" indicator triggers on any new published version newer than the worker's last completion — badge on the SOP card + walkthrough entry. No material-change classification.
- **D-09:** Sign-off is a single end sign-off at completion (not per-step).
- **D-10:** Chain scope this phase = worker + supervisor (two links): worker signs at completion, supervisor counter-signs (fold in existing supervisor review).
- **D-11:** Identity = roster name-select. All org users are loaded into a roster; a worker selects their name from a list to sign in — this replaces password/magic-link login for workers (no password). The supervisor counter-signature is also via name-select. All usage + signatures are logged against the selected user. Deliberate floor-usability-over-cryptographic-strength tradeoff for shared devices.

### Claude's Discretion

- Exact diff rendering/granularity (D-07) within the block-diff approach.
- Internal shape of the field-registry abstraction (AFL-AI-03), provided it is unified and v5.0-consumable.

### Deferred Ideas (OUT OF SCOPE)

- Cmd+K command palette (AFL-AI-04) — REMOVED from product 2026-06-25. Do not reintroduce.
- Conversational/agent UI surface for the AI field layer — v5.0.
- Multi-role competency sign-off chain (COMPL-01: worker→trainer→verifier→manager) — separate deferred requirement.
- Material-change classification for the update indicator.
- Central "AI proposals" review queue — inline-only chosen (D-03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AFL-AI-01 | Every editable field exposes an AI read API (agent can fetch current value) | Field descriptor registry with `read()` fn per field |
| AFL-AI-02 | Most editable fields expose an AI write API (agent can propose/apply a value, approval-gated for high-stakes) | Registry `write()` fn + tiered approval (D-01/D-02) wrapping existing server actions |
| AFL-AI-03 | Unified agent interface — every surface registers fields via a single shared mechanism, no per-feature bespoke API | `src/lib/ai-fields/registry.ts` — see Architecture Patterns § Field Registry |
| AFL-VER-01 | Admin can edit an SOP into a new version with the previous version explicitly deprecated and saved in version history | `cloneSopAsDraft` server action — new code on top of existing `versioning.ts` patterns |
| AFL-VER-02 | Side-by-side diff between any two SOP versions | Extend existing `diff-block-content.ts`; new `SopVersionDiff` page/component |
| AFL-VER-03 | Admin can restore an old version as the active one with one click | `restoreVersionAsNew` server action — append-only, copies content forward |
| AFL-VER-04 | Workers see an indicator on the SOP if it has been updated since their last completion | Badge on SOP card; compare `sops.published_at` vs `sop_completions.submitted_at` — no schema change needed |
| AFL-VER-05 | Every SOP instance run is recorded with the worker's name + per-step approval, forming a personal sign-off chain — completing the SOP IS the legal signature | New `sop_completion_signatures` table; D-11 roster identity captured at instance start on `sop_completions.roster_worker_id` |
</phase_requirements>

---

## Summary

Phase 23 has two fully independent bundles that can be waved in parallel after a schema wave.

**Bundle X-03 (AI Field Layer)** is net-new greenfield: a typed field descriptor registry (`src/lib/ai-fields/registry.ts`) where every editable surface registers its fields with `read()` and `write()` callbacks. The `write()` path does NOT bypass existing server actions and Zod validators — it calls them, wrapping the call with the D-01/D-02 tiered-approval gate. For high-stakes fields (published SOP content, metadata, assignments, member roles) the write produces a pending `AiFieldProposal` record that renders as an inline diff Accept/Reject at the field. For everything else it auto-applies immediately. No user-facing invocation surface ships this phase; the registry is designed for the v5.0 conversational agent to drive programmatically via `POST /api/ai-fields/write`.

**Bundle G-01 (Version Supersede + Sign-off)** extends existing `versioning.ts`, `completions.ts`, and the versions UI. The key new server action is `cloneSopAsDraft` which duplicates a published SOP's sections/blocks/steps into a new `draft` SOP record and marks the original with `superseded_by` on publish. Diff reuses `diff-block-content.ts` with a new two-SOP comparison page. Restore is `restoreVersionAsNew` — purely additive, copies old content into a new draft, never mutates history. The "updated since last completion" badge compares `sop.published_at` vs `MAX(sop_completions.submitted_at)` — no schema change needed for AFL-VER-04. AFL-VER-05 sign-off requires a new `roster_worker_id` column on `sop_completions` and a new `sop_completion_signatures` table.

**D-11 (roster name-select)** is the highest-risk item. After full codebase and migration analysis, the recommended approach is: a **per-org kiosk Supabase account** (one `auth.users` row per org, named e.g. `kiosk+{org_id}@internal`) that holds a long-lived session on shared devices. RLS sees this kiosk account as a member of the org (an `organisation_members` row with `role='worker'`). The selected roster identity is stored as `roster_worker_id` on `sop_completions` — a FK to `auth.users` (not the session user). This preserves the append-only, org-scoped audit trail while allowing passwordless "pick your name" UX. No RLS rewrite is needed; the kiosk account naturally satisfies all existing policies. The security tradeoff is explicit: the kiosk account can complete any SOP in its org (same as a logged-in worker), but individual identity attribution for audit purposes is the roster selection, which is self-reported and not cryptographically proven.

**Primary recommendation:** Wave the phase as: W1 = schema migration (roster columns + sop_completion_signatures + ai_field_proposals); W2 = server actions (cloneSopAsDraft + restoreVersionAsNew + field registry + write API); W3 = UI (versions page enhancements + diff view + SOP card badge + completion sign-off + roster login page); W4 = API route + integration tests.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Field registry + descriptor types | API/Backend (`src/lib/ai-fields/`) | — | Pure TypeScript module; no React, no DB. Consumed by server actions and API routes. |
| AI write approval gate (D-01/D-02) | API/Backend (server action wrapper) | Database (ai_field_proposals table) | Gate logic must be server-enforced; pending proposals stored in DB so Accept/Reject survives page reload. |
| Inline Accept/Reject diff UI (D-03) | Frontend (admin builder components) | — | Field-level UI affordance; read proposal from DB, dispatch Accept/Reject server action. |
| clone-to-draft supersede (D-05) | API/Backend (server action) | Database (new sop record + copy of sections/blocks) | Deep-copy of structured SOP content; must be atomic or at least idempotent. |
| Side-by-side version diff (D-07) | Frontend (admin route `/admin/sops/[sopId]/versions/diff`) | API/Backend (fetch two SOP versions, run diff) | `diff-block-content.ts` is pure; diff computation can be client-side once both versions are fetched. |
| Restore-as-new-version (D-06) | API/Backend (server action) | Database | Append-only mutation; triggers publish supersede path. |
| "Updated since last completion" badge (D-08) | Frontend Server (page.tsx server component) | Database (query) | Compare published_at vs submitted_at at render time; no polling needed. |
| Worker sign-off capture (D-09) | API/Backend (server action wrapping completions.ts) | Database (sop_completions.roster_worker_id + sop_completion_signatures) | Append-only; must go through server action, not client-direct. |
| Supervisor counter-sign (D-10) | API/Backend (extend signOffCompletion) | Frontend (activity/[completionId] page) | Existing supervisor sign-off path extended with roster identity capture. |
| Roster name-select login (D-11) | Frontend (`/login/kiosk` route) + API Backend (session management) | Database (kiosk org account in auth.users + organisation_members) | Kiosk session established once per device; roster pick stored in local session state, not in Supabase session. |
| Kiosk session RLS | Database (existing policies unchanged) | API/Backend (kiosk account is a valid org member) | Existing org-scoped policies satisfy kiosk account transparently. |

---

## Standard Stack

### Core (no new npm packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | existing | Field descriptor type validation + AI write payload validation | Already in project; schema for `FieldDescriptor` and `AiWriteRequest` |
| Supabase JS (admin client) | existing | Kiosk account creation + ai_field_proposals writes | Service-role writes for junction tables — established pattern |
| `diff-block-content.ts` | existing (src/lib/builder/) | Block-level content diff for AFL-VER-02 | Already ships and is unit-tested |
| `versioning.ts` | existing (src/actions/) | Version history model — extend for clone/restore | `uploadNewVersion`, `getVersionHistory` already exist |
| `completions.ts` | existing (src/actions/) | Completion records — extend for roster sign-off | `submitCompletion`, `signOffCompletion` already exist |

**No new npm packages are needed for this phase.** [VERIFIED: codebase read — all required capabilities (deep-copy, diff, DB writes) are covered by existing stack]

### Package Legitimacy Audit

> No new external packages are installed in this phase — all work extends existing dependencies.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
[Admin Browser]
    |
    | roster pick / Accept / Reject / Clone / Diff
    v
[Next.js App Router — server components + server actions]
    |                        |                          |
    v                        v                          v
[src/lib/ai-fields/      [src/actions/              [src/actions/
  registry.ts]             versioning.ts]            completions.ts]
  FieldDescriptor[]        cloneSopAsDraft()          submitCompletion()
  read() / write()         restoreVersionAsNew()       + roster_worker_id
    |                        |                          |
    | tiered approval gate   | deep-copy sections       | sop_completion_signatures
    v                        v                          v
[Supabase Postgres — service-role (admin client) for all writes]
  ai_field_proposals       sops (new draft row)        sop_completions
  (pending / applied /     sop_sections (copied)       sop_completion_signatures
   rejected)               sop_steps (copied)          (worker + supervisor rows)

[Worker Browser — /login/kiosk route]
    |
    | org kiosk session (long-lived cookie)
    | + roster_worker_id in localStorage / completion start payload
    v
[Next.js Middleware — updateSession()]
    |  kiosk account passes existing auth.uid() check
    v
[Supabase RLS — unchanged]
    sops: existing policies (org-scoped, sub-trade, dept) apply to kiosk account
    sop_completions: INSERT with roster_worker_id as attribution FK
```

### Recommended Project Structure

```
src/
├── lib/
│   └── ai-fields/
│       ├── registry.ts          # FieldDescriptor registry + read/write types
│       ├── approval.ts          # tiered approval gate logic (D-01/D-02)
│       └── index.ts             # barrel export
├── actions/
│   ├── versioning.ts            # extend: cloneSopAsDraft, restoreVersionAsNew
│   ├── completions.ts           # extend: roster_worker_id on submitCompletion
│   └── ai-fields.ts             # new: applyAiWrite, acceptProposal, rejectProposal
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── kiosk/           # new: roster name-select login page
│   │           └── page.tsx
│   ├── api/
│   │   └── ai-fields/
│   │       ├── read/route.ts    # GET: read field value
│   │       └── write/route.ts   # POST: propose/apply AI write
│   └── (protected)/
│       └── admin/sops/[sopId]/
│           └── versions/
│               └── diff/        # new: side-by-side diff page
│                   └── page.tsx
└── lib/validators/
    └── ai-fields.ts             # Zod: FieldDescriptor, AiWriteRequest, AiFieldProposal
supabase/migrations/
    └── 00038_phase23_schema.sql # ai_field_proposals + roster columns + sop_completion_signatures
```

---

### Pattern 1: Typed Field Descriptor Registry (AFL-AI-03)

**What:** A module-level typed registry where each feature surface calls `registerField()` with a descriptor at import time. The descriptor declares the field's ID, label, read function, write function (optional), and stake level. The registry is a plain `Map<string, FieldDescriptor>`.

**When to use:** Any editable field that should be AI-readable/writable.

**Why this shape:** It mirrors the established project pattern — `src/lib/validators/` for schemas, `src/actions/` for mutations. The registry itself has no React dependency, so it can be consumed by server actions, API routes, and future agent orchestrators equally. v5.0's conversational app calls `POST /api/ai-fields/write` with a `field_id` and the registry resolves the descriptor.

**Example:**

```typescript
// Source: [ASSUMED] — design by Claude based on project conventions
// src/lib/ai-fields/registry.ts

export type StakeLevel = 'low' | 'high'  // D-01/D-02

export interface FieldDescriptor<T = unknown> {
  /** Globally unique field ID, e.g. 'sop.title', 'sop.section.{sectionId}.title' */
  id: string
  /** Human label for UI diff display (D-03) */
  label: string
  stakeLevel: StakeLevel
  /** Returns the current value. Called by GET /api/ai-fields/read */
  read: (context: FieldContext) => Promise<T>
  /** Applies or proposes a new value. Called by POST /api/ai-fields/write.
   *  For high-stake fields: stores AiFieldProposal in DB, returns proposalId.
   *  For low-stake fields: calls the existing server action directly, returns applied value. */
  write?: (context: FieldContext, newValue: T) => Promise<WriteResult>
}

export interface FieldContext {
  organisationId: string
  sopId?: string
  sectionId?: string
  stepId?: string
  memberId?: string
}

export type WriteResult =
  | { outcome: 'applied'; value: unknown }
  | { outcome: 'pending_approval'; proposalId: string }

const registry = new Map<string, FieldDescriptor>()

export function registerField<T>(descriptor: FieldDescriptor<T>) {
  if (registry.has(descriptor.id)) {
    // Idempotent — re-registration with same id is a no-op (safe for HMR/module reload)
    return
  }
  registry.set(descriptor.id, descriptor as FieldDescriptor)
}

export function getField(id: string): FieldDescriptor | undefined {
  return registry.get(id)
}

export function getAllFields(): FieldDescriptor[] {
  return Array.from(registry.values())
}
```

**Registration site example (co-located with existing server action):**

```typescript
// Source: [ASSUMED]
// src/actions/sops.ts — at bottom of file
import { registerField } from '@/lib/ai-fields/registry'

registerField({
  id: 'sop.title',
  label: 'SOP Title',
  stakeLevel: 'low',    // draft SOPs auto-apply; published gated by approval.ts check
  read: async ({ sopId, organisationId }) => {
    const sop = await getSopById(sopId!, organisationId)
    return sop?.title ?? null
  },
  write: async ({ sopId, organisationId }, newValue) => {
    // Calls the EXISTING server action — no bypass
    const result = await updateSopTitle({ sopId: sopId!, title: newValue as string, organisationId })
    return { outcome: 'applied', value: result.title }
  },
})
```

---

### Pattern 2: Tiered Approval Gate (D-01 / D-02)

**What:** `approval.ts` implements a single function `gateWrite(descriptor, context, newValue)` that checks the stake level and SOP status, then either calls `descriptor.write()` directly (low-stake or draft) or creates an `ai_field_proposals` DB row (high-stake + published) and returns `pending_approval`.

**Key logic:**

```typescript
// Source: [ASSUMED]
// src/lib/ai-fields/approval.ts

import { createAdminClient } from '@/lib/supabase/admin'
import type { FieldDescriptor, FieldContext, WriteResult } from './registry'

export async function gateWrite(
  descriptor: FieldDescriptor,
  context: FieldContext,
  newValue: unknown,
  currentValue: unknown,
): Promise<WriteResult> {
  const isHighStake = isHighStakeContext(descriptor, context)

  if (!isHighStake) {
    // Auto-apply: call the write fn directly
    return descriptor.write!(context, newValue)
  }

  // High-stake: create pending proposal — NEVER call write() directly
  const admin = createAdminClient()
  const { data, error } = await admin.from('ai_field_proposals').insert({
    organisation_id: context.organisationId,
    field_id: descriptor.id,
    field_label: descriptor.label,
    context: context as unknown as Record<string, string>,
    current_value: currentValue,
    proposed_value: newValue,
    status: 'pending',
  }).select('id').single()

  if (error || !data) throw new Error('Failed to create proposal')
  return { outcome: 'pending_approval', proposalId: data.id }
}

function isHighStakeContext(descriptor: FieldDescriptor, context: FieldContext): boolean {
  if (descriptor.stakeLevel === 'high') return true
  // Published-SOP content is always high-stake regardless of field stakeLevel
  // (D-02: "anything on a published SOP")
  // This check requires a DB lookup or a context flag passed from the API route
  // — the API route reads sop.status before calling gateWrite and passes it as context
  return context.sopIsPublished === true
}
```

**IMPORTANT (from CLAUDE.md learning 2026-06-15):** The `ai_field_proposals` table must have NO authenticated INSERT policy. The `gateWrite` function must use `createAdminClient()` (service-role) for the insert, and must self-enforce org-scoping (verify the field's target resource belongs to `context.organisationId` before inserting). [CITED: CLAUDE.md § Learnings — 2026-06-15 RLS junction table pattern]

---

### Pattern 3: clone-to-draft Supersede (D-05)

**What:** `cloneSopAsDraft(publishedSopId)` in `versioning.ts` — creates a new `draft` SOP record by deep-copying sections, steps, and block junctions from the published SOP. The new draft gets `parent_sop_id` = lineage root, `version` = max + 1. Publishing the draft calls the existing publish action which sets `superseded_by` on the prior published version.

**Integration points:**
- Versions page (`/admin/sops/[sopId]/versions/page.tsx`) gets a new "Edit into new version" button alongside the existing "Upload New Version" button.
- After clone, redirect to `/admin/sops/builder/{newDraftId}` — the builder already handles draft SOPs.

**Deep-copy scope:** `sop_sections` → `sop_steps` → `sop_section_blocks` junction (blocks themselves are not copied — they are shared library items referenced by FK). `sop_images` associated with sections/steps should be copied by reference (storage path shared; immutable once published). [VERIFIED: codebase read — `sop_section_blocks` is the junction, blocks are library items]

**Idempotency hazard:** The clone is NOT atomic if done row-by-row. Use a DB function or wrap in a try/catch that deletes the partial draft on failure. Simplest: create the draft SOP row first, then copy sections and steps; if any section copy fails, delete the draft SOP row (cascade deletes sections/steps). [ASSUMED]

---

### Pattern 4: D-11 Roster Name-Select Login (Highest Risk)

This is the most architecturally impactful decision in Phase 23. Full analysis follows in the D-11 deep-dive section.

**Recommended approach: Per-org kiosk account.**

```
Auth model:
  One Supabase auth.users row per org: kiosk+{org_id}@internal
  One organisation_members row: role = 'worker'
  Shared device holds a long-lived Supabase session for the kiosk account
  
Sign-in flow:
  Worker opens /login/kiosk?org={org_code}
  Page loads roster: SELECT id, display_name FROM organisation_members WHERE organisation_id = {org_id}
  Worker taps their name → roster_worker_id stored in component state (NOT in Supabase session)
  
Completion flow:
  submitCompletion receives both kiosk session (for RLS/org-scoping) AND roster_worker_id (for attribution)
  sop_completions.worker_id = kiosk account uid (satisfies RLS INSERT check)
  sop_completions.roster_worker_id = selected worker uuid (attribution FK)
  
Supervisor counter-sign:
  Same kiosk device: supervisor picks from roster → stored as roster_supervisor_id on sop_completion_signatures
```

**Anti-pattern (do not use):** Anon session + JWT claims injection. Supabase anon sessions do not support custom JWT claims via `custom_access_token_hook` — the hook only fires on `auth.users` sign-in events, not anon. Org-scoped RLS helpers (`current_organisation_id()`) read from JWT claims, so anon sessions would get null org and fail all RLS policies. [VERIFIED: codebase read — `custom_access_token_hook` reads `organisation_members` by `user_id`; anon has no user_id]

---

### Anti-Patterns to Avoid

- **Do not bypass existing server actions in the AI write path.** The write `fn` in each descriptor must call the existing Zod-validated server action, not write directly to Supabase. Bypassing the server action is how field-specific business rules (publish gates, org-scoping) get silently skipped. [CITED: CLAUDE.md § Learnings — 2026-06-15 junction table RLS]
- **Do not make the field registry a React context.** Server actions and API routes need to resolve field descriptors without a React tree. A module-level Map is the correct primitive. [ASSUMED]
- **Do not register fields with closures that capture mutable state.** `read()` and `write()` must be pure functions of their `context` argument. [ASSUMED]
- **Do not mutate history in the restore flow (D-06).** Never UPDATE `sops.superseded_by` on an old row to point backward. Restore = create new draft = publish = old published becomes superseded. The append-only audit invariant (State.md) is never violated. [VERIFIED: codebase read — completion records are explicitly append-only by design]
- **Do not create the diff page as a full-page RSC fetch on every block change.** Diff is computed client-side from two already-fetched SOP payloads using `diffBlockContent()` — one network fetch for each SOP, then pure client computation. [VERIFIED: codebase read — `diff-block-content.ts` is pure, no DB calls]
- **Do not put roster_worker_id on sop_completions.worker_id.** `worker_id` is a FK to `auth.users` used by RLS (`worker_id = auth.uid()`). The kiosk account's uid must stay in `worker_id`; roster attribution goes in a new `roster_worker_id` column. [VERIFIED: codebase read — migration 00010 RLS policy `workers_see_own_completions` uses `worker_id = auth.uid()`]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Block-level content diff | Custom diff algo | `diff-block-content.ts` (existing) | Already ships, unit-tested, covers all 17 block kinds |
| Version history lineage query | Custom recursive CTE | Existing `getVersionHistory()` + `parent_sop_id` FK chain | Pattern already established in `versioning.ts` |
| Approval proposal persistence | In-memory queue | `ai_field_proposals` DB table | Survives page reload, enables audit trail, consistent with project append-only posture |
| Kiosk auth session | Custom JWT/token system | Supabase account per org (kiosk account) | RLS continues to work unchanged; no new auth middleware needed |
| Supervisor counter-sign UX | New page | Extend existing `/activity/[completionId]` | `SupervisorActivityView` + `signOffCompletion` already exists |

**Key insight:** The entire phase extends existing patterns rather than introducing new ones. The field registry is a new module, but its shape mirrors the existing `src/lib/validators/` + `src/actions/` dual-layer pattern. The kiosk approach is a data-model addition, not an auth framework change.

---

## D-11 Deep-Dive: Roster Name-Select Auth / RLS Analysis

### The Collision

Current auth model (verified in codebase):
- Every worker is an individually-authenticated `auth.users` row.
- `custom_access_token_hook` injects `organisation_id` and `user_role` into the JWT on sign-in.
- All RLS helper functions read from JWT: `current_organisation_id()`, `current_user_role()`.
- `sop_completions.worker_id` FK → `auth.users(id)`, RLS INSERT policy checks `worker_id = auth.uid()`.
- `organisation_members` has `unique(user_id)` — one org per user (migration 00001).

D-11 says: workers should NOT need individual Supabase accounts. They select their name from a roster. This breaks the `worker_id = auth.uid()` pattern.

### Three Options Evaluated

#### Option A: Per-org Kiosk Account (RECOMMENDED)

**Mechanism:** Create one `auth.users` row per org (email: `kiosk+{org_id}@internal`, password: org-generated long random string stored by admin). One `organisation_members` row for this kiosk account with `role='worker'`. Shared devices are signed into the kiosk account once (admin does this setup). The kiosk session is long-lived (Supabase refresh tokens auto-renew).

**Roster pick:** The worker's name selection is captured as `roster_worker_id` (FK to `auth.users`) on `sop_completions`. The kiosk account's UID goes in `sop_completions.worker_id` (satisfies existing RLS INSERT policy). `roster_worker_id` is the human-attribution column.

**RLS impact:** Zero — all existing policies continue to work. `current_organisation_id()` returns the kiosk account's org (set by hook on sign-in). `worker_id = auth.uid()` is satisfied by the kiosk UID. The new `roster_worker_id` column has no RLS dependency.

**Security posture:** A kiosk device can complete any SOP visible to workers in its org, regardless of which name the worker picks (since all roster picks share the same kiosk session). The individual identity attribution is the roster pick — self-reported, not cryptographically proven. This is explicitly the accepted tradeoff (D-11: "floor-usability-over-cryptographic-strength").

**Threat model acceptable risk:**
- A worker can falsely pick another name on completion → roster attribution is wrong but the completion is still org-scoped and audit-visible. Mitigated by: supervisor counter-sign (D-10) which adds a second name-select for the supervisor.
- A shared device's kiosk session is stolen → attacker can read org SOPs and create completions attributed to anyone. Mitigated by: the kiosk account cannot promote itself to admin (role is permanently 'worker'); it cannot read other orgs' data (RLS org-scope). The attack surface is the same as a logged-in worker leaving their device unlocked.

**Schema additions needed:**
```sql
-- sop_completions
ALTER TABLE public.sop_completions
  ADD COLUMN IF NOT EXISTS roster_worker_id uuid REFERENCES auth.users(id);

-- New sign-off signatures table (AFL-VER-05)
CREATE TABLE public.sop_completion_signatures (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  completion_id    uuid NOT NULL REFERENCES public.sop_completions(id),
  role             text NOT NULL CHECK (role IN ('worker', 'supervisor')),
  roster_user_id   uuid NOT NULL REFERENCES auth.users(id),
  signed_at        timestamptz NOT NULL DEFAULT now()
);
-- Append-only: no UPDATE/DELETE policy
-- INSERT via admin client in server action (same pattern as completion_sign_offs)
```

**Kiosk login route:** `/login/kiosk` — a separate route that bypasses the regular email/password form. The admin sets up the kiosk session (signs in with kiosk credentials once). Workers then see the roster. Route must NOT be accessible to already-authed non-kiosk accounts (check JWT `user_role` and redirect if admin/safety_manager).

**Implementation steps:**
1. Migration 00038: `roster_worker_id` on `sop_completions`, new `sop_completion_signatures` table, new `ai_field_proposals` table.
2. Server-side kiosk account creation: a one-time admin action (can be a script or admin panel button) that creates the kiosk `auth.users` row and `organisation_members` row via `createAdminClient()`.
3. `/login/kiosk` page: fetches org roster, worker picks name, stores `roster_worker_id` in component state / `sessionStorage` for the duration of the walkthrough session.
4. `submitCompletion` extended: accepts `rosterWorkerId` in payload, validates it belongs to same org, writes to `sop_completions.roster_worker_id`.
5. `sop_completion_signatures`: new server action `recordSignature(completionId, role, rosterUserId)` using admin client.

#### Option B: Anon Session + org claim (NOT RECOMMENDED)

An anon Supabase session cannot carry `organisation_id` in the JWT because the `custom_access_token_hook` only fires for authenticated users. Every RLS helper call returns null. All data reads and writes fail RLS. Would require rewriting all RLS policies to support anon sessions with a cookie-based org claim — a massive, risky change. [VERIFIED: codebase read — `custom_access_token_hook` is the only org-claim injection point and is gated on `user_id` from `organisation_members`]

#### Option C: Shared individual accounts (NOT RECOMMENDED)

Give each org-roster-worker an individual Supabase account but auto-sign in when they pick their name. Requires storing all worker passwords server-side (security regression) or using magic links (which require email, defeating the UX goal). Not viable.

### Recommended Option: A (Per-org Kiosk Account)

- Zero RLS changes
- Zero middleware changes
- Additive schema (one column + one table)
- Kiosk session setup is a one-time admin action per org
- Self-reported roster attribution is consistent with D-11's stated tradeoff

---

## Runtime State Inventory

> This is an extension phase, not a rename/refactor. No runtime state rename is involved.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `sop_completions` existing rows: `roster_worker_id` will be NULL for all historical completions | Schema: `ADD COLUMN IF NOT EXISTS … DEFAULT NULL` — backward-compat, no migration of existing rows needed |
| Live service config | None — no external services configured for AI field layer | None |
| OS-registered state | None | None |
| Secrets/env vars | No new env vars required (existing Supabase service role key covers kiosk account creation) | None |
| Build artifacts | None | None |

---

## Common Pitfalls

### Pitfall 1: RLS Recursion via Cross-Table Checks in the Approval Policy

**What goes wrong:** The `ai_field_proposals` table's SELECT policy is tempted to join back to `sops` to check org membership. This triggers the 00030/00031 recursion pattern (42P17) if `sops` itself has a policy that queries `ai_field_proposals`.

**Why it happens:** Phase 25 established the recursion-avoidance pattern: junction tables use `using(true)` for SELECT, the real gate stays on the parent. The AI proposals table is not a junction but is org-scoped.

**How to avoid:** Use `organisation_id = current_organisation_id()` directly on `ai_field_proposals` SELECT policy (same as `departments` table in 00035). Do NOT reference `sops` from the proposals policy. [CITED: CLAUDE.md § Learnings — 2026-05-13 RLS recursion pattern; migration 00031]

**Warning signs:** `42P17 infinite recursion detected in policy` errors after adding the migration.

---

### Pitfall 2: `cloneSopAsDraft` Section Copy Leaves Orphan Sections on Failure

**What goes wrong:** Copying sections one-by-one in a loop fails midway, leaving a partial draft SOP with some sections copied and some missing. The admin sees a malformed draft.

**Why it happens:** No transaction wrapping in server actions (Next.js server actions don't have a native transaction primitive; Supabase JS client doesn't expose PG transactions via the REST API).

**How to avoid:** Create the new SOP record first (status = 'uploading' as a sentinel, not 'draft'). Copy all sections/steps in a single batch INSERT if possible (using `supabase.from('sop_sections').insert([...rows])`). Only flip status to 'draft' after all inserts succeed. If any insert fails, delete the partial SOP row (cascade deletes sections). This gives a near-atomic experience without a DB transaction. [ASSUMED]

**Warning signs:** Drafts visible in the admin SOP list with section counts of 0, or with partially-copied content.

---

### Pitfall 3: Field Registry Populated at Module Load — Server Components Re-Run on Every Request

**What goes wrong:** Server components (page.tsx) import field registration side-effect files. In Next.js App Router each request re-runs the server component module. If `registerField()` is called from a server component import chain, the registry is populated fresh per request — this is actually fine for a module-level Map in Node.js, since the module is cached by Node's module system across requests in the same process.

**Why it matters:** The idempotent re-registration guard (`if (registry.has(id)) return`) handles HMR reloads without duplicates. But the registry MUST be imported (directly or transitively) by the API routes that serve read/write requests. The planner must ensure `src/lib/ai-fields/registry.ts` imports (which trigger registrations) happen in the API route module, not only in admin page components. [ASSUMED]

**How to avoid:** Import all field registrations from a single barrel `src/lib/ai-fields/registrations/index.ts` that is imported by both the API routes and the admin components. [ASSUMED]

---

### Pitfall 4: `roster_worker_id` Write — Must Validate FK Belongs to Same Org

**What goes wrong:** A malicious client sends a `rosterWorkerId` UUID belonging to a user in a different org. The `submitCompletion` server action writes it to `sop_completions.roster_worker_id` without checking org membership. This is a cross-tenant attribution attack.

**Why it happens:** The CLAUDE.md learning (2026-06-15) states: "service-role bypasses RLS, so the action must then enforce org-scoping ITSELF." `submitCompletion` uses the admin client for the insert.

**How to avoid:** Before writing `roster_worker_id`, verify: `SELECT 1 FROM organisation_members WHERE user_id = roster_worker_id AND organisation_id = current_organisation_id`. If not found, return an error. This check should use the session client (RLS-respected) so the org claim comes from the kiosk JWT. [CITED: CLAUDE.md § Learnings — 2026-06-15 junction-table write security]

---

### Pitfall 5: Diff Page Fetches Both SOPs With `createClient()` — Worker Cannot See Old Superseded Versions

**What goes wrong:** The diff page fetches `sop_a` and `sop_b` using the session client. Superseded SOPs have `status='published'` but `superseded_by IS NOT NULL`. If an RLS policy restricts workers to only see the current version, old versions are invisible to the session client.

**Why it happens:** The diff page is an admin-only route, but the session client respects RLS which may not include superseded SOPs.

**How to avoid:** The versions diff page is admin-only (`/admin/sops/...`). Use `createAdminClient()` for fetching both SOP versions on the server component, consistent with the existing pattern for presigned URLs in admin routes. [VERIFIED: codebase read — `admin/sop/[sopId]/review` uses admin client; CLAUDE.md note on `getPhotoUploadUrl`]

---

### Pitfall 6: `sop_completion_signatures` INSERT Needs Service-Role Client

**What goes wrong:** The `recordSignature` server action writes to `sop_completion_signatures` with the session client. The table has no authenticated INSERT policy (writes via admin server actions only — same pattern as junction tables). The insert fails with `42501 new row violates row-level security`.

**Why it happens:** Established pattern: tables with "writes via admin server actions only" need `createAdminClient()` for the write + manual org-scoping in the action. [CITED: CLAUDE.md § Learnings — 2026-06-15 junction-table RLS]

**How to avoid:** Always use `createAdminClient()` in `recordSignature`. Verify `organisation_id` matches the kiosk session's org before inserting.

---

### Pitfall 7: Published-SOP Clone Re-Copies to Supabase Storage (Don't)

**What goes wrong:** `cloneSopAsDraft` tries to copy images/media from the original SOP's storage bucket into new paths for the draft. This is slow, expensive, and unnecessary.

**Why it happens:** Over-engineering the "draft is independent" mental model.

**How to avoid:** `sop_images` records are copied by reference (the new `sop_sections` rows point to the same `sop_images` rows via FK, or the `storage_path` string is copied verbatim). Images are immutable once published. The draft can reference the same storage paths — they are read-only assets. [ASSUMED — consistent with project's append-only posture]

---

## Code Examples

### Verified Existing Patterns Referenced in This Phase

**Version lineage query (from `getVersionHistory` in `versioning.ts`):**
```typescript
// Source: src/actions/versioning.ts (read 2026-06-25)
const { data: versions } = await supabase
  .from('sops')
  .select('id, version, status, uploaded_by, created_at, superseded_by, title, source_file_name, parent_sop_id')
  .or(`parent_sop_id.eq.${parentId},id.eq.${parentId}`)
  .order('version', { ascending: false })
```

**Block content diff (from `diff-block-content.ts`):**
```typescript
// Source: src/lib/builder/diff-block-content.ts (read 2026-06-25)
// diffBlockContent(oldContent: BlockContent, newContent: BlockContent): BlockContentDiff
// Returns: { changed: boolean, kindChanged: boolean, fields: BlockContentDiffField[] }
// Each field: { key: string, oldValue: string, newValue: string }
// Covers all 17 block kinds including Phase 21 parser-emitted types
```

**Admin client for service-role writes (from `completions.ts`):**
```typescript
// Source: src/actions/completions.ts (read 2026-06-25)
const admin = createAdminClient()
const { error } = await admin.from('sop_completions').insert({
  id: localId,
  organisation_id: organisationId,
  // ...
  worker_id: user.id,   // ← kiosk account uid for D-11
  // roster_worker_id: rosterWorkerId  ← new column
})
```

**JWT claim extraction pattern (from `completions.ts` + `versioning.ts`):**
```typescript
// Source: src/actions/completions.ts (read 2026-06-25)
const { data: { session } } = await supabase.auth.getSession()
const jwtClaims = session?.access_token
  ? JSON.parse(atob(session.access_token.split('.')[1]))
  : {}
const organisationId: string | null = jwtClaims['organisation_id'] ?? null
```

**Completion sign-off second-immutable-record pattern (from `completions.ts`):**
```typescript
// Source: src/actions/completions.ts (read 2026-06-25)
// completion_sign_offs is a second table, never mutates sop_completions content
// D-17: second immutable record pattern — referenced in STATE.md
// sop_completion_signatures follows the same append-only pattern
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-feature AI write (bespoke per page) | Unified field registry with `FieldDescriptor` | This phase (greenfield) | Agent can drive any field without new code per-feature |
| Version supersede = upload new doc | Clone-to-draft in builder | D-05 this phase | Admin can iterate in the builder, not just re-upload |
| Worker logs in with email/password | Roster name-select (kiosk account) | D-11 this phase | Floor-usability on shared devices; tradeoff explicitly accepted |
| Sign-off = supervisor approval of completion | Sign-off = worker self-sign + supervisor counter-sign | D-09/D-10 this phase | Completing the SOP IS the legal signature (AFL-VER-05) |

**Deprecated/outdated approaches this phase deprecates:**
- The upload-only version flow (`Upload New Version` button) is supplemented (not removed) by clone-to-draft. Both coexist on the versions page.
- Individual worker Supabase accounts for shared devices → kiosk account model. Individually-authenticated workers remain supported; kiosk is additive.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `registerField()` idempotency (re-registration on HMR is a no-op) is safe because Node.js module cache persists the Map across requests | Pattern 1: Field Registry | Minor — worst case is duplicate descriptor; the guard prevents it |
| A2 | `cloneSopAsDraft` can use batch INSERT for sections + steps (Supabase JS `insert([...rows])`) and this is fast enough for SOPs with up to ~200 steps | Pattern 3: clone-to-draft | Performance issue if SOPs are very large; could add a DB function instead |
| A3 | `sop_images` can be referenced by FK from copied sections without duplicating storage objects | Pitfall 7 | If `sop_images` has ON DELETE CASCADE from `sop_sections`, copying sections and pointing to same images creates FK conflicts — need to copy `sop_images` rows with new `sop_section_id` but same `storage_path` |
| A4 | Field registration barrel (`src/lib/ai-fields/registrations/index.ts`) imported by API routes is sufficient to populate the registry before each API request | Pattern 1: Field Registry | If Next.js Route Handler isolates module scope from page module scope in a way that empties the Map, registrations may not persist — test with a health-check endpoint |
| A5 | Kiosk account creation (one per org) can be a manual admin action (script or button) rather than automatic | D-11 Architecture | If automatic creation is needed, requires a trigger or post-org-creation hook |
| A6 | `isHighStakeContext` can rely on a `sopIsPublished` flag passed from the API route (avoids a DB lookup inside `gateWrite`) | Pattern 2: Tiered Approval Gate | If the flag is not reliably passed, a stale `false` could auto-apply a high-stake write — default to `true` (require approval) on ambiguity |

---

## Open Questions

1. **Who creates the kiosk account per org?**
   - What we know: kiosk account requires creating an `auth.users` row + `organisation_members` row via service-role; the `createAdminClient()` pattern already exists.
   - What's unclear: is kiosk account creation a one-off manual action (admin runs a script) or does it happen automatically when an org is provisioned?
   - Recommendation: Ship as a manual admin script for Phase 23. Auto-provisioning can be added in a later phase or via a Supabase Edge Function trigger.

2. **Does `roster_worker_id` need an index?**
   - What we know: `sop_completions` has indexes on `(organisation_id, worker_id)`, `(organisation_id, sop_id)`, `(organisation_id, status)`.
   - What's unclear: Will reports need to query `WHERE roster_worker_id = X`? (Activity view currently filters by `worker_id = auth.uid()`.)
   - Recommendation: Add `idx_completions_roster_worker ON sop_completions(roster_worker_id)` in the migration. Cheap and future-proof.

3. **AI field proposals: what's the read-back mechanism for inline Accept/Reject UI?**
   - What we know: Proposals are written to DB on AI write; Accept/Reject server actions will apply or discard them.
   - What's unclear: How does the admin field component know there is a pending proposal? Options: (a) server component fetches proposals at page load; (b) Supabase Realtime subscription; (c) polling.
   - Recommendation: Server component fetches pending proposals at page load (simplest; consistent with App Router pattern). No Realtime needed — a page refresh or `router.refresh()` after AI write is sufficient for the backbone phase.

---

## Environment Availability

> No new external dependencies beyond existing Supabase and Node.js.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase service role key | Kiosk account creation, ai_field_proposals writes | ✓ | existing | — |
| `diff-block-content.ts` | AFL-VER-02 diff | ✓ | existing | — |
| Supabase Auth (email/password sign-in for kiosk) | D-11 kiosk session setup | ✓ | existing | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (existing) |
| Config file | `playwright.config.ts` (existing) |
| Quick run command | `npx playwright test --project=phase23-stubs` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AFL-AI-01 | `getField('sop.title').read(ctx)` returns a value | source-contract | `npx playwright test --project=phase23-stubs -g "AFL-AI-01"` | ❌ Wave 0 |
| AFL-AI-02 | `gateWrite()` returns `pending_approval` for high-stake published SOP field | source-contract | `npx playwright test --project=phase23-stubs -g "AFL-AI-02"` | ❌ Wave 0 |
| AFL-AI-02 | `gateWrite()` returns `applied` for low-stake draft field | source-contract | `npx playwright test --project=phase23-stubs -g "AFL-AI-02-auto"` | ❌ Wave 0 |
| AFL-AI-03 | `registerField` + `getField` round-trip | unit | `npx playwright test --project=phase23-unit -g "registry"` | ❌ Wave 0 |
| AFL-VER-01 | `cloneSopAsDraft` action exported from `versioning.ts` | source-contract | `npx playwright test --project=phase23-stubs -g "AFL-VER-01"` | ❌ Wave 0 |
| AFL-VER-02 | Diff page exists + imports `diffBlockContent` | source-contract | `npx playwright test --project=phase23-stubs -g "AFL-VER-02"` | ❌ Wave 0 |
| AFL-VER-03 | `restoreVersionAsNew` action exported from `versioning.ts` | source-contract | `npx playwright test --project=phase23-stubs -g "AFL-VER-03"` | ❌ Wave 0 |
| AFL-VER-04 | SOP card has `data-updated-badge` when new version > last completion | source-contract | `npx playwright test --project=phase23-stubs -g "AFL-VER-04"` | ❌ Wave 0 |
| AFL-VER-05 | `sop_completions.roster_worker_id` column exists in schema | source-contract (migration) | `npx playwright test --project=phase23-stubs -g "AFL-VER-05"` | ❌ Wave 0 |
| D-11 | `/login/kiosk` route exists + renders roster | source-contract | `npx playwright test --project=phase23-stubs -g "D-11"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx playwright test --project=phase23-stubs --project=phase23-unit`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/phase23/` directory — new
- [ ] `tests/phase23/ai-field-registry.spec.ts` — AFL-AI-01/02/03 source-contract + unit
- [ ] `tests/phase23/version-supersede.spec.ts` — AFL-VER-01/02/03 source-contract
- [ ] `tests/phase23/version-indicator.spec.ts` — AFL-VER-04 source-contract
- [ ] `tests/phase23/completion-roster.spec.ts` — AFL-VER-05 + D-11 source-contract
- [ ] `src/lib/ai-fields/__tests__/registry.test.ts` — AFL-AI-03 unit (pure module, no DB)
- [ ] `playwright.config.ts` additions:
  ```typescript
  { name: 'phase23-stubs', testDir: '.', testMatch: /tests\/phase23\/.*\.(spec|test)\.ts$/ },
  { name: 'phase23-unit', testDir: './src/lib/ai-fields/__tests__', testMatch: /.*\.test\.ts$/ },
  ```
- [ ] CRITICAL: verify registration with `npx playwright test --list --project=phase23-stubs | grep phase23` before Wave 1 (CLAUDE.md 2026-05-25 unregistered-spec learning)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (D-11 kiosk account) | Supabase Auth email/password for kiosk setup; roster pick is not an auth event |
| V3 Session Management | Yes (kiosk long-lived session) | Supabase refresh token auto-renewal; kiosk session scoped to device |
| V4 Access Control | Yes (AI write gate D-02; kiosk account org-scope) | Tiered approval gate in `approval.ts`; kiosk account is role='worker' — cannot escalate |
| V5 Input Validation | Yes (AI write payload; roster_worker_id) | Zod schema on `AiWriteRequest`; org-membership check before writing `roster_worker_id` |
| V6 Cryptography | No | No new crypto operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Roster ID spoofing (client sends arbitrary UUID as roster_worker_id) | Tampering | Server-side org-membership check before writing `roster_worker_id` (Pitfall 4) |
| AI write bypasses approval gate | Tampering | `gateWrite()` is the single write path; `FieldDescriptor.write()` is never called directly by API routes |
| High-stake write auto-applied due to wrong `sopIsPublished` flag | Tampering | Default to `true` (require approval) on ambiguity (A6 mitigation) |
| Kiosk account privilege escalation to admin | Elevation of Privilege | Kiosk `organisation_members.role = 'worker'`; `requireAdmin()` guard in all admin server actions checks JWT `user_role` |
| Cross-org data read via kiosk session | Information Disclosure | `current_organisation_id()` reads from kiosk account's JWT claim (set by `custom_access_token_hook`) — org-scoped correctly |
| Stale AI proposal applied after SOP is re-published at higher version | Tampering | `ai_field_proposals` should store `sop_version` at proposal time; Accept action validates version still matches current — planner detail |

---

## Sources

### Primary (HIGH confidence)

- `src/actions/versioning.ts` — version model, `uploadNewVersion`, `getVersionHistory`, `notifyAssignedWorkers` (read 2026-06-25)
- `src/lib/builder/diff-block-content.ts` — block diff utility, all 17 block kind coverage (read 2026-06-25)
- `src/actions/completions.ts` — completion append-only pattern, `submitCompletion`, `signOffCompletion`, admin-client write pattern (read 2026-06-25)
- `src/lib/validators/completions.ts` — Zod schemas for completions, `SubmitCompletionSchema`, `SignOffSchema` (read 2026-06-25)
- `src/stores/completionStore.ts` — Zustand completion store, LocalCompletion shape (read 2026-06-25)
- `supabase/migrations/00001_foundation_schema.sql` — `custom_access_token_hook`, `current_organisation_id()`, `organisation_members unique(user_id)` (read 2026-06-25)
- `supabase/migrations/00010_completion_schema.sql` — append-only RLS, `worker_id = auth.uid()` INSERT policy (read 2026-06-25)
- `supabase/migrations/00030_sub_trades.sql` — SECURITY DEFINER helper pattern, junction RLS pattern (read 2026-06-25)
- `supabase/migrations/00031_fix_sops_sub_trades_rls_recursion.sql` — recursion-avoidance pattern `using(true)` (read 2026-06-25)
- `supabase/migrations/00035_departments_schema.sql` — org-scoped table with admin-only writes, `current_user_department_ids()` SECURITY DEFINER pattern (read 2026-06-25)
- `src/lib/supabase/middleware.ts` — middleware auth check pattern (read 2026-06-25)
- `src/app/(protected)/layout.tsx` — protected layout auth resolution pattern (read 2026-06-25)
- `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` — versions UI existing state (read 2026-06-25)
- `playwright.config.ts` — test project registration pattern (read 2026-06-25)
- `CLAUDE.md` — Learnings log: 2026-06-15 junction-table RLS, 2026-06-15 PostgREST schema cache, 2026-05-13 RLS recursion, 2026-05-08 SQL function rename, 2026-06-05 source-contract vs wiring (read 2026-06-25)

### Secondary (MEDIUM confidence)

- `.planning/phases/23-ai-field-layer-version-supersede/23-CONTEXT.md` — all D-01..D-11 decisions (read 2026-06-25)
- `.planning/REQUIREMENTS.md` §Phase 23 — AFL-AI-01/02/03, AFL-VER-01..05 (read 2026-06-25)
- `.planning/STATE.md` — append-only posture, project decisions log (read 2026-06-25)

### Tertiary (LOW confidence)

- Field registry shape (Pattern 1) — [ASSUMED] design by Claude; no prior art in codebase
- `cloneSopAsDraft` batch INSERT idempotency approach (A2) — [ASSUMED]
- API route module scope / registry persistence in Next.js App Router (A4) — [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all required capabilities exist in codebase; no new npm packages
- D-11 architecture (kiosk account): MEDIUM — mechanism is clear from codebase analysis; specific kiosk creation flow and long-lived session management details are [ASSUMED] but consistent with Supabase's documented capabilities
- Field registry shape: MEDIUM — pattern is sound (module-level Map); exact FieldContext shape and API route design are [ASSUMED]
- Pitfalls: HIGH — all 7 pitfalls are derived from verified codebase patterns and CLAUDE.md Learnings

**Research date:** 2026-06-25
**Valid until:** 2026-07-25 (stable stack; no fast-moving dependencies)
