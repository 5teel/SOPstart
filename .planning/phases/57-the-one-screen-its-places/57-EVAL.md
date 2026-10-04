# Deployed-site eval — 2026-10-04T15:13:13.045Z

Target: https://sopstart.com · commit 5fe93d3 · 44 passed / 0 failed / 0 skipped

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
| ✅ | Phase 54 -- admin governance inbox + machine detail (deployed) › A -- inbox: unowned fixture is a red row, EVAL Oven is a Machines row, no real-org leak |  |
| ✅ | Phase 54 -- admin governance inbox + machine detail (deployed) › B -- machine detail on the one screen: NO OWNER badge, Open/Edit links, owner none |  |
| ✅ | Phase 54 -- admin governance inbox + machine detail (deployed) › C -- Machines chip filters the inbox to machines rows only |  |
| ✅ | Phase 54 -- admin governance inbox + machine detail (deployed) › D -- Assign owner clears the row and the red pin |  |
| ✅ | Phase 54 -- admin governance inbox + machine detail (deployed) › E -- the Office card opens the Office and its inbox link opens /governance |  |
| ✅ | Phase 57 — the one screen (deployed) › SHL-01 PLC-01: worker lands on three panes with four signposts and no header |  |
| ✅ | Phase 57 — the one screen (deployed) › SHL-02: map click equals list click, and Esc returns to the overview |  |
| ✅ | Phase 57 — the one screen (deployed) › SHL-02: second-iteration leak -- machine, then Office, then another machine shows no stale detail |  |
| ✅ | Phase 57 — the one screen (deployed) › SHL-04: search lights matching machine and room shapes |  |
| ✅ | Phase 57 — the one screen (deployed) › SHL-05: the Now card names the due SOP and opens it |  |
| ✅ | Phase 57 — the one screen (deployed) › PLC-02 PLC-03: a worker walks a SOP from a machine and from the Noticeboard |  |
| ✅ | Phase 57 — the one screen (deployed) › D-11: a place deep link selects on load; a worker edit-mode link falls back to the overview |  |
| ✅ | Phase 57 — the one screen (deployed) › D-12 D-15: a bridge page shows Back to the site and returns to its room |  |
| ✅ | Phase 57 — the one screen (deployed) › PLC-04: worker due pin on EVAL Press |  |
| ✅ | Phase 57 — the one screen (deployed) › PLC-01: a worker on a phone gets the list, with glove-sized rows |  |
| ✅ | Phase 57 — the one screen (deployed) › D-06: the supervisor sees the Office card with the sign-off count |  |
| ✅ | Phase 57 — the one screen (deployed) › PLC-04: admin health pin on EVAL Press |  |
| ✅ | Phase 57 — the one screen (deployed) › D-16 PLC-04: admin Office count equals the governance page open count |  |
| ✅ | Phase 57 — the one screen (deployed) › PLC-02 D-19: admin machine panel offers Walk, Edit and new SOP for the machine |  |
| ✅ | Phase 57 — the one screen (deployed) › D-12 D-13: the Workshop lists the org drafts and links to the new-SOP flow |  |
| ✅ | Phase 57 — the one screen (deployed) › PLC-05 D-08 D-22: edit mode shows the site workspace and the departments strip |  |
| ✅ | Phase 57 — the one screen (deployed) › D-10 D-17: retired URLs (dashboard, list, departments, site, governance views) redirect to the one screen |  |
| ✅ | Phase 57 — the one screen (deployed) › Pitfall 7: real-org overview screenshot, read-only |  |
| ✅ | Phase 57 — the one screen (deployed) › D-10: signed-out root shows the landing page |  |
| ✅ | Phase 51 — site editor (deployed) › admin uploads a scene, draws two machines (one after zoom+pan), names them, tags a department, moves a corner, links a SOP from the builder, and reloads |  |
| ✅ | Phase 51 — site editor (deployed) › a worker gets the overview, not the editor, at the edit-mode address |  |
| ✅ | SOP page — one document, one job (deployed) › worker, desktop: Orient → Prepare → Do, one job at a time, no admin chrome |  |
| ✅ | SOP page — one document, one job (deployed) › worker, phone: same document, glove-sized job chooser and Walk it |  |
| ✅ | SOP page — one document, one job (deployed) › admin keeps the preview toggle and has no Flow tab |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › A -- every SOP has an ok conversion run; convert fixture counts match the known answer; library-linked SOPs converted |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › B -- old SOP page and builder render the converted fixture exactly as before |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › C -- standards: add, attach to the SOP and a section, worker sees the label, rename, remove |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › D -- placement: machine + department, or Whole site |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › E -- owner change, completion reject and an AI write each write one decision; the AI one names the agent |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › F -- ledger is non-empty, refuses service-key update and delete, refuses an unnamed agent |  |

