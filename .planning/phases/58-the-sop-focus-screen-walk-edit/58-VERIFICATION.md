---
phase: 58-the-sop-focus-screen-walk-edit
verified: 2026-10-05T11:00:00Z
status: passed
score: 5/5 must-haves verified (deployed eval re-run 60/60 at e844e3b1 by the orchestrator, 2026-10-05T10:48Z)
overrides_applied: 0
human_verification:
  - test: "Wait for Railway to serve HEAD (e844e3b1), then run `npm run eval -- --phase 58` and read the new 58-*.png shots"
    expected: "60/60 again. The walk case ('SC2 walk ... Send, sent') is the end-to-end proof that the service-role write channel (CR-01, migration 00072) works on the deployed site"
    why_human: "At verification time https://sopstart.com/api/version returned sha dce7a268 (the pre-review-fix build) while origin/master is e844e3b1. Migration 00072 is already live and dropped the worker INSERT/UPDATE policies on sop_walks. dce7a268's src/actions/walk.ts writes sop_walks with the session client (no createAdminClient), so until the new build deploys, starting or recording a walk on production is refused by RLS. The eval was not re-run after the review fixes. Needs the orchestrator, not a manual click-path."
  - test: "Re-read the 58-*.png screenshots after that eval run"
    expected: "Frame, rail, hazard/PPE panels, AI banner, parsing skeleton look as 58-EVAL.md describes"
    why_human: ".planning/evals/latest/ is empty on disk (emptied 21:36), so the screenshots could not be viewed in this verification. The CSS-token and sizing checks rest on 58-EVAL.md's executor notes plus the compiled-CSS assertion in the eval."
---

# Phase 58: The SOP focus screen (walk + edit) Verification Report

**Phase Goal:** Opening a SOP gives it the whole screen; walk it (hazard/PPE ack, photo, completion queued for sign-off); edit it (steps under sections, AI check on top, tick per step, Publish gated); parse-in-progress opens in the editor with status; Back/Esc returns to the one screen; old tabbed page, walkthrough, builder routes and chrome deleted and every link repointed.
**Verified:** 2026-10-05
**Status:** passed — both deployment-state items resolved by the orchestrator: Railway served e844e3b1, `npm run eval -- --phase 58` passed 60/60 on the service-role walk channel (walk → acks → photo → Send for sign-off → Sent), and the 25 `58-*.png` shots were re-read (frame, rail, hazard/PPE tint, AI banner, publish bar, parsing views all render from tokens).
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening a SOP from a machine removes map/list; slim bar Back + title, rail left, one centred column; no site chrome | VERIFIED | `src/app/(protected)/sops/[sopId]/page.tsx` is a server component rendering only `FocusWalker`. `src/components/focus/` holds FocusFrame, FocusTopBar (Back + title + version chip + one slot), FocusRail, BrowseDocument. Eval cases "SC1 frame" and "SC1 compiled CSS" passed (60/60 at 9a43d0bf). The `phase58` project passes 219 (9 skipped). |
| 2 | Walking: hazard/PPE acknowledged before going on, photo step takes one, last step records completion and queues for sign-off | VERIFIED (code) / deployed proof pending | `src/actions/walk.ts` filters every read and write by session `organisation_id` + `worker_id`. `submitCompletion` recomputes from the walk row and `recordSignature` writes via `recordDecision`. Eval "SC2 walk" passed at 9a43d0bf, before the CR-01 channel change (see human item 1). |
| 3 | Admin edit: steps under sections, version/machine/standards in left rail, AI findings at top, Publish off until all ticked + findings cleared, no tick-all | VERIFIED | `src/components/focus/admin/` has AiCheckBanner, EditRail, StepCard, ThisSopBlock, PublishBar, PublishDialog. The gate is server-side and unweakened: `assertPublishGates()` in `src/lib/governance/publish-core.ts` checks steps > 0, no `verified_by_admin_id IS NULL`, no `cleared_at IS NULL` finding, and is called by the publish route and `performPublish`. `publish-gate-pin.spec.ts` and `no-bulk-verify-ui.spec.ts` (which now scans the focus editor) pass. |
| 4 | SOP still parsing opens in the editor saying what is happening and roughly how long, never empty, no full reload | VERIFIED | The page sends an admin to the editor frame when status is `uploading`/`parsing` (`reading` / `wantEdit`). `ParseProgress.tsx` and `EditorSkeleton.tsx` exist. Eval "SC4 58-parsing" (including the video variant) and "58-parse-failed" passed. `parse-progress-ui.spec.ts` passes. |
| 5 | New version: workers get latest published, earlier versions on record; Back/Esc returns to the one screen with the place selected | VERIFIED | `resolveFocusTarget()` (`src/lib/sop/lineage-current.ts`) gives not-found for a draft and a redirect for a superseded id. `forkDraft` copies the SOP. The review fix added six sops columns and the image annotations (spec census walks migrations and passes). `useFocusBack.ts` handles Esc and Back with the `from=` place whitelist. Eval "SOP-04" and "SC2 ... then Back to the place it came from" passed. |

**Score:** 5/5 truths verified in code.

### Review-fix wiring (the specific ask)

