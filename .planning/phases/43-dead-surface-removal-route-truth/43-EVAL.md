# Phase 43 — Dead-Surface Removal & Route Truth — deployed eval sign-off

## Summary

Two runs against production. First run (commit `2e4a373`): 28/29 passed, test A
("New block opens the create form, creates an item, and archives it") failed —
`new row violates row-level security policy for table "blocks"` when the
create-form submit tried to `.select('*').single()` the just-inserted row.
Reproduced directly against the live DB (SQL + a minted eval-site-admin
session, both 42501) and root-caused: migration 00037 dropped the only SELECT
policy on `public.blocks` (`blocks_read_global_plus_org`) as part of the Phase
25 global-block-model cleanup, but never added an org-scoped replacement —
`INSERT ... RETURNING` needs a passing SELECT check on top of the INSERT's own
WITH CHECK, so any session-client (non-service-role) read of `blocks` has been
silently denied since that migration, masked because every existing read used
the admin client. Fixed with migration `00068_blocks_read_own_org.sql`
(`blocks_read_own_org`, org-scoped SELECT), applied live via the Management
API and reproduced clean before committing (`1ae05cd`). Second run (commit
`1ae05cd`, below): 29/29 passed, 0 failed.

## Screenshots read and judged (2026-09-30, all from the second/green run)

| Screenshot | What was checked | Result |
|---|---|---|
| `new-block-form.png` | Name/Kind/Text/Categories/Tags fields legible on paper tokens; selected "Hazard" chip visibly outlined vs. the four unselected chips; no white-on-white or unstyled control | OK |
| `new-block-created.png` | Created item renders with a live preview panel (tinted WARNING severity badge), category chips, JSON content block — no placeholder/boilerplate text | OK |
| `scan-document.png` | Scanner dialog framed with a visible close (X) button top-right, black capture viewport, "Tap Add page..." copy, "Capture first page" CTA — no "coming soon" text anywhere | OK |
| `access-wiring-only.png` | Access map toolbar (search bar, "Whole site"/dept rows, library collections) has no orphaned gap where the Matrix/Illuminate lens toggle used to render; no lens toggle control at all | OK |
| `admin-library.png` | `/sops` admin library table: filters, checks columns, owner/status columns all render with visible borders/text; "Access map" button top-right | OK |
| `admin-governance.png` | `/governance` inbox + floor-health 3D scene both render; filter chips (All/Stuck/Machines) visibly tinted; no unstyled panels | OK |
| `worker-sops.png` | Worker nav shows only SOPs/Sign-off (no Governance/Content/Team/Site/Settings) — confirms D2's "worker never reaches the inbox" holds visually, not just via URL assertion | OK |

No CSS-token or sizing defects found (CLAUDE.md 2026-07-14 class). No further
fixes needed after the blocks-RLS patch.

---

# Deployed-site eval — 2026-09-30T12:44:52.233Z (green run)

Target: https://sopstart.com · commit 1ae05cd · 29 passed / 0 failed / 2 skipped

| | Test | Failure |
|---|------|---------|
| ✅ | Phase 43 — dead-surface removal (deployed) › A — New block opens the create form, creates an item, and archives it |  |
| ✅ | Phase 43 — dead-surface removal (deployed) › B — Scan document opens the shipped scanner, not a coming-soon modal |  |
| ✅ | Phase 43 — dead-surface removal (deployed) › C — Access map shows the Wiring view only |  |
| ✅ | Phase 43 — dead-surface removal (deployed) › D1 — legacy /admin/sops and /admin/governance land on real routes |  |
| ✅ | Phase 43 — dead-surface removal (deployed) › D2 — a worker following a legacy governance link never reaches the inbox |  |
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

Screenshots (inspect these — CSS/sizing bugs are invisible to assertions): `.planning\evals\latest\access-wiring-only.png`, `.planning\evals\latest\admin-access.png`, `.planning\evals\latest\admin-governance.png`, `.planning\evals\latest\admin-library-filtered.png`, `.planning\evals\latest\admin-library.png`, `.planning\evals\latest\admin-mobile.png`, `.planning\evals\latest\builder-machines.png`, `.planning\evals\latest\governance-after-assign.png`, `.planning\evals\latest\governance-inbox.png`, `.planning\evals\latest\governance-panel.png`, `.planning\evals\latest\new-block-created.png`, `.planning\evals\latest\new-block-form.png`, `.planning\evals\latest\phone-home.png`, `.planning\evals\latest\phone-machine-sheet.png`, `.planning\evals\latest\phone-machine.png`, `.planning\evals\latest\phone-plate-print.png`, `.planning\evals\latest\phone-plate.png`, `.planning\evals\latest\phone-scan-fallback.png`, `.planning\evals\latest\plant-home-ask.png`, `.planning\evals\latest\plant-home-panel.png`, `.planning\evals\latest\plant-home-voice.png`, `.planning\evals\latest\plant-home-zone.png`, `.planning\evals\latest\plant-home.png`, `.planning\evals\latest\scan-document.png`, `.planning\evals\latest\site-editor.png`, `.planning\evals\latest\site-empty.png`, `.planning\evals\latest\sop-read-desktop.png`, `.planning\evals\latest\sop-read-mobile.png`, `.planning\evals\latest\sop-walk-desktop.png`, `.planning\evals\latest\sop-walk-mobile.png`, `.planning\evals\latest\worker-mobile.png`, `.planning\evals\latest\worker-sops.png`
