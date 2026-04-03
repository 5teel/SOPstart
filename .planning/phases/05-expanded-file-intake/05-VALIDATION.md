---
phase: 5
slug: expanded-file-intake
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (integration + E2E) |
| **Config file** | playwright.config.ts |
| **Quick run command** | `npx playwright test --project=integration` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=integration`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | FILE-01 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FILE-02 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FILE-03 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FILE-04 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FILE-05 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FILE-06 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FILE-07 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FILE-08 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INFRA-01 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INFRA-02 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Playwright test stubs for all FILE-* and INFRA-* requirements
- [ ] Test fixtures for new file type uploads (XLSX, PPTX, TXT, image)

*Existing Playwright infrastructure from prior phases covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera capture photo quality check (blur/glare) | FILE-01 | Requires physical device camera | Open upload page on mobile device, take photo of printed SOP, verify quality check UI feedback |
| TUS resumable upload resumes after network drop | INFRA-01 | Requires network interruption simulation | Start large file upload, disable WiFi mid-upload, re-enable, verify upload completes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
