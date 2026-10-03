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
| 55-04-01 | 04 | 4 | CUT-01 | T-55-04-01 | walkthrough, step cards and plant ask bar carry no voice, read-aloud or mic | source-contract | `npx tsc --noEmit && npx playwright test --project=phase52 && npx playwright test --project=phase15-stubs` | ✅ | ✅ green |
| 55-04-02 | 04 | 4 | CUT-01 | T-55-04-01/02 | voice modules deleted; measurement and voice-note sections render inert; bundle gate has no voice assertion and no growth | contract-check + build | `npx tsx scripts/contract-check.ts && npm run build` | ✅ | ✅ green (935 / 827 KB) |
| 55-04-03 | 04 | 4 | CUT-01 | T-55-04-02 | voice-capture sweep live and mutation-proven (red with a planted import, green without) | sweep | `npx playwright test --project=phase55` | ✅ | ✅ green |
| 55-05-01 | 05 | 5 | CUT-01 | T-55-05-01/02 | voice drafting, voice/ask endpoints, token route and 5 voice AI model keys gone; sop-pack moved byte-identical; typed brief still opens | source-contract + build | `npx tsc --noEmit && npx playwright test --project=phase55 tests/phase55/sop-pack.spec.ts && npm run build` | ✅ | ✅ green (935 / 827 KB) |
| 55-05-02 | 05 | 5 | CUT-01 | T-55-05-01 | voice sweep live and mutation-proven (red with planted `/api/voice/token` fetch, green without); voice specs and phase15-unit project removed | sweep | `npx playwright test --project=phase55 --project=phase15-stubs --project=phase30 --project=phase40 --project=phase26 --project=phase26.5` | ✅ | ✅ green |
| 55-06-01 | 06 | 6 | CUT-01 | T-55-06-03 | /m/[code], plate, per-SOP QR, PhoneHome, ScanSheet, MachineListSheet, MachineView, qr-decode deleted; /sops has no phone seam; bundle marker groups dropped | source-contract + build | `npx tsc --noEmit && npm run build` | ✅ | ✅ green (935 / 827 KB) |
| 55-06-02 | 06 | 6 | CUT-01 | T-55-06-01/02, T-55-04 | /login/roster, /api/roster, RosterSelector deleted; submitCompletion records only the session user; supervisor counter-signs as themselves | source-contract + build | `npx tsc --noEmit && npm run build` | ✅ | ✅ green |
| 55-06-03 | 06 | 6 | CUT-01 | T-55-06-01/03 | phone-qr and shared-device sweeps live and mutation-proven; phase53/phase23 specs, phone-home eval, journeys, UAT, capability matrix updated | sweep + guards | `npx playwright test --project=phase55 --project=phase52 --project=phase41 --project=phase53 --project=phase23-stubs --project=phase30 --project=phase46` | ✅ | ✅ green |
| 55-07-01 | 07 | 7 | CUT-02 | T-55-07-01 | UploadDropzone offers Upload + Record video only; YouTube route/fetcher/validators and PhotoScanner/overlay/image checks deleted; image file pick and OCR untouched | source-contract + build | `npx tsc --noEmit && npm run build` | ✅ | ✅ green (935 / 827 KB) |
| 55-07-02 | 07 | 7 | CUT-02 | T-55-07-01 | youtube and photo-scan sweeps live and mutation-proven; youtube specs deleted, phase40 route lists and write census (46 to 44) repointed, dead-controls scanner test and eval test B deleted, journeys reworded | sweep + guards | `npx playwright test --project=phase55 --project=phase43 --project=phase40 --project=phase6-stubs --project=phase21-stubs` | ✅ | ✅ green |
| 55-08-01 | 08 | 8 | CUT-02 | T-55-02, T-55-08-01 | video generation routes/pipeline page/components/lib deleted; publish no longer auto-queues (assertPublishGates untouched); Shotstack public-route exemption and tts-video key gone; record-a-video on-ramp kept | source-contract + build | `npx tsc --noEmit && npm run build` | ✅ | ✅ green (935 / 827 KB) |
| 55-08-02 | 08 | 8 | CUT-02 | T-55-08-01 | ParseJobStatus parse-only; job-stages loses pipeline snapshot and render stage; no Make a training video / Video versions links | source-contract + build | `npx tsc --noEmit && npm run build` | ✅ | ✅ green |
| 55-08-03 | 08 | 8 | CUT-02 | T-55-02 | video-generation sweep live and mutation-proven (planted Shotstack const goes red); 14 video/pipeline stub specs and phase8/9/10/video-gen-unit projects deleted; phase29/30/33/40 specs, write census (44 to 41), journeys, uat repointed | sweep + guards | `npx playwright test --project=phase55 --project=phase29 --project=phase26 --project=phase30 --project=phase33 --project=phase40 --project=phase6-stubs --project=phase11-stubs --project=phase21-stubs` | ✅ | ✅ green (9 baseline-only failures in phase11-stubs) |
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
