---
phase: 55
slug: cut-the-dropped-features-one-organisation
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-10-03
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright `@playwright/test` ^1.58.2 (source-contract + unit + deployed evals) |
| **Config file** | `playwright.config.ts` — Wave 0 adds project `phase55` (`testMatch: /tests\/phase55\/.*\.(spec\|test)\.ts$/`), verified with `--list` |
| **Quick run command** | `npx tsc --noEmit && npx playwright test --project=phase55` |
| **Full suite command** | `npm run build && npm run test` (ONCE per gate — live-probe OTP budget, CLAUDE.md 2026-09-28) |
| **Deployed** | `npm run eval -- --phase 55` after push to master |
| **Estimated runtime** | ~30 s quick · ~10 min full · ~5 min eval |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit && npx playwright test --project=phase55`
- **After every plan wave:** Run `npm run build` (bundle gate + marker self-validation + prebuild `contract-check`) plus the non-live projects the wave touched (RESEARCH.md Section 7)
- **Before `/gsd-verify-work`:** Full suite ONCE (compare non-live failures to `55-BASELINE-FAILURES.md`; OTP rate-limit failures are environment), push, `npm run eval -- --phase 55`, read every screenshot — `55-EVAL.md` is the UAT artefact
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 55-01-01 | 01 | 1 | CUT-01, CUT-02 | T-55-W0-03 (vacuous guard) | dropped list is data; sweep asserts absence of files AND references per feature; survivors live | source-contract | `npx playwright test --list --project=phase55 && npx playwright test --project=phase55 tests/phase55/deletion-sweep.spec.ts` | ✅ | ✅ green |
| 55-01-02 | 01 | 1 | CUT-01, ORG-01 | T-55-W0-01, T-55-W0-02 | worker-path + org contracts; D-06 and D-02 live; walk fixture unassigned/machine-less; cleanup refuses real org | source-contract + fixture | `npx tsc --noEmit && npx playwright test --project=phase55 && npx playwright test --list --project=evals` | ✅ | ✅ green |
| 55-01-03 | 01 | 1 | CUT-01, CUT-02 | — | before-numbers recorded: failure baseline + bundle 1045 / 936 KB; baseline file untouched | build + record | `test -f .bundle-baseline.old.json && git diff --quiet -- .bundle-baseline.json` | ✅ | ✅ green |
| 55-02-01 | 02 | 2 | CUT-01 | T-55-02-01 | worker list = published library joined to own assignments; no Dexie read; no offline label on /sops | source-contract | `npx tsc --noEmit && npx playwright test --project=phase52 tests/phase52/plant-pins.spec.ts && npx playwright test --project=phase41 tests/phase41/merged-surface.spec.ts` | ✅ | ✅ green |
| 55-02-02 | 02 | 2 | CUT-01 | T-55-02-03 | SOP detail and Now-card minutes read from Supabase | source-contract | `npx tsc --noEmit && npx playwright test --project=phase52 tests/phase52/plant-now-card.spec.ts` | ✅ | ✅ green |
| 55-02-03 | 02 | 2 | CUT-01 | T-55-02-02 | builder autosave debounces 750 ms then calls updateSectionLayout; pill reads save result | behavioural + source-contract | `npx tsx scripts/autosave-rewire-check.tsx && npx playwright test --project=phase55 tests/phase55/worker-path-contract.spec.ts && npm run build` | ✅ | ✅ green |
| 55-03-01 | 03 | 3 | CUT-01 | T-55-04 | compressor in lib/photo; useStepPhotos does compress -> signed URL -> PUT; getPhotoUploadUrl takes org from session and UUID ids only; submitCompletion rejects foreign photo paths | source-contract | `npx tsc --noEmit && npx playwright test --project=phase46 tests/phase46/capability-matrix-doc.spec.ts` | ✅ | ✅ green |
| 55-03-02 | 03 | 3 | CUT-01 | T-55-03-02 | walkthrough on direct path; no queue chip, no confirm, no Dexie; completionStore memory-only | source-contract + build | `npx tsc --noEmit && npx playwright test --project=phase55 tests/phase55/worker-path-contract.spec.ts && npm run build` | ✅ | ✅ green |
| 55-03-03 | 03 | 3 | CUT-01 | T-55-03-03 | phone walk + photo + submit, admin sees it waiting with its photo, on sopstart.com | deployed eval | `npm run eval` | ✅ | ✅ green (31 passed, 0 failed on 87fec4e) |
| (filled by planner per task) | | | CUT-01 | T-55-01 (stale SW serving old shell) | kill-switch `public/sw.js` committed; eval asserts no SW registered | source-contract + eval | `npx playwright test --project=phase55 tests/phase55/deletion-sweep.spec.ts` | ❌ W0 | ⬜ pending |
| | | | CUT-01 | — | no `@/lib/offline` import in `src/`; walkthrough uses `getPhotoUploadUrl` + `submitCompletion` | source-contract | `npx playwright test --project=phase55 tests/phase55/worker-path-contract.spec.ts` | ❌ W0 | ⬜ pending |
| | | | CUT-01 | — | worker walks + photo + submit online, no banner/queue | deployed eval | `npm run eval -- --phase 55` | ❌ W0 | ⬜ pending |
| | | | CUT-02 | T-55-02 (orphaned Shotstack middleware exemption) | exemption removed with the route; dropped files/packages/refs absent; survivors present | source-contract | `npx playwright test --project=phase55 tests/phase55/deletion-sweep.spec.ts` | ❌ W0 | ⬜ pending |
| | | | CUT-02 | — | admin sees no dropped affordances; dead addresses render not-found content | deployed eval | `npm run eval -- --phase 55` | ❌ W0 | ⬜ pending |
| | | | ORG-01 | T-55-03 (direct Supabase signup with publishable key) | `signUpOrganisation`/`switchOrganisation`/`OrgSwitcher` absent; Supabase public signup disabled | source-contract | `npx playwright test --project=phase55 tests/phase55/org-single.spec.ts` | ❌ W0 | ⬜ pending |
| | | | ORG-01 | — | signed-out `/sign-up` shows invitation text, no inputs | deployed eval | `npm run eval -- --phase 55` | ❌ W0 | ⬜ pending |
| | | | all | — | build green incl. bundle gate (voice assertion + 3 marker groups removed, baseline moved down only) | build | `npm run build && npm run lint` | ✅ | ⬜ pending |
| | | | all | T-55-04 (sibling action loses org guard when trimmed) | existing guards green after repoint | source-contract | `npx playwright test --project=phase15-stubs --project=phase41 --project=phase43 --project=phase46 --project=phase52 --project=phase54` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `playwright.config.ts` — project `phase55` + `npx playwright test --list --project=phase55` shows the specs
- [x] `scripts/dropped-features.json` — initial full list (routes, packages, jobs, modules) from RESEARCH.md Section 1; the Phase 62 build-guard input
- [x] `tests/phase55/deletion-sweep.spec.ts` — reads the JSON; asserts absence of FILES and of REFERENCES (imports/hrefs/`router.push`/`journeys.ts` routes); positive survivor list; fixme-gated, flipped live per wave
- [x] `tests/phase55/worker-path-contract.spec.ts` — stubs for CUT-01 rewire
- [x] `tests/phase55/org-single.spec.ts` — stubs for ORG-01
- [x] `tests/evals/cut-features.eval.ts` skeleton + walk fixture in `scripts/eval-fixtures.mjs` (photo-required step) + completion cleanup helper in `tests/evals/lib/` so the shared plant fixture SOP is never left "done" (would flip `plant-home.eval`)
- [x] `55-BASELINE-FAILURES.md` — pre-phase full-suite failure baseline, recorded before the first deleting wave
- [x] Snapshot `.bundle-baseline.json` → `.bundle-baseline.old.json` (gitignored) for the move-down-only check
- No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Guard mutation proof | CUT-01/02 | A grep guard that finds nothing passes vacuously (CLAUDE.md 2026-05-25 / 2026-06-05) | Once per new guard: plant a violation (re-add one import/href), run the spec → red; remove → green. Record in SUMMARY.md |
| External schedulers calling dropped routes | CUT-02 | Not derivable from repo | Executor checks Railway cron + Shotstack dashboard for callers of `/api/sops/*/video*`, `/api/voice/*`; records result in SUMMARY.md |
| Photo capture on a photo-required step | CUT-01 | `DesktopWalkthrough` has no photo capture | Eval runs the walk at a phone viewport (mobile project) — automated, but note the viewport constraint |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