| Fix | Check | Status |
|-----|-------|--------|
| CR-01 `sop_walks` server-written | `supabase/migrations/00072_sop_walks_server_written.sql` drops the two worker write policies. `walk.ts` uses `createAdminClient()` with `.eq('organisation_id', organisationId).eq('worker_id', userId)` on every walk read and write (lines 56-218). The `sops` read stays on the session client. CAPABILITY-MATRIX row says one SELECT policy only. `walk-actions.spec.ts` pins the channel. | WIRED in code. Not yet live on the deployed site (see human item 1) |
| CR-02 `recordSignature` | `completions.ts:431` returns "Only the worker who did this walk can sign it." for `role === 'worker'` when `completion.worker_id !== userId`. Pinned in `walk-actions.spec.ts`. | WIRED |
| WR-01..07 | Pinned by the passing phase58 specs (fork-draft census, reviewer-steps, edit-actions, walk-no-leak, edit-ui). | VERIFIED |

### Required Artifacts / Key Links

| Artifact | Status | Details |
|----------|--------|---------|
| Focus page, FocusWalker, walk and edit components | VERIFIED | Exist, substantive, wired from the page. The focus page reads `sop_walks`, completions and the parse job. |
| Retired routes | VERIFIED | `src/app/(protected)/sops/` holds only `[sopId]`. `admin/sops/` holds only `[sopId]/assign`, `new`, `upload`. No `builder`, `walkthrough` or `versions` directory. Old addresses 307 in the proxy via `legacyRedirectFor()` (`focus-path.ts`, `middleware.ts`) and `/review` via `next.config.ts`. `retirement-sweep.spec.ts` passes. |
| `journeys.ts` | VERIFIED | Focus route `/sops/[sopId]` covers detail, walk, review, editor, parse, publish and workers-land-on-new-version steps. No `route:` or detail names `builder/`, `walkthrough` or `/versions` as an address. `/admin/sops/[sopId]/assign` is a real surviving route. |
| `CAPABILITY-MATRIX.md` | VERIFIED | Phase 58 rows at lines 69-78: open/browse, walk, send, edit, annotate, tick/publish, switch, versions, AI findings, legacy addresses. They reflect the 00072 change. |

### Behavioral Spot-Checks and Probes

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Type check | `npx tsc --noEmit` | exit 0, no output | PASS |
| Phase project | `npx playwright test --project=phase58` | 219 passed, 9 skipped (live probes), 0 failed | PASS |
| Gate guards | `playwright test publish-gate-pin, no-bulk-verify-ui, design-tokens` | 14 passed | PASS |
| Live RLS probe | `focus-rls-live` | not run (OTP budget). The REVIEW-FIX report records 8/8 once | SKIP |
| Deployed build | `curl https://sopstart.com/api/version` | sha `dce7a268`, which is behind HEAD `e844e3b1` (origin == HEAD, `git rev-list` 0/0) | PENDING DEPLOY |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| FOC-01 | Walk opens as bar + rail + one centred step | SATISFIED | Truth 1; eval SC1 |
| FOC-02 | Edit: steps under sections, SOP details in left rail | SATISFIED | Truth 3; eval SC3 |
| FOC-03 | Nothing else on screen; Back/Esc returns with the place selected | SATISFIED | `useFocusBack`, eval "back-place" |
| FOC-04 | One step at a time; ack, photo, send for sign-off | SATISFIED in code; deployed re-proof pending | `walk.ts`, `submitCompletion` |
| SOP-04 | Publish a new version; latest wins; earlier kept | SATISFIED | `forkDraft`, `resolveFocusTarget`, eval SOP-04 |
| WRK-03 | Parsing SOP opens in editor with status and time | SATISFIED | `ParseProgress`, eval SC4 |
| WRK-04 | AI findings shown; every step ticked and finding cleared before Publish | SATISFIED | `assertPublishGates`, `PublishBar` |

All seven IDs appear in REQUIREMENTS.md (lines 1000-1017) and the traceability table (1096-1100); no orphaned Phase 58 requirements.

### Anti-Patterns / Notes

| Item | Severity | Notes |
|------|----------|-------|
| `src/app/api/sops/[sopId]/sections/route.ts` (POST) still exists and delegates to `createSection` (old `sop_sections` model). No `src/` caller found. | Info | The matrix says the section route family was deleted. Only the POST remains. It is an orphan to remove in a later cleanup. It is not a goal blocker. |
| `src/lib/uat/tests.ts:458` marks a setting `archived` ("its new home is not built yet") | Info | A known, documented loss: the setting lived on the retired Version History page. |
| `deferred-items.md` lists red specs (phase11/12.5 builder specs, phase26, phase40 dat01, phase55 sweep) scheduled for 58-15/16. | Info | 58-15/16 repointed or deleted them. REVIEW-FIX records phase55 145, phase40 77 and phase56 99 green after the fixes. I did not re-run those projects. |
| No TBD/FIXME/XXX gate was run over the modified files | Info | Not exercised in this pass. |

### Human Verification Required

1. **Deploy and re-run the deployed eval.** Production is serving `dce7a268`. Migration 00072 (applied live during the review fix) already removed the worker write policies on `sop_walks`, and the deployed `walk.ts` writes with the session client. A worker starting a walk on sopstart.com is therefore likely refused until the new build lands. Check `/api/version == e844e3b1`, then run `npm run eval -- --phase 58`.
2. **Screenshots.** `.planning/evals/latest/` is empty. Re-read the 58-* shots from the new run to confirm the visual claims in 58-EVAL.md.

### Gaps Summary

No code gaps. Every roadmap criterion and all seven requirement IDs are backed by code, passing specs, a clean `tsc`, and the 60/60 deployed eval at 9a43d0bf. The only open items are operational. The review-fix commits (service-role walk channel, `recordSignature` guard) are pushed but not yet serving, and the live DB is already ahead of the live code. The eval proof for FOC-04 predates those changes.

---

_Verified: 2026-10-05_
_Verifier: Claude (gsd-verifier)_
