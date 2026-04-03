---
phase: 6
slug: video-transcription-upload-and-url
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 6 — Validation Strategy

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
| TBD | TBD | TBD | VID-01 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VID-02 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VID-04 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VID-05 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VID-06 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VID-07 | integration | `npx playwright test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Playwright test stubs for all VID-* requirements
- [ ] Test fixtures for video upload and YouTube URL scenarios

*Existing Playwright infrastructure from prior phases covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Video file upload transcription accuracy | VID-01 | Requires real audio transcription API call | Upload a short MP4 with NZ-accented speech, verify transcript quality |
| YouTube caption fetch with real URL | VID-02 | Requires external YouTube API | Paste a YouTube URL with known captions, verify caption text appears |
| Video player timestamp sync | VID-05 | Requires visual verification | Click transcript lines, verify video jumps to correct timestamp |
| Adversarial verification catches real errors | VID-06 | Requires Anthropic API call | Submit a video where transcript has errors, verify flags appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
