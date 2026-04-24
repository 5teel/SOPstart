---
phase: 12
slug: builder-shell-blank-page-authoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated by gsd-planner during wave 0 planning; refined during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright @latest (integration + E2E) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npm run test:integration -- --grep "@phase-12"` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~90 seconds (quick), ~10 min (full) |

---

## Sampling Rate

- **After every task commit:** Run quick suite filtered to `@phase-12` tag
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds per task commit

---

## Per-Task Verification Map

_Populated by gsd-planner during Wave 0. Each task gets a row with its automated command, test-type, and file existence status._

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _TBD by planner_ | | | | | | | | | |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/sb-layout-editor.test.ts` — SB-LAYOUT-01..06 test.fixme → test()
- [ ] `tests/sb-builder-infrastructure.test.ts` — builder + Puck integration assertions
- [ ] `tests/sb-auth-builder.test.ts` (new) — SB-AUTH-01 / SB-AUTH-04 / SB-AUTH-05 coverage
- [ ] `tests/sb-section-reorder.test.ts` (new) — SB-SECT-05 reorder atomicity
- [ ] `playwright.config.ts` — add `phase12-stubs` project matching `tests/sb-*.test.ts`
- [ ] `@puckeditor/core@0.21.2` install (note: package renamed from `@measured/puck` — SPEC references old name)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile preview device frame (430×932) visual accuracy | SB-LAYOUT-03 | Subjective device-frame fidelity | Load `/admin/sops/builder/{id}`, toggle MOBILE, eyeball against iPhone 15 Pro reference |
| Puck editor drag-and-drop smoothness | SB-LAYOUT-01 | Browser-specific DnD timing variance | Manual drag test on Chrome + Firefox + Safari |
| Dexie offline-queue UX | SB-LAYOUT-04 (constraint) | Requires airplane-mode toggle | Disconnect network, edit in builder, reconnect, verify Supabase sync + toast copy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
