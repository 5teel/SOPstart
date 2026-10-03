---
phase: 55-cut-the-dropped-features-one-organisation
plan: 14
subsystem: testing
tags: [playwright, deployed-eval, uat, service-worker, not-found]
requires:
  - phase: 55-13
    provides: final code state, moved-down bundle baseline
provides:
  - complete tests/evals/cut-features.eval.ts (6 tests, 0 fixme)
  - 55-EVAL.md deployed UAT artefact (28 passed, 0 failed, 1 pre-existing skip)
  - 55-VALIDATION.md signed off (nyquist_compliant true)
affects: [gsd-verify-work, phase-56]
tech-stack:
  added: []
  patterns:
    - "signed-in visits to /login* redirect home, so dead-address checks for auth routes run signed out"
key-files:
  created:
    - .planning/phases/55-cut-the-dropped-features-one-organisation/55-EVAL.md
  modified:
    - tests/evals/cut-features.eval.ts
    - src/app/(protected)/admin/sops/new/ai/page.tsx
    - src/app/(protected)/admin/sops/new/page.tsx
    - .planning/phases/55-cut-the-dropped-features-one-organisation/55-VALIDATION.md
key-decisions:
  - "Existing-completion eval falls back to the newest real-org completion because the real org has zero completion_photos rows"
  - "Final eval run used --no-wait: Railway had not rolled ffd0cc4 after 15 min, but ffd0cc4 differs from the live 04d493a only in the eval file (5 lines)"
requirements-completed: [CUT-01, CUT-02, ORG-01]
duration: ~1h (mostly Railway build waits)
completed: 2026-10-03
---

# Phase 55 Plan 14: Deployed Eval Summary

**The five Phase 55 success criteria are proven on sopstart.com: 28 evals passed, 0 failed, 1 skipped (Phase 52 no-site test, pre-existing), every Phase 55 screenshot read.**

## Tasks and commits

| Task | Commit | What |
|------|--------|------|
| 1 | d095b1d | Authored the four remaining cut-features eval tests (0 `test.fixme`, no `status()`) |
| 2 (fix) | afd968b | Product copy fix found by the eval |
| 2 (eval) | 04d493a, ffd0cc4 | Existing-completion fallback; `/login/roster` checked signed out |


## Deployed result

- `npm run eval -- --phase 55`: **28 passed / 0 failed / 1 skipped**, report at `55-EVAL.md`. Eval-site fixtures re-provisioned first; walk fixture SOP has 0 `sop_completions` after the run (verified).
- Run 1 at d095b1d: 26 passed / 1 failed. Run 2 at 04d493a: 27 passed / 1 failed. Run 3 (no-wait) at ffd0cc4: all green.
- **`/sw.js` post-deploy check (55-09 deferred):** `curl https://sopstart.com/sw.js` returns HTTP 200, `application/javascript`, 834 bytes, body begins "Kill-switch. Replaces the retired offline (Serwist) service worker." It is the self-unregistering script, not login HTML. The eval also asserts the signed-out body contains `unregister()` and no `<html`, and that a signed-in worker has 0 service-worker registrations.

## Deviations from Plan

**1. [Rule 1 - Bug] Leftover voice copy on the AI draft entry.** The eval failed on `/admin/sops/new/ai`: the subtitle still read "Type a brief or talk it through" and the method picker said "talk it through with an AI interviewer", though voice drafting was cut in 55-05. Reworded both to typed-brief only. Files: `src/app/(protected)/admin/sops/new/ai/page.tsx`, `src/app/(protected)/admin/sops/new/page.tsx`.

**2. [Rule 1 - Eval bug] `/login/roster` asserted while signed in.** Middleware redirects a signed-in visit to any `/login*` path home, so the not-found text never showed. Moved the check to the signed-out sign-up test.

**3. [Rule 3 - Eval robustness] No real-org completion has a photo.** The real SOPstart org has zero `completion_photos` rows, so the plan's "completion with its photo" would always skip. The test now opens the newest real-org completion (read-only), asserts it renders and is not the not-found page, and additionally checks the photo `naturalWidth` only when a photo completion exists. Criterion 5's photo half therefore rests on the walk test (photo uploads, shows on the sign-off page with `naturalWidth > 0`), not on legacy data.

**4. Deploy wait.** The runner's 15-minute wait timed out once because Railway had not rolled ffd0cc4; the live SHA was 04d493a, whose product code is identical (ffd0cc4 only touches the eval file). Final run used `--no-wait`.

## Screenshots read (`.planning/evals/latest/`)

- `cut-worker-plant.png` - plant scene with a pin "1" on a machine, "Next for you: Eval plant fixture SOP" card with Walk it / Show me; no install banner, no mic in the ask bar. Clean.
- `cut-walk-phone.png` - 390px "Completion submitted", Re-read steps / Start another walkthrough; nothing queued. Clean.
- `cut-walk-signoff.png` - admin Completion Detail: "1 photo submitted", step 2 shows the photo thumbnail (dark red 1x1 test image), Approve / Reject. Clean.
- `cut-builder-tools.png` - Tools menu has Assign, See earlier versions, Pick machines, Change category only. No video/QR/flow items. (The walk fixture shows "Nothing here yet" in the builder canvas because it has steps but no layout_data; fixture quirk, not a Phase 55 regression.)
- `cut-upload.png` - Upload file and Record video tabs, Browse files / Browse video; no YouTube or photo scan.
- `cut-new-ai.png` - "Draft a SOP with AI", subtitle now "Type a brief - you review the draft in the builder before publish."; typed prompt only, setup modal over it.
- `cut-versions.png` - Version History with Upload New Version and "Edit into new version"; no Compare/Restore.
- `cut-not-found.png` - "This page has moved or no longer exists." card (last dead address checked).
- `cut-sign-up.png` - "SOPstart is by invitation / Ask your admin to invite you", Log in and invite-code links, no inputs.
- `cut-login.png` - email/password form, "Ask your admin for an invitation", Join with invite code; no Register link.
- `cut-profile.png` - Account, Observations, Your training, Sign out; no Organisations list.
- `cut-existing-sop.png` - OTG Probe Maintenance reads fully (4 job chips, safety requirements).
- `cut-existing-completion.png` - real-org OTG completion detail renders steps with Approve / Reject.
- Other-phase screenshots (plant-home*, governance*, admin-*, site-*, sop-*, worker-*, access-wiring-only, builder-machines) were produced by passing sibling evals; the cut-features set above is what this phase changes.

Nothing visually wrong beyond the fixture note above.

## Known Stubs

None.

## Threat Flags

None. Real-org access in the eval is read-only; cleanup still goes through `deleteEvalCompletions`, which refuses the real org.

## Self-Check: PASSED

- `tests/evals/cut-features.eval.ts`: 6 tests, 0 `test.fixme`, no `response.status()`; tsc clean.
- `55-EVAL.md` exists (0 failed); `55-VALIDATION.md` has `nyquist_compliant: true`.
