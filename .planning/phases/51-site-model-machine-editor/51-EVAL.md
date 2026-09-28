# Deployed-site eval — 2026-09-28T12:57:29.541Z

Target: https://sopstart.com · commit cf9d1e1 · 12 passed / 0 failed / 0 skipped

| | Test | Failure |
|---|------|---------|
| ✅ | Phase 51 — site editor (deployed) › admin uploads a scene, draws two machines (one after zoom+pan), names them, tags a department, moves a corner, links a SOP from the builder, and reloads |  |
| ✅ | Phase 51 — site editor (deployed) › a worker is sent away from /admin/site |  |
| ✅ | SOP page — one document, one job (deployed) › worker, desktop: Orient → Prepare → Do, one job at a time, no admin chrome |  |
| ✅ | SOP page — one document, one job (deployed) › worker, phone: same document, glove-sized job chooser and Walk it |  |
| ✅ | SOP page — one document, one job (deployed) › admin keeps the preview toggle and the Flow tab |  |
| ✅ | admin, desktop › A — Admin scope group renders inside the Miller frame with counts, one department group, columns aligned |  |
| ✅ | admin, desktop › B — Drafts lens lists SOPs, Open goes to the worker view and Edit is the one builder chain, attention stays in-frame, access takes over full-width and returns without reload |  |
| ✅ | admin, desktop › C — worker behaviours survive for an admin: All yours scope, search overlay, department filter |  |
| ✅ | admin, desktop › D — one SOPs door: single nav entry, legacy admin URLs redirect onto /sops, Governance deep-links the attention lens |  |
| ✅ | admin, desktop › E — pathways map reports zero unmapped screens |  |
| ✅ | worker › F1 — desktop: no Admin group, legacy admin URL bounces away from admin params |  |
| ✅ | worker › F2 — mobile: stacked worker list, no admin scopes |  |

Screenshots (inspect these — CSS/sizing bugs are invisible to assertions): `.planning\evals\latest\admin-access.png`, `.planning\evals\latest\admin-attention.png`, `.planning\evals\latest\admin-search.png`, `.planning\evals\latest\admin-sops.png`, `.planning\evals\latest\builder-machines.png`, `.planning\evals\latest\site-editor.png`, `.planning\evals\latest\site-empty.png`, `.planning\evals\latest\sop-read-desktop.png`, `.planning\evals\latest\sop-read-mobile.png`, `.planning\evals\latest\sop-walk-desktop.png`, `.planning\evals\latest\sop-walk-mobile.png`, `.planning\evals\latest\worker-library.png`, `.planning\evals\latest\worker-mobile-library.png`, `.planning\evals\latest\worker-mobile.png`, `.planning\evals\latest\worker-sops.png`
