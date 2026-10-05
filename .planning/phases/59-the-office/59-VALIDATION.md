---
phase: 59
slug: the-office
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-05
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Filled by 59-01; signed off by 59-16.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58.2 (source-contract + pure-module specs; deployed evals) |
| **Config file** | `playwright.config.ts` (project `phase59`, deliberately broad `tests/phase59/**`) |
| **Quick run command** | `npx playwright test --project=phase59` |
| **Full suite command** | `npx tsc --noEmit` then `npm run build` (bundle gate) then `npx playwright test --project=phase54 --project=phase56 --project=phase57 --project=phase58 --project=phase59 --project=phase15-stubs --project=phase41 --project=phase30 --project=phase28 --project=phase29 --project=phase32 --project=phase37` once, then `npm run eval -- --phase 59` once after push |
| **Registration check** | `npx playwright test --list --project=phase59` (a spec outside a project regex never runs, CLAUDE.md 2026-05-25) |
| **Estimated runtime** | ~2 s quick run; full suite is the phase gate, run once |

Live-DB probes (`PHASE56_LIVE=1`, `PHASE59_LIVE=1`, phase33/34/35/37/46/51) share one Supabase OTP budget: run them once, never in a loop (CLAUDE.md 2026-09-28).

---

## Sampling Rate

