---
phase: 57
slug: the-one-screen-its-places
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-04
---

# Phase 57 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58 (source-contract / unit specs + deployed evals) |
| **Config file** | `playwright.config.ts` — Wave 0 registers the `phase57` project (`testMatch: /tests\/phase57\/.*\.(spec|test)\.ts$/`) |
| **Quick run command** | `npx playwright test --project=phase57` + `npx tsc --noEmit` |
| **Full suite command** | `npm run test` (run ONCE per gate — live probes share one OTP budget, CLAUDE.md 2026-09-28) |
| **Deployed eval** | `npm run eval -- --phase 57` (needs `EVAL_BASE_URL`; self-skips otherwise) |
| **Build gate** | `npm run build` (postbuild bundle check) |
| **Estimated runtime** | phase57 project ~30 s; full suite several minutes |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase57` + `npx tsc --noEmit`
- **After every plan wave:** phase57 + every project named in the repoint inventory (phase30, 41, 51, 52, 54, 55, 56, `phase15-stubs`) + `npm run build`
- **Before `/gsd-verify-work`:** ONE full-suite run, non-live failures compared to the recorded baseline; deployed eval after push, screenshots READ
- **Max feedback latency:** ~60 seconds (phase57 project)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | | | SHL-01 | T-57-xx | shell page branches on session; no TopHeader; `roleHome` → `/` | source-contract + eval | `npx playwright test --project=phase57 -g SHL-01` | ❌ W0 `tests/phase57/shell-structure.spec.ts` | ⬜ pending |
| | | | SHL-02 | — | one `select()` for map + list; Esc → overview; `parsePlace`/`formatPlace` round-trip, bad token → overview | unit + eval | `-g SHL-02` | ❌ W0 `tests/phase57/place.spec.ts` | ⬜ pending |
| | | | SHL-04 | — | search matches machine names + SOP titles + room names; highlights shapes | unit + eval | `-g SHL-04` | ❌ W0 `tests/phase57/search.spec.ts` | ⬜ pending |
| | | | SHL-05 | — | worker card = `pickNowQueue()[0]`; admin card number === Office pin number from one shared read | source-contract + eval | `-g SHL-05` | ❌ W0 `tests/phase57/one-query.spec.ts` | ⬜ pending |
| | | | PLC-01 | — | four rooms as fractional polygons in [0,1]; signposts at every zoom; no room table / room UI (absence guard) | unit + source-contract + eval | `-g PLC-01` | ❌ W0 `tests/phase57/rooms.spec.ts` | ⬜ pending |
| | | | PLC-02 | T-57-xx | machine body lists SOPs with badge; worker Walk; admin Walk/Edit/new-SOP with machine param | source-contract + eval | `-g PLC-02` | ❌ W0 `tests/phase57/machine-body.spec.ts` | ⬜ pending |
| | | | PLC-03 | — | Noticeboard filters `placement === 'site'`; `placement` selected in worker query | source-contract + eval | `-g PLC-03` | ❌ W0 `tests/phase57/noticeboard.spec.ts` | ⬜ pending |
| | | | PLC-04 | T-57-xx | pins from session org only; Office pin === `/governance` open count via shared function | source-contract + eval | `-g PLC-04` | ❌ W0 `tests/phase57/pins.spec.ts` | ⬜ pending |
| | | | PLC-05 | T-57-xx | edit mode via button + `?place=edit`; departments strip; delete refused server-side with counts; `/admin/departments` + `/admin/site` redirect in proxy | source-contract + live probe (`PHASE57_LIVE=1`) + eval | `-g PLC-05` | ❌ W0 `tests/phase57/departments.spec.ts` | ⬜ pending |
| | | | Retirement | — | no `href`/`push`/`redirect` to retired routes in `src/` (comment-stripped); dropped list extended; sweep enumerates | source-contract | `-g retire` | ❌ W0 `tests/phase57/retirement-sweep.spec.ts` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — register the `phase57` project; verify with `npx playwright test --list --project=phase57`
- [ ] `tests/phase57/repoint-inventory.spec.ts` — every stale guard (≈25 specs, 7 evals) listed with disposition (precedent `tests/phase41/spec-repoint-inventory.spec.ts`)
- [ ] `tests/phase57/*.spec.ts` stubs per row above
- [ ] `tests/evals/one-screen.eval.ts` (sign in via `signInAs`; assert by NAME, never exact counts; `SLOW` timeout after `page.goto('/')`; second-iteration selection leak check) + supervisor fixture decision in `scripts/eval-fixtures.mjs`
- [ ] Retired-URL assertions rewritten/retired in `plant-home`, `governance`, `site-editor`, `sop-surface`, `dead-surface`, `cut-features` evals
- [ ] `scripts/check-bundle-size.ts` route-list change plan (`(protected)/sops/page*` hard-coded; `/` page gate entry outside `(protected)`) — baseline change recorded as a decision artefact, never re-captured to hide growth

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Room hit-areas sit over sensible spots on the real org's 2752×1536 scene and the eval org's 1600×900 scene; signposts legible at overview and max zoom | PLC-01 | CSS/geometry is invisible to assertions (CLAUDE.md 2026-07-14) | Claude reads the eval screenshots (overview, zoomed, edit mode) before declaring a pass |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
