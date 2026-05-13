---
status: partial
phase: 15-manufacturing-line-mode
source: [15-00-SUMMARY.md, 15-01-SUMMARY.md, 15-02-SUMMARY.md, 15-03-SUMMARY.md, 15-04-SUMMARY.md]
started: 2026-05-13T08:10:34+10:00
updated: 2026-05-13T19:00:00+10:00
paused_at: 2026-05-13T19:00:00+10:00
environment: production (https://sopstart.com — Railway deploy of master HEAD 4c72f58)
---

## Session Summary — 2026-05-13

Phase 15 went live on production this session. UAT formally covered Test 1 (smoke) and surfaced enough live-site issues that the rest of the session was inline polish + bug-fix rather than ticking through Tests 2-15. The shipped code is markedly different from the head we started UAT against (`ba68931` → `4c72f58`), so Tests 2-14 should be re-considered against the current build.

### Inline fixes shipped during UAT (in order)

| Commit | What |
|---|---|
| `6e785d9` | Walkthrough post-completion review mode — "Re-read steps" button preserves ack trace; "Start another walkthrough" still resets |
| `a98dd57` | Flow tab clickable nodes (initial: modal) |
| `fc4e74d` | Flow tab redesigned to inline expanding card list (no modal) per Simon feedback |
| `36f16de` | Walkthrough ack-next perf: optimistic Zustand + fire-and-forget Dexie + `active:scale[0.97]` tap feedback |
| `3b541b6` | Walkthrough perf root-cause: replaced `router.push('?step=…')` with local state + `history.replaceState` to avoid RSC fetch |
| `4977fe1` | DB hotfix 00031 — broke RLS recursion between sops ↔ sops_sub_trades policies from migration 00030 |
| `f4f7195` | PageShell primitive + walkthrough CSS-grid named regions + step cross-fade animation |
| `3271212` | RouteTransition — fade-up on every protected/auth route change |
| `e7b9364` | Dropped walkthrough body placeholder card; pinned "follow as written" hint above action bar |
| `fa8192c` / `84d1744` | CLAUDE.md learnings recorded for both bugs |
| `4c72f58` | Backlog 999.3 — security hardening pass (CSP / HSTS / frame-ancestors) |

### Tests covered

| # | Test | Result |
|---|---|---|
| 1 | Production Deploy Smoke Test | issue → SW no-response on `/admin/sops/new/ai`; pre-existing Phase 14 route, NOT a Phase 15 regression. Recommended SW reset; not blocking. |
| 2-14 | Walkthrough/voice/sub-trade/bundle tests | not formally exercised — but a lot of the walkthrough surface was touched and re-tested informally as the polish work landed |
| 15 | Post-completion re-read | added during session; not formally verified |

### Recommended next session

1. SW reset on Simon's browser to confirm Test 1 was a stale SW (or escalate to a real bug).
2. Re-run Tests 2-15 against current HEAD (`4c72f58`) — the walkthrough big-text layout, ack gate, voice modal, sub-trade RLS, bundle gate, ack-trace persistence are all unchanged at the contract level, but the UI shell + page transitions changed significantly.
3. The Visy demo prep flow in `15-DEMO-PREP.md` still hasn't been driven end-to-end — that's the Bryce-readiness blocker.

## Current Test

number: 2
name: Desktop Walkthrough Big-Text Layout (SB-LINE-01)
expected: |
  At https://sopstart.com on a viewport ≥1024px, opening a SOP walkthrough renders the DesktopWalkthrough layout — body text ≥24px, single step per viewport, primary "I've done this — Next" button is ≥60px tall and full-width. Visually distinct from the existing mobile immersive card.
awaiting: user response

## Tests

### 1. Production Deploy Smoke Test
expected: Railway has built and deployed master HEAD `ba68931` to https://sopstart.com. Migration 00030 applied to production Supabase (`npx supabase db push --include-all` against the linked project). Open https://sopstart.com/sops as a logged-in worker — SOP list renders, no console errors, page paints within ~3s.
result: issue
reported: "Drafting a SOP from a prompt at /admin/sops/new/ai triggers a service-worker error: `sw.js: Uncaught (in promise) no-response :: [{\"url\":\"https://sopstart.com/admin/sops/new/ai\"}]`. The FetchEvent for the page was rejected by the SW."
severity: major
diagnosis: |
  Server-side healthy (curl confirms 307 → /login from railway-edge). Error is client-side Serwist returning no-response on the navigation. Phase 15 did NOT modify sw.ts, the /admin/sops/new/ai page, PromptClient.tsx, or the /api/sops/ai-prompt route — this is a pre-existing route added in Phase 14 (commit 4108704). Same bug family as the April fix `5a325e6 fix(ux): ... fix SW navigation error` which disabled navigationPreload. Most likely a stale service worker cached in the browser from a prior deploy.
remediation_to_try: |
  Before treating this as a real bug, clear the service worker:
  1. DevTools → Application → Service Workers → Unregister for sopstart.com
  2. Application → Storage → Clear site data
  3. Hard reload (Ctrl+Shift+R)
  4. Re-try the AI draft flow at /admin/sops/new/ai
  If it still fails after SW reset, this is a real production bug and warrants a separate gap-closure phase (not Phase 15 scope).

### 2. Desktop Walkthrough Big-Text Layout (SB-LINE-01)
expected: At https://sopstart.com on a viewport ≥1024px, opening a SOP walkthrough renders the DesktopWalkthrough layout — body text ≥24px, single step per viewport, primary "I've done this — Next" button is ≥60px tall and full-width. Visually distinct from the existing mobile immersive card.
result: [pending]

### 3. Mobile Walkthrough No-Regression
expected: At https://sopstart.com on a viewport <1024px (e.g. iPhone 390×844 or DevTools mobile emulation), the walkthrough renders byte-identically to the Phase 12.5 immersive step card — same photo capture, sticky action bar, Prev/Next, SafetyAcknowledgement gate, view-mode toggle. The only behavioural change is the primary CTA now reads "I've done this — Next" instead of "Mark step N complete".
result: [pending]

### 4. Sequential Ack Gate + Deep-Link Bypass (SB-LINE-02)
expected: On the live walkthrough, clicking Next without acknowledging the current step is impossible (button disabled or no-op). Manually editing the URL to `?step=N+2` when only step N has been acknowledged redirects via `router.replace` to step N+1 — workers cannot skip ahead.
result: [pending]

### 5. Voice Mic-Pill + Modal Shell
expected: A floating mic-pill button is fixed at the bottom-right of the walkthrough surface on both mobile and desktop on sopstart.com. Tapping it opens `WalkthroughVoiceModal` with three visible states (idle / recording / answering). Modal can be closed without submitting.
result: [pending]

### 6. Voice Q&A Positive — PPE (SB-LINE-03)
expected: After seeding the Visy ENF4-03-031 SOP into production (via `tests/fixtures/visy-enf4-03-031.sql` against the linked project), asking "what PPE do I need" returns an answer that cites the Hazards section and mentions heat-resistant gloves. Citations are visible in the modal. Response arrives within ~5 seconds.
result: [pending]

### 7. Voice Q&A Adversarial — Grounded Uncertainty
expected: In the same Visy SOP on sopstart.com, asking "can I use leather gloves instead?" returns an "I'm not certain" / grounded-uncertainty response — NOT a confident "yes" or fabricated answer. The verifier_flags surface a warning if the model attempted an ungrounded recommendation.
result: [pending]

### 8. Voice Grounding Scope — Cross-SOP Isolation (SB-LINE-04)
expected: Asking a question whose answer lives only in a DIFFERENT SOP (e.g. ask a fitter SOP a question about a sparky-only procedure) returns "I can't find that in this procedure" or equivalent grounded-uncertainty. The route does NOT cross-search the corpus.
result: [pending]

### 9. Sub-Trade Worker Assignment (SB-LINE-05a)
expected: As an admin at https://sopstart.com/admin/team, the SubTradePicker lets you assign sub-trade tags (e.g. `['fitter', 'sparky']`) to a worker. The assignment persists in `users_sub_trades` and is visible on next page load. The 5 seed slugs (operator/fitter/sparky/maintainer/other) are selectable.
result: [pending]

### 10. Sub-Trade SOP Tagging (SB-LINE-05b)
expected: As an admin at https://sopstart.com/admin/sops/[sopId]/assign, the SubTradePicker lets you assign a SOP to one or more sub-trades (e.g. `fitter`). The assignment persists in `sops_sub_trades` and is visible on next load.
result: [pending]

### 11. Sub-Trade RLS Visibility Gate (SB-LINE-05c)
expected: A worker tagged `fitter` sees the fitter-tagged SOP in https://sopstart.com/sops. A worker tagged only `sparky` does NOT see the fitter-tagged SOP. Verified via two separate logged-in sessions (different browsers / incognito windows).
result: [pending]

### 12. Backward-Compat — Untagged SOPs Visible to All
expected: A SOP with NO `sops_sub_trades` rows (e.g. any Phase 1-14 SOP not yet tagged) is visible to ALL workers regardless of their sub-trade on sopstart.com. No Phase 1-14 worker loses access.
result: [pending]

### 13. Bundle Size Gate (SB-LINE-06)
expected: Either the Railway deploy log shows the postbuild bundle gate passed during build, OR running `npx tsx scripts/check-bundle-size.ts` locally against the same committed source confirms Δ within ±2KB of the 1095 KB rebaselined `.bundle-baseline.json` and both `DesktopWalkthrough` + `WalkthroughVoiceModal` are present as separate chunks. (Network tab on the live site can confirm chunk isolation — opening a mobile SOP should NOT fetch the DesktopWalkthrough chunk.)
result: [pending]

### 14. step_ack_trace Persistence (D-21)
expected: After completing a walkthrough of a 3-step SOP on sopstart.com, running `select step_ack_trace from sop_completions order by submitted_at desc limit 1;` against production Supabase returns a JSONB array with 3 entries, each shaped `{stepId, timestamp}`. Timestamps are in chronological order.
result: [pending]

### 15. Post-Completion Re-Read Mode
expected: After submitting a completion on sopstart.com, the success screen shows TWO buttons: "Re-read steps" (returns to step 1 in review mode — banner reads "Already submitted — re-reading", Prev/Next nav works freely with no ack gate) and "Start another walkthrough" (resets state, re-prompts safety acknowledgement, starts a fresh walkthrough). Both desktop and mobile layouts behave the same way. Fixed in commit `6e785d9` after Simon flagged it during Test 2.
result: [pending]

## Summary

total: 15
passed: 0
issues: 1
pending: 14
skipped: 0
blocked: 0

## Gaps

- truth: "AI draft flow at /admin/sops/new/ai loads without service-worker errors"
  status: failed
  reason: "User reported: Drafting a SOP from a prompt generates a no-response error from sw.js. Pre-existing route from Phase 14 — not Phase 15 scope. Likely stale SW; try unregister + clear-site-data + hard-reload before treating as a real bug."
  severity: major
  test: 1
  phase_origin: 14
  artifacts: [src/app/sw.ts, src/app/(protected)/admin/sops/new/ai/PromptClient.tsx]
  missing: []