Screenshots (inspect these — CSS/sizing bugs are invisible to assertions): `.planning\evals\latest\57-admin-edit-refused.png`, `.planning\evals\latest\57-admin-edit.png`, `.planning\evals\latest\57-admin-machine.png`, `.planning\evals\latest\57-admin-office.png`, `.planning\evals\latest\57-admin-overview.png`, `.planning\evals\latest\57-admin-workshop.png`, `.planning\evals\latest\57-bridge-activity.png`, `.planning\evals\latest\57-bridge-governance.png`, `.planning\evals\latest\57-real-org-noticeboard.png`, `.planning\evals\latest\57-real-org-office.png`, `.planning\evals\latest\57-real-org-overview.png`, `.planning\evals\latest\57-real-org-smoko.png`, `.planning\evals\latest\57-real-org-workshop.png`, `.planning\evals\latest\57-supervisor-overview.png`, `.planning\evals\latest\57-worker-mobile.png`, `.planning\evals\latest\57-worker-noticeboard.png`, `.planning\evals\latest\57-worker-overview.png`, `.planning\evals\latest\57-worker-search.png`, `.planning\evals\latest\57-worker-zoomed.png`, `.planning\evals\latest\access-wiring-only.png`, `.planning\evals\latest\builder-machines.png`, `.planning\evals\latest\cut-builder-tools.png`, `.planning\evals\latest\cut-existing-completion.png`, `.planning\evals\latest\cut-existing-sop.png`, `.planning\evals\latest\cut-login.png`, `.planning\evals\latest\cut-new-ai.png`, `.planning\evals\latest\cut-not-found.png`, `.planning\evals\latest\cut-profile.png`, `.planning\evals\latest\cut-sign-up.png`, `.planning\evals\latest\cut-upload.png`, `.planning\evals\latest\cut-versions.png`, `.planning\evals\latest\cut-walk-phone.png`, `.planning\evals\latest\cut-walk-signoff.png`, `.planning\evals\latest\cut-worker-plant.png`, `.planning\evals\latest\governance-after-assign.png`, `.planning\evals\latest\governance-inbox.png`, `.planning\evals\latest\governance-panel.png`, `.planning\evals\latest\ledger-b-builder-hazards.png`, `.planning\evals\latest\ledger-b-builder.png`, `.planning\evals\latest\ledger-b-read.png`, `.planning\evals\latest\ledger-b-walk.png`, `.planning\evals\latest\ledger-c-panel.png`, `.planning\evals\latest\ledger-c-worker-read.png`, `.planning\evals\latest\ledger-c-worker-removed.png`, `.planning\evals\latest\ledger-c-worker-renamed.png`, `.planning\evals\latest\ledger-c-worker-walk.png`, `.planning\evals\latest\ledger-d-machine.png`, `.planning\evals\latest\ledger-d-whole-site.png`, `.planning\evals\latest\ledger-e-owner.png`, `.planning\evals\latest\ledger-e-reject.png`, `.planning\evals\latest\site-editor.png`, `.planning\evals\latest\site-empty.png`, `.planning\evals\latest\sop-read-desktop.png`, `.planning\evals\latest\sop-read-mobile.png`, `.planning\evals\latest\sop-walk-desktop.png`, `.planning\evals\latest\sop-walk-mobile.png`

## Screenshots read (second run, commit 5fe93d3; the first run at 9e9708c also passed 44/44)

| Screenshot | What was checked | Seen |
|---|---|---|
| `57-worker-overview` | three panes, no header, four signposts, Now card, due pin | Pass. List / map / detail; Now card "Eval plant fixture SOP"; pin 1 on EVAL Press; four room signs present. Eval scene is placeholder boxes, so room outlines sit on empty ground by design of the fixture. |
| `57-worker-zoomed` | Noticeboard selected: camera, row highlight, detail rows | Pass. Noticeboard outline sits on the floor of the big box; detail lists the convert and walk fixture SOPs, each with Walk. |
| `57-worker-mobile` (390x844) | list-only layout, glove-sized rows | Pass. Search, Now card, Rooms, Departments, Machines stack with the summary under; rows are 44px+ (asserted). |
| `57-admin-overview` | Office card number, room pins, health pin | Pass. Office 2 equals the Office pin; Workshop pin 1 (the eval-site draft); red "!" pin on EVAL Press. Smoko and Office signs sit close together on the eval scene (placeholder art), still legible. |
| `57-admin-machine` | Walk, Edit, NO OWNER badge, new-SOP-for-machine | Pass. Badge, Walk, Edit and "New SOP for this machine" all present; "no photo yet" is the fixture, not a bug. |
| `57-admin-edit` / `57-admin-edit-refused` | edit mode strip and workspace; refusal with counts | Pass. Departments strip over the site workspace; refusal reads "Forming is still used by 2 machines and 0 SOP rules. Move them first." in the hazard token colour. |
| `57-bridge-governance` | Back to the site on a bridged page, no header | Pass. Single "Back to the site" bar, inbox shows "2 open" (matches the Office card). |
| `57-supervisor-overview` | supervisor Office card | Pass. "0 waiting for your sign-off" card with Open the Office. |
| `57-real-org-overview` (first run) | rooms on the real 2752x1536 scene | FAIL on placement. Smoko and Workshop floated on the white ground outside the building. Fixed in `5fe93d3` (see below). Office sat exactly on the Office terminal (expected, D-18); Noticeboard on empty floor. |
| `57-real-org-overview`, `-smoko`, `-workshop` (second run) | same, after the fix | Pass. Smoko is on empty floor right of the pallet stack; Workshop is on floor under the workbench, in front of the band saw. No room covers a machine polygon (checked with the polygons overlaid on the scene image). |

## Added after the run

The deleted sop-surface eval carried the pathways "0 not mapped yet" assertion, so it was folded into `one-screen.eval.ts` (CLAUDE.md pathways rule) after the full run. Run on its own against sopstart.com at 5fe93d3: 1 passed. The full run above is therefore 44 tests; the file now has 20.

## Room placement fix

`ROOMS` in `src/lib/site/rooms.ts` came from the sketch fractions (57-01) and was never checked against a scene. On the real org's scene Smoko and Workshop sat outside the building. Both moved to empty floor; Office and Noticeboard unchanged. `rooms.spec.ts` stays green (no vertex of one room inside another).

## Notes for Simon

- The real org's Office terminal is a machine under the Office room; the room hit-area wins the click (D-18). Click the list row to reach the machine.
- The eval-site scene is grey boxes, so room placement there proves only that signposts and hit-areas render, not that they sit on anything meaningful.

