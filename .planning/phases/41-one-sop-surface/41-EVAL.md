# Deployed-site eval — 2026-09-15T11:24:47.481Z

Target: https://sopstart.com · commit c68ff77 · 7 passed / 0 failed / 0 skipped

| | Test | Failure |
|---|------|---------|
| ✅ | admin, desktop › A — Admin scope group renders inside the Miller frame with counts, one department group, columns aligned |  |
| ✅ | admin, desktop › B — Drafts lens lists SOPs, a selected row exposes one Open→builder chain, attention + access lenses take over full-width and return without reload |  |
| ✅ | admin, desktop › C — worker behaviours survive for an admin: All yours scope, search overlay, department filter |  |
| ✅ | admin, desktop › D — one SOPs door: single nav entry, legacy admin URLs redirect onto /sops, Governance deep-links the attention lens |  |
| ✅ | admin, desktop › E — pathways map reports zero unmapped screens |  |
| ✅ | worker › F1 — desktop: no Admin group, legacy admin URL bounces away from admin params |  |
| ✅ | worker › F2 — mobile: stacked worker list, no admin scopes |  |

Screenshots (inspect these — CSS/sizing bugs are invisible to assertions): `.planning\evals\latest\admin-access.png`, `.planning\evals\latest\admin-attention.png`, `.planning\evals\latest\admin-sops.png`, `.planning\evals\latest\worker-mobile.png`, `.planning\evals\latest\worker-sops.png`
