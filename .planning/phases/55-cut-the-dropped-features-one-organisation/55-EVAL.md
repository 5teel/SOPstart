# Deployed-site eval — 2026-10-03T12:49:17.238Z

Target: https://sopstart.com · commit 2d60b43 · 28 passed / 0 failed / 1 skipped

| | Test | Failure |
|---|------|---------|
| ✅ | Phase 55 — cut features (deployed) › worker at 1440 sees pins and the next-SOP card — no install prompt, no offline banner, no microphone, no service worker |  |
| ✅ | Phase 55 — cut features (deployed) › existing SOPs, completions and photos still open |  |
| ✅ | Phase 55 — cut features (deployed) › admin sees none of the dropped authoring tools; dead addresses show the not-found page |  |
| ✅ | Phase 55 — cut features (deployed) › sign-up says ask your admin; login has no register link; profile has no organisation switch |  |
| ✅ | walk with a photo, then it waits for sign-off › worker on a phone walks the walk fixture, takes the photo it asks for and submits — nothing queued |  |
| ✅ | walk with a photo, then it waits for sign-off › admin sees that completion waiting for sign-off with its photo |  |
| ✅ | Phase 43 — dead-surface removal (deployed) › C — Access map shows the Wiring view only |  |
| ✅ | Phase 43 — dead-surface removal (deployed) › D1 — legacy /admin/sops and /admin/governance land on real routes |  |
| ✅ | Phase 43 — dead-surface removal (deployed) › D2 — a worker following a legacy governance link never reaches the inbox |  |
| ✅ | Phase 54 -- admin governance inbox + floor health (deployed) › A -- inbox + floor: unowned fixture is a red row, EVAL Oven is a Machines row, EVAL Press pins bad, no real-org leak |  |
| ✅ | Phase 54 -- admin governance inbox + floor health (deployed) › B -- machine panel: NO OWNER badge, Open/Edit links, owner none |  |
| ✅ | Phase 54 -- admin governance inbox + floor health (deployed) › C -- Machines chip filters the inbox to machines rows only |  |
| ✅ | Phase 54 -- admin governance inbox + floor health (deployed) › D -- Assign owner clears the row and the red pin |  |
| ✅ | Phase 54 -- admin governance inbox + floor health (deployed) › E -- header Governance link opens the inbox |  |
| ✅ | Phase 52 — worker plant home (deployed) › eval-site worker at 1440 sees the scene, a pin on EVAL Press, the Now card, the panel, a chip fit, the ask highlight and no microphone — no scope column, no console errors |  |
| ⏭ | Phase 52 — worker plant home (deployed) › a worker whose org has no site still sees the list |  |
| ✅ | Phase 51 — site editor (deployed) › admin uploads a scene, draws two machines (one after zoom+pan), names them, tags a department, moves a corner, links a SOP from the builder, and reloads |  |
| ✅ | Phase 51 — site editor (deployed) › a worker is sent away from /admin/site |  |
| ✅ | SOP page — one document, one job (deployed) › worker, desktop: Orient → Prepare → Do, one job at a time, no admin chrome |  |
| ✅ | SOP page — one document, one job (deployed) › worker, phone: same document, glove-sized job chooser and Walk it |  |
| ✅ | SOP page — one document, one job (deployed) › admin keeps the preview toggle and has no Flow tab |  |
| ✅ | admin, desktop › A — library table: checks row, one builder chain per row, header/search |  |
| ✅ | admin, desktop › B — chips narrow the table and resolve deep links |  |
| ✅ | admin, desktop › C — Access lens opens full-width and returns without a reload |  |
| ✅ | admin, desktop › D — legacy governance URLs land on /governance; legacy status URL keeps resolving onto the table |  |
| ✅ | admin, desktop › E — pathways map reports zero unmapped screens |  |
| ✅ | worker › F1 — desktop: no library table, no Governance link, worker list or plant |  |
| ✅ | worker › F2 — mobile: no library table, no Governance link |  |
| ✅ | worker › F3 — admin on a phone renders no library table (an admin on a phone is a worker, D-07) |  |

Screenshots (inspect these — CSS/sizing bugs are invisible to assertions): `.planning\evals\latest\access-wiring-only.png`, `.planning\evals\latest\admin-access.png`, `.planning\evals\latest\admin-governance.png`, `.planning\evals\latest\admin-library-filtered.png`, `.planning\evals\latest\admin-library.png`, `.planning\evals\latest\admin-mobile.png`, `.planning\evals\latest\builder-machines.png`, `.planning\evals\latest\cut-builder-tools.png`, `.planning\evals\latest\cut-existing-completion.png`, `.planning\evals\latest\cut-existing-sop.png`, `.planning\evals\latest\cut-login.png`, `.planning\evals\latest\cut-new-ai.png`, `.planning\evals\latest\cut-not-found.png`, `.planning\evals\latest\cut-profile.png`, `.planning\evals\latest\cut-sign-up.png`, `.planning\evals\latest\cut-upload.png`, `.planning\evals\latest\cut-versions.png`, `.planning\evals\latest\cut-walk-phone.png`, `.planning\evals\latest\cut-walk-signoff.png`, `.planning\evals\latest\cut-worker-plant.png`, `.planning\evals\latest\governance-after-assign.png`, `.planning\evals\latest\governance-inbox.png`, `.planning\evals\latest\governance-panel.png`, `.planning\evals\latest\plant-home-ask.png`, `.planning\evals\latest\plant-home-panel.png`, `.planning\evals\latest\plant-home-zone.png`, `.planning\evals\latest\plant-home.png`, `.planning\evals\latest\site-editor.png`, `.planning\evals\latest\site-empty.png`, `.planning\evals\latest\sop-read-desktop.png`, `.planning\evals\latest\sop-read-mobile.png`, `.planning\evals\latest\sop-walk-desktop.png`, `.planning\evals\latest\sop-walk-mobile.png`, `.planning\evals\latest\worker-mobile.png`, `.planning\evals\latest\worker-sops.png`
