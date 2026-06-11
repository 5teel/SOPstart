---
phase: 24
slug: procedure-flow-spatial-node-graph
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (project-pattern: phaseNN-stubs source-contract + integration projects) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --project=phase24-stubs` (registered in Wave 0; derivation tests under `phase24-unit`) |
| **Full suite command** | `npx tsc --noEmit && npx playwright test` |
| **Estimated runtime** | ~60–120 seconds (contract tests; no browser binaries required for source-contract specs) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase24-stubs`
- **After every plan wave:** Run `npx tsc --noEmit && npx playwright test --project=phase24-stubs`
- **Before `/gsd-verify-work`:** Full suite must be green + `npx tsx scripts/check-bundle-size.ts` within ±2 KB
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | — | — | FLOW-01..FLOW-05 | — | N/A (read-only presentation layer) | contract/unit | per-plan | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Requirement → validation mapping (from 24-RESEARCH.md § Validation Architecture):**

| Req | Validation |
|-----|-----------|
| FLOW-01 | Unit/contract test: `layout()` honours explicit positions (any `position.x !== 0` → authored coordinates used verbatim); auto-layout path still produces depth layers for all-zero-x graphs. Existing `flow-graph-derivation.test.ts` stays green. |
| FLOW-02 | Already covered by `src/components/sop/__tests__/flow-graph-derivation.test.ts` (registered in playwright.config). Coverage audit only — add cases only for found gaps. |
| FLOW-03 | Contract test: FIT computes viewBox fit (not scrollTo); EXPORT-PNG path serialises SVG with CSS vars inlined via getComputedStyle clone. Human-UAT: PNG downloads and is legible at devicePixelRatio ≥ 2. |
| FLOW-04 | Contract test: FlowTab seeds `useState('list')` (SSR-safe) and reconciles to `'graph'` on desktop in an effect; no `window`/`navigator` read in first render. "PREVIEW" string absent from FlowGraphCanvas/FlowTab. |
| FLOW-05 | Schema test: relaxed `FlowGraphSchema` accepts derived non-UUID node ids while `stepId` stays uuid. Human-UAT: author positions in builder FlowGraphField → save → Flow tab renders explicit layout (carried Phase 12.5 UAT item — MUST be run in a real authenticated browser per the [2026-06-08] learning). |

---

## Wave 0 Requirements

- [ ] Register a `phase24-stubs` project regex in `playwright.config.ts` covering all new spec files (2026-05-25 learning: unregistered specs never run — validate with `npx playwright test --list --project=phase24-stubs`)
- [ ] Stub spec files for FLOW-01, FLOW-03, FLOW-04, FLOW-05 contract assertions

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FlowGraphField reachable in Phase 21.6 builder UI | FLOW-05 | Puck root-fields panel visibility after 21.6 sidebar suppression has never been human-verified (carried Phase 12.5 UAT) | On sopstart.com: open any SOP in the admin builder → locate the flow-graph authoring field → drag/position nodes → save → open `/sops/[sopId]` Flow tab → explicit layout renders |
| EXPORT-PNG visual fidelity | FLOW-03 | Font fallback + DPR scaling are visual judgements | Export a branched SOP graph; check labels legible, colours match on-screen tokens, no blank/tainted canvas |
| Graph-default on desktop / list on mobile | FLOW-04 | Viewport behaviour needs a real device pass | Desktop ≥1024px shows graph by default; phone shows list; toggle works both ways; no hydration warning in console |
