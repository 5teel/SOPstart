# Deployed-site eval — 2026-10-05T10:48:35.288Z

Target: https://sopstart.com · commit e844e3b · 60 passed / 0 failed / 0 skipped

| | Test | Failure |
|---|------|---------|
| ✅ | Phase 55 — cut features (deployed) › worker at 1440 sees pins and the next-SOP card — no install prompt, no offline banner, no microphone, no service worker |  |
| ✅ | Phase 55 — cut features (deployed) › existing SOPs, completions and photos still open |  |
| ✅ | Phase 55 — cut features (deployed) › admin sees none of the dropped authoring tools; dead addresses show the not-found page |  |
| ✅ | Phase 55 — cut features (deployed) › sign-up says ask your admin; login has no register link; profile has no organisation switch |  |
| ✅ | walk with a photo, then it waits for sign-off › worker on a phone walks the walk fixture, adds the photo it asks for and sends it — nothing queued |  |
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
| ✅ | Phase 57 — the one screen (deployed) › CLAUDE.md pathways: the pathways map reports zero unmapped screens |  |
| ✅ | Phase 57 — the one screen (deployed) › D-10: signed-out root shows the landing page |  |
| ✅ | Phase 51 — site editor (deployed) › admin uploads a scene, draws two machines (one after zoom+pan), names them, tags a department, moves a corner, links a SOP from the editor, and reloads |  |
| ✅ | Phase 51 — site editor (deployed) › a worker gets the overview, not the editor, at the edit-mode address |  |
| ✅ | Phase 58 — the SOP focus screen (deployed) › SC1 real-org SOP (OTG Probe Maintenance) opens in the focus screen browse state, read-only |  |
| ✅ | worker: frame, walk, versions, Back and phone › SC1 frame: opened from a machine it holds only the SOP — Back + title, rail 300 px, column <= 820, Start walking, no site chrome |  |
| ✅ | worker: frame, walk, versions, Back and phone › SC1 compiled CSS contains text-step, max-w-205, w-75, size-18 and bg-accent-signoff (a utility that compiles to nothing is invisible to every other check) |  |
| ✅ | worker: frame, walk, versions, Back and phone › SC2 walk: hazard, PPE and photo steps, locked rail, review, Send, sent — then Back to the place it came from; a second walk in the same session starts clean |  |
| ✅ | worker: frame, walk, versions, Back and phone › SC2 resume: reopening mid-walk offers "Resume where you left off"; Esc closes the Start over dialog; Start over begins again |  |
| ✅ | worker: frame, walk, versions, Back and phone › SC2 jump-ahead: with it on every row opens and unacknowledged hazard dots are hollow |  |
| ✅ | worker: frame, walk, versions, Back and phone › SC5 addresses: an old tab address redirects to the bare focus address; a superseded or draft version never reaches a worker |  |
| ✅ | worker: frame, walk, versions, Back and phone › SC5 phone (390x844): sticky dock, rail hidden behind "Steps · n of N", 28 px text; the rail opens as a full-screen sheet of 44 px rows |  |
| ✅ | admin: editor, parsing, versions and publish › SC3 58-edit-admin: version slot, AI banner above the first section, tick per step, kind borders, "Checked 2 of 4" |  |
| ✅ | admin: editor, parsing, versions and publish › SC3 58-edit-ai-findings: violet markers, Publish off with reasons, Clear writes "Cleared · logged in the decision ledger" |  |
| ✅ | admin: editor, parsing, versions and publish › SC3 58-edit-publish-dialog: every step checked and no finding open, Publish is on; the dialog recesses the screen and "Not yet" leaves the draft alone |  |
| ✅ | admin: editor, parsing, versions and publish › SC3 58-edit-blank: "Nothing here yet", Add a section, "Checked 0 of 0", Publish off |  |
| ✅ | admin: editor, parsing, versions and publish › SC3 58-this-sop: the rail block shows the version, the earlier versions and the jump-ahead switch |  |
| ✅ | admin: editor, parsing, versions and publish › SC5 58-superseded: the admin opens the exact earlier version, "v2 — superseded", no Start walking, no switch |  |
| ✅ | admin: editor, parsing, versions and publish › SC4 58-parsing: the frame is never empty -- stage line, rough time, skeleton rail and cards -- and the video reads "Transcribing the video" |  |
| ✅ | admin: editor, parsing, versions and publish › SC4 58-parse-failed: the card says it could not read the document, shows the job's own line, Try again and Back |  |
| ✅ | admin: editor, parsing, versions and publish › SOP-04: Start editing v2 (client navigation, no reload), check every step one by one, Publish; a worker on the old address lands on v2 and v1 stays on record |  |
| ✅ | admin: editor, parsing, versions and publish › D-03 58-annotate: add a photo, Annotate, draw one shape, Save -- the photo changes and the tick clears; Esc on a second open saves nothing |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › A -- every SOP has an ok conversion run; convert fixture counts match the known answer; library-linked SOPs converted |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › B -- the focus screen (browse) and the editor render the converted fixture |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › C -- standards: add, attach to the SOP and a section, worker sees the label, rename, remove |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › D -- placement: machine + department, or Whole site |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › E -- owner change, completion reject and an AI write each write one decision; the AI one names the agent |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › F -- ledger is non-empty, refuses service-key update and delete, refuses an unnamed agent |  |

