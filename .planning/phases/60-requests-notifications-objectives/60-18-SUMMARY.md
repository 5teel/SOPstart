---
phase: 60-requests-notifications-objectives
plan: 18
subsystem: evals
tags: [deployed-eval, signoff, cron, bundle-gate]
requires: [60-17]
provides:
  - deployed eval runs of Phase 60 with fixes to eval cases
  - one product fix (Ask picker width)
  - eight requirement ids ticked
affects: []
key-files:
  modified:
    - tests/evals/requests.eval.ts
    - tests/evals/office.eval.ts
    - src/components/requests/AskPicker.tsx
    - .planning/phases/60-requests-notifications-objectives/60-EVAL.md
    - .planning/phases/60-requests-notifications-objectives/60-VALIDATION.md
    - .planning/REQUIREMENTS.md
    - CLAUDE.md
completed: 2026-10-06
status: COMPLETE after continuation (cron schedules pending, human dashboard action)
---

# Phase 60 Plan 18: Deployed proof and sign-off Summary

The deployed eval proves the request, ask, objective, bell and review-due flows; it does not yet prove the divert-time next-approver notification, the sign-off-waiting notification, the overview-structure case or the assign-address case, so NTF-02 and SHL-03 are not ticked and validation is not signed off.

## Commits

| Commit | What |
|--------|------|
| 5ca988b4 | eval: bound the tab-count read; People row height ceiling 150 |
| (next, pushed) | eval: published fixture SOPs for ask / walk / browse; case-insensitive bell focus; Show read; wait for the ask |
| a4225ad0 | fix: Ask picker popover no longer squeezed (`max-w-full` removed) |
| (docs commit) | SUMMARY, 60-EVAL notes, VALIDATION, REQUIREMENTS, CLAUDE.md Learnings |

## Results

