# Phase 46: Capability Matrix - Research

**Researched:** 2026-08-25
**Domain:** Authorization model documentation (CAP-01) + server-side enforcement extension (CAP-02) in an existing Next.js/Supabase RLS codebase
**Confidence:** MEDIUM-HIGH — the enforcement mechanism is HIGH confidence (verified against live migrations/code); the mapping of "sign-off authority" to `owner_user_id` is MEDIUM confidence (strong code evidence, not yet confirmed by Simon)

## Summary

This phase has two deliverables and no new infrastructure. CAP-01 is a documentation task: write one markdown table enumerating every role × every capability in the app, sourced from a direct sweep of the route tree and `src/actions/*`. CAP-02 is a small, surgical code change: today, **every** SOP-content write path (sections, steps, images, layout_data, block junctions) is gated by a single blanket check — `role IN ('admin','safety_manager')` — enforced redundantly at three layers (RLS policies, `requireAdminContext()` in server actions, and ad-hoc `getSessionContext()` role checks). There is currently **no code path** that lets a non-admin SOP owner edit their own SOP, even though `setSopOwner` (Phase 28) lets an admin assign ANY org member — including a plain `worker` or `supervisor` — as a SOP's `owner_user_id`. CAP-02 closes that gap by adding one new composite guard (`requireSopEditAccess(sopId)`) that authorizes when the caller is admin/safety_manager (unchanged) **or** is the SOP's `owner_user_id` (new), and extending the three content-table RLS policies (`admins_can_manage_sections`, `admins_can_manage_steps`, `admins_can_manage_images`) with the same OR-condition as defense-in-depth. Publish, delete-SOP, version-supersede, and owner-reassignment stay admin/safety_manager-only — CAP-02's rule is scoped to "edit," matching the CONTEXT's own capability list which lists "edit SOP blocks" as distinct from "publish."