Screenshots (inspect these — CSS/sizing bugs are invisible to assertions): `.planning\evals\latest\57-admin-edit-refused.png`, `.planning\evals\latest\57-admin-edit.png`, `.planning\evals\latest\57-admin-machine.png`, `.planning\evals\latest\57-admin-office.png`, `.planning\evals\latest\57-admin-overview.png`, `.planning\evals\latest\57-admin-workshop.png`, `.planning\evals\latest\57-bridge-activity.png`, `.planning\evals\latest\57-bridge-governance.png`, `.planning\evals\latest\57-real-org-noticeboard.png`, `.planning\evals\latest\57-real-org-office.png`, `.planning\evals\latest\57-real-org-overview.png`, `.planning\evals\latest\57-real-org-smoko.png`, `.planning\evals\latest\57-real-org-workshop.png`, `.planning\evals\latest\57-supervisor-overview.png`, `.planning\evals\latest\57-worker-mobile.png`, `.planning\evals\latest\57-worker-noticeboard.png`, `.planning\evals\latest\57-worker-overview.png`, `.planning\evals\latest\57-worker-search.png`, `.planning\evals\latest\57-worker-zoomed.png`, `.planning\evals\latest\58-annotate.png`, `.planning\evals\latest\58-back-place.png`, `.planning\evals\latest\58-browse-real-org.png`, `.planning\evals\latest\58-browse-worker.png`, `.planning\evals\latest\58-edit-admin.png`, `.planning\evals\latest\58-edit-ai-findings.png`, `.planning\evals\latest\58-edit-blank.png`, `.planning\evals\latest\58-edit-publish-dialog.png`, `.planning\evals\latest\58-parse-failed.png`, `.planning\evals\latest\58-parsing-video.png`, `.planning\evals\latest\58-parsing.png`, `.planning\evals\latest\58-phone-rail.png`, `.planning\evals\latest\58-phone-walk.png`, `.planning\evals\latest\58-publish-done.png`, `.planning\evals\latest\58-publish-ready.png`, `.planning\evals\latest\58-resume.png`, `.planning\evals\latest\58-review.png`, `.planning\evals\latest\58-sent.png`, `.planning\evals\latest\58-superseded.png`, `.planning\evals\latest\58-this-sop.png`, `.planning\evals\latest\58-walk-hazard.png`, `.planning\evals\latest\58-walk-jump-on.png`, `.planning\evals\latest\58-walk-locked-rail.png`, `.planning\evals\latest\58-walk-photo-required.png`, `.planning\evals\latest\58-walk-ppe.png`, `.planning\evals\latest\access-wiring-only.png`, `.planning\evals\latest\cut-builder-tools.png`, `.planning\evals\latest\cut-existing-completion.png`, `.planning\evals\latest\cut-existing-sop.png`, `.planning\evals\latest\cut-login.png`, `.planning\evals\latest\cut-new-ai.png`, `.planning\evals\latest\cut-not-found.png`, `.planning\evals\latest\cut-profile.png`, `.planning\evals\latest\cut-sign-up.png`, `.planning\evals\latest\cut-upload.png`, `.planning\evals\latest\cut-versions.png`, `.planning\evals\latest\cut-walk-phone.png`, `.planning\evals\latest\cut-walk-signoff.png`, `.planning\evals\latest\cut-worker-plant.png`, `.planning\evals\latest\editor-machines.png`, `.planning\evals\latest\governance-after-assign.png`, `.planning\evals\latest\governance-inbox.png`, `.planning\evals\latest\governance-panel.png`, `.planning\evals\latest\ledger-b-browse.png`, `.planning\evals\latest\ledger-b-editor-hazards.png`, `.planning\evals\latest\ledger-b-editor.png`, `.planning\evals\latest\ledger-c-panel.png`, `.planning\evals\latest\ledger-c-worker-read.png`, `.planning\evals\latest\ledger-c-worker-removed.png`, `.planning\evals\latest\ledger-c-worker-renamed.png`, `.planning\evals\latest\ledger-d-machine.png`, `.planning\evals\latest\ledger-d-whole-site.png`, `.planning\evals\latest\ledger-e-owner.png`, `.planning\evals\latest\ledger-e-reject.png`, `.planning\evals\latest\site-editor.png`, `.planning\evals\latest\site-empty.png`
