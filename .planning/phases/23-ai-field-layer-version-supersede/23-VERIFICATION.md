---
phase: 23-ai-field-layer-version-supersede
verified: 2026-06-26T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Version supersede flows — Edit-into-new-version, Compare diff, Restore — on sopstart.com"
    expected: "Admin clicks 'Edit into new version' on a published SOP → lands in builder on a new draft copy. Publishing that draft marks the prior version Superseded. 'Compare' shows side-by-side diff. 'Restore' on an old version creates a new draft without reactivating/rewriting the old row."
    why_human: "Deep-copy correctness, superseded_by state after publish, and diff visual rendering require a live Supabase instance with real SOP data and a round-trip through the publish path."
  - test: "Roster name-select kiosk login + worker self-sign + supervisor counter-sign on sopstart.com"
    expected: "/login/kiosk?org=<code> shows the org roster. Selecting a name completes the walkthrough with roster_worker_id recorded on sop_completions (distinct from worker_id). A worker sop_completion_signatures row exists. Supervisor approval creates a supervisor sop_completion_signatures row. Kiosk device sees only this org's SOPs and cannot reach admin surfaces."
    why_human: "Requires one-time kiosk account setup per org, real RLS isolation observable only end-to-end, live Supabase sop_completion_signatures insert verification, and a real device with the kiosk session active."
  - test: "Final phase smoke on sopstart.com — /pathways 0-not-mapped, /uat entries render, AI-field read API backbone"
    expected: "/pathways 'All screens' shows 0 not-mapped for /login/kiosk and /admin/sops/[sopId]/versions/diff. /uat shows 3 Phase-23 entries (p23-roster-kiosk-login, p23-inline-ai-proposal, p23-updated-since-badge). GET /api/ai-fields/read?fieldId=sop.title returns the current value for a registered field (org-scoped). No user-facing AI command surface exists (D-04 backbone-only confirmed)."
    why_human: "Visual rendering of /pathways + /uat requires browser. Read-API smoke requires a live authenticated session. D-04 enforcement (no accidental Cmd+K or command surface) is a live-browse check."
  - test: "'Updated since last completion' badge timing on sopstart.com"
    expected: "Worker completes SOP v1 → Admin publishes v2 → Worker returns to /sops library → 'Updated' badge appears on that SOP card."
    why_human: "Cross-session timing: worker completion + admin publish across different sessions; badge computation involves a live sop_completions.submitted_at vs sops.published_at comparison that requires real data."
---

# Phase 23: AI Field Layer + Version Supersede Verification Report

