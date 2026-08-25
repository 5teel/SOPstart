# Capability Matrix

**Last updated:** 2026-08-25

This document is the single reference for who can see and do what in SafeStart. When a capability gate changes (an RLS policy, a `require*` guard, or a role check), this file changes in the **same commit**. If this file disagrees with the code, the code is the bug or the file is stale — treat any drift as a finding, not a footnote.

## Two channels (D1: obligation ≠ access)

**Access channel** — whether a role *can* reach and act on a surface. Enforced today by RLS policies + server-action guards (`requireAdminContext()`, `requireSopEditAccess()`, RLS `USING`/`WITH CHECK` clauses). This is shipped, and it is what the table below documents.

**Obligation channel** — whether a role *is required* to complete a SOP (assigned vs. optional, mandatory vs. bookmarked). This is a separate concept: a worker can have *access* to read a SOP without being *obligated* to complete it, and vice versa is meaningless (obligation without access is a bug). Today obligation is only implied by `sop_assignments` rows; a first-class manager-set obligation record ships in **Phase 44a**. Access must never be read as a proxy for obligation, and obligation must never be read as a proxy for access — they are tracked, and will be enforced, independently.

The matrix below is the **access channel only**.

## How to read this document

To answer "can a supervisor do X?": find the `X` row in the Matrix below, read the `supervisor` column. ✅ means yes today, enforced at the file/policy named in `Enforced at`. `—` means no path exists for that role at all. ⚠ means the UI/route looks reachable but the write-path gate has a known gap — check Findings before assuming the cell is safe. 🕒 in the Planned capabilities table means the capability does not exist yet at all, for any role — check the named phase.

To answer "is a worker *required* to do X?": this document does not answer that question. See Two channels above — obligation is a separate, mostly-not-yet-built concept, and inferring it from an access ✅ is exactly the mistake D1 exists to prevent.

## Legend

| Symbol | Meaning |
|---|---|
| ✅ `shipped-and-enforced` | The gate exists in code today (RLS and/or app guard) and blocks the disallowed case |
| ⚠ `shipped-but-unenforced` | The capability is reachable in the UI/API surface but the write path currently has a gap — see Findings below |
| 🕒 `planned` | Not yet built; ships in a named future phase |
| `—` | Not applicable to this role |

## Matrix (access channel)

| Capability | worker | supervisor | admin | safety_manager | Chain approver (any role) | Enforced at |
|---|---|---|---|---|---|---|
| Read SOP | ✅ | ✅ | ✅ | ✅ | ✅ | RLS `sops` SELECT policies, org-scoped (`org_members_can_view_sops` + department/sub-trade tag arms, migration 00061) |
| Walk SOP | ✅ | ✅ | ✅ | ✅ | ✅ | Same RLS as Read SOP — walkthrough is a read-only client mode over the same rows |
| Self-add SOP | ✅ | ✅ | ✅ | ✅ | — | `assignments.ts` worker-context self-assign functions, session client + org-scoped RLS on `sop_assignments` |
| Record completion | ✅ | ✅ | ✅ | ✅ | — | `sop_completions` INSERT RLS (append-only — no UPDATE/DELETE, D-15) |
| Sign off completion | — | ✅ | ✅ | ✅ | — | `signOffCompletion()` in `src/actions/completions.ts`, role check `role in ('supervisor','safety_manager','admin')` + org-scoped write (fixed cross-org hole, 2026-06-26 CR-02) |
| Record observation | — | ✅ | ✅ | ✅ | — | `recordObservation()` in `src/actions/observations.ts`, supervisor/assessor-gated + org-scoped RLS (`sop_observations`, fixed 2026-07-20 org-scope hole) |
| Create SOP | — | — | ✅ | ✅ | — | `requireAdminContext()` in `src/lib/auth/guards.ts` at every creation on-ramp (upload/AI-prompt/AI-voice/wizard/video) |
| Edit SOP content | — | — | ✅ | ✅ | ✅ (SOPs in their chain's category only) | `requireSopEditAccess()` in `src/lib/auth/guards.ts` (Phase 46 CAP-02, A1 resolved) — admin/safety_manager unconditionally, or the caller matches a step (`userId` or `role`) of the `approval_chains` row for (their org, the SOP's `category_slug`) via `stepMatchesCaller`; RLS backstop is `is_sop_sign_off_approver()` + migration `00066_sign_off_approver_edit.sql`, which recreated `admins_can_manage_sections`/`_steps`/`_images` (orig. 00063) and `ssb_admin_manage_own_org` on block junctions (orig. 00064, full predicate in USING and WITH CHECK) with the approver arm nested inside the org-scope AND |
| Verify blocks | — | — | ✅ | ✅ | — | Per-block verify checklist gate, `requireAdminContext()`-gated — **not** extended to chain approvers by CAP-02 (scoped to content-edit only, RESEARCH § SOP Edit Path Inventory Scope decision) |
| Publish SOP | — | — | ✅ | ✅ | — | `assertPublishGates()` via `requireAdmin()` in `src/lib/governance/publish-core.ts` — a chain approver does not gain publish rights (approving a step ≠ executing the publish) |
| Delete SOP | — | — | ✅ | ✅ | — | `requireAdminContext()` — a chain approver does not gain delete rights |
| Version history | — | — | ✅ | ✅ | — | `cloneSopAsDraft`/`restoreVersionAsNew`/`uploadNewVersion` in `src/actions/versioning.ts`, manual role check + service-role self-enforced org-scope — a chain approver does not gain version-supersede rights |
| Governance queue | — | — | ✅ | ✅ | — | `listGovernanceQueue` + owner/cadence/review actions in `src/actions/governance.ts`, `requireAdminContext()` |
| Approval chains | — | ✅ (as named chain-step approver only) | ✅ | ✅ | — | `setApprovalChain` admin/safety_manager-only (`approvals.ts`); `approveStep`/`requestChanges` open to whichever member is named in that chain step, which may include a supervisor |
| Manage team | — | — | ✅ | ⚠ (partial) | — | `/admin/team` routes, `requireAdminContext()` — safety_manager has partial access per 2026-07-05 learning (verify current scope before relying on this cell) |
| Manage departments | — | — | ✅ | ✅ | — | `org-model.ts`/`departments.ts`/`grants.ts`, `requireAdminContext()` |
| Manage blocks library | — | — | ✅ | ✅ | — | `/admin/blocks`, `requireAdminContext()`; global block curation additionally gated by `platform_admin` (`platform-admin-guard.ts`) |
| AI settings | — | — | ✅ | — | — | `/admin/ai-settings`, admin-only role check |
| Training matrix | — | — | ✅ | ✅ (read) | — | `/admin/team` matrix mode + `competency.ts`; supervisor gains a narrow write via Record observation above, not matrix admin |
| Assessor governance | — | — | ✅ (override) | — | — | `isSignedOffAssessor` flag on the member row + admin override path (Phase 37); assessor status itself is a per-member flag, not a role |
| Export training records | — | — | ✅ | ✅ | — | Training CSV export, `competency.ts`, admin/safety_manager |
| Own profile | ✅ | ✅ | ✅ | ✅ | — | `/profile`, self-scoped to the caller's own observations/completions/competency — every role reads only their own row |

