---
phase: 24-procedure-flow-spatial-node-graph
slug: procedure-flow-spatial-node-graph
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-12
---

# Phase 24 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| builder admin → `updateSopFlowGraph` server action | Authored flow graph written to DB via a `'use server'` action | Structured JSON (FlowGraph), admin-authored; role-gated + Zod-validated + 256 KB capped |
| rendered SVG → exported PNG (client-only) | Pure client-side rasterisation; no network request, no untrusted input | SOP flow graph the user is already authorised to view; output is a local download |
| desktop/mobile viewport detection | matchMedia reconcile in a `useEffect` (client-only); no server trust decision | None — controls UI default only |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-24-01 | Tampering | FlowGraphSchema relaxation (id/from/to → min(1)) | mitigate | `z.string().min(1)` on node id + edge from/to; `z.string().uuid()` retained on stepId; 256 KB cap in `updateSopFlowGraph`; schema spec asserts empty-string id rejected | closed |
| T-24-02 | Tampering | npm/pip/cargo installs (plan 01) | accept | No package installs — zero new deps; native browser APIs + existing libs only | closed |
| T-24-03 | Information Disclosure | exportPng (SVG→canvas→PNG) | accept | Client-only rasterisation of the user's own SOP; no cross-origin images drawn; local download only — no exfiltration path | closed |
| T-24-04 | Denial of Service | layoutFromPositions on adversarial positions | accept | Positions validated by FlowGraphSchema (z.number()) before write; 256 KB graph cap at write time; bounding-box math O(n) over a capped node set | closed |
| T-24-05 | Elevation of Privilege | re-surfaced FlowGraphEditor write path (BuilderFlowEditButton) | mitigate | All writes go through `updateSopFlowGraph`; role gate reads JWT claims (not user_metadata); update is org-scoped (`eq('organisation_id', organisationId)`); zero-row writes surface as error; FlowGraphSchema + 256 KB cap applied at action entry | closed |
| T-24-06 | Tampering | hydration-mismatch via window-derived first render (FLOW-04) | mitigate | `useState<'list'\|'graph'>('list')` SSR-safe seed; `useViewport` reconcile to `'graph'` runs only in `useEffect` (post-hydration); spec asserts initial 'list' seed + no window read; human-UAT confirmed no React #418 on sopstart.com | closed |
| T-24-SC | Tampering | npm/pip/cargo installs (all plans) | accept | No package installs across plans 01–03; native Canvas/XMLSerializer + existing deps only | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-24-01 | T-24-02 | No new packages installed in plan 01. Dependency slopcheck not applicable. | Simon Scott / Potenco Pty Ltd | 2026-06-12 |
| AR-24-02 | T-24-03 | exportPng rasterises only the SOP flow graph the authenticated user already has read access to (RLS-gated at load time). No cross-origin image is drawn; the canvas is never tainted. Output is a `<a download>` click — no network transmission, no exfiltration path. Client-side PNG generation is a standard browser capability; no elevated risk above the existing read authorisation. | Simon Scott / Potenco Pty Ltd | 2026-06-12 |
| AR-24-03 | T-24-04 | Node positions are validated as `z.number()` by FlowGraphSchema before persisting, and the entire graph JSON is capped at 256 KB at write time in `updateSopFlowGraph`. `layoutFromPositions` iterates once over a node set that cannot exceed the cap; it computes min/max bounding box only — O(n), no quadratic or recursive path. An adversarial graph with extreme coordinate values produces a large SVG viewBox but cannot cause an unbounded computation loop. | Simon Scott / Potenco Pty Ltd | 2026-06-12 |
| AR-24-04 | T-24-SC | Plans 01–03 introduced zero new npm/pip/cargo dependencies. All new functionality (explicit-position layout, viewBox fit, PNG export) uses the native Canvas API, XMLSerializer, and existing project libraries. Slopcheck is not applicable. | Simon Scott / Potenco Pty Ltd | 2026-06-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Threat Verification Evidence

### T-24-01 — CLOSED

**Mitigation:** `z.string().min(1)` on node id + edge from/to; `z.string().uuid()` retained on stepId; 256 KB cap enforced; schema spec asserts empty-string id rejected.

| Check | Evidence | Location |
|-------|----------|----------|
| node id uses `z.string().min(1)` | `id: z.string().min(1)` at line 8 | `src/lib/validators/flow-graph.ts:8` |
| edge from/to use `z.string().min(1)` | `from: z.string().min(1)` / `to: z.string().min(1)` at lines 16–17 | `src/lib/validators/flow-graph.ts:16-17` |
| stepId retains `z.string().uuid()` | `stepId: z.string().uuid().optional()` at line 12 | `src/lib/validators/flow-graph.ts:12` |
| 256 KB cap enforced in server action | `const MAX_BYTES = 256 * 1024` + `Buffer.byteLength` check | `src/actions/flow-graph.ts:6,18-20` |
| Schema spec asserts empty-string id rejected | `expect(result.success, 'empty-string id must be rejected (min(1))').toBe(false)` | `src/lib/validators/__tests__/flow-graph-schema.spec.ts:57` |
| Schema spec asserts non-UUID stepId rejected | `expect(bad.success, 'non-UUID stepId must be rejected').toBe(false)` | `src/lib/validators/__tests__/flow-graph-schema.spec.ts:67` |

