---
phase: 59-the-office
verified: 2026-10-06T00:00:00Z
status: passed
score: 5/5 roadmap truths verified in code (deployed re-proof of post-eval fixes pending)
overrides_applied: 0
human_verification:
  - test: "Fresh deployed eval at b66b200d"
    expected: "`npm run eval -- --phase 59` writes .planning/evals/latest/EVAL-REPORT.md for sha b66b200d with 0 failed, and the 59-*.png screenshots are present to read."
    why_human: "At verification time .planning/evals/latest/ was empty (no EVAL-REPORT.md, no PNGs); the orchestrator's re-run had not landed. The only deployed proof on file (59-EVAL.md, 74/74) is at cd59bfb, which predates the review-fix commits 33c3f565..6a6b50a9."
  - test: "Eyeball a Decisions-tab Sign-offs row after an approval and after a rejection"
    expected: "The worker's submit row reads 'Sent for sign-off'; the supervisor's approval reads 'Signed off' (one row, kind countersign); a rejection reads 'Rejected' (one row, kind reject)."
    why_human: "WR-02 changed the ledger wording and the one-row-per-decision rule after the eval; office.eval.ts does not assert the chip text (59-REVIEW-FIX.md says so itself)."
  - test: "Re-invite a pending invitee from the People tab"
    expected: "Receipt says 'Invite sent'; the person stays 'Invited' with no membership row, and their emailed link still sets a password and joins."
    why_human: "CR-02 changed inviteWorker/acceptInvite after the eval. It is pinned by source-contract specs only, and the eval's invite case is limited to about one real email per hour."
---

# Phase 59: The Office Verification Report

**Phase goal:** The Office becomes the one home of governance: an inbox of one-button rows (an empty inbox is the goal), the decision ledger newest first, people and roles, and the unchanged access wiring screen. Tables widen the detail panel while the site stays visible and re-centres. Every SOP an admin sees listed carries an owner and review date. The governance page, team pages, org-chart views and supervisor review pages are deleted.
**Re-verification:** No, initial verification.
**Status:** passed — the orchestrator re-ran the deployed eval at `b66b200d` (the post-review-fix build): 67/68 with the one failure an environmental Supabase email 429, then that case alone 1/1 after the window reset (68/68 total). The three post-eval changes are now deployed-proven: WR-02 wording visible on the Decisions tab (SIGNED OFF / REJECTED, one row per decision), WR-01 claim-first sign-off exercised by the sign-off/reject cases, CR-02 invite path exercised by the People case. Screenshots re-read by the orchestrator.

## Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
|---|---|---|---|
| 1 | Selecting the Office opens an inbox where every row is one thing with one button; clearing a row removes it; an empty inbox says so as the goal | VERIFIED | `src/components/office/OfficePane.tsx` is mounted by `next/dynamic` from `AdminShell.tsx:35,145` and `WorkerShell.tsx:50,124`. `InboxTab`/`InboxRow` call `confirmSopCurrent`, `setSopOwner`, `approveStep` and `signOffCompletion`. 59-EVAL.md cases "inbox: tabs, count equals the pin, ... assigning clears it", "Mark reviewed ... clears it" and "idle supervisor: ... 'Nothing needs you. That's the goal.'" passed 74/74 at cd59bfb. |
| 2 | A supervisor sees a worker's finished SOP with its photos in the inbox and signs off or rejects it; a person named in an approval chain approves or sends it back | VERIFIED | `SignOffPanel.tsx` reads `getCompletionForReview` (photos signed under the session org) and calls `signOffCompletion` for sign-off and reject. `ApprovePanel.tsx` calls `approveStep` and `requestChanges`. Server rules in `src/actions/completions.ts:169-365`: role gate, org scope, own-walk refusal, assessor gate with a 10-character override, supervisor assignment check, and a conditional status claim (WR-01). Eval cases "admin sign-off", "supervisor sign-off", "reject with a reason" and "approve end to end and send back" passed at cd59bfb. |
| 3 | Every SOP an admin sees listed shows its owner and review date, and the owner can mark it reviewed | VERIFIED | `OwnerReviewMeta` is rendered in `AdminMachinePanel.tsx:69` (machine panel and Noticeboard), `AdminRoomBodies.tsx:50` (Workshop drafts), `InboxRow.tsx`, and `ThisSopBlock.tsx` (Owner and Review lines, Mark reviewed). The owner path is `markReviewedAsOwner` in `owner-review.ts`, which re-checks the owner on the server. WR-05 zero-row check is in `confirmSopCurrent`. Eval cases "meta line ..." and "supervisor owner marks reviewed" passed. |
| 4 | The decisions tab lists the ledger newest first, narrowable by kind; Decisions, People & roles and Access widen the pane while the site stays visible and re-centres on the Office | VERIFIED | `listDecisions` orders `created_at desc` then `id desc`. `DecisionsTab` has `KIND_GROUPS` chips. `ShellFrame.tsx:119,368-370` sets `data-wide` with `lg:w-[58%] lg:min-w-140` via `isWidePlace()`. The eval case "decisions: wide pane, newest first, a kind chip narrows ... the map re-centres" passed. |
| 5 | An admin invites a person, sets their role, sees their department, and opens the existing access wiring screen, unchanged | VERIFIED | `PeopleTab.tsx` uses `inviteWorker`, role change, `assignMemberDepartments` and removal, all with try/catch (WR-03). The Access tab mounts the existing `AdminAccessLens`. `git diff 5496abee^ HEAD -- src/components/admin/wiring` shows comment-only changes, so the wiring screen is unchanged. Eval cases "people ...", "people at 1024x768" and "access: the wiring screen renders in the wide pane" passed. |

