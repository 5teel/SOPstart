---
phase: 26
slug: sop-builder-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-03
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Full Validation Architecture (per-P-item behavioural test map) lives in `26-RESEARCH.md` § Validation Architecture — the planner expands it into the Per-Task map below.**

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (integration + E2E); source-contract specs for structure |
| **Config file** | `playwright.config.ts` (register a **`phase26`** project regex — CLAUDE.md 2026-05-25) |
| **Quick run command** | `npx playwright test --project=phase26` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~TBD (planner/executor to measure) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase26`
- **After every plan wave:** Run the full suite + `npx tsc --noEmit` + a real `npm run build` (next build) — CLAUDE.md 2026-06-27 (`'use server'` async-only surfaces only under next build)
- **Before `/gsd-verify-work`:** Full suite green + convert golden-path fixture byte-equivalent
- **Max feedback latency:** TBD

---

## Per-Task Verification Map

> Planner populates from `26-RESEARCH.md` § Validation Architecture. **Mandatory rule (CLAUDE.md 2026-06-05):** every Preservation-Checklist RE-WIRE / RE-IMPLEMENT item (P8, P11, P12, P13, P14, P17) needs a **behavioural** parity test, NOT a source-contract presence assertion. R6 needs the convert-golden-path regression (byte-equivalent `layout_data` + junctions + `block_provenance`).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 26-00-01 | 00 | 0 | R6 | — | pre-phase convert golden fixture captured | integration | `npx playwright test --project=phase26 -g golden` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Register `phase26` Playwright project regex in `playwright.config.ts` (or specs never run — CLAUDE.md 2026-05-25)
- [ ] Capture pre-phase **convert golden fixture** (upload a known DOCX → snapshot resulting `layout_data` + junctions + `block_provenance`) as the R6 regression baseline
- [ ] Re-point `scripts/contract-check.ts` from `puck-config.tsx` to the new block registry (else the 3-place contract gate silently checks a dead file)
- [ ] Re-capture `.bundle-baseline.json` (removing Puck from the worker read path changes First Load JS)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Edit == worker render parity (visual) | R2 | Visual equivalence needs a real browser + human eye | Open a SOP in edit + worker view at 1366px on sopstart.com; confirm identical block rendering |
| Konva annotation UX (draw/re-edit/palm-reject) | R5 (Phase 17 absorbed) | Stylus/pointer behaviour needs a device | Annotate a diagram, publish, re-open; confirm baked PNG served to worker (no Konva in worker bundle) |

*Expand during planning; keep automated coverage maximal per CLAUDE.md source-contract-blindness learning.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (phase26 project, golden fixture, contract-check repoint, bundle baseline)
- [ ] Every RE-WIRE/RE-IMPLEMENT P-item has a behavioural parity test (not source-contract)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
