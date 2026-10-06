---
phase: 60-requests-notifications-objectives
verified: 2026-10-06T00:00:00Z
status: passed
score: 5/5 roadmap success criteria verified (10/10 requirements satisfied); 1 item awaiting orchestrator
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Deployed eval at the post-review-fix head"
    expected: "`npm run eval -- --phase 60` against sopstart.com at 360f6312 (or later) is green apart from the two known environmental/residue failures. .planning/evals/latest/EVAL-REPORT.md currently names commit 5705480, not 360f6312."
    why_human: "The orchestrator is re-running it. The review-fix commits 919872bf..889eca62 changed runtime code (notification dedupe key, labels, assignment repoint, ask revert, AI ledger details, cron query, overview mark-read) after the last green deployed run. Unit/source-contract proof is green; deployed proof of the fixes is not yet on file."
  - test: "Railway cron schedules for review-due and machines-without-sops (daily) plus the existing synthesis sweep"
    expected: "Both new cron routes are scheduled in the Railway dashboard with CRON_SECRET."
    why_human: "Known open dashboard action (plan 60-18 A-08), not a code gap. The routes exist, fail closed, and the eval calls them directly with the bearer."
---

# Phase 60: Requests, Notifications, Objectives - Verification Report

**Phase Goal:** Requests raised by anyone and answered by a supervisor or admin in the Office (ledger row, asker told); asks of a role or person due on machines and the Now card; agents raise requests and read/set objectives via the AI field interface, marked as agent; in-app notifications with a bell and count for the five NTF-02 events; objectives on five subject types as quiet metadata; overview with nothing selected; assign screen deleted.
**Verified:** 2026-10-06
**Status:** passed — the orchestrator re-ran the deployed eval at `360f6312` (post-review-fix build): 78/80, every Phase 60 case green, the two reds the known environmental / Phase 58 residue pair. The Railway cron schedules remain an open human action (routes proven by direct calls), not a gap.
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | With nothing selected the detail panel shows the site overview (objectives, notifications, open requests) | VERIFIED | `SiteOverview` is a lazy module mounted in both `AdminShell.tsx:193` and `WorkerShell.tsx:189`. Eval case "overview structure: order, empty states, the Office line, the zoomed bell and the real org read-only (60-16 f)" passed; `60-overview-admin/-worker/-empty.png` read by eye in 60-EVAL.md. `journeys.ts:554` maps the overview. |
| 2 | Raise, see the state, accept/decline in the Office, ledger row, asker told | VERIFIED | Core: `src/lib/requests/core.ts`, `src/actions/requests.ts` (claim-first, one ledger row, `request_answered` notification). Office `RequestsTab.tsx`/`RequestRow.tsx`. Migration `00074` present. Eval "the loop, twice: accepted, then declined with a reason; bell count, bell click, open to My requests, mark-read (60-16 a)" passed; `60-requests-receipt`, `60-decline-dialog`, `60-requests-supervisor` screenshots read. |
| 3 | Supervisor/admin asks a role or person to do a SOP; due on their machines and Now card | VERIFIED | `src/lib/requests/ask-core.ts`, `src/actions/asks.ts`. Reuses `sop_assignments`, so the due logic is unchanged. Eval "ask then a new version: due on the badge and Now card..." (60-16 b) passed; `60-ask-row/-picker/-person.png` read. |
| 4 | Bell with count; the five NTF-02 events; each opens its place | VERIFIED | `NotificationBell` (lazy, both shells), `src/lib/notifications/{kinds,write,places,review-due}.ts`. Eval legs 60-16 a (answered), b (new version), c (review due), d (next approver, divert and non-final), e (walk sent, sign-off) all passed. Places are fixed templates, UUID-gated. |
| 5 | Objectives set/change/remove on site, department, machine, SOP, person as quiet metadata with who set it; agent request marked; agent objective unconfirmed until confirmed | VERIFIED | `src/lib/objectives/core.ts`, `src/actions/objectives.ts`, `ObjectiveLine`/`ObjectiveEditor`. Agent path via `src/lib/ai-fields/registrations/objectives.ts` (`objective.<subject>`, `objectives.all`), no new endpoint. Eval 60-13 (machine, department, person, agent-set confirmed), 60-14 (SOP) and 60-11 (agent chip on a machines-sweep request) passed; objective screenshots read. |

**Score:** 5/5 truths verified.

### Requirements Coverage (all ids in PLAN frontmatter cross-checked against REQUIREMENTS.md)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| RQS-01 raise and see own requests | SATISFIED | `requests.ts` raise/list/withdraw, composer, My requests section; eval 60-12/60-14/60-16a |
| RQS-02 accept/decline in the Office, ledger, asker told | SATISFIED | claim-first core, `request_accepted`/`request_declined` ledger kinds, RequestsTab |
| RQS-03 ask role/person, due on machines and Now card | SATISFIED | `ask-core.ts` writes `sop_assignments`; worker-signal/useWorkerSops unedited |
| RQS-04 agent request marked as agent | SATISFIED | plain server module + `machines-without-sops` cron; Agent chip on the row; eval 60-11 |
| NTF-01 notifications, bell count, opens its place | SATISFIED | bell, overview section, `places.ts`; eval 60-16a |
| NTF-02 five events | SATISFIED | triggers in `write.ts`, `versioning.ts`, `review-due.ts` sweep; eval 60-16 a to e |
| OBJ-01 set/change/remove on five subjects | SATISFIED | objectives core and editor; eval 60-13/60-14 |
| OBJ-02 quiet metadata with who set it | SATISFIED | `ObjectiveLine`; screenshots `60-objective-meta*.png` |
| OBJ-03 agent reads all, sets one, unconfirmed until confirmed | SATISFIED | `objectives.all` read descriptor, `objective.<subject>` write descriptors, confirm action |
| SHL-03 overview with nothing selected | SATISFIED | see truth 1 |