### T-24-05 — CLOSED

**Mitigation:** All writes routed through `updateSopFlowGraph`; role gate reads JWT claims (not user_metadata); update org-scoped; zero-row writes error; schema + size cap applied.

| Check | Evidence | Location |
|-------|----------|----------|
| `BuilderFlowEditButton` calls `FlowGraphEditor` only (no direct DB write) | `<FlowGraphEditor initialGraph={initialGraph} sopId={sopId} …>` | `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowEditButton.tsx:130` |
| `FlowGraphEditor.handleSave` calls `updateSopFlowGraph` | `await updateSopFlowGraph({ sopId, graph: localGraph })` | `src/lib/builder/flow-graph-field.tsx:177` |
| Role read from JWT claims, NOT user_metadata | `const jwtClaims = … JSON.parse(atob(session.access_token.split('.')[1]))` / `const role = jwtClaims['user_role']` | `src/actions/flow-graph.ts:31-34` |
| `user_metadata` not read (confirmed absent from action) | Grep match is comment-only: `"never user_metadata"` | `src/actions/flow-graph.ts:27` (comment only) |
| Role gate blocks non-admin/safety_manager | `if (!role \|\| !['admin', 'safety_manager'].includes(role)) return { error: 'Admin access required' }` | `src/actions/flow-graph.ts:35-36` |
| Update is org-scoped | `.eq('organisation_id', organisationId)` | `src/actions/flow-graph.ts:49` |
| Zero-row write surfaces as error | `if (!data \|\| data.length === 0) return { error: '…' }` | `src/actions/flow-graph.ts:53-55` |
| FlowGraphSchema applied at action entry | `const parsed = Input.safeParse(input)` where `Input = z.object({ sopId, graph: FlowGraphSchema })` | `src/actions/flow-graph.ts:8-15` |
| No Puck hook called in BuilderFlowEditButton | Grep returns only a comment (`no useGetPuck / usePuck`) — no call site | `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowEditButton.tsx:13` |

### T-24-06 — CLOSED

**Mitigation:** SSR-safe `useState('list')` seed; `useViewport` reconcile in `useEffect` only; spec asserts initial 'list'; human-UAT confirms no #418.

| Check | Evidence | Location |
|-------|----------|----------|
| `useState<'list'\|'graph'>('list')` SSR-safe seed | `const [view, setView] = useState<'list' \| 'graph'>('list')` | `src/components/sop/tabs/FlowTab.tsx:217` |
| `useViewport` import present | `import { useViewport } from '@/hooks/useViewport'` | `src/components/sop/tabs/FlowTab.tsx:13` |
| Reconcile runs in `useEffect` (post-hydration only) | `useEffect(() => { if (viewport === 'desktop') setView('graph') }, [viewport])` | `src/components/sop/tabs/FlowTab.tsx:221-223` |
| No `window.innerWidth` or `window` read at render/module-load | Comment citation of CLAUDE.md 2026-06-08; no window reference outside useEffect | `src/components/sop/tabs/FlowTab.tsx:1-6` |
| FlowGraphCanvas loaded via `next/dynamic ssr:false` | `const FlowGraphCanvas = dynamic(… { ssr: false })` | `src/components/sop/tabs/FlowTab.tsx:20-30` |
| Spec asserts useViewport import + 'list' seed + useEffect desktop reconcile | Three `expect(content).toMatch(…)` assertions live (not fixme) | `src/components/sop/flow/__tests__/flow-graph-canvas.spec.ts:47-56` |
| Human-UAT confirmed no React #418 | Simon approved 2026-06-12 on sopstart.com; SUMMARY 03 Task 3 PASSED | `.planning/phases/24-procedure-flow-spatial-node-graph/24-03-SUMMARY.md:98` |

---

## Unregistered Threat Flags

All three SUMMARY.md `## Threat Flags` sections were inspected:

- **24-01-SUMMARY.md:** No `## Threat Flags` section. No new attack surface declared.
- **24-02-SUMMARY.md:** `## Threat Flags` — "None. Both tasks are pure client-side renderer changes with no network, no auth paths, no schema changes, and no new trust boundaries. The exportPng rasterises only the current user's own SOP flow graph to a local download (T-24-03 accepted disposition)."
- **24-03-SUMMARY.md:** `## Threat Flags` — "None. Both tasks are client-side UI changes. The FlowGraphEditor write path goes through the unchanged `updateSopFlowGraph` server action — T-24-05 mitigated as planned. T-24-06 closed."

**Unregistered flags: none.** All executor-declared threat surface maps to existing threat register entries.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-12 | 7 | 7 | 0 | gsd-security-auditor (Claude Sonnet 4.6) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-12
