# Deployed-site eval — 2026-09-28T17:41:23.911Z

Target: https://sopstart.com · commit fd1ec3a · 20 passed / 0 failed / 0 skipped

| | Test | Failure |
|---|------|---------|
| ✅ | Phase 53 — phone home (deployed) › eval-site worker at 390×844: ask bar, Now card, floor picture, Scan → machine sheet lists EVAL Press under Forming → /m/<code> → Walk it |  |
| ✅ | Phase 53 — phone home (deployed) › Scan with no camera falls back to typing the code, which opens /m/<code> |  |
| ✅ | Phase 53 — phone home (deployed) › logged out, /m/<code> goes to /login?next=…, and a signed-in visit to that login URL lands on the machine |  |
| ✅ | Phase 53 — phone home (deployed) › a worker in another org gets a 404 for the EVAL Press code |  |
| ✅ | Phase 53 — phone home (deployed) › eval-site admin: the plate page renders at A6 with the QR, name, department and code; print hides the controls; the site editor links to it; a worker cannot open the plate |  |
| ✅ | Phase 53 — phone home (deployed) › a worker whose org has no site still sees today's phone list |  |
| ✅ | Phase 52 — worker plant home (deployed) › eval-site worker at 1440 sees the scene, a pin on EVAL Press, the Now card, the panel, a chip fit, the ask highlight and the voice dialog — no scope column, no console errors |  |
| ✅ | Phase 52 — worker plant home (deployed) › a worker whose org has no site still sees the list |  |
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

Screenshots (inspect these — CSS/sizing bugs are invisible to assertions): `.planning\evals\latest\admin-access.png`, `.planning\evals\latest\admin-attention.png`, `.planning\evals\latest\admin-search.png`, `.planning\evals\latest\admin-sops.png`, `.planning\evals\latest\builder-machines.png`, `.planning\evals\latest\phone-home-fallback.png`, `.planning\evals\latest\phone-home.png`, `.planning\evals\latest\phone-machine-sheet.png`, `.planning\evals\latest\phone-machine.png`, `.planning\evals\latest\phone-plate-print.png`, `.planning\evals\latest\phone-plate.png`, `.planning\evals\latest\phone-scan-fallback.png`, `.planning\evals\latest\plant-home-ask.png`, `.planning\evals\latest\plant-home-fallback.png`, `.planning\evals\latest\plant-home-panel.png`, `.planning\evals\latest\plant-home-voice.png`, `.planning\evals\latest\plant-home-zone.png`, `.planning\evals\latest\plant-home.png`, `.planning\evals\latest\site-editor.png`, `.planning\evals\latest\site-empty.png`, `.planning\evals\latest\sop-read-desktop.png`, `.planning\evals\latest\sop-read-mobile.png`, `.planning\evals\latest\sop-walk-desktop.png`, `.planning\evals\latest\sop-walk-mobile.png`, `.planning\evals\latest\worker-mobile.png`, `.planning\evals\latest\worker-sops.png`

## Screenshots read (orchestrator)

Every phone-home screenshot plus `plant-home.png`/`worker-sops.png` (regression) was opened and read:

- **phone-home.png** — Ask bar, Now card ("Eval plant fixture SOP", red/pink NEVER DONE badge, dark "Walk it" + outlined "Read" — no Show me), the floor thumbnail (fixture scene drawing, filled not blank), a full-width dark "Scan a machine plate" button, "Everything else" strip below. All legible, no missing tokens.
- **phone-machine-sheet.png** — Bottom sheet "Machines on your site", "FORMING" group with an amber department dot, "EVAL Press" row with an amber "1" to-do count.
- **phone-machine.png** — `/m/<code>` in-page card: "no photo yet" placeholder (sprite unset, as expected), FORMING in orange, "EVAL Press" title, the fixture SOP row with a tinted "NEVER DONE" badge and "Walk ›" — no close control (correct: nothing to close back to).
- **phone-scan-fallback.png** — Dark full-screen scan sheet, "Couldn't start the camera — type the code on the plate." note, a readable dark-outlined code field, white "Open machine" button.
- **phone-plate.png** — A6 plate: sharp square QR, "EVAL Press", "FORMING", large mono code "QW5B6R", "Print plate" and "Back to site map" controls.
- **phone-plate-print.png** — Same plate with `media: print` emulated — the QR/name/department/code card renders identically, both buttons and the page chrome are gone (`.no-print` hidden as designed).
- **phone-home-fallback.png** — Real-org `eval-worker` (no drawn site): today's classic stacked phone list ("All yours"/"Never done"/"Everything" chips, one SOP row) — no phone home rendered.
- **plant-home.png** (regression) — Desktop plant scene, amber pin "1", Now card with dark "Walk it" + outlined "Show me" — unaffected by this phase's changes.
- **worker-sops.png** (regression) — Desktop admin Miller-frame view — unaffected.

No visual defects found; no further eval runs needed beyond the one fix below.

## Manual-only

Real camera decode of a printed plate on an Android phone and an iPhone — not exercised by the eval (headless Chromium has no camera). On an Android phone and an iPhone: open sopstart.com, sign in, tap "Scan a machine plate", point the camera at a printed EVAL Press plate, confirm it lands on `/m/<code>` with the machine's jobs listed. Instructions also recorded in 53-VALIDATION.md.