**Phase Goal:** Ship the X-03 unified AI field layer (every editable field registers a read/write API via one shared mechanism, tiered approval gate, NO user-facing command surface this phase) and G-01 formal version-supersede flow (edit-into-draft clone, publish supersedes, side-by-side diff, restore-as-new, updated-since-completion worker badge, worker+supervisor instance sign-off chain via roster name-select).
**Verified:** 2026-06-26
**Status:** human_needed — all code artifacts verified WIRED and SUBSTANTIVE; 3 deferred live-UAT checkpoints (23-05 Task 4, 23-06 Task 4, 23-07 Task 4) are the only outstanding items.
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | AFL-AI-01: Every registered field exposes a GET /api/ai-fields/read endpoint that returns its current value, org-scoped | VERIFIED | `src/app/api/ai-fields/read/route.ts` exports GET; imports registrations barrel (side-effect); calls `getField(fieldId).read(context)`; uses RLS session client; returns 404 for unknown fields |
| 2 | AFL-AI-02: AI write layer exists — low-stake auto-applies, high-stake/published-SOP goes to pending_approval; Accept/Reject inline at the field | VERIFIED | `gateWrite` in `approval.ts` implements the tiered gate; `applyAiWrite` is the single write path (calls gateWrite, never descriptor.write directly); `InlineProposalDiff.tsx` wires Accept onClick to `acceptProposal()` and Reject onClick to `rejectProposal()` with `router.refresh()` after each |
| 3 | AFL-AI-03: Unified registry — every field registers via `registerField` on a single module-level Map; no per-feature bespoke API; programmatically driveable (no React dependency) | VERIFIED | `registry.ts` is a plain `new Map<string, FieldDescriptor>()`; `registerField/getField/getAllFields` exported; no React import; ≥2 fields registered via `registrations/index.ts` barrel; read and write API routes both import the barrel as a side-effect |
| 4 | AFL-VER-01: Admin can edit a published SOP into a new version via edit-into-draft clone; publishing the draft supersedes the prior version | VERIFIED | `cloneSopAsDraft` in `versioning.ts`: auth guard, JWT role check, deep-copies sections + steps + sop_section_blocks + sop_images-by-reference, status sentinel (uploading→draft), cleanup-on-failure, never sets superseded_by on source. Versions page `handleClone` CALLS `cloneSopAsDraft(` and routes to builder. The existing publish path sets `superseded_by` |
| 5 | AFL-VER-02: Side-by-side version diff renders via diffBlockContent | VERIFIED | `diff/page.tsx` imports and calls `diffBlockContent(`; fetches both versions via `getSopVersionForDiff` (admin client for superseded visibility); diff computed client-side; search params `?a=&b=` wired |
| 6 | AFL-VER-03: Restore-as-new-version creates a new draft copying old content; history is append-only (no old row reactivated) | VERIFIED | `restoreVersionAsNew` delegates to `cloneSopAsDraft(oldVersionSopId)`; D-06 comment present; no `superseded_by: null` or `status: 'published'` on old row in function body. Versions page `handleRestore` CALLS `restoreVersionAsNew(`. `clone-restore.test.ts` asserts append-only invariant |
| 7 | AFL-VER-04: Workers see an "Updated" badge on the SOP card when a newer published version exists than their last completion | VERIFIED | `SopLibraryCard.tsx` renders `data-updated-badge="true"` element conditional on `hasNewerVersion` prop; `/sops/page.tsx` computes the flag from `published_at` vs worker's `sop_completions.submitted_at`; never hardcoded; badge derives from a real comparison prop |
| 8 | AFL-VER-05: Completing SOP records worker's roster name (roster_worker_id, org-validated) + recordSignature writes append-only sop_completion_signatures; completing IS the legal signature | VERIFIED | `submitCompletion` validates `rosterWorkerId` via `organisation_members` (same-org, Pitfall 4) before writing `roster_worker_id`; `worker_id` stays as `user.id` (kiosk uid, RLS key). `recordSignature` uses `createAdminClient()` + org-scope check + append-only insert into `sop_completion_signatures`. `CompletionDetailClient` calls `recordSignature(completionId, 'supervisor', rosterUserId)` on approval |
| 9 | D-11: Passwordless roster name-select kiosk login route exists; workers pick a name from the org roster; no password required | VERIFIED | `/login/kiosk/page.tsx` exists under `(auth)/`; imports and renders `RosterSelector`; redirects admin/safety_manager/supervisor away (T-23-06-02). `RosterSelector.tsx` fetches `/api/roster`, renders large tap-target name buttons, stores `roster_worker_id` in sessionStorage |

**Score:** 9/9 truths verified

