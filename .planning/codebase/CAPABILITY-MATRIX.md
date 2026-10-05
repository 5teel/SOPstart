# Capability Matrix

**Last updated:** 2026-10-04 (56-06)

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
| Self-add SOP | ✅ | ✅ | ✅ | ✅ | — | `assignments.ts` worker-context self-assign functions, session client + org-scoped RLS on `sop_assignments`. The self-add list UI (per-row Add/Remove buttons) was retired with the worker list page in Phase 57 (D-13); the action still exists, and assignments return as requests in Phase 60 |
| Record completion | ✅ | ✅ | ✅ | ✅ | — | `sop_completions` INSERT RLS (append-only — no UPDATE/DELETE, D-15); walk photos upload through `getPhotoUploadUrl()` in `src/actions/completions.ts`, which builds the storage path from the session organisation only and accepts UUID ids only (Phase 55) |
| Sign off completion | — | ✅ | ✅ | ✅ | — | `signOffCompletion()` in `src/actions/completions.ts`, role check `role in ('supervisor','safety_manager','admin')` + org-scoped write (fixed cross-org hole, 2026-06-26 CR-02) |
| Counter-sign completion | — | ✅ | ✅ | ✅ | — | `recordSignature()` in `src/actions/completions.ts`: a `supervisor` signature needs session role `in ('supervisor','safety_manager','admin')`; the signer id is the session user (no client-supplied signer), org-scoped to the session (Phase 55 review CR-02) |
| Record observation | — | ✅ | ✅ | ✅ | — | `recordObservation()` in `src/actions/observations.ts`, supervisor/assessor-gated + org-scoped RLS (`sop_observations`, fixed 2026-07-20 org-scope hole) |
| Create SOP | — | — | ✅ | ✅ | — | `requireAdminContext()` in `src/lib/auth/guards.ts` at every creation on-ramp (upload/AI-prompt/wizard/video) |
| Edit SOP content | — | — | ✅ | ✅ | ✅ (SOPs in their chain's category only) | `requireSopEditAccess()` in `src/lib/auth/guards.ts` (Phase 46 CAP-02, A1 resolved) — admin/safety_manager unconditionally, or the caller matches a step (`userId` or `role`) of the `approval_chains` row for (their org, the SOP's `category_slug`) via `stepMatchesCaller`; RLS backstop is `is_sop_sign_off_approver()` + migration `00066_sign_off_approver_edit.sql`, which recreated `admins_can_manage_sections`/`_steps`/`_images` (orig. 00063) and `ssb_admin_manage_own_org` on block junctions (orig. 00064, full predicate in USING and WITH CHECK) with the approver arm nested inside the org-scope AND |
| Publish SOP | — | — | ✅ | ✅ | — | `assertPublishGates()` via `requireAdmin()` in `src/lib/governance/publish-core.ts` — a chain approver does not gain publish rights (approving a step ≠ executing the publish) |
| Delete SOP | — | — | ✅ | ✅ | — | `requireAdminContext()` — a chain approver does not gain delete rights |
| Version history | — | — | ✅ | ✅ | — | `cloneSopAsDraft`/`uploadNewVersion` in `src/actions/versioning.ts` (compare and restore removed in Phase 55-10), manual role check + service-role self-enforced org-scope — a chain approver does not gain version-supersede rights |
| Governance queue | — | — | ✅ | ✅ | — | `/governance` (server page, Phase 54) opens with `requireAdminContext()` and redirects any other role; it reads through `loadInbox()` (`src/lib/governance/load-inbox.ts`, Phase 57 D-16) -- `listGovernanceQueue`, `listAdminSopRows` and `listSiteHealthForOrg`, each self-guarded the same way -- the same read the one screen's Office pin and card count via `getAdminShell()`. The inbox adds no new mutation — its row actions are the existing `approveStep` (server-side next-approver check in `src/actions/approvals.ts`), `setSopOwner` (target must be a member of the caller's org) and `confirmSopCurrent`, plus links into the focus editor (`/sops/[sopId]?mode=edit`, Phase 58-14) / `/admin/sops/new` |
| SOP library table + Access lens (admin) | — | — | ✅ | ✅ | — | `listAdminSopRows` (`src/actions/admin-sop-list.ts`) and `listAdminAccessData` (`src/actions/admin-access-view.ts`), both open with `requireAdminContext()`. The library table is retired (Phase 57 D-13): there is no admin list page. Drafts list in the Workshop via `getAdminShell`, machine and site SOPs sit on the one screen (`/`), where `useIsAdmin()` only decides which module MOUNTS (a UX convenience); it is not and must never be read as the access gate. `listAdminSopRows` remains the guarded read behind the governance inbox. Phase 57 (57-07): the Access lens is now the `/admin/access` page — server page gate `requireAdminContext()` before render, with `listAdminAccessData` self-guarding as defence in depth; `?sop=` pins a SOP only when it is a UUID The category fix (previously the retired list detail pane) is `setSopCategory` (session-org guarded) from This SOP in the focus editor (`CategoryButton`, Phase 58) |
| Approval chains | — | ✅ (as named chain-step approver only) | ✅ | ✅ | — | `setApprovalChain` admin/safety_manager-only (`approvals.ts`); `approveStep`/`requestChanges` open to whichever member is named in that chain step, which may include a supervisor |
| Manage team | — | — | ✅ | ⚠ (partial) | — | `/admin/team` routes, `requireAdminContext()` — safety_manager has partial access per 2026-07-05 learning (verify current scope before relying on this cell) |
| Manage departments | — | — | ✅ | ✅ | — | `org-model.ts`/`departments.ts`/`grants.ts`, `requireAdminContext()`. Phase 57 (57-07): departments are managed from the departments strip in site edit mode on `/` (`/?place=edit`; `requireAdminContext()` in `departments.ts`; remove is refused while machines or SOP visibility rows use the department, D-22) — the `/admin/departments` and `/admin/site` pages are gone and redirect there. The wiring/access surface (`listOrgTree`/`listGrants`/`ensureSopCollections`) is reached through `/admin/access`. Per-person department membership stays on `/admin/team` (`assignMemberDepartments`, D-09). Access wiring and department visibility RLS are unchanged |
| AI settings | — | — | ✅ | — | — | `/admin/ai-settings`, admin-only role check |
| Training matrix | — | — | ✅ | ✅ (read) | — | `/admin/team` matrix mode + `competency.ts`; supervisor gains a narrow write via Record observation above, not matrix admin |
| Assessor governance | — | — | ✅ (override) | — | — | `isSignedOffAssessor` flag on the member row + admin override path (Phase 37); assessor status itself is a per-member flag, not a role |
| Export training records | — | — | ✅ | ✅ | — | Training CSV export, `competency.ts`, admin/safety_manager |
| Own profile | ✅ | ✅ | ✅ | ✅ | — | `/profile`, self-scoped to the caller's own observations/completions/competency — every role reads only their own row |
| View site map (scene, machines, SOP links) | ✅ | ✅ | ✅ | ✅ | — | RLS `org_members_can_view_site_layouts`/`_machines`/`_sop_machines` + `org_members_can_read_site_scenes` (migration `00067_site_model.sql`); `listSiteForWorker()` in `src/actions/site-worker.ts` (`getSessionContext()`, session-org filter on every query, published-SOP link filter) feeds the `/` one screen for every role (Phase 57): all four rooms are visible to every role, and what a room shows is decided by the server reads (`listSiteForWorker()` and completions RLS for workers and supervisors, `getAdminShell()` for admins). |
| Edit site map (scene, machines) | — | — | ✅ | ✅ | — | RLS `admins_can_write_site_layouts`/`_machines` + `admins_can_upload_site_scenes` (00067) backstopping `requireAdminContext()` in `src/actions/site.ts` and `POST /api/admin/site/generate` (Phase 51 plan 51-03). Phase 57: reached as edit mode on `/` (`?place=edit`); `useIsAdmin()` only decides which module mounts, `requireAdminContext()` in `src/actions/site.ts` and `src/actions/departments.ts` is the gate. Departments are added, renamed, recoloured and removed (refused while in use) from the strip there. |
| Link SOPs to machines | — | — | ✅ | ✅ | — | RLS `admins_can_write_sop_machines` (00067) backstopping `setSopMachines()` in `src/actions/site.ts` — `requireAdminContext()`, both the SOP id and every machine id filtered to the session org before write (Phase 51 plan 51-03). Also keeps `sops.placement` in sync (`'machine'` while any link exists, else `'site'`) via the invoker trigger `sop_machines_sync_placement` (00069, Phase 56 D-09), so a machine or SOP delete cascade flips it too |
| Generate site scene (paid AI) | — | — | ✅ | ✅ | — | `POST /api/admin/site/generate` — `requireAdminContext()`, `GEMINI_API_KEY` gate, refuses when the org's layout already has a scene (Phase 51 plan 51-03) |
| Library health data (floor + library checks) | — | — | ✅ | ✅ | — | Enforced at `listSiteHealthForOrg()` (`src/actions/site.ts`) and `listAdminSopRows()` (`src/actions/admin-sop-list.ts`): `requireAdminContext()` first, every new read filtered to the SESSION organisation, `sop_access_people` scoped by RLS 00048's same-org admin arm, no service-role client (Phase 54 plan 54-01); also enforced at `getAdminShell()` (`src/actions/shell.ts`, Phase 57 plan 57-03): `requireAdminContext()` first, no parameters, session-org filter on the placement read, no service-role client |
| Workshop drafts list (admin) | — | — | ✅ | ✅ | — | Enforced at `getAdminShell()` (`src/actions/shell.ts`): `requireAdminContext()` first, no parameters, session-org filter on every read, no service-role client (Phase 57 plan 57-05). The Workshop room lists every non-published SOP in the org. |
| View standards labels | ✅ | ✅ | ✅ | ✅ | — | RLS `org_members_can_view_standards` / `org_members_can_view_standard_attachments`, org-scoped (migration `00069_sop_kinds_placement_standards.sql`, Phase 56) |
| Manage standards (add, rename, remove, attach) | — | — | ✅ | ✅ | — | RLS `admins_can_write_standards`, `admins_can_attach_standards` (the target SOP, section or generated step must belong to the caller's org) and `admins_can_detach_standards` (00069); server guard: `requireAdminContext()` first in every action, session-org filters, and the standard and target checked in the org before writing, in `src/actions/standards.ts` (56-06) |
| Read generated SOP steps | ✅ | ✅ | ✅ | ✅ | ✅ | RLS `org_members_can_view_sop_focus_steps` (00069): org-scoped AND an `exists` on `sops` evaluated under the caller's own sops policies, so department visibility is inherited exactly as the old step table inherits it. Writes: service-role converter only, no write policy |
| Read conversion reports | — | — | ✅ | ✅ | — | RLS `admins_can_view_sop_conversion_runs` (00069), org-scoped; no write policy (service-role converter only) |
| Read decision ledger | — | — | ✅ | ✅ | — | RLS `admins_can_read_decisions` (00070, Phase 56), org-scoped, admin/safety_manager only; the Office view is Phase 59 |
| Write a decision | — | — | — | — | — | No role writes directly. The only insert path is the server writer `recordDecision()` (service role; organisation and actor taken from the session only, 56-05). There is no authenticated INSERT policy and INSERT is revoked from anon and authenticated (00070) |
| Change or delete a decision | — | — | — | — | — | Refused for EVERY role including the service role: triggers `decisions_no_update_delete` + `decisions_no_truncate` (both set to always fire) and UPDATE / DELETE / TRUNCATE revoked from anon, authenticated and service_role (00070, DEC-03). A correction is a new decision with `supersedes_decision_id`. Only the table owner could switch a trigger off deliberately |
| Phase 58 -- open a SOP to browse or walk | ✅ | ✅ | ✅ | ✅ | ✅ | Workers and supervisors open the LATEST PUBLISHED version only: a draft or unknown id renders not-found and a superseded id redirects to the current version. That refusal is enforced by the server page `src/app/(protected)/sops/[sopId]/page.tsx` via `resolveFocusTarget()` (`src/lib/sop/lineage-current.ts`), not RLS (the page, not the database, enforces it), which still lets any org member read draft rows. Admins and safety managers open any row. (Phase 58 plans 58-08, 58-11) |
| Phase 58 -- start, record, resume and start over a walk | ✅ | ✅ | ✅ | ✅ | ✅ | Own rows only. RLS `workers_can_view_own_sop_walks` / `workers_can_start_own_sop_walks` / `workers_can_update_own_sop_walks` on `sop_walks` (00071: org conjunct AND `worker_id = auth.uid()` in USING and WITH CHECK, the SOP must be in the caller's org, no delete policy), plus session-scoped `src/actions/walk.ts` (`startWalk`, `recordWalkStep`, `startOverWalk`; Phase 58 plan 58-09) |
| Phase 58 -- send a walk for sign-off | ✅ | ✅ | ✅ | ✅ | ✅ | `submitCompletion()` reads the caller's own `sop_walks` row (its id becomes the completion id; `sop_completions` stays append-only) and `recordSignature()` writes the ledger row through `recordDecision()` with the actor taken from the session (Phase 58 plan 58-09) |
| Phase 58 -- edit steps, sections, tips, kinds, photo flag, step images and objective (drafts only) | — | — | ✅ | ✅ | ✅ | `requireSopEditAccess()` (`src/lib/auth/guards.ts`: admin, safety manager, or an approver of the SOP's category chain) in `src/actions/focus-steps.ts` (Phase 58 plan 58-04). `sop_focus_steps` has NO authenticated write policy (00069/00071), so every write is a service-role action that self-scopes to the session org. A text, kind, tip, photo-flag or image change clears the step's tick through the trigger `clear_focus_step_tick` (00071) |
| Phase 58 -- annotate a step photo (drafts only) | — | — | ✅ | ✅ | ✅ | `requireSopEditAccess({ stepId })` then `editableSop()` in `saveAnnotatedStepImage` / `getStepAnnotation` (`src/actions/focus-steps.ts`, Phase 58 plan 58-17). `sop_image_annotations` has no authenticated write policy (00039), so the marks are written by the service-role action with the session-org filter; both photo paths are rebuilt from the session org, the resolved SOP and the step, and the marks are zod-capped. Removing a marked photo (`removeStepImage`) deletes its marks too. Workers only ever see the baked image |
| Phase 58 -- tick or untick a step, clear an AI finding, run the AI check, publish, start a new version, toggle "let workers jump ahead" | — | — | ✅ | ✅ | — | `requireAdminContext()` in `src/actions/focus-steps.ts`, `src/actions/findings.ts`, `src/actions/publish-gate.ts`, `src/actions/versions.ts` (Phase 58 plans 58-04, 58-05, 58-08); running the AI check is the POST of `src/app/api/sops/[sopId]/ai-reviewer/route.ts`, an inline admin / safety_manager role check with the SOP resolved in the session organisation (58-06). Publish, verify and version actions stay on `requireAdminContext()`; `requireSopEditAccess()` is never swapped in here |
| Phase 58 -- Walk / Edit switch visible | — | — | ✅ | ✅ | ✅ | Shown to anyone the SOP page grants edit access (the same `requireSopEditAccess()` outcome); never to a plain worker or supervisor (Phase 58 plan 58-13) |
| Phase 58 -- read earlier versions of a SOP (browse only) | — | — | ✅ | ✅ | — | `listLineageVersions()` in `src/actions/versions.ts` behind `requireAdminContext()`; the version rows open read-only (Phase 58 plan 58-08) |
| Phase 58 -- read AI findings | — | — | ✅ | ✅ | ✅ | Admins and safety managers read `sop_ai_findings` directly: RLS `admins_can_view_sop_ai_findings` (00071), org-scoped, no write policy (the reviewer route and the clear action write with the service role). Other editors, including chain approvers, receive findings only through the reviewer route after `requireSopEditAccess()` (Phase 58 plan 58-06) |
| Phase 58 -- open an old builder, versions or review address | ✅ | ✅ | ✅ | ✅ | ✅ | Gives no capability: `/admin/sops/builder/<uuid>` and `/admin/sops/<uuid>/versions` 307 in the proxy (`src/lib/supabase/middleware.ts` through `legacyRedirectFor()` in `src/lib/sop/focus-path.ts`, UUID-gated fixed templates), and `/admin/sops/<id>/review` redirects in `next.config.ts`, all to `/sops/<id>?mode=edit`. The focus page then decides: edit mode needs `requireSopEditAccess()` on the server and a refusal falls back to the worker resolution (a draft is not-found for a worker). A signed-out visitor still goes to login first (Phase 58 plan 58-14) |

Where a row's `Enforced at` column names RLS only (no app guard), or app guard only (RLS is `using(true)` or otherwise not the real gate), that asymmetry is deliberate context, not an oversight — see Findings below for the two cases where it became a real gap.

**Phase 41/54/57 note — the route is no longer an access boundary for SOP-list surfaces.** Before Phase 41, `/admin/sops`'s page-level `redirect('/dashboard')` was a real (if redundant) second gate in front of every admin SOP-list capability. That page was retired to a redirect shim in Phase 41 and deleted in Phase 43 (D-01). In Phase 57 the worker list page was retired too: the old list addresses are server-side redirects in the session proxy (`src/lib/supabase/middleware.ts` -- `/sops` goes to `/`, its attention view to `/governance`, its access view to `/admin/access`, and `/governance?view=library` to `/`), carry no guard of their own, and each destination enforces its own. `/` mounts `WorkerShell`, or the lazy `AdminShell` under `useIsAdmin()` -- that is a MOUNT decision in the browser, never the gate: it does not and cannot decide what a caller may READ or WRITE. `getAdminShell`, `listSiteForWorker` and `listAdminAccessData` (plus the `/governance` page) are the real access gates, each self-guarded (`requireAdminContext()` for the admin reads). A reviewer checking any of the rows above must confirm the capability is reachable by calling the named server action directly, never by observing that the route is reachable — "the route renders" and "the capability is granted" are fully decoupled.

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

- **`platform_admin`** — Potenco-level super-admin (`platform_admins` table, renamed from `summit_admins` in migration 00026), orthogonal to every org role above. Gates no page today — the global block curation pages were deleted in Phase 25 (plan 25-05); `is_platform_admin()` survives because RLS policies still call it (e.g. `ai_review_results`, migration 00032). Per `CLAUDE.md` § Ownership, this is a Potenco concept and is never conflated with Summit Insights.
- **Dept-scoped job role** (Phase 32 `roles` table, e.g. "Grade Two Operator") — an org-chart / headcount entity today, not a capability gate anywhere in code. Becomes a visibility axis in **Phase 44b**; do not treat it as a fifth matrix row until that phase ships it as one.

**One organisation (Phase 55, ORG-01):** there is no self-service organisation creation or switching; accounts are created only by an admin invite (`inviteWorker` -> `inviteUserByEmail`, `acceptInvite`) and Supabase public sign-up is disabled.

## Planned capabilities

| Capability | Phase | Notes |
|---|---|---|
| Obligation record (mandatory vs. bookmarked, manager-set) | Phase 44a | First-class row for the obligation channel described above; today only implied by `sop_assignments` |
| Role-ladder visibility (dept-scoped job role as a visibility axis) | Phase 44b | Turns the "Roles that are not rows" dept-role axis into an actual capability gate |
| View-as-role (admin previews another role's surface) | Phase 45 | No implementation in this phase |
| Edit history, read-only to everyone with SOP access | Phase 47 (D5) | Distinct from Version history above, which stays admin/safety_manager-only for the *action* of starting a new version |
| Worker feedback with moderated removals | Phase 48 (D4) | Not yet built |

These rows are never mixed into the shipped matrix above — a `planned` capability has no ✅ cell anywhere until its phase ships it.

Do not build against any planned row before its phase starts; each is deliberately deferred per `.planning/phases/46-capability-matrix/46-CONTEXT.md` "Deferred Ideas."

## Findings — shipped-but-unenforced

Gaps observed while writing this document. Recorded here, not fixed here — Phase 46 plan 03 (CAP-02) closes the first two as part of extending the edit-access guard; the third is pre-existing by design and noted for future reference.

1. **Legacy `PATCH /api/sops/[sopId]/sections/[sectionId]` route** — had no app-level guard (the plain session client relied purely on RLS). Closed by 46-03 adding an explicit `requireSopEditAccess()` call, then **deleted in Phase 58-16** together with the section editor that called it; no section PATCH route exists now.
2. **`createSection` in `src/actions/sections.ts`** — no guard at the action level; relies purely on RLS (`admins_can_manage_sections`) via the plain session client. Closed by 46-03.
3. **`sop_section_blocks` block-junction writes** — CLOSED by the Phase 46 review-fix pass (CR-02, migration `00064_ssb_owner_edit.sql`, superseded by the approver arm in `00066_sign_off_approver_edit.sql`), and **retired in Phase 58-16**: the last writers (`verifyBlock` / `unverifyBlock` in `src/actions/sop-section-blocks.ts`) and the `{ junctionId }` arm of `requireSopEditAccess()` are deleted, so no application code writes the junction any more. The table and its `ssb_admin_manage_own_org` policy stay in the database (no table is dropped), still org-scoped with the full predicate in USING and WITH CHECK; the step tick (`sop_focus_steps.verified_by_admin_id`) is the surviving verify path.

4. **`accept_block_update` / `decline_block_update` RPCs** (Phase 56, migration 00070) — these SECURITY DEFINER functions had no caller in `src/` after Phase 55 removed the content library, yet stayed executable by `authenticated` through PostgREST, so an admin could have recorded a block-update decision around the decision ledger. EXECUTE is now revoked from `public`, `anon` and `authenticated`: no app role can call them. Closed in the same migration that creates the ledger.

## Maintenance

Mirrors `CLAUDE.md` § Pathways Map Maintenance:

1. Any change to an RLS policy, a `require*` guard in `src/lib/auth/guards.ts`, or a role check in `src/actions/*` updates this file in the same commit.
2. `/gsd-plan-phase` adds the matrix edit as an explicit task when a phase changes a capability gate.
3. `/gsd-code-review` and `/gsd-verify-work` confirm this file matches the gates the phase touched.

## Why this document exists

Before this phase, the answer to "who can do X" was spread across RLS policies in six-plus migrations, `requireAdminContext()` call sites scattered across `src/actions/*`, and ad-hoc role checks — the exact fragmentation that let the 00061 (`sops` SELECT policy missing an org predicate) and 00062 (`WITH CHECK` silently narrowing a policy's org scope) cross-tenant holes ship undetected. Naming the enforcement point per row, in one file, makes the next gap visible on read — a planner or reviewer checking a capability's row sees immediately whether it names a concrete file/policy or a `—`/`⚠`, instead of having to trace six files to find out the gate does not exist.

## Automated enforcement of this document

`tests/phase46/capability-matrix-doc.spec.ts` (CAP-01, source-contract gate) pins every row label, both channel headings, all three legend markers, the `platform_admin` footnote token, the `sign-off authority`/`is_sop_sign_off_approver`/`A1 RESOLVED` CAP-02 tokens, and all five forward-reference phase markers as literal-string assertions against this file. If a row disappears or a heading is renamed without updating the spec in the same commit, the gate goes red — that is by design (mutation-proven at Phase 46 plan 02, Task 2).