**Primary recommendation:** Pin "sign-off authority" = `sops.owner_user_id` (Phase 28 OWN-* single accountable owner). Add `requireSopEditAccess(sopId)` to `src/lib/auth/guards.ts`, swap it in at the 6-8 content-write call sites identified below, and extend 3 RLS policies with one owner-OR-condition each (never a sibling policy — CLAUDE.md 2026-08-04 OR-combination trap). Write the matrix as `.planning/codebase/CAPABILITY-MATRIX.md`, referenced from CLAUDE.md.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Capability matrix document (CAP-01) | Docs (`.planning/codebase/`) | — | No runtime component; a reference doc consumed by future planners/reviewers |
| Sign-off → edit rights (CAP-02) | API/Backend (server actions) | Database (RLS) | Server actions are the primary gate (fail fast, good error messages); RLS is the backstop per the codebase's established defence-in-depth posture (every prior phase: service-role writes self-enforce + RLS backstops) |
| Owner resolution (`sops.owner_user_id` lookup) | Database (RLS) + API (guard) | — | `owner_user_id` already exists (Phase 28); no schema change needed, just a new predicate on existing columns |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Users with sign-off authority on a SOP also have edit permissions on that SOP — this is the CAP-02 rule, verbatim from the meeting
- Keep the application as simple as possible — no new permission machinery beyond what the rule requires; prefer extending existing guards over new frameworks
- Separate SOPs for operators vs engineers; SOPs assigned at team level with role-based visibility (context for the matrix's rows, shipping in 44a/44b — do NOT build role-ladder logic in this phase)
- Obligation ≠ access (D1): the matrix document must distinguish the *visibility* channel from the *obligation* channel per capability — do not describe them as one thing
- Edit history read-only to everyone with SOP access (D5) and feedback moderation rules (D4) are settled — the matrix documents them as planned capabilities (Phases 47/48) marked as such, distinct from shipped ones

### Claude's Discretion
- Where the matrix document lives and its exact format (a markdown table in-repo; location + granularity are the planner's call — it must be referenced from CLAUDE.md or .planning docs as the authority)
- What "sign-off authority" concretely maps to in the current schema (approval chains from Phase 29, `sops` ownership from Phase 28, supervisor/safety_manager roles) — RESEARCH must pin this before the enforcement point is chosen
- Where the CAP-02 guard lives (server action guard vs RLS policy vs both) — follow the codebase's established pattern: server actions self-enforce org-scope; service-role writes re-check; RLS is the backstop

### Deferred Ideas (OUT OF SCOPE)
- Role-ladder visibility (Phase 44b), obligation record (44a), view-as (45), edit log (47), feedback (48) — the matrix documents them as planned; no implementation here
- Any UI for viewing the matrix in-app — the deliverable is a document + enforcement, not a screen

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAP-01 | One written role × capability matrix exists as the single reference for who can see/do what | § Capability Inventory Sweep + § Role Inventory below give the exact rows/columns; § Code Examples gives the doc's required structure (channel distinction per D1) |
| CAP-02 | Sign-off authority on a SOP carries edit permission on that SOP | § Sign-off Authority: Schema Mapping pins the definition; § SOP Edit Path Inventory enumerates every call site to change; § Enforcement Point Design gives the guard + RLS diff; § Common Pitfalls flags the OR-policy and WITH CHECK traps that have bitten this exact table twice already |
</phase_requirements>

## Sign-off Authority: Schema Mapping

Three candidates exist in the schema. Only one fits "sign-off authority on **a SOP**" as a singular, per-SOP concept that CAP-02 (and the future FBK-02 "email the manager with sign-off authority") can address directly:

| Candidate | Table/column | Shape | Fits CAP-02? |
|---|---|---|---|
| **SOP ownership (Phase 28)** | `sops.owner_user_id` | Exactly one person per SOP, backfilled, reassignable by admin in ≤2 clicks (`setSopOwner`) | **Yes — recommended.** [VERIFIED: supabase/migrations/00043_ownership_review_governance.sql, src/actions/governance.ts] Every SOP has exactly one owner (default = uploader, never null after backfill per OWN-01/03). `getOrgMembers()` (src/actions/assignments.ts:153-182) returns members of **any** role, and `OwnerPicker.tsx` lets an admin assign any of them — so a plain `worker` or `supervisor` can already be a SOP's owner today, but currently gets **no** edit capability from it. This is the exact gap CAP-02 describes. |
| **Approval chains (Phase 29)** | `approval_chains.steps` (jsonb, by role or named member), `sop_approvals.approver_user_id` | Per-**category**, 1-4 ordered steps, optional (categories without a chain have none) | No — doesn't cover every SOP (chains are opt-in per category, APR-01), and is multi-person/multi-step, not a singular "the sign-off manager." Approval is a publish-gate concept, not an edit-rights concept. |
| **Completion sign-off (Phase 4/23/37)** | `signOffCompletion()` in `src/actions/completions.ts`, gated to `role IN ('supervisor','safety_manager','admin')` | Per **worker's walkthrough instance**, not per-SOP | No — this is a supervisor approving that *a worker performed the SOP*, unrelated to who may edit the SOP's content. Different noun entirely; do not conflate. |

**Recommendation (MEDIUM confidence — pin at plan-check or note in PLAN.md as an assumption to confirm with Simon):** "sign-off authority on a SOP" = `sops.owner_user_id`. Supporting evidence beyond the schema fit: the v9.0 dev plan (`.planning/v9.0-DEV-PLAN.md`) and FBK-02 both use the phrase "the sign-off manager" in the **singular**, and the dev-plan's own Phase 46 one-liner is "sign-off authority carries edit rights" directly under the Phase 28 ownership model in the codebase's conceptual lineage. `owner_user_id` is also the only candidate that exists on **every** SOP (not just SOPs with a configured approval chain), matching CAP-02's success criterion ("a user with sign-off authority on a SOP can edit **that** SOP" — implies universal applicability, not category-conditional).

**Assumption flagged:** if Simon actually means approval-chain approvers, the enforcement point changes (join through `approval_chains`/`sop_approvals` instead of `sops.owner_user_id`) and the matrix's "who has sign-off authority" column changes shape (multiple people, category-scoped, sometimes empty) instead of the current one-owner-per-SOP shape. Recommend the plan state this assumption explicitly and treat it as a fast, cheap-to-flip decision (single predicate swap) rather than blocking on it.

## SOP Edit Path Inventory

Every server-side path that writes SOP **content** (sections, steps, images, layout_data, block junctions), and its current guard. [VERIFIED: direct reads of each file]

| Path | File | Current guard | Guard type |
|---|---|---|---|
| `createSection` | `src/actions/sections.ts` | **None at the action level** — relies purely on RLS via plain session client | RLS only (`admins_can_manage_sections`) |
| `reorderSections` | `src/actions/sections.ts` | `requireAdminContext()` | App-level, session client (RLS also applies) |
| `updateSectionLayout` (builder autosave) | `src/actions/sections.ts` | `requireAdminContext()` | App-level, session client (RLS also applies) |
| `updateSectionTitle` (AI field write) | `src/actions/sections.ts` | `getSessionContext()` + manual `role in ['admin','safety_manager']` check | App-level, **admin (service-role) client** — bypasses RLS, self-enforces org via explicit `.eq('organisation_id', organisationId)` |
| `PATCH /api/sops/[sopId]/sections/[sectionId]` (legacy Phase 2 review route — content + step text + approval toggle) | `src/app/api/sops/[sopId]/sections/[sectionId]/route.ts` | **No app-level guard at all** — plain session client, RLS is the only gate | RLS only (`admins_can_manage_sections`, `admins_can_manage_steps`) |
| `addBlockToSection`, `removeBlockFromSection`, `setBlockPinMode`, block-junction writes (builder library-block attach/detach) | `src/actions/sop-section-blocks.ts` | `requireAdmin()` → `requireAdminContext()` (except the parser's `serviceRole` bypass, which is a different, non-user-triggered path) | App-level, uses **admin (service-role) client** for the actual write — RLS on `sop_section_blocks` is `using(true)` (00030/00031 recursion-avoidance pattern) and does **not** gate this path; the app-level guard is the *only* enforcement |
| Version clone/restore/supersede (`cloneSopAsDraft`, `restoreVersionAsNew`, `uploadNewVersion`) | `src/actions/versioning.ts` | `getSessionContext()` + manual `role in ['admin','safety_manager']` check, admin client writes | App-level, service-role, self-enforced org-scope |
| Publish gate | `src/app/api/sops/[sopId]/publish/route.ts` via `assertPublishGates()` | admin/safety_manager role check (governance.ts `requireAdmin()`) | App-level |

**RLS policies backing the content tables** [VERIFIED: supabase/migrations/00003_sop_schema.sql:100-164]:
- `admins_can_update_sops` (sops, UPDATE) — `organisation_id = current_organisation_id() AND current_user_role() IN ('admin','safety_manager')`, **no explicit `WITH CHECK`** (falls back to `USING`, per the 2026-08-04 CLAUDE.md finding — this is one of the "safe" tables in that audit)
- `admins_can_manage_sections` (sop_sections, `FOR ALL`) — same predicate, joined through `sops`
- `admins_can_manage_steps` (sop_steps, `FOR ALL`) — same predicate, joined through `sop_sections` → `sops`
- `admins_can_manage_images` (sop_images, `FOR ALL`) — same predicate, joined through `sops`

**Scope decision (recommended, not locked):** CAP-02 should extend only the **content** surface above (sections/steps/images/layout_data/block-junctions) — not `admins_can_update_sops` itself (SOP metadata: category, department, owner reassignment, refresher interval), not delete-SOP, not publish, not version-supersede/clone, not approval-chain actions. This keeps the change to exactly what the locked rule requires ("edit that SOP") and matches CONTEXT's own capability list, which enumerates "edit SOP blocks" as a capability distinct from "publish," "manage departments," "manage team." A non-admin owner gains the ability to edit their SOP's content; they do NOT gain admin powers over unrelated SOPs, org settings, or governance actions. This is the "lazy" (ladder rung 2 — extend the existing guard) reading of the locked decision and should be confirmed at plan-check, not re-litigated from scratch.

## Enforcement Point Design

**New guard** — add to `src/lib/auth/guards.ts` (extends the existing `requireAdminContext()` pattern, does not replace it — other admin-only actions like `setSopOwner`, `setApprovalChain`, department/team management keep using `requireAdminContext()` unchanged):

```typescript
// Source: pattern matches existing requireAdminContext() in the same file
export interface SopEditContext {
  supabase: SessionContext['supabase']
  user: { id: string }
  role: string
  organisationId: string | null
}

/**
 * CAP-02: admin/safety_manager retains universal edit rights (unchanged).
 * A non-admin who is the SOP's owner_user_id also gets edit rights on
 * THIS SOP only. Self-enforces org-scope via an admin-client fetch of the
 * SOP row (never trust a client-supplied sopId's organisation_id — CLAUDE.md
 * 2026-06-15/26 pattern).
 */
export async function requireSopEditAccess(
  sopId: string
): Promise<SopEditContext | { error: string }> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }

  if (role && ['admin', 'safety_manager'].includes(role)) {
    return { supabase, user: { id: userId }, role, organisationId }
  }

  // Not an admin — check SOP ownership. Admin client bypasses RLS but we
  // self-enforce org-scope explicitly (do not trust the fetched row alone).
  const admin = createAdminClient()
  const { data: sop } = await admin
    .from('sops')
    .select('id, owner_user_id, organisation_id')
    .eq('id', sopId)
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (sop?.owner_user_id === userId) {
    return { supabase, user: { id: userId }, role: role ?? 'owner', organisationId }
  }

  return { error: 'Edit access required — you must be an admin, safety manager, or this SOP\'s owner.' }
}
```

**Call sites to swap** (replace `requireAdminContext()` / manual role checks with `requireSopEditAccess(sopId)`, since a `sopId` is always available at these call sites):
- `sections.ts`: `reorderSections`, `updateSectionLayout`, `updateSectionTitle` (and add a guard to `createSection`, which currently has none)
- `src/app/api/sops/[sopId]/sections/[sectionId]/route.ts`: add an explicit guard (currently RLS-only)
- `sop-section-blocks.ts`: all `requireAdmin()` call sites except the `serviceRole` parser-invocation bypass

**RLS extension** (defense-in-depth for the session-client paths; also closes the legacy PATCH route which has no app-level guard). Add the owner condition **inside the existing policy's USING clause**, not as a sibling policy — per the CLAUDE.md 2026-08-04 finding, sibling permissive policies OR together and a narrowing arm without its own org predicate becomes a hole; here the owner check is an OR-widening arm *inside* an already org-scoped USING, which is the safe shape:

```sql
-- Source: pattern extends 00003_sop_schema.sql; drop+recreate since Postgres
-- has no ALTER POLICY ... USING syntax to append a clause.
drop policy if exists "admins_can_manage_sections" on public.sop_sections;
create policy "admins_can_manage_sections" on public.sop_sections
  for all to authenticated
  using (
    exists (
      select 1 from public.sops
      where sops.id = sop_sections.sop_id
        and sops.organisation_id = public.current_organisation_id()
        and (
          public.current_user_role() in ('admin', 'safety_manager')
          or sops.owner_user_id = auth.uid()
        )
    )
  );
-- Repeat identically for admins_can_manage_steps (join via sop_sections) and
-- admins_can_manage_images (join via sops directly). Do NOT touch
-- admins_can_update_sops or admins_can_delete_sops (out of CAP-02 scope).
```

## Role Inventory

Three independent role axes exist in the schema. CAP-01's matrix rows should be the first axis (org role); the second and third are context, not new matrix rows, per D1 (obligation ≠ access) and the CONTEXT's instruction not to build role-ladder logic here:

| Axis | Values | Source | Scope |
|---|---|---|---|
| **Org role** (`organisation_members.role`) | `worker`, `supervisor`, `admin`, `safety_manager` | [VERIFIED: src/types/auth.ts] | Every capability gate in the app is keyed to this. **This is the matrix's row axis.** |
| **Platform role** | `platform_admins` table (renamed from `summit_admins`, migration 00026) | [VERIFIED: src/lib/auth/platform-admin-guard.ts] | Potenco-level super-admin, orthogonal to any org. Gates `/admin/global-blocks` (global block library curation) only. Note in the matrix as a footnote row, not a peer of the four org roles — do not conflate with Summit Insights per CLAUDE.md's ownership note. |
| **Dept-scoped job role** (Phase 32 `roles` table) | Free-text per-department (e.g. future "Grade Two Operator", "Grade One Operator", "Wear Maker") | [VERIFIED: supabase/migrations/00046_org_model_schema.sql:102-164] | This is an org-chart/headcount entity, not yet a capability gate anywhere in code — it's visibility/obligation scoping (Phase 44a/44b territory), explicitly deferred. Document as "incoming, Phase 44b" in the matrix per CONTEXT's instruction, do not build against it. |

## Capability Inventory Sweep

Derived from the full route tree (`src/app/(protected)/**/page.tsx`) and `src/actions/*` (27 files). Group by surface for the matrix's columns:

| Capability group | Representative actions/routes |
|---|---|
| Worker walkthrough | `/sops/[sopId]` (Read/Walk it/Flow tabs), voice Q&A, offline sync |
| Completion & sign-off | `sop_completions` write (worker), `signOffCompletion` (supervisor/safety_manager/admin) |
| Self-add / bookmarking | Worker self-assignment (`assignments.ts` worker-context functions) — becomes "bookmark" per OBL-04 in 44a |
| Observations | `recordObservation`, `listAssessmentRequests` (`observations.ts`) — supervisor/assessor-gated |
| SOP creation on-ramps | Upload/AI-prompt/AI-voice/blank wizard/YouTube/video-record/video-generate — all admin/safety_manager |
| SOP builder editing | Sections/steps/images/layout/blocks — admin/safety_manager **+ owner after CAP-02** |
| Publish gate | `assertPublishGates()`, per-block verify checklist | admin/safety_manager |
| Version history | Clone/restore/supersede, diff view — admin/safety_manager |
| Governance queue | `listGovernanceQueue`, owner/cadence/review actions (`governance.ts`) — admin/safety_manager |
| Approval chains | `setApprovalChain`, `approveStep`/`requestChanges` (`approvals.ts`) — admin/safety_manager (chain-step approvers, which may include supervisors named in a chain) |
| Team management | `/admin/team`, invites, role assignment | admin (safety_manager partial per 2026-07-05 learning) |
| Departments / org model | `/admin/departments`, areas/roles/grants (`org-model.ts`, `departments.ts`, `grants.ts`) | admin/safety_manager |
| Blocks library | `/admin/blocks`, global vs org-scoped, suggestions | admin/safety_manager (+ platform_admin for global) |
| AI settings | `/admin/ai-settings` | admin |
| Competency / training matrix | `/admin/team` matrix mode, CSV export (`competency.ts`) | admin/safety_manager (read); supervisor (record observation) |
| Assessor governance | `isSignedOffAssessor`, override path (Phase 37) | assessor-flagged members + admin override |
| Exports | Training CSV export | admin/safety_manager |
| Profile / trust surfaces | `/profile` (own observations/competency) | self (any role) |

## Common Pitfalls

### Pitfall 1: Sibling RLS policy instead of an OR-widened USING clause
**What goes wrong:** Adding a second `CREATE POLICY` for "owner can edit" instead of extending the existing policy's USING clause.
**Why it happens:** Feels additive and non-invasive to leave the existing policy untouched.
**How to avoid:** Postgres ORs all permissive policies for a command together. A second policy is fine ONLY if it independently carries the full org-scope predicate — but the safer, simpler shape (and the one this codebase has standardized on per the 2026-08-04 fix) is one policy, one USING clause, with `role-check OR owner-check` nested *inside* the org-scope AND. Drop+recreate the existing policy rather than adding a sibling.
**Warning signs:** `tests/lint/rls-org-scope.spec.ts` already parses every migration and will fail if a new policy lacks an org predicate — but it does NOT know about the owner-OR-role semantic, so it will pass a badly-shaped sibling policy that happens to be org-scoped. Manual review of the diff is still required.

### Pitfall 2: A future `WITH CHECK` that forgets the owner clause
**What goes wrong:** If any later migration adds an explicit `WITH CHECK` to these policies (e.g. to prevent an owner from reassigning `sop_id` cross-org), and only restates the org predicate without the owner-OR-role predicate, it silently **narrows** edit access back to admin-only — the exact 00062 bug class (`WITH CHECK` replaces `USING`, doesn't add to it).
**How to avoid:** If CAP-02's migration or any later one adds a `WITH CHECK`, it must restate the full `org AND (role OR owner)` predicate, not just the org part.

### Pitfall 3: Fixing only the RLS layer and missing the app-level guard (or vice versa)
**What goes wrong:** `sop-section-blocks.ts` writes through the **service-role admin client**, which bypasses RLS entirely — extending RLS alone does nothing for that file. Conversely, `sections.ts`'s `createSection` and the legacy `PATCH /api/sops/[sopId]/sections/[sectionId]` route have **no app-level guard at all** — extending only `requireAdminContext()`-based call sites misses them.
**How to avoid:** Treat this as two independent sweeps (grep every `requireAdminContext()`/manual role-check call site that touches SOP content, AND update the 3 RLS policies) — confirmed necessary by direct inspection in this research, not an assumption.

### Pitfall 4: Widening CAP-02 beyond "edit" into publish/governance/delete
**What goes wrong:** Interpreting "sign-off authority carries edit rights" as "carries admin rights on that SOP" and also loosening publish, delete, version-supersede, or owner-reassignment gates.
**How to avoid:** The locked decision says "edit rights," and CONTEXT's own capability list treats "edit SOP blocks" as separate from "publish." Scope the guard swap to the content-write call sites listed above only. If Simon later wants owner-publish too, that's a fast follow-on with the same guard, not a reason to expand CAP-02's blast radius now (locked "keep it simple" decision).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (`@playwright/test`) — no unit-test framework in this codebase; Wave-0 stub + live-Supabase-integration pattern is standard |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=phase46` (source-contract specs, run without live Supabase) |
| Full suite command | `npx playwright test --project=phase46` with `.env.local` populated (activates the live-ephemeral-org specs, mirrors `tests/phase34/observation-read-role-scope.spec.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAP-01 | Matrix document exists, covers every role × capability, referenced from CLAUDE.md | source-contract (file exists + contains required rows + CLAUDE.md references it) | `npx playwright test tests/phase46/capability-matrix-doc.spec.ts` | ❌ Wave 0 |
| CAP-02 | Owner (non-admin) can edit their SOP's sections | live-Supabase positive probe, ephemeral org | `npx playwright test tests/phase46/sop-edit-owner-access.spec.ts` | ❌ Wave 0 |
| CAP-02 | Non-owner, non-admin worker CANNOT edit a SOP they don't own | live-Supabase negative probe, same spec, per the 2026-07-20 "positive AND negative per role" learning | same file | ❌ Wave 0 |
| CAP-02 | Admin/safety_manager retains universal edit (regression) | live-Supabase probe, same spec | same file | ❌ Wave 0 |
| CAP-02 | Guard source contract — `requireSopEditAccess` exists and is called at every enumerated call site | source-contract (grep) | `npx playwright test tests/phase46/sop-edit-guard-wiring.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** source-contract specs only (`npx playwright test --project=phase46 --grep-invert "live"`, or run the fast subset)
- **Per wave merge:** full `phase46` project including live-ephemeral-org probes (requires `.env.local` with `SUPABASE_SERVICE_ROLE_KEY`)
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/phase46/capability-matrix-doc.spec.ts` — covers CAP-01
- [ ] `tests/phase46/sop-edit-owner-access.spec.ts` — covers CAP-02 (positive + negative + regression, mirrors `tests/phase34/observation-read-role-scope.spec.ts` fixture pattern: `createEphemeralOrg`/`createEphemeralMember`/`mintAccessToken`/`asUserClient`)
- [ ] `tests/phase46/sop-edit-guard-wiring.spec.ts` — covers CAP-02 call-site coverage (source-contract, mirrors the "guard exists AND is called" pattern from the 2026-06-05 dead-feature learning — grepping for `requireSopEditAccess(` at each of the enumerated files)
- [ ] Register a `phase46` Playwright project in `playwright.config.ts` (`testDir: '.', testMatch: /tests\/phase46\/.*\.(spec|test)\.ts$/` — matches the broad-registration convention used by phase28/29/30/32/33/34/35/36/37/40)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | `requireSopEditAccess()` — object-level authorization check per-SOP, not just role-level; RLS backstop with explicit org-scope + owner-scope predicates |
| V5 Input Validation | yes (unchanged) | `sopId` is a UUID param, already validated at existing call sites (Zod schemas in sections.ts etc.) |
| V2/V3/V6 | no | No auth/session/crypto changes in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Owner check trusts a client-supplied `sopId` without re-verifying org membership of the fetched row | Elevation of Privilege | `requireSopEditAccess` fetches the SOP via admin client with an explicit `.eq('organisation_id', organisationId)` filter sourced from the session, never from client input — mirrors the CLAUDE.md 2026-06-15/26 pattern used throughout this codebase |
| Sibling RLS policy silently ORs in a cross-org read/write | Tampering/Info Disclosure | Single-policy OR-inside-AND shape (Pitfall 1 above); this exact bug class hit `public.sops` twice (00061, 00062) |
| A future `WITH CHECK` on the extended policies drops the owner clause | Elevation restricted incorrectly (functional bug, not a security hole, but breaks CAP-02 silently) | Pitfall 2 above — restate full predicate in any future `WITH CHECK` |

## Sources

### Primary (HIGH confidence)
- Direct reads: `supabase/migrations/00003_sop_schema.sql`, `00043_ownership_review_governance.sql`, `00045_approval_chains.sql`, `00046_org_model_schema.sql`
- Direct reads: `src/lib/auth/guards.ts`, `src/lib/auth/session-context.ts`, `src/actions/sections.ts`, `src/actions/governance.ts`, `src/actions/sop-section-blocks.ts`, `src/actions/versioning.ts`, `src/actions/completions.ts`, `src/actions/assignments.ts`, `src/components/admin/governance/OwnerPicker.tsx`, `src/types/auth.ts`
- Direct reads: `src/app/api/sops/[sopId]/sections/[sectionId]/route.ts`, full route tree glob
- Direct reads: `tests/phase34/observation-read-role-scope.spec.ts`, `tests/lint/rls-org-scope.spec.ts`, `playwright.config.ts`, `.planning/config.json`

### Secondary (MEDIUM confidence)
- `.planning/v9.0-DEV-PLAN.md`, `.planning/REQUIREMENTS.md` § v9.0/v6.0, `.planning/STATE.md` — phase intent, "sign-off manager" phrasing, ownership-model provenance

### Tertiary (LOW confidence)
- None — no external/web sources needed for this phase; entirely a codebase-internal research task

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new libraries this phase
- Architecture (enforcement point, call-site inventory): HIGH — every claim verified by direct file reads, not inference
- "Sign-off authority" definition: MEDIUM — best-fit reading of available evidence; recommend the plan flag it as a stated assumption rather than block on further confirmation, since the fix is a single cheap-to-swap predicate

**Research date:** 2026-08-25
**Valid until:** Until the next migration touching `sops`/`sop_sections`/`sop_steps`/`sop_images` RLS policies (this schema area has moved twice in the last month — 00061/00062 — so treat the exact policy text as needing a fresh grep at plan time, not copy-paste from this doc)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Sign-off authority on a SOP" = `sops.owner_user_id`, not approval-chain approvers or completion sign-off | Sign-off Authority: Schema Mapping | If wrong, the enforcement predicate changes from a single-owner check to a chain/approver-membership check — a different (larger) query, and the matrix's "sign-off authority" column changes from one-owner-per-SOP to category-scoped/multi-approver. Cheap to fix if caught at plan-check; expensive if caught after CAP-02 ships and Simon expected chain-approver semantics. |
| A2 | CAP-02 scope = content-edit paths only (sections/steps/images/layout/blocks), excluding publish/delete/version-supersede/owner-reassignment | SOP Edit Path Inventory § Scope decision | If Simon intends "edit" to include publish or version actions, those call sites (governance.ts, versioning.ts's admin-gated writes) need the same guard swap — a larger diff than currently scoped. |

## Open Questions

1. **Does a SOP owner need to see/use the builder's admin-only UI chrome (governance queue links, publish button, etc.), or just gain the write capability with the existing worker-facing SOP detail page?**
   - What we know: The builder route (`/admin/sops/builder/[sopId]`) is itself gated by admin-route conventions (not verified in this pass — CAP-02's CONTEXT says "no route work, no new UI surfaces").
   - What's unclear: If a non-admin owner can now legally write to `sop_sections`, but the only UI that calls `updateSectionLayout` lives behind an admin-only route/nav, the capability is granted server-side but unreachable client-side — satisfying CAP-02's literal server-side enforcement requirement but not any practical use.
   - Recommendation: Confirm with Simon whether CAP-02 is intentionally server-only enforcement (proven by tests, no UI change — matches "no route work" in CONTEXT) or whether a follow-up phase needs to expose builder access to owners. Treat as out of scope for 46 either way; flag in the matrix as "owner edit: server-enforced, UI access pending" if the builder route stays admin-gated.