### Requirement ID Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|-------------|--------|---------|
| AFL-AI-01 | 23-00, 23-02 | SATISFIED | GET /api/ai-fields/read route wired to getField(id).read(ctx) |
| AFL-AI-02 | 23-00, 23-04 | SATISFIED | gateWrite gate + applyAiWrite + acceptProposal + rejectProposal + InlineProposalDiff wired |
| AFL-AI-03 | 23-00, 23-02 | SATISFIED | Module-level Map registry + registerField/getField/getAllFields + registrations barrel + ≥2 real fields |
| AFL-AI-04 | 23-00 | REMOVED — product decision 2026-06-25; Cmd+K dropped from SOPstart entirely (d06066b). REQUIREMENTS.md updated with [-] marker | Not implemented by design |
| AFL-VER-01 | 23-00, 23-03, 23-05 | SATISFIED | cloneSopAsDraft deep-copies + versions page "Edit into new version" button calls it |
| AFL-VER-02 | 23-00, 23-05 | SATISFIED | diff/page.tsx with diffBlockContent client-side diff, admin client fetch |
| AFL-VER-03 | 23-00, 23-03, 23-05 | SATISFIED | restoreVersionAsNew (delegates to clone) + versions page "Restore" button + append-only unit test |
| AFL-VER-04 | 23-00, 23-05 | SATISFIED | SopLibraryCard data-updated-badge + sops/page.tsx published_at vs submitted_at computation |
| AFL-VER-05 | 23-00, 23-01, 23-06 | SATISFIED | submitCompletion roster attribution + recordSignature + CompletionDetailClient supervisor counter-sign |
| D-11 | 23-00, 23-06 | SATISFIED | /login/kiosk route + RosterSelector + /api/roster endpoint |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---------|---------|--------|---------|
| `supabase/migrations/00038_phase23_schema.sql` | roster_worker_id + sop_completion_signatures + ai_field_proposals | VERIFIED | All three schema additions confirmed in file; recursion-safe RLS (no cross-table sops/sop_completions join in policies); migration 00038 LIVE on Supabase per phase context |
| `src/types/database.types.ts` | sop_completion_signatures, ai_field_proposals, roster_worker_id | VERIFIED | All three identifiers present in database.types.ts |
| `src/lib/ai-fields/registry.ts` | registerField, getField, getAllFields, FieldDescriptor, WriteResult | VERIFIED | Module-level Map; idempotent re-registration guard; BACKEND-ONLY header comment; v5.0-consumable note |
| `src/lib/validators/ai-fields.ts` | AiWriteRequestSchema, FieldContextSchema, ProposalStatusSchema, StakeLevelSchema, AcceptProposalSchema, RejectProposalSchema | VERIFIED | All 6 schemas exported |
| `src/lib/ai-fields/approval.ts` | gateWrite, isHighStakeContext, AdminInsertFn | VERIFIED | A6 fail-safe on ambiguous sopId; high-stake path NEVER calls descriptor.write(); injectable seam for unit testing |
| `src/lib/ai-fields/registrations/index.ts` | ≥2 real fields (sop.title low-stake, sop.section.title high-stake); each write calls an @/actions server action | VERIFIED | sop.title (low, calls updateSopTitle from @/actions/sops) + sop.section.title (high, calls updateSectionTitle from @/actions/sections) registered |
| `src/app/api/ai-fields/read/route.ts` | GET; side-effect import registrations barrel; getField; RLS session client | VERIFIED | All criteria met |
| `src/app/api/ai-fields/write/route.ts` | POST; imports registrations barrel; resolves sopIsPublished from DB; delegates to applyAiWrite | VERIFIED | gateWrite is single write path; sopIsPublished resolved from sop.status before delegation |
| `src/actions/ai-fields.ts` | applyAiWrite, acceptProposal, rejectProposal | VERIFIED | CR-01 fixed (applyAiWrite looks up sop.status independently, never trusts client sopIsPublished). WR-06 fixed (rejectProposal checks for 0-rows-updated). WR-04 (sopIsPublished not in reconstructed acceptProposal fieldContext) — documented warning, lower-confidence, latent risk only |
| `src/actions/versioning.ts` | cloneSopAsDraft, restoreVersionAsNew, computeNextVersionLineage, getSopVersionForDiff | VERIFIED | WR-02 (section id map by index, not sort_order) and WR-03 (step id map by index) both fixed. WR-07 (uploadNewVersion JWT org assertion) fixed |
| `src/components/ai-fields/InlineProposalDiff.tsx` | Accept + Reject handlers wired, router.refresh(), data-inline-proposal-diff | VERIFIED | Both handlers call server actions; data-inline-proposal-diff on root |
| `src/app/(protected)/admin/sops/[sopId]/versions/diff/page.tsx` | diffBlockContent; admin client; searchParams ?a= ?b= | VERIFIED | All criteria met |
| `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` | Edit-into-new-version (cloneSopAsDraft), Restore (restoreVersionAsNew), Compare → diff; existing Upload retained | VERIFIED | All three affordances wired with real handlers |
| `src/components/sop/SopLibraryCard.tsx` | data-updated-badge; derived from comparison prop; not hardcoded | VERIFIED | Badge conditional on hasNewerVersion prop computed from published_at vs submitted_at |
| `src/app/(auth)/login/kiosk/page.tsx` | Under (auth)/; renders RosterSelector; redirects admin/safety_manager away | VERIFIED |
| `src/components/auth/RosterSelector.tsx` | Fetches /api/roster; large tap-target buttons; sessionStorage for roster_worker_id | VERIFIED |
| `src/app/api/roster/route.ts` | Paginated listUsers (CR-03 fix); org-scoped via JWT; returns display names | VERIFIED | CR-03 fixed (paginated while loop until total reached) |
| `src/lib/supabase/jwt.ts` | parseJwtPayload with Base64URL → Base64 conversion | VERIFIED | CR-02 fixed; all Phase-23 callsites in ai-fields.ts, completions.ts, versioning.ts, sops.ts, sections.ts, roster/route.ts use parseJwtPayload |
| `src/lib/journeys/journeys.ts` | /login/kiosk + /admin/sops/[sopId]/versions/diff mapped | VERIFIED | Both routes confirmed in journeys.ts |
| `src/lib/uat/tests.ts` | ≥3 Phase-23 UAT entries | VERIFIED | p23-roster-kiosk-login, p23-inline-ai-proposal, p23-updated-since-badge all present |
| `src/lib/builder/__tests__/clone-restore.test.ts` | lineage continuation + append-only source-contract | VERIFIED |
| `src/lib/ai-fields/__tests__/registry.test.ts` | round-trip, idempotent, read, getAllFields | VERIFIED |
| `src/lib/ai-fields/__tests__/approval.test.ts` | 5 gate behaviors with injectable seams | VERIFIED |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| read/route.ts | registry.ts | `import '@/lib/ai-fields/registrations'` side-effect + `getField(fieldId)` | WIRED | Registry populated before request; getField resolves descriptor |
| write/route.ts | approval.ts gateWrite | delegates to applyAiWrite → gateWrite() | WIRED | gateWrite is the single write path; route never calls descriptor.write directly |
| approval.ts | ai_field_proposals | createAdminClient insert with org-scope check | WIRED | defaultAdminInsert writes to ai_field_proposals; self-enforced org-scope |
| InlineProposalDiff.tsx | ai-fields.ts | acceptProposal() / rejectProposal() onClick | WIRED | Both handlers invoke server actions; router.refresh() after each |
| versions/page.tsx | versioning.ts | cloneSopAsDraft( / restoreVersionAsNew( onClick | WIRED | handleClone calls cloneSopAsDraft; handleRestore calls restoreVersionAsNew |
| diff/page.tsx | diff-block-content.ts | diffBlockContent( call | WIRED | Computed client-side; no DB call in diff loop |
| SopLibraryCard.tsx | sop.published_at vs last completion | hasNewerVersion prop from sops/page.tsx query | WIRED | Prop derived from sop_completions query; never hardcoded |
| completions.ts submitCompletion | sop_completions.roster_worker_id | org-membership validation + admin client write | WIRED | rosterWorkerId validated via organisation_members before writing |
| completions.ts recordSignature | sop_completion_signatures | createAdminClient append-only insert + org-scope | WIRED | Service-role write; append-only (no UPDATE/DELETE policy) |
| CompletionDetailClient.tsx | recordSignature | recordSignature( in handleApprove | WIRED | Supervisor counter-sign bound to roster identity; WR-05 fixed (fallback uses currentUserId, not workerId) |
| kiosk/page.tsx | RosterSelector | import + render RosterSelector | WIRED |
| RosterSelector.tsx | /api/roster | fetch('/api/roster') | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---------|-------------|--------|------------------|--------|
| SopLibraryCard.tsx | hasNewerVersion | sops/page.tsx: sop_completions query (RLS-scoped, TanStack Query) + sops.published_at comparison | Yes — real DB query per SOP per worker | FLOWING |
| diff/page.tsx | sopA / sopB | getSopVersionForDiff (admin client, sop_sections query) | Yes — real versioned SOP data from DB | FLOWING |
| versions/page.tsx | versions list | getVersionHistory (session client, sops lineage query) | Yes — real SOP version history | FLOWING |
| InlineProposalDiff.tsx | proposal (AiFieldProposal) | Parent server component fetches pending proposals from ai_field_proposals | Prop-driven; real data when parent queries the table | FLOWING (prop from server component) |
| RosterSelector.tsx | workers (roster list) | /api/roster → organisation_members + listUsers pagination | Yes — real org members | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for live-UAT items. Static checks confirm all wiring.

| Behavior | Command | Result | Status |
|---------|--------|--------|--------|
| phase23-stubs discoverable | `npx playwright test --list --project=phase23-stubs` | 4 spec files, 36 tests — per 23-07 SUMMARY | PASS |
| phase23-unit discoverable | `npx playwright test --list --project=phase23-unit` | 2 test files, 13 tests — per 23-07 SUMMARY | PASS |
| phase23-stubs all pass | `npx playwright test --project=phase23-stubs` | 35 passed, 1 skipped (AFL-VER-05 runtime DB insert, expected) — per 23-07 SUMMARY | PASS |
| phase23-unit all pass | `npx playwright test --project=phase23-unit` | 13 passed — per 23-07 SUMMARY | PASS |
| tsc --noEmit | `npx tsc --noEmit` | Clean — per 23-07 SUMMARY | PASS |
| Bundle delta | `npx tsx scripts/check-bundle-size.ts` | 1054 KB, delta 0 KB — phase-23 additions are server/API-only — per 23-07 SUMMARY | PASS |
| Full suite | `npm run test` | 489 passed, 28 failed (all pre-existing in phase3/11/12.5/15/20/21 stubs, none in phase23) — per 23-07 SUMMARY | PASS (no regressions) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared for this phase. N/A.

### Requirements Coverage

All requirements accounted for:

| Requirement | Status | Notes |
|-------------|--------|-------|
| AFL-AI-01 | SATISFIED | GET read API; getField() wired |
| AFL-AI-02 | SATISFIED | gateWrite gate; write API; accept/reject actions; InlineProposalDiff |
| AFL-AI-03 | SATISFIED | Unified Map registry; registerField/getField/getAllFields |
| AFL-AI-04 | REMOVED (product decision) | Cmd+K dropped from SOPstart 2026-06-25; REQUIREMENTS.md updated with [-] marker |
| AFL-VER-01 | SATISFIED | cloneSopAsDraft + versions page button |
| AFL-VER-02 | SATISFIED | diff/page.tsx + diffBlockContent |
| AFL-VER-03 | SATISFIED | restoreVersionAsNew + append-only unit test |
| AFL-VER-04 | SATISFIED | SopLibraryCard badge + sops/page computation |
| AFL-VER-05 | SATISFIED (code) / NEEDS HUMAN (live RLS) | roster_worker_id + recordSignature + sign-off chain |
| D-11 | SATISFIED (code) / NEEDS HUMAN (live device) | /login/kiosk + RosterSelector |

### Anti-Patterns Found

Code-review findings were addressed in the review-fix pass. Status per finding:

| Finding | Severity | Status |
|---------|---------|--------|
| CR-01: applyAiWrite trusted client sopIsPublished | Critical | FIXED — applyAiWrite independently looks up sop.status when sopId present |
| CR-02: raw atob across 10+ new Phase-23 callsites | Critical | FIXED — parseJwtPayload helper in jwt.ts; all Phase-23 callsites migrated. Pre-Phase-23 callsites (auth.ts, blocks.ts, etc.) still use raw atob — this is a pre-existing issue outside Phase-23 scope |
| CR-03: listUsers perPage:1000 silently drops workers | Critical | FIXED — paginated while loop in /api/roster until total reached |
| CR-04: signOffCompletion org-scope missing for safety_manager | Critical | FIXED — explicit completion.organisation_id !== organisationId guard before role branch |
| WR-02: section ID map by sort_order (duplicate collision) | Warning | FIXED — index-based matching |
| WR-03: step ID map by (section_id, step_number) (duplicate collision) | Warning | FIXED — index-based matching within section group |
| WR-05: supervisor roster id fallback used workerId (worker's uid) | Warning | FIXED — fallback uses currentUserId (supervisor's own user.id) |
| WR-06: rejectProposal no 0-rows-updated detection | Warning | FIXED — .select('id') + empty check |
| WR-07: uploadNewVersion derived org from SOP row, not JWT | Warning | FIXED — explicit JWT org assertion added |
| WR-01: write() has no enforced auth contract | Warning | DOCUMENTED — JSDoc added to descriptors; acceptable as architectural warning |
| WR-04: acceptProposal reconstructed fieldContext missing sopIsPublished | Warning | REMAINS — latent risk if a future descriptor.write() branches on sopIsPublished; no immediate behavioral impact since acceptProposal validates sop_version and applies through the existing server action. Documented as known risk |
| WR-08: diff page aligns sections by array index (false-positive on reorder) | Warning | REMAINS — documented; index alignment is a known limitation for reordered/removed sections |
| WR-09: org query param accepted but server ignores it | Warning | REMAINS — display-only per SUMMARY decision |
| IN-01 through IN-07 | Info | Accepted/documented |

### Human Verification Required

Three plan checkpoints (23-05 Task 4, 23-06 Task 4, 23-07 Task 4) were deferred from code-complete to live-UAT. The code is committed and pushed to master; Railway auto-deploys. Human verification is the only outstanding gate.

#### 1. Version Supersede Flows — sopstart.com

**Test:** As admin on sopstart.com:
1. Open a published SOP → Versions → click "Edit into new version"
2. Confirm you land in the builder with a NEW draft that is a content copy of the published SOP
3. Publish the draft → confirm the prior version shows "Superseded" in version history
4. Versions page → click "Compare" between two versions → confirm side-by-side diff highlights changed blocks/sections
5. Click "Restore as new version" on an older version → confirm a NEW draft is created; the old version row is NOT reactivated or rewritten

**Expected:** All flows complete; superseded_by is set only on publish (not on clone); restored draft appears in builder ready to edit; history is append-only.

**Why human:** Requires live Supabase + real SOP data + round-trip through the publish path.

#### 2. Roster Kiosk Login + Sign-off Chain + RLS Isolation — sopstart.com

**Test:**
1. One-time setup: create kiosk account per org (create auth.users `kiosk+{org}@safestart.internal`, add to organisation_members role=worker, sign the device in)
2. Open `/login/kiosk?org=<code>` — confirm org roster shows and a worker name can be selected (no password)
3. Complete an SOP as that worker → in Supabase confirm sop_completions.roster_worker_id = selected worker, worker_id = kiosk account uid, and a worker sop_completion_signatures row exists
4. As supervisor: open the completion in Activity → approve → confirm a supervisor sop_completion_signatures row is recorded
5. Confirm the kiosk device sees ONLY this org's SOPs and cannot reach admin-only surfaces (role='worker' enforced)

**Expected:** Roster login works; sign-off chain is fully attributed; RLS isolation holds.

**Why human:** Requires real device with kiosk session, live Supabase insert verification for sop_completion_signatures, and end-to-end RLS observable only in the live product.

#### 3. Phase Sign-off Smoke — /pathways, /uat, AI-field backbone

**Test:**
1. Open `/pathways` → confirm "All screens" shows 0 not-mapped for `/login/kiosk` and `/admin/sops/[sopId]/versions/diff`
2. Open `/uat` → confirm 3 Phase-23 entries render (kiosk login, inline AI proposal, updated-since badge)
3. As an authenticated admin: call `GET /api/ai-fields/read?fieldId=sop.title&sopId=<uuid>` → confirm returns the current SOP title value (org-scoped, not an error)
4. Confirm NO user-facing AI command surface exists anywhere in the app (D-04 backbone-only; Cmd+K stays removed)

**Expected:** /pathways shows 0 not-mapped; /uat entries render; read API returns real data; no command palette.

**Why human:** /pathways + /uat require browser rendering; read-API smoke requires an authenticated live session; D-04 enforcement requires a live browse.

#### 4. Updated-Since Badge Timing

**Test:**
1. As a worker: complete an SOP (note the SOP id)
2. As admin: publish a new version of that SOP
3. As the same worker: return to `/sops` library
4. Confirm the "Updated" badge appears on that SOP's card

**Expected:** Badge appears; does not appear on SOPs the worker has never completed or where their completion is newer than the published version.

**Why human:** Cross-session timing — worker completion and admin publish across different sessions; observable only in the live product.

---

### Gaps Summary

No code-level gaps found. All must-haves are verified in the codebase. The `human_needed` status reflects three deferred live-UAT checkpoints from plans 23-05, 23-06, and 23-07 — the code is complete, committed, and deployed; only live device/session confirmation is outstanding.

**Remaining documented-but-accepted deviations (not actionable gaps):**
- WR-04: `acceptProposal` fieldContext missing `sopIsPublished` — latent risk; no immediate impact
- WR-08: diff page section alignment by array index — known limitation for reordered sections
- WR-09: `org` query param accepted but server derives org from JWT — display-only, not a functional gap
- CR-02 pre-existing: raw `atob` in pre-Phase-23 actions (auth.ts, blocks.ts, etc.) — outside Phase-23 scope; the Phase-23 fix helper `jwt.ts` exists and is available for future migration

---

_Verified: 2026-06-26_
_Verifier: Claude (gsd-verifier)_