Where a row's `Enforced at` column names RLS only (no app guard), or app guard only (RLS is `using(true)` or otherwise not the real gate), that asymmetry is deliberate context, not an oversight — see Findings below for the two cases where it became a real gap.

## Sign-off authority and edit rights (CAP-02)

Locked decision: a user with **sign-off authority** on a SOP also has **edit rights** on that SOP's content.

**Mapping in force — A1 RESOLVED = approvers (Simon, 2026-08-25):** sign-off authority = **approval-chain approvers** (Phase 29 `approval_chains`/`sop_approvals` — category-scoped, 1-4 ordered steps, optional per category), NOT `sops.owner_user_id`. A member who matches any step (`userId` equality or `role` equality, via the shared `stepMatchesCaller`) of the chain configured for (their org, the SOP's `category_slug`) gets content edit rights (sections, steps, images, layout_data, block junctions) on SOPs in that category, via `requireSopEditAccess()` and the `is_sop_sign_off_approver()` RLS backstop (migration 00066). Publish, verify-blocks, delete-SOP, version-supersede, and owner-reassignment stay admin/safety_manager-only — the rule is scoped to "edit," not to admin powers generally (RESEARCH § SOP Edit Path Inventory Scope decision, A2).

**Accepted consequence (stated when A1 was framed, chosen knowingly):** a SOP whose category has NO configured approval chain (or an empty steps array) has **zero** people with sign-off-derived edit rights — only admin/safety_manager can edit it. The SOP owner (`sops.owner_user_id`, which remains as a governance/accountability field) no longer gains edit rights as such; an owner edits only if they are also an admin/safety_manager or a matching chain-step approver.

## Cross-references

| Concept | Where it lives |
|---|---|
| Org role union (`AppRole`) | `src/types/auth.ts` |
| Admin/safety_manager guard | `requireAdminContext()`, `src/lib/auth/guards.ts` |
| Chain-approver edit guard (CAP-02) | `requireSopEditAccess()`, `src/lib/auth/guards.ts` (added Phase 46 plan 03; repointed to chain approvers by the A1 resolution, 2026-08-25) |
| Chain-approver RLS helper (CAP-02) | `public.is_sop_sign_off_approver(uuid)`, migration `00066_sign_off_approver_edit.sql` — SECURITY DEFINER, self-scoping via `auth.uid()`/`current_organisation_id()`/`current_user_role()` |
| Platform-admin guard | `src/lib/auth/platform-admin-guard.ts` |
| SOP ownership field | `sops.owner_user_id`, migration `00043_ownership_review_governance.sql` |
| Approval chains | `approval_chains`/`sop_approvals`, migration `00045_approval_chains.sql` |
| Dept-scoped job roles | `roles` table, migration `00046_org_model_schema.sql` |

## Roles that are not rows

- **`platform_admin`** — Potenco-level super-admin (`platform_admins` table, renamed from `summit_admins` in migration 00026), orthogonal to every org role above. Gates `/admin/global-blocks` (global block library curation) only. Per `CLAUDE.md` § Ownership, this is a Potenco concept and is never conflated with Summit Insights.
- **Dept-scoped job role** (Phase 32 `roles` table, e.g. "Grade Two Operator") — an org-chart / headcount entity today, not a capability gate anywhere in code. Becomes a visibility axis in **Phase 44b**; do not treat it as a fifth matrix row until that phase ships it as one.

## Planned capabilities

| Capability | Phase | Notes |
|---|---|---|
| Obligation record (mandatory vs. bookmarked, manager-set) | Phase 44a | First-class row for the obligation channel described above; today only implied by `sop_assignments` |
| Role-ladder visibility (dept-scoped job role as a visibility axis) | Phase 44b | Turns the "Roles that are not rows" dept-role axis into an actual capability gate |
| View-as-role (admin previews another role's surface) | Phase 45 | No implementation in this phase |
| Edit history, read-only to everyone with SOP access | Phase 47 (D5) | Distinct from Version history above, which stays admin/safety_manager-only for the *action* of restoring a version |
| Worker feedback with moderated removals | Phase 48 (D4) | Not yet built |

These rows are never mixed into the shipped matrix above — a `planned` capability has no ✅ cell anywhere until its phase ships it.

Do not build against any planned row before its phase starts; each is deliberately deferred per `.planning/phases/46-capability-matrix/46-CONTEXT.md` "Deferred Ideas."

## Findings — shipped-but-unenforced

Gaps observed while writing this document. Recorded here, not fixed here — Phase 46 plan 03 (CAP-02) closes the first two as part of extending the edit-access guard; the third is pre-existing by design and noted for future reference.

1. **Legacy `PATCH /api/sops/[sopId]/sections/[sectionId]` route** (`src/app/api/sops/[sopId]/sections/[sectionId]/route.ts`) — no app-level guard at all; the plain session client relies purely on RLS (`admins_can_manage_sections`, `admins_can_manage_steps`) as the only gate. Closed by 46-03 adding an explicit `requireSopEditAccess()` call.
2. **`createSection` in `src/actions/sections.ts`** — no guard at the action level; relies purely on RLS (`admins_can_manage_sections`) via the plain session client. Closed by 46-03.
3. **`sop_section_blocks` block-junction writes** — CLOSED by the Phase 46 review-fix pass (CR-02, migration `00064_ssb_owner_edit.sql`; the owner arm it added was superseded by the approver arm in `00066_sign_off_approver_edit.sql` when A1 resolved). The app-level guard (`requireSopEditAccess()` in `src/actions/sop-section-blocks.ts`, 46-03) is backstopped by RLS: `ssb_admin_manage_own_org` carries the `is_sop_sign_off_approver()` arm nested inside the org-scope AND, with the full predicate restated in **both** USING and WITH CHECK (the 00062 partial-check trap deliberately avoided). Proven live by the junction probes in `tests/phase46/sop-edit-owner-access.spec.ts`. Recorded here because this document originally claimed the junction had no RLS backstop by design — that was true when written and is no longer true.

## Maintenance

Mirrors `CLAUDE.md` § Pathways Map Maintenance:

1. Any change to an RLS policy, a `require*` guard in `src/lib/auth/guards.ts`, or a role check in `src/actions/*` updates this file in the same commit.
2. `/gsd-plan-phase` adds the matrix edit as an explicit task when a phase changes a capability gate.
3. `/gsd-code-review` and `/gsd-verify-work` confirm this file matches the gates the phase touched.

## Why this document exists

Before this phase, the answer to "who can do X" was spread across RLS policies in six-plus migrations, `requireAdminContext()` call sites scattered across `src/actions/*`, and ad-hoc role checks — the exact fragmentation that let the 00061 (`sops` SELECT policy missing an org predicate) and 00062 (`WITH CHECK` silently narrowing a policy's org scope) cross-tenant holes ship undetected. Naming the enforcement point per row, in one file, makes the next gap visible on read — a planner or reviewer checking a capability's row sees immediately whether it names a concrete file/policy or a `—`/`⚠`, instead of having to trace six files to find out the gate does not exist.

## Automated enforcement of this document

`tests/phase46/capability-matrix-doc.spec.ts` (CAP-01, source-contract gate) pins every row label, both channel headings, all three legend markers, the `platform_admin` footnote token, the `sign-off authority`/`is_sop_sign_off_approver`/`A1 RESOLVED` CAP-02 tokens, and all five forward-reference phase markers as literal-string assertions against this file. If a row disappears or a heading is renamed without updating the spec in the same commit, the gate goes red — that is by design (mutation-proven at Phase 46 plan 02, Task 2).