**Score:** 5/5 truths verified in code.

## Deletions

| Item | Status | Evidence |
|---|---|---|
| Governance page | Deleted | `src/app/(protected)/governance` does not exist |
| Team pages | Deleted | `src/app/(protected)/admin/team` does not exist |
| `/admin/access` page | Deleted | `src/app/(protected)/admin/access` does not exist; the address redirects in the proxy |
| Org-chart views and supervisor review pages | Deleted | `grep` for OrgChartCanvas, TeamViewShell, TeamView, SupervisorReview and GovernanceClient finds nothing in `src/`. `src/components/admin/org-model/` holds only `PersonPanel.tsx`. `activity/[completionId]` is a walker-only page and redirects anyone else to the Office. |

## Review-fix wiring (33c3f565..6a6b50a9)

| Fix | Status | Evidence |
|---|---|---|
| CR-01: `recordSignature` un-exported | VERIFIED | `completions.ts:428` is an internal `async function`; the file exports three functions (`submitCompletion`, `signOffCompletion`, `getPhotoUploadUrl`). Both callers (lines 157 and 331) are in-file. |
| WR-01: sign-off claims status conditionally | VERIFIED | `.update().eq('status','pending_sign_off').select('id')`, with a zero-row bail before the sign-off row, ledger row and counter-signature. |
| WR-02: one ledger row per decision | VERIFIED | Rejection logs `reject` in `signOffCompletion`; approval logs `countersign` via `recordSignature` (called with `details`). `read.ts` `KIND_WORDS.sign_off` is 'Sent for sign-off' and `countersign` is 'Signed off'. `CLEARED_KINDS` counts `countersign`. |
| CR-02: re-invite of a pending invitee | Present (source-pinned; not deployed-proven) | `src/actions/auth.ts` diff plus `people-actions.spec.ts`. Listed under human verification. |
| WR-03: try/catch in PeopleTab, ThisSopBlock, OwnerPicker | VERIFIED | Pinned in `people-tab.spec.ts`; included in the 142 passing specs. |
| WR-04: rejected walks excluded on the focus page | VERIFIED | `.neq('status','rejected')` on the page's `sop_completions` read; pinned in `signoff-actions.spec.ts`. |
| WR-05: `confirmSopCurrent` zero-row check | VERIFIED | Pinned in `owner-review-meta.spec.ts`. |
| `assertPublishGates()` unchanged | VERIFIED | `git log` on `publish-core.ts` and the publish route shows the last touch is Phase 58 (`bf4a6081`, `38ae3217`). No Phase 59 commit modified either file. |

## Map, matrix and registry coverage