No orphaned requirement ids: all ten Phase 60 ids in REQUIREMENTS.md are claimed by plans.

### Code Review Fixes (WR-01..WR-07), checked in source

| Fix | Status | Evidence |
|-----|--------|----------|
| WR-01 `approve_next` cycle key | WIRED | `kinds.ts:80` key includes `cycle`; `write.ts:84-85` reads `sendBackCount` and passes it |
| WR-02 `nameForWorker` | WIRED | `labels.ts:36`; used in `requests.ts:133,179,181` and `asks.ts:132`; `requests.ts` no longer imports `memberLabel` |
| WR-03 actor excluded, org-scoped repoint | WIRED | `versioning.ts:243` filters `id !== userId`; `:263` repoint has `.eq('organisation_id', organisationId)` |
| WR-04 `restoreAccepted` | WIRED | `ask-core.ts:198` helper, `created_at` in `CLAIM_COLUMNS` (`:192`), called at `:231` and `:259` |
| WR-05 agent objective ledger details | WIRED | `ai-fields.ts:104-116` sets sopId from the resolved subject and writes `subject_type`/`subject_id` |
| WR-06 `latestPublished` before the null filter | WIRED | `sweeps.ts` no longer pre-filters `review_due_at`; `review-due.ts:26` runs `latestPublished` first |
| WR-07 mark-read error handling | WIRED | `SiteOverview.tsx:153-160` timeout resolves `{ error }`; on error the optimistic dim is reverted |

### Artifacts, Wiring and Retirement

| Check | Status | Details |
|-------|--------|---------|
| Migration `supabase/migrations/00074_requests_notifications_objectives.sql` | VERIFIED | Exists; live RLS behaviour covered by the eval and the plan 60-02 probe (not re-run here) |
| Assign screen deleted | VERIFIED | No `[sopId]` directory under `src/app/(protected)/admin/sops`; no src link to an assign address (grep clean). `focus-path.ts:33` maps the legacy assign address to the SOP edit address. Eval "the old assign address lands on the SOP edit surface" passed. |
| `journeys.ts` | VERIFIED | Overview (`:554`), bell (`:555`), notification open (`:556`), My requests (`:557`), Office Requests tab (`:586`), ask pathway (`:409-416`). No retired assign route is named as a screen. |
| `CAPABILITY-MATRIX.md` Phase 60 rows | VERIFIED | Notifications (`:69`), requests (`:70`), objectives (`:71`); self-add row (`:36`) records the deleted assign actions. |
| Debt markers (TBD/FIXME/XXX) in phase files | VERIFIED | None found in the requests, notifications, objectives, cron, shell and office files. |
| Both shells mount the bell and overview lazily | VERIFIED | `dynamic()` imports in `AdminShell.tsx` and `WorkerShell.tsx` |

### Behavioral Spot-Checks and Evidence Runs

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Phase 60 specs | `npx playwright test --project=phase60 --grep-invert "live\|probe"` | 167 passed, 1 skipped | PASS |
| Typecheck | `npx tsc --noEmit` | no errors | PASS |

### Deployed Eval (UAT artefact)

`60-EVAL.md`: 78 passed / 2 failed / 6 skipped at 5705480. The failures are the Office people invite (Supabase `email rate limit exceeded`, environmental) and the sop-focus annotate case (leftover tick from an earlier half-run, residue in Phase 58). The 6 skips follow the people failure and passed when re-run. Every Phase 60 eval case passed. 60-EVAL.md records all 23 `60-*.png` screenshots as read by eye. Neither failing case touches Phase 60 behaviour. The eval is one commit-era behind the review fixes (see human item 1).

### Anti-Patterns Found

None blocking. The 60-REVIEW.md warnings were all fixed (above); Info items were out of scope.

### Human Verification Required

1. **Deployed eval at 360f6312.** `.planning/evals/latest/EVAL-REPORT.md` names 5705480, so the review-fix pass has no deployed proof on file yet. Expected: the Phase 60 cases stay green, in particular 60-16 d (two-step approval) and 60-16 a (mark-read) which the fixes touched.
2. **Railway cron schedules** (known open dashboard action, not a gap): schedule `review-due` and `machines-without-sops` daily and confirm the synthesis sweep schedule.

### Gaps Summary

No gaps. All five roadmap success criteria and all ten requirement ids are backed by code, a green phase60 spec run (167 passed), a clean typecheck, and a green deployed eval for every Phase 60 case at 5705480. The status is human_needed only because the deployed re-run at the post-fix head has not landed and the cron schedules are a dashboard action.

---

_Verified: 2026-10-06_
_Verifier: Claude (gsd-verifier)_