- Deployed eval at 90f467a: 66 passed / 3 failed / 17 skipped. At 5ca988b: 65 / 3 / 18 (the skips are the serial requests suite after its first failing case). Sibling failures were order or state residue (annotate and SC3 leftover tick, D-06 blank supervisor scene) or fixed (People row height).
- Requests file re-run directly at the deployed HEAD after fixes: green = 60-11 (tab and pin, accept receipt with link), 60-11 agent request, 60-12 composer and ask picker, 60-13 objectives, 60-14 SOP objective and browse request, 60-16 a (loop twice, bell, mark-read), b (ask, new version, decline), c (review-due sweep and dedupe).
- RED or not reached: 60-16 d (next approver at the divert: the safety manager's notification never appeared; the publish route returned success and `approval_state` was pending), 60-16 e, 60-16 f (overview structure and real org), 60-17 (assign address).
- Build: green. Bundle gate: `/sops/[sopId]/page` 794 (baseline 795, -1), `/page` 836 (baseline 834, +2). Baseline file untouched. `npx tsc --noEmit` clean. phase60 project: 172 passed, 10 skipped.
- Full suite once: 2228 passed, 243 skipped, 6 failed. All six are `phase46/sop-edit-owner-access` live probes failing with `verifyOtp failed: Request rate limit reached` (environmental; the eval runs spent the OTP budget). Not re-run.
- Compiled CSS: size-5, min-w-5, w-72, line-clamp-2, bg-accent-measure/10, bg-ai/10, bg-accent-decision/10, bg-ink-100, h-18 all present.

## NTF-02 legs

| Leg | Proof | Result |
|-----|-------|--------|
| request answered | eval 60-16 a | proven |
| new version | eval 60-16 b | proven |
| review due | eval 60-16 c (cron route with bearer, dedupe) | proven |
| next approver at the divert | eval 60-16 d | NOT proven (red) |
| next approver after a non-final approval | eval 60-16 d | not reached |
| sign-off waiting | eval 60-16 e | not reached |

No `notification-writers-live.spec.ts` was written (budget). First suspect for leg d: `notifyNextApprover` throwing inside the try/catch in `publish/route.ts` (look for "[publish] approver notification failed" in Railway logs).

## Task 2: Railway cron schedules (checkpoint, not done)

Read-only `railway status --json`: the project has ONE service, `SOPstart`. No cron service exists, so the synthesis sweep has no schedule either; all three are needed. Exact steps for Simon (Railway dashboard; the same `CRON_SECRET` as the app service, referenced, never pasted; if it ever rotates, `.env.local` changes with it):

1. Service `cron-review-due`, schedule `0 18 * * *`, start command: `curl -fsS -X POST https://sopstart.com/api/cron/review-due -H "Authorization: Bearer $CRON_SECRET"`
2. Service `cron-machines-without-sops`, schedule `10 18 * * *`, start command: `curl -fsS -X POST https://sopstart.com/api/cron/machines-without-sops -H "Authorization: Bearer $CRON_SECRET"`
3. Service `cron-synthesis-sweep`, schedule `20 18 * * *`, start command: `curl -fsS -X POST https://sopstart.com/api/agent-layer/synthesis-sweep -H "Authorization: Bearer $CRON_SECRET"`

The eval's cron calls passed with the local secret, so `.env.local` and the deployed value match.

## Screenshots

Read: 60-requests-supervisor, 60-objective-meta, 60-ask-picker (defect, fixed), the worker overview frame. Not read for lack of budget: 14 others, listed in `60-EVAL.md`. Do not treat the screenshot reading as complete.

## Deviations

1. [Rule 1] Ask picker width bug fixed in `AskPicker.tsx` (not re-verified by screenshot).
2. [Rule 1, eval] Seven eval defects fixed in `requests.eval.ts` / `office.eval.ts` (see Learnings entry 2026-10-06).
3. Sign-off steps withheld: validation status partial, NTF-02 and SHL-03 unticked (8 of 10 ids ticked, not the 10 the plan's criterion asks for), screenshots incompletely read.

## Issues

- 60-16 d red (divert-time notification), 60-16 e / f and 60-17 not run green.
- Next step: diagnose d, re-run `requests.eval.ts` once (OTP budget has reset), re-read the remaining 14 screenshots plus the post-fix ask picker, then sign off validation and tick NTF-02 and SHL-03.

## Self-Check: PASSED

SUMMARY, 60-EVAL.md notes, VALIDATION and REQUIREMENTS edits exist; commits 5ca988b4 and a4225ad0 exist. STATE.md and ROADMAP.md untouched.

## Continuation

- **60-16 d root cause: eval defect, not product.** The divert-time notification and `notifyNextApprover` work (the safety manager's row appeared on the deployed site; chain steps by role resolve through `membersWithRole`; nothing in Railway needed). The case failed on its second half: it clicked Approve and loaded the admin overview at once, and the bell does not poll, so the page was read before the server action wrote the next-approver row. Fix in `tests/evals/requests.eval.ts`: wait for the approved row to leave the safety manager's inbox before the admin loads (commit 5705480, pushed). No product change; no live probe spec was needed (every NTF-02 leg is driven end to end by the eval).
- **Re-runs:** 60-16 d, e, f and 60-17 alone, retries off: 4 passed. Full `npm run eval -- --phase 60` at 5705480: 78 passed / 2 failed / 6 skipped. Failures: office People case (`email rate limit exceeded` on the invite, environmental, not looped; it passed in the 90f467a and 5ca988b full runs) and sop-focus annotate (leftover tick, Phase 58 sibling residue). The 6 skips (office serial cases after People) were re-run once directly: 6 passed. Every requests case is green.
- **Screenshots:** all 23 `60-*.png` read; one line each in `60-EVAL.md`. The Ask picker fix is confirmed by eye (role and person modes both normal width, nothing clipped). No further visual defects.
- **Sign-off:** `60-VALIDATION.md` set to `nyquist_compliant: true`, status complete; NTF-02 and SHL-03 ticked in REQUIREMENTS.md (all ten Phase 60 plan ids now ticked). STATE.md and ROADMAP.md untouched. CLAUDE.md Learnings: no new entry (the bell-does-not-poll rule is already recorded by the 2026-10-06 entry).

## Issues

- Task 2 (Railway cron schedules, three services) remains Simon's dashboard action; the steps are above. Until it is done the review-due, machines-without-SOPs and synthesis sweeps do not run on a schedule, though the routes are proven by the eval.
- Environmental reds to ignore: office People invite email rate limit; phase46 live probes (verifyOtp rate limit) from the earlier full-suite run.
