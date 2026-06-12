# Phase 24 — Human UAT Runbook

**Run on:** sopstart.com (deployed app), authenticated as an admin.
**Deploy first:** Push `master` → Railway auto-deploys. Wait for the deployment to complete before running.

---

## Status: PASSED

All three scenarios approved by Simon on **2026-06-12** on sopstart.com (post-deploy, dynamic-import fix in commit `20bb8a5`).

| Scenario | Result | Verified by |
|----------|--------|-------------|
| FLOW-05 Round-Trip | PASS | Simon, 2026-06-12 |
| FLOW-03 Export (Fit + Export PNG) | PASS | Simon, 2026-06-12 |
| FLOW-04 Viewport Default | PASS | Simon, 2026-06-12 |

---

## Scenario 1: FLOW-05 Round-Trip (carried Phase 12.5 item)

**Result: PASS**

Confirms the admin can author explicit node positions and the worker Flow tab reflects them.

1. Open any SOP that has Decision or Measurement blocks in the admin builder (`/admin/sops/builder/[sopId]`).
2. In the builder header (top bar), click **"Edit flow"** (GitBranch icon). The FlowGraphEditor modal should open — **not** hidden by the suppressed Puck sidebar.
3. Verify the editor opens seeded with the current graph (either the stored explicit graph or the derived layout — not an empty canvas).
4. Drag one or more nodes to new positions. Click **"Save to SOP"**. Confirm no error appears.
5. Reload the builder page. Click **"Edit flow"** again. Confirm the dragged positions persisted (nodes are where you left them).
6. Open the worker-facing Flow tab at `/sops/[sopId]`. Click the **Graph** toggle (or confirm graph is default on desktop). Confirm the graph renders the nodes at the AUTHORED positions (not auto-layout depth columns).
7. Toggle **List / Graph** both ways and confirm both views render correctly.

**Pass criteria:** Editor opens; positions save; Flow tab reflects authored positions; both toggles work.

---

## Scenario 2: FLOW-03 Export (fit-to-view + Export PNG)

**Result: PASS**

Confirms the production renderer controls work correctly.

1. Open `/sops/[sopId]` and click the **Graph** toggle (or it should already be selected on desktop).
2. Click **Fit** in the FlowGraphCanvas toolbar. Confirm the entire graph fits within the visible viewport in one click (no scroll jump, no partial crop).
3. Click **Export PNG**. Confirm a PNG file downloads.
4. Open the downloaded PNG. Confirm:
   - Node colours match the on-screen colour tokens (coloured fills — not all-black nodes; this confirms CSS `var(--accent-*)` was inlined before rasterisation).
   - Node labels are legible (system-font fallback is acceptable for v1).

**Pass criteria:** Fit centres the graph; PNG downloads with correct accent-colour fills.

---

## Scenario 3: FLOW-04 Viewport Default (desktop graph / mobile list)

**Result: PASS**

Confirms the SSR-safe desktop-default logic and no hydration errors.

1. On a **desktop browser ≥ 1024px wide**, open `/sops/[sopId]`. Click the **Flow** tab. Confirm the graph view is shown by **default** (no manual toggle needed).
2. On a **phone** (or resize the browser to ≤ 1023px), open the same URL. Click the Flow tab. Confirm the **list** view is shown by default.
3. In either viewport, toggle List → Graph → List. Confirm the toggle works both ways.
4. Open the browser DevTools console. Confirm there is **NO** React hydration warning (`#418`) or `Warning: Text content did not match` on page load.

**Pass criteria:** Desktop defaults to graph; mobile defaults to list; toggle works; no hydration warning in console.

---

## Resume signal

Type **"approved"** once all three scenarios pass on the deployed app.

If any scenario fails, describe the issue (e.g. "editor still hidden", "PNG nodes all black", "hydration #418 in console", "positions not persisted after reload") so the gap can be closed before Phase 24 is marked complete.