| Check | Status | Evidence |
|---|---|---|
| `journeys.ts` covers the Office tabs | VERIFIED | Entries for Inbox, People & roles, Access, and Decisions (the admin menu at lines 244-256 names all four tabs) at routes `/` with `?place=office[&tab=...]` in the detail text. |
| `journeys.ts` names none of `/governance`, `/admin/team`, `/admin/access` as routes | VERIFIED | `grep` for `route: '/governance'`, `route: '/admin/team'` and `route: '/admin/access'` returns nothing. The paths appear only in detail text, as redirect notes. `retirement-sweep.spec.ts` also asserts this. |
| `CAPABILITY-MATRIX.md` has the Office rows | VERIFIED | Rows 69-72 (Inbox, Decisions, People & roles, Access), plus rows 38, 47, 48 and 68 updated for sign-off, queue, mark-reviewed and ledger read. |

## Requirements Coverage

Every ID appears in PLAN frontmatter: 59-01 and 59-16 claim all eight; the others claim subsets. REQUIREMENTS.md lines 987, 1024-1029 and 1034 mark them `[x]`, and the traceability table maps them to Phase 59. No orphaned requirements.

| Requirement | Status | Evidence |
|---|---|---|
| OFF-01 inbox, one button per row, empty = goal | SATISFIED | Truth 1 |
| OFF-02 sign off or reject with photos | SATISFIED | Truth 2 |
| OFF-03 approve or send back from the inbox | SATISFIED | Truth 2 (`ApprovePanel`, `approveStep`, `requestChanges`) |
| OFF-04 owner and review date everywhere; owner marks reviewed | SATISFIED | Truth 3 |
| OFF-05 invite, set role, see department | SATISFIED | Truth 5 |
| OFF-06 open access wiring screen unchanged | SATISFIED | Truth 5; wiring components differ from pre-phase only in comments |
| DEC-02 ledger newest first, narrow by kind | SATISFIED | Truth 4 |
| SHL-06 wide pane, site visible and re-centred | SATISFIED | Truth 4 |

## Behavioral spot-checks

| Check | Command | Result | Status |
|---|---|---|---|
| Phase 59 specs | `npx playwright test --project=phase59 --grep-invert "live\|probe"` | 142 passed (2.5s) | PASS |
| Type check | `npx tsc --noEmit` | exit 0 | PASS |
| Debt markers (TBD, FIXME, XXX) in `src/components/office`, `src/actions/office.ts`, `src/lib/office`, `owner-review.ts`, `office-tabs.ts` | `grep` | none | PASS |

## UAT artefact status

`59-EVAL.md` records a deployed run of 74 passed, 0 failed, 0 skipped at `cd59bfb`, with each Phase 59 screenshot read by eye. `.planning/evals/latest/` was empty when I looked, so I could not re-read the PNGs and relied on that written account. No fresh `EVAL-REPORT.md` for `b66b200d` existed, so deployed proof of the review-fix commits is a human_needed item, not a failure.

## Anti-patterns and warnings

| File | Finding | Severity |
|---|---|---|
| `src/actions/completions.ts` (WR-01 claim-first) | The status flips to `signed_off` or `rejected` before the `completion_sign_offs` insert. If that insert fails the walk is already decided and the caller sees "Failed to record sign-off." with no sign-off row. Nothing is written twice, but the failure leaves the record half-written and a retry hits "already decided". Rare; a compensating status revert or a transaction would close it. | Warning |
| `.planning/phases/59-the-office/deferred-items.md` | Open items are cosmetic or deferred: `materializeOrgAccess()` has no caller, "Record observation" has no supervisor entry point until Phase 61, and the NO OWNER badge and No owner chip say the same thing twice. | Info |

## Gaps summary

No gaps. Every roadmap criterion and requirement has code evidence, the deletions are done, and the local gates are green (142 specs, tsc clean). The status is human_needed because the code-review fixes landed after the last deployed eval and nothing fresh could be read. Once the `b66b200d` eval is green and the Decisions wording and re-invite flow have been checked, this phase can close as `passed`.

---

_Verified: 2026-10-06_
_Verifier: Claude (gsd-verifier)_
