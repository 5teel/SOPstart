---
phase: 2
slug: document-intake
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (installed in Phase 1, Wave 0) |
| **Config file** | playwright.config.ts (exists) |
| **Quick run command** | `npx playwright test --reporter=line` |
| **Full suite command** | `npx playwright test --reporter=html` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --reporter=line`
- **After every plan wave:** Run `npx playwright test --reporter=html`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | PARSE-01 | integration | `npx playwright test tests/sop-upload.test.ts` | Wave 0 | pending |
| 02-01-02 | 01 | 1 | PARSE-02 | integration | `npx playwright test tests/sop-upload.test.ts` | Wave 0 | pending |
| 02-02-01 | 02 | 2 | PARSE-03 | integration | `npx playwright test tests/sop-parsing.test.ts` | Wave 0 | pending |
| 02-02-02 | 02 | 2 | PARSE-04 | integration | `npx playwright test tests/sop-parsing.test.ts` | Wave 0 | pending |
| 02-03-01 | 03 | 3 | PARSE-05 | e2e | `npx playwright test tests/sop-review.test.ts` | Wave 0 | pending |
| 02-03-02 | 03 | 3 | PARSE-06 | e2e | `npx playwright test tests/sop-review.test.ts` | Wave 0 | pending |
| 02-03-03 | 03 | 3 | PARSE-07 | e2e | `npx playwright test tests/sop-review.test.ts` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/sop-upload.test.ts` — stubs for PARSE-01, PARSE-02 (file upload, format handling)
- [ ] `tests/sop-parsing.test.ts` — stubs for PARSE-03, PARSE-04 (AI parsing, image extraction)
- [ ] `tests/sop-review.test.ts` — stubs for PARSE-05, PARSE-06, PARSE-07 (review UI, editing, publish flow)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera capture uploads | PARSE-01/02 | Requires real device camera | Open upload page on phone, tap camera icon, photograph SOP page, verify upload succeeds |
| Side-by-side review layout | PARSE-05 | Visual verification needed | Upload a real SOP, verify parsed output appears alongside original with correct formatting |
| Inline editing UX | PARSE-06 | Interaction quality | Click on parsed section, verify inline editor appears, edit text, verify changes persist |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