- **After every task commit:** `npx playwright test --project=phase59` (plus `npx tsc --noEmit` for any `src/` change)
- **After every plan wave:** phase59 + phase57 + phase58 + phase54 + phase56 + `phase15-stubs` (dead hrefs, design tokens, undefined CSS tokens, admin-lens leak)
- **Per plan touching the shell or a lazy seam:** `npm run build` (bundle gate: expect `/` delta 0 KB)
- **Before `/gsd-verify-work`:** full suite once, build, push, `npm run eval -- --phase 59` once, every screenshot read
- **Max feedback latency:** a few seconds per task

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 59-01-1 | 01 | 1 | SHL-06, OFF-01..06, DEC-02 | T-59-01, T-59-02 | every retired reader has an owner; project registered | source-contract | `npx playwright test --list --project=phase59 && npx playwright test --project=phase59 repoint-inventory retirement-sweep && npx tsc --noEmit` | ✅ W0 | ✅ green |
| 59-01-2 | 01 | 1 | SHL-06, OFF-01..06, DEC-02 | T-59-02 | a stub per requirement and decision group | source-contract | `npx playwright test --list --project=phase59 && npx playwright test --project=phase59 && npx playwright test --list --project=evals office && npx tsc --noEmit` | ✅ W0 | ✅ green |
| 59-01-3 | 01 | 1 | OFF-02, OFF-05 | T-59-03, T-59-04 | fixtures only in the eval-site org; probe prints counts only | fixture | `node --check scripts/eval-fixtures.mjs && node scripts/eval-fixtures.mjs && npx tsc --noEmit && grep -n "wave_0_complete: true" .planning/phases/59-the-office/59-VALIDATION.md` | ✅ W0 | ✅ green |
| 59-02-1 | 02 | 2 | DEC-02 | T-59-05..09 | additive kind check only; no policy change | static + unit | `npx tsc --noEmit && node --check scripts/apply-phase59-migration.mjs && npx playwright test --project=phase15-stubs rls-org-scope && npx playwright test --project=phase56 decision-kinds` | ✅ W0 | ✅ green |
| 59-02-2 | 02 | 2 | DEC-02 | T-59-05..09 | read module partitions kinds exactly | unit | `npx playwright test --project=phase59 ledger-read && npx tsc --noEmit` | ✅ W0 | ✅ green |
| 59-02-3 | 02 | 2 | DEC-02 | T-59-05..09 | worker and supervisor read 0 ledger rows; admin own org only | live probe (blocking) | `node scripts/apply-phase59-migration.mjs --assert-only && PHASE56_LIVE=1 npx playwright test --project=phase56 decision-kinds-live && PHASE59_LIVE=1 npx playwright test --project=phase59 ledger-rls-live` | ✅ W0 | ✅ green |
| 59-03-1 | 03 | 2 | SHL-06 | T-59-10..12 | tab whitelisted, role-gated, never a redirect | unit | `npx playwright test --project=phase59 place-tab && npx playwright test --project=phase57 place && npx playwright test --project=phase58 legacy-redirects && npx tsc --noEmit` | ✅ W0 | ✅ green |
| 59-03-2 | 03 | 2 | SHL-06 | T-59-10..12 | wide pane, Esc closes only the top layer | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 shell-wide place-tab && npx playwright test --project=phase57 && npx playwright test --project=phase15-stubs design-tokens no-static-admin-lens-import` | ✅ W0 | ✅ green |
| 59-04-1 | 04 | 2 | OFF-01, OFF-02, OFF-04 | T-59-13..16 | one derive, optional inputs, legacy shapes valid | unit | `npx playwright test --project=phase59 inbox-model && npx playwright test --project=phase54 governance-inbox && npx playwright test --project=phase30 governance-fold && npx tsc --noEmit` | ✅ W0 | ✅ green |
| 59-04-2 | 04 | 2 | OFF-01, OFF-02, OFF-04 | T-59-13..16 | RLS-scoped reads, labels never `role (uuid)` | unit + regression | `npx tsc --noEmit && npx playwright test --project=phase41 && npx playwright test --project=phase54 && npx playwright test --project=phase57 one-query && npx playwright test --project=phase59 inbox-model` | ✅ W0 | ✅ green |
| 59-04-3 | 04 | 2 | OFF-01, OFF-02 | T-59-13..16 | parameterless read; role from the session | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 inbox-model capability-matrix && npx playwright test --project=phase46 capability-matrix-doc` | ✅ W0 | ✅ green |
| 59-05-1 | 05 | 3 | OFF-05 | T-59-17..21 | invite admin-only, truthful role change, logged removal | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 people-actions && npx playwright test --project=phase55 org-single` | ✅ W0 | ✅ green |
| 59-05-2 | 05 | 3 | OFF-05 | T-59-17..21 | three writers registered in the ledger sweep | source-contract | `npx playwright test --project=phase56 decision-writers-sweep && npx playwright test --project=phase59 capability-matrix people-actions && npx playwright test --project=phase46 capability-matrix-doc` | ✅ W0 | ✅ green |
| 59-06-1 | 06 | 4 | OFF-02, OFF-03 | T-59-22..26 | own walk refused; counter-signature written; guards unchanged | source-contract + regression | `npx tsc --noEmit && npx playwright test --project=phase59 signoff-actions approve-actions capability-matrix && npx playwright test --project=phase56 && npx playwright test --project=phase37 && npx playwright test --project=phase29` | ✅ W0 | ✅ green |
| 59-06-2 | 06 | 4 | OFF-02 | T-59-22..26 | session read first, then sign storage paths | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 signoff-actions` | ✅ W0 | ✅ green |
| 59-06-3 | 06 | 4 | OFF-02 | T-59-22..26 | rejected completions never count as done | source-contract | `npx tsc --noEmit && npx playwright test --project=phase59 signoff-actions && npx playwright test --project=phase35 && npx playwright test --project=phase36` | ✅ W0 | ✅ green |
| 59-07-1 | 07 | 5 | OFF-04 | T-59-27..30 | owner path re-checks owner and org server-side | source-contract | `npx tsc --noEmit && npx playwright test --project=phase59 owner-review-meta capability-matrix && npx playwright test --project=phase28 && npx playwright test --project=phase56 decision-writers-sweep` | ✅ W0 | ✅ green |
| 59-07-2 | 07 | 5 | OFF-04 | T-59-27..30 | one meta line under every admin SOP row | unit + lint | `npx tsc --noEmit && npx playwright test --project=phase59 owner-review-meta && npx playwright test --project=phase54 && npx playwright test --project=phase57 && npx playwright test --project=phase15-stubs design-tokens no-undefined-css-tokens` | ✅ W0 | ✅ green |
| 59-07-3 | 07 | 5 | OFF-04 | T-59-27..30 | Owner and Review rows in This SOP; eval case | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 owner-review-meta && npx playwright test --project=phase58 && npx playwright test --list --project=evals office` | ✅ W0 | ✅ green |
| 59-08-1 | 08 | 5 | OFF-02 | T-59-31..34 | every old sign-off gate kept (assessor, override, reason >= 10) | source-contract + lint | `npx tsc --noEmit && npx playwright test --project=phase59 signoff-panel && npx playwright test --project=phase15-stubs design-tokens no-undefined-css-tokens` | ✅ W0 | ✅ green |
| 59-08-2 | 08 | 5 | OFF-03 | T-59-31..34 | approve / send back with a note; publish gate untouched | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 approve-actions signoff-panel && npx playwright test --project=phase56 publish-gate` | ✅ W0 | ✅ green |
| 59-09-1 | 09 | 6 | OFF-01..04 | T-59-35..38 | one button per row | source-contract + lint | `npx tsc --noEmit && npx playwright test --project=phase59 office-pane-structure && npx playwright test --project=phase15-stubs design-tokens no-undefined-css-tokens` | ✅ W0 | ✅ green |
| 59-09-2 | 09 | 6 | OFF-01 | T-59-35..38 | cache patched per action; empty state said plainly | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 office-pane-structure && npx playwright test --project=phase15-stubs` | ✅ W0 | ✅ green |
| 59-09-3 | 09 | 6 | OFF-01..04 | T-59-35..38 | eval cases authored for admin, supervisor, owner, approve, reject | eval (listed) | `npx playwright test --list --project=evals office && npx tsc --noEmit` | ✅ W0 | ✅ green |
| 59-10-1 | 10 | 7 | DEC-02 | T-59-39..42 | guarded session read; no client-supplied org | unit + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 ledger-read capability-matrix && npx playwright test --project=phase46 capability-matrix-doc` | ✅ W0 | ✅ green |
| 59-10-2 | 10 | 7 | DEC-02, OFF-01 | T-59-39..42 | decisions arm in the wide pane; cleared-today line | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 ledger-read office-pane-structure && npx playwright test --project=phase15-stubs design-tokens no-undefined-css-tokens && npx playwright test --list --project=evals office` | ✅ W0 | ✅ green |
| 59-11-1 | 11 | 8 | OFF-05 | T-59-43..46 | role select uses the safe writer; confirmed removal | source-contract + lint | `npx tsc --noEmit && npx playwright test --project=phase59 people-tab people-actions && npx playwright test --project=phase15-stubs design-tokens no-undefined-css-tokens` | ✅ W0 | ✅ green |
| 59-11-2 | 11 | 8 | OFF-06, SHL-06 | T-59-43..46 | access lens mounted unchanged, UUID-gated pin | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 access-mount people-tab && npx playwright test --project=phase15-stubs no-static-admin-lens-import && npx playwright test --list --project=evals office` | ✅ W0 | ✅ green |
| 59-12-1 | 12 | 9 | OFF-01, SHL-06 | T-59-49, T-59-50 | one lazy seam; no static admin import from the worker shell | type check | `npx tsc --noEmit` | ✅ | ✅ green |
| 59-12-2 | 12 | 9 | OFF-01, OFF-06 | T-59-49, T-59-50 | bundle marker self-validates; bundle gate holds | build + source-contract | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 office-pane-structure repoint-inventory && npx playwright test --project=phase15-stubs && npx playwright test --project=phase57 && npx playwright test --project=phase41 && npx playwright test --list --project=evals` | ✅ W0 | ✅ green |
| 59-13-1 | 13 | 10 | OFF-01, OFF-06 | T-59-47, T-59-48, T-59-51 | fixed destination templates, UUID gate, cookies copied | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 legacy-redirects place-tab && npx playwright test --project=phase57 place && npx playwright test --project=phase15-stubs no-dead-internal-hrefs` | ✅ W0 | ✅ green |
| 59-13-2 | 13 | 10 | OFF-01, OFF-06 | T-59-47, T-59-48, T-59-51 | pathways, UAT and matrix updated in the same change | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 && npx playwright test --project=phase57 && npx playwright test --project=phase54 && npx playwright test --project=phase55 deletion-sweep && npx playwright test --project=phase15-stubs && npx playwright test --project=phase46 capability-matrix-doc && npx playwright test --list --project=evals office` | ✅ W0 | ✅ green |
| 59-14-1 | 14 | 11 | OFF-01, OFF-05, OFF-06 | T-59-52..54 | pages and their only-used components deleted by consumer graph | build | `npx tsc --noEmit && npm run build` | ✅ | ✅ green |
| 59-14-2 | 14 | 11 | OFF-01, OFF-05, OFF-06 | T-59-52..54 | every reader of a deleted subject repointed or deleted | regression | `npx tsc --noEmit && npx playwright test --project=phase54 && npx playwright test --project=phase57 && npx playwright test --project=phase28 && npx playwright test --project=phase29 && npx playwright test --project=phase30 && npx playwright test --project=phase32 && npx playwright test --project=phase33 && npx playwright test --project=phase43 && npx playwright test --list --project=evals` | ✅ W0 | ✅ green |
| 59-14-3 | 14 | 11 | OFF-01, OFF-05, OFF-06 | T-59-52..54 | dropped-feature entry; sweeps live | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 && npx playwright test --project=phase55 deletion-sweep && npx playwright test --project=phase15-stubs` | ✅ W0 | ✅ green |
| 59-15-1 | 15 | 12 | OFF-02 | T-59-55..57 | non-owner completion read goes through RLS, then redirects server-side | build | `npx tsc --noEmit && npm run build` | ✅ | ✅ green |
| 59-15-2 | 15 | 12 | OFF-02 | T-59-55..57 | every reader of the supervisor views repointed | regression | `npx tsc --noEmit && npx playwright test --project=phase37 && npx playwright test --project=phase34 && npx playwright test --project=phase35 && npx playwright test --project=phase55 && npx playwright test --list --project=evals` | ✅ W0 | ✅ green |
| 59-15-3 | 15 | 12 | OFF-02 | T-59-55..57 | dropped-feature entry; maps and matrix; sweeps live | source-contract + build | `npx tsc --noEmit && npm run build && npx playwright test --project=phase59 && npx playwright test --project=phase55 deletion-sweep && npx playwright test --project=phase15-stubs && npx playwright test --project=phase46 capability-matrix-doc && npx playwright test --list --project=evals office` | ✅ W0 | ✅ green |
| 59-16-1 | 16 | 13 | OFF-01..06, DEC-02, SHL-06 | T-59-58, T-59-59 | deployed eval, every screenshot read | deployed eval | `npm run eval -- --phase 59` | ✅ W0 | ✅ green |
| 59-16-2 | 16 | 13 | OFF-01..06, DEC-02, SHL-06 | T-59-58, T-59-59 | build and full suite once; sign-off | full suite | `npm run build && npm run test` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `playwright.config.ts` — `phase59` project (broad `tests/phase59/**` match)
- [x] `tests/phase59/repoint-inventory.spec.ts` — RETIRED tokens, INVENTORY rows, `LIVE_PLANS`
- [x] `tests/phase59/retirement-sweep.spec.ts` — fixme blocks for 59-13, 59-14, 59-15
- [x] `tests/phase59/{place-tab,shell-wide,ledger-read,ledger-rls-live,inbox-model,people-actions,signoff-actions,approve-actions,owner-review-meta,signoff-panel,office-pane-structure,people-tab,access-mount,legacy-redirects,capability-matrix}.spec.ts` — fixme stubs naming the owning plan
- [x] `tests/evals/office.eval.ts` — skeleton, one fixme case per owning plan
- [x] `scripts/eval-fixtures.mjs` + `tests/evals/lib/session.ts` — supervisor assignment, idle supervisor, unsupervised worker
- [x] No framework install needed

---

## Manual-Only Verifications

None: the deployed eval and its screenshots replace click-path checks (CLAUDE.md § Deployed-site evals).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency within budget
- [x] `nyquist_compliant: true` set in frontmatter (59-16)

**Approval:** approved 2026-10-06 (deployed eval 74/74 at cd59bfb with every 59-* screenshot read, real-org case re-proved at 2d1ba6c; build and full suite once, see 59-16-SUMMARY)
