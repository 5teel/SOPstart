# Deployed-site eval — 2026-09-29T06:14:48.628Z

Target: https://sopstart.com · commit 5049f29 · 24 passed / 0 failed / 2 skipped

| | Test | Failure |
|---|------|---------|
| ✅ | Phase 54 -- admin governance inbox + floor health (deployed) › A -- inbox + floor: unowned fixture is a red row, EVAL Oven is a Machines row, EVAL Press pins bad, no real-org leak |  |
| ✅ | Phase 54 -- admin governance inbox + floor health (deployed) › B -- machine panel: NO OWNER badge, Open/Edit links, owner none |  |
| ✅ | Phase 54 -- admin governance inbox + floor health (deployed) › C -- Machines chip filters the inbox to machines rows only |  |
| ✅ | Phase 54 -- admin governance inbox + floor health (deployed) › D -- Assign owner clears the row and the red pin |  |
| ✅ | Phase 54 -- admin governance inbox + floor health (deployed) › E -- header Governance link opens the inbox |  |
| ✅ | Phase 53 — phone home (deployed) › eval-site worker at 390×844: ask bar, Now card, floor picture, Scan → machine sheet lists EVAL Press under Forming → /m/<code> → Walk it |  |
| ✅ | Phase 53 — phone home (deployed) › Scan with no camera falls back to typing the code, which opens /m/<code> |  |
| ✅ | Phase 53 — phone home (deployed) › logged out, /m/<code> goes to /login?next=…, and a signed-in visit to that login URL lands on the machine |  |
| ✅ | Phase 53 — phone home (deployed) › a worker in another org gets a 404 for the EVAL Press code |  |
| ✅ | Phase 53 — phone home (deployed) › eval-site admin: the plate page renders at A6 with the QR, name, department and code; print hides the controls; the site editor links to it; a worker cannot open the plate |  |
| ⏭ | Phase 53 — phone home (deployed) › a worker whose org has no site still sees today's phone list |  |
| ✅ | Phase 52 — worker plant home (deployed) › eval-site worker at 1440 sees the scene, a pin on EVAL Press, the Now card, the panel, a chip fit, the ask highlight and the voice dialog — no scope column, no console errors |  |
| ⏭ | Phase 52 — worker plant home (deployed) › a worker whose org has no site still sees the list |  |
| ✅ | Phase 51 — site editor (deployed) › admin uploads a scene, draws two machines (one after zoom+pan), names them, tags a department, moves a corner, links a SOP from the builder, and reloads |  |
| ✅ | Phase 51 — site editor (deployed) › a worker is sent away from /admin/site |  |
| ✅ | SOP page — one document, one job (deployed) › worker, desktop: Orient → Prepare → Do, one job at a time, no admin chrome |  |
| ✅ | SOP page — one document, one job (deployed) › worker, phone: same document, glove-sized job chooser and Walk it |  |
| ✅ | SOP page — one document, one job (deployed) › admin keeps the preview toggle and the Flow tab |  |
| ✅ | admin, desktop › A — library table: checks row, one builder chain per row, header/search |  |
| ✅ | admin, desktop › B — chips narrow the table and resolve deep links |  |
| ✅ | admin, desktop › C — Access lens opens full-width and returns without a reload |  |
| ✅ | admin, desktop › D — legacy governance URLs land on /governance; legacy status URL keeps resolving onto the table |  |
| ✅ | admin, desktop › E — pathways map reports zero unmapped screens |  |
| ✅ | worker › F1 — desktop: no library table, no Governance link, worker list or plant |  |
| ✅ | worker › F2 — mobile: no library table, no Governance link |  |
| ✅ | worker › F3 — admin on a phone renders no library table (an admin on a phone is a worker, D-07) |  |

Screenshots (inspect these — CSS/sizing bugs are invisible to assertions): `.planning\evals\latest\admin-access.png`, `.planning\evals\latest\admin-governance.png`, `.planning\evals\latest\admin-library-filtered.png`, `.planning\evals\latest\admin-library.png`, `.planning\evals\latest\admin-mobile.png`, `.planning\evals\latest\builder-machines.png`, `.planning\evals\latest\governance-after-assign.png`, `.planning\evals\latest\governance-inbox.png`, `.planning\evals\latest\governance-panel.png`, `.planning\evals\latest\phone-home.png`, `.planning\evals\latest\phone-machine-sheet.png`, `.planning\evals\latest\phone-machine.png`, `.planning\evals\latest\phone-plate-print.png`, `.planning\evals\latest\phone-plate.png`, `.planning\evals\latest\phone-scan-fallback.png`, `.planning\evals\latest\plant-home-ask.png`, `.planning\evals\latest\plant-home-panel.png`, `.planning\evals\latest\plant-home-voice.png`, `.planning\evals\latest\plant-home-zone.png`, `.planning\evals\latest\plant-home.png`, `.planning\evals\latest\site-editor.png`, `.planning\evals\latest\site-empty.png`, `.planning\evals\latest\sop-read-desktop.png`, `.planning\evals\latest\sop-read-mobile.png`, `.planning\evals\latest\sop-walk-desktop.png`, `.planning\evals\latest\sop-walk-mobile.png`, `.planning\evals\latest\worker-mobile.png`, `.planning\evals\latest\worker-sops.png`
