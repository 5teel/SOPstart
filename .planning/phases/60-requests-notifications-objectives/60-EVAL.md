# Deployed-site eval — 2026-10-06T02:10:49.893Z

Target: https://sopstart.com · commit 5ca988b · 65 passed / 3 failed / 18 skipped

| | Test | Failure |
|---|------|---------|
| ✅ | Phase 55 — cut features (deployed) › worker at 1440 sees pins and the next-SOP card — no install prompt, no offline banner, no microphone, no service worker |  |
| ✅ | Phase 55 — cut features (deployed) › existing SOPs open, and an old completion address lands on the Office |  |
| ✅ | Phase 55 — cut features (deployed) › admin sees none of the dropped authoring tools; dead addresses show the not-found page |  |
| ✅ | Phase 55 — cut features (deployed) › sign-up says ask your admin; login has no register link; profile has no organisation switch |  |
| ✅ | walk with a photo, then it waits for sign-off › worker on a phone walks the walk fixture, adds the photo it asks for and sends it — nothing queued |  |
| ✅ | walk with a photo, then it waits for sign-off › admin sees that completion waiting for sign-off in the Office inbox with its photo |  |
| ✅ | Phase 43 — dead-surface removal (deployed) › C — Access map shows the Wiring view only |  |
| ✅ | Phase 43 — dead-surface removal (deployed) › D1 — legacy /admin/sops and /admin/governance land on real routes |  |
| ✅ | Phase 43 — dead-surface removal (deployed) › D2 — a worker following a legacy governance link never reaches the inbox |  |
| ✅ | office cases › meta line: owner and review line on a machine panel row, a Noticeboard row and a Workshop draft; This SOP carries Owner and Review (59-07) |  |
| ✅ | office cases › inbox: tabs, count equals the pin, the unowned row has Assign owner, assigning clears it by title and the receipt ends "logged in the decision ledger" (59-09) |  |
| ✅ | office cases › inbox: a machine with no SOPs is no longer an inbox row (no Machines chip, no machines-kind row); it reaches the Office as an agent request (60-05, D-05; proved in requests.eval), no real-org title leaks |  |
| ✅ | office cases › inbox: Mark reviewed on an overdue row clears it (59-09) |  |
| ✅ | office cases › idle supervisor: a true empty inbox reads "Nothing needs you. That's the goal." with a two-segment tab control (Inbox, Requests) and no chips or cleared-today line (59-09, 60-11) |  |
| ✅ | office cases › admin sign-off: pending completion with a photo, thumbnail loads, lightbox opens, Escape closes the lightbox only, override reason enables Sign off, row leaves, pin patched; twice (59-09) |  |
| ✅ | office cases › supervisor sign-off: the supervised worker walk with a photo appears, a non-assessor sees the teaching callout and can reject; the unsupervised worker walk is absent (59-09) |  |
| ✅ | office cases › supervisor owner marks reviewed on their own SOP (59-09) |  |
| ✅ | office cases › reject with a reason; the worker then sees the walk as sent back; second iteration (59-09) |  |
| ✅ | office cases › approve end to end and send back on a pending-approval SOP (59-09) |  |
| ✅ | office cases › real org: inbox screenshot, read only, no writes (59-09) |  |
| ✅ | office cases › decisions: wide pane, newest first, a kind chip narrows, absolute time on hover, the map re-centres (59-10) |  |
| ✅ | office cases › people: wide pane, invite with a role, Invited chip, role change both ways, remove with confirmation (59-11) |  |
| ✅ | office cases › people at 1024x768: the stacked layout, nothing clipped (59-11) |  |
| ✅ | office cases › access: the wiring screen renders in the wide pane, the map re-centres, a sop address pins it (59-11) |  |
| ✅ | office cases › supervisor Office: Inbox and Requests only, a people tab address falls back to the inbox (59-13, 60-11) |  |
| ✅ | office cases › legacy addresses (governance, team, access with a sop, attention view) land on the right Office place; assert the rendered place, not the status (59-13) |  |
| ✅ | office cases › the training bridge: the Smoko room links it, the matrix renders, Back returns to the Smoko room (59-13) |  |
| ✅ | office cases › a non-owner completion address lands on the Office; the walker still sees their own (59-15) |  |
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
| ❌ | Phase 57 — the one screen (deployed) › D-06: the supervisor sees the Office card, and its pin equals the pane Inbox list plus open requests (59-12, 60-05) | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoHaveAttribute[2m([22m[32mexpected[39m[2m)[22m failed |
| ✅ | Phase 57 — the one screen (deployed) › PLC-04: admin health pin on EVAL Press |  |
| ✅ | Phase 57 — the one screen (deployed) › D-16 PLC-04: admin Office pin equals the pane Inbox tab count plus the Requests count (59-12, 60-05) |  |
| ✅ | Phase 57 — the one screen (deployed) › PLC-02 D-19: admin machine panel offers Walk, Edit and new SOP for the machine |  |
| ✅ | Phase 57 — the one screen (deployed) › D-12 D-13: the Workshop lists the org drafts and links to the new-SOP flow |  |
| ✅ | Phase 57 — the one screen (deployed) › PLC-05 D-08 D-22: edit mode shows the site workspace and the departments strip |  |
| ✅ | Phase 57 — the one screen (deployed) › D-10 D-17: retired URLs (dashboard, list, departments, site, governance views) redirect to the one screen |  |
| ✅ | Phase 57 — the one screen (deployed) › Pitfall 7: real-org overview screenshot, read-only |  |
| ✅ | Phase 57 — the one screen (deployed) › CLAUDE.md pathways: the pathways map reports zero unmapped screens |  |
| ✅ | Phase 57 — the one screen (deployed) › D-10: signed-out root shows the landing page |  |
| ✅ | requests cases › supervisor Requests tab and pin: tab bar shows Inbox and Requests, pin equals inbox plus requests (60-11) |  |
| ✅ | requests cases › agent new-SOP request from the machines sweep appears with the agent chip; declined; a second run raises nothing (60-11) |  |
| ❌ | requests cases › composer opens from the machine panel; the ask picker works in role mode and person mode (60-12) | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoHaveCount[2m([22m[32mexpected[39m[2m)[22m failed |
| ⏭ | requests cases › objective on a machine, a department and a person; an agent-set objective is confirmed (60-13) |  |
| ⏭ | requests cases › SOP objective in This SOP and browse; a second request raised from browse, never in the walk (60-14) |  |
| ⏭ | requests cases › the loop, twice: accepted, then declined with a reason; bell count, bell click, open to My requests, mark-read (60-16 a) |  |
| ⏭ | requests cases › ask then a new version: due on the badge and Now card, the new version notifies, the decline reaches the supervisor (60-16 b) |  |
| ⏭ | requests cases › review due sweep notifies the SOP owner once (60-16 c) |  |
| ⏭ | requests cases › two-step approval chain: the divert and a non-final approval each name the next approver (60-16 d) |  |
| ⏭ | requests cases › a sent walk notifies the supervisor, who finds the sign-off row (60-16 e) |  |
| ⏭ | requests cases › overview structure: order, empty states, the Office line, the zoomed bell and the real org read-only (60-16 f) |  |
| ⏭ | requests cases › the old assign address lands on the SOP edit surface (rendered place, not status) (60-17) |  |
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
| ❌ | admin: editor, parsing, versions and publish › SC3 58-edit-admin: version slot, AI banner above the first section, tick per step, kind borders, "Checked 2 of 4" | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoHaveCount[2m([22m[32mexpected[39m[2m)[22m failed |
| ⏭ | admin: editor, parsing, versions and publish › SC3 58-edit-ai-findings: violet markers, Publish off with reasons, Clear writes "Cleared · logged in the decision ledger" |  |
| ⏭ | admin: editor, parsing, versions and publish › SC3 58-edit-publish-dialog: every step checked and no finding open, Publish is on; the dialog recesses the screen and "Not yet" leaves the draft alone |  |
| ⏭ | admin: editor, parsing, versions and publish › SC3 58-edit-blank: "Nothing here yet", Add a section, "Checked 0 of 0", Publish off |  |
| ⏭ | admin: editor, parsing, versions and publish › SC3 58-this-sop: the rail block shows the version, the earlier versions and the jump-ahead switch |  |
| ⏭ | admin: editor, parsing, versions and publish › SC5 58-superseded: the admin opens the exact earlier version, "v2 — superseded", no Start walking, no switch |  |
| ⏭ | admin: editor, parsing, versions and publish › SC4 58-parsing: the frame is never empty -- stage line, rough time, skeleton rail and cards -- and the video reads "Transcribing the video" |  |
| ⏭ | admin: editor, parsing, versions and publish › SC4 58-parse-failed: the card says it could not read the document, shows the job's own line, Try again and Back |  |
| ⏭ | admin: editor, parsing, versions and publish › SOP-04: Start editing v2 (client navigation, no reload), check every step one by one, Publish; a worker on the old address lands on v2 and v1 stays on record |  |
| ⏭ | admin: editor, parsing, versions and publish › D-03 58-annotate: add a photo, Annotate, draw one shape, Save -- the photo changes and the tick clears; Esc on a second open saves nothing |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › A -- every SOP has an ok conversion run; convert fixture counts match the known answer; library-linked SOPs converted |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › B -- the focus screen (browse) and the editor render the converted fixture |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › C -- standards: add, attach to the SOP and a section, worker sees the label, rename, remove |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › D -- placement: machine + department, or Whole site |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › E -- owner change, completion reject and an AI write each write one decision; the AI one names the agent |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › F -- ledger is non-empty, refuses service-key update and delete, refuses an unnamed agent |  |

Screenshots (inspect these — CSS/sizing bugs are invisible to assertions): `.planning\evals\latest\57-admin-edit-refused.png`, `.planning\evals\latest\57-admin-edit.png`, `.planning\evals\latest\57-admin-machine.png`, `.planning\evals\latest\57-admin-office.png`, `.planning\evals\latest\57-admin-overview.png`, `.planning\evals\latest\57-admin-workshop.png`, `.planning\evals\latest\57-bridge-activity.png`, `.planning\evals\latest\57-real-org-noticeboard.png`, `.planning\evals\latest\57-real-org-office.png`, `.planning\evals\latest\57-real-org-overview.png`, `.planning\evals\latest\57-real-org-smoko.png`, `.planning\evals\latest\57-real-org-workshop.png`, `.planning\evals\latest\57-worker-mobile.png`, `.planning\evals\latest\57-worker-noticeboard.png`, `.planning\evals\latest\57-worker-overview.png`, `.planning\evals\latest\57-worker-search.png`, `.planning\evals\latest\57-worker-zoomed.png`, `.planning\evals\latest\58-back-place.png`, `.planning\evals\latest\58-browse-real-org.png`, `.planning\evals\latest\58-browse-worker.png`, `.planning\evals\latest\58-phone-rail.png`, `.planning\evals\latest\58-phone-walk.png`, `.planning\evals\latest\58-resume.png`, `.planning\evals\latest\58-review.png`, `.planning\evals\latest\58-sent.png`, `.planning\evals\latest\58-walk-hazard.png`, `.planning\evals\latest\58-walk-jump-on.png`, `.planning\evals\latest\58-walk-locked-rail.png`, `.planning\evals\latest\58-walk-photo-required.png`, `.planning\evals\latest\58-walk-ppe.png`, `.planning\evals\latest\59-access.png`, `.planning\evals\latest\59-approve-open.png`, `.planning\evals\latest\59-completion-non-owner.png`, `.planning\evals\latest\59-completion-owner.png`, `.planning\evals\latest\59-decisions-hover.png`, `.planning\evals\latest\59-decisions.png`, `.planning\evals\latest\59-inbox-empty.png`, `.planning\evals\latest\59-inbox.png`, `.planning\evals\latest\59-legacy-redirects.png`, `.planning\evals\latest\59-owner-meta.png`, `.planning\evals\latest\59-people-1024.png`, `.planning\evals\latest\59-people-invite.png`, `.planning\evals\latest\59-people.png`, `.planning\evals\latest\59-real-org-office.png`, `.planning\evals\latest\59-receipt.png`, `.planning\evals\latest\59-reject-dialog.png`, `.planning\evals\latest\59-signoff-lightbox.png`, `.planning\evals\latest\59-signoff-open.png`, `.planning\evals\latest\59-signoff-override.png`, `.planning\evals\latest\59-signoff-supervisor.png`, `.planning\evals\latest\59-supervisor-signoff.png`, `.planning\evals\latest\59-supervisor.png`, `.planning\evals\latest\59-this-sop.png`, `.planning\evals\latest\59-training-bridge.png`, `.planning\evals\latest\59-worker-sent-back.png`, `.planning\evals\latest\60-decline-dialog.png`, `.planning\evals\latest\60-requests-receipt.png`, `.planning\evals\latest\60-requests-supervisor.png`, `.planning\evals\latest\60-requests-tab.png`, `.planning\evals\latest\access-wiring-only.png`, `.planning\evals\latest\cut-builder-tools.png`, `.planning\evals\latest\cut-existing-completion.png`, `.planning\evals\latest\cut-existing-sop.png`, `.planning\evals\latest\cut-login.png`, `.planning\evals\latest\cut-new-ai.png`, `.planning\evals\latest\cut-not-found.png`, `.planning\evals\latest\cut-profile.png`, `.planning\evals\latest\cut-sign-up.png`, `.planning\evals\latest\cut-upload.png`, `.planning\evals\latest\cut-versions.png`, `.planning\evals\latest\cut-walk-phone.png`, `.planning\evals\latest\cut-walk-signoff.png`, `.planning\evals\latest\cut-worker-plant.png`, `.planning\evals\latest\editor-machines.png`, `.planning\evals\latest\ledger-b-browse.png`, `.planning\evals\latest\ledger-b-editor-hazards.png`, `.planning\evals\latest\ledger-b-editor.png`, `.planning\evals\latest\ledger-c-panel.png`, `.planning\evals\latest\ledger-c-worker-read.png`, `.planning\evals\latest\ledger-c-worker-removed.png`, `.planning\evals\latest\ledger-c-worker-renamed.png`, `.planning\evals\latest\ledger-d-machine.png`, `.planning\evals\latest\ledger-d-whole-site.png`, `.planning\evals\latest\ledger-e-owner.png`, `.planning\evals\latest\ledger-e-reject.png`, `.planning\evals\latest\site-editor.png`, `.planning\evals\latest\site-empty.png`

---
## 60-18 reading notes (written after the final runs)

Run history: full deployed eval at 90f467a (66 passed / 3 failed / 17 skipped; the skips are the serial requests suite cascading from one failing case), full deployed eval at 5ca988b (65 / 3 / 18), then the requests file alone at the deployed HEAD with fixes (last pass: cases 60-11, 60-11 agent, 60-12, 60-13, 60-14, 60-16 a, b, c green; 60-16 d red, e, f and 60-17 not reached in that pass). This file's table above is the 5ca988b run; the requests cases were re-run directly with `npx playwright test --project=evals requests.eval.ts` and so are not in that table.

Eval defects fixed (not product): textContent on an absent Inbox badge waited the whole predicate window; the People row ceiling (120) predated the 60-13 objective line (now 150); the site fixture SOP is a draft so Ask and the worker browse address need the plant SOP (published) and the walk case needs the walk SOP; the bell-focus heading is uppercase in source; read notifications leave the unread list (asserted through Show read); the ask must land before the worker loads (bell does not poll).

Product defect found by eye: the Ask picker popover rendered as a one-word-per-line column clipped at the panel edge (`max-w-full` against the narrow Ask wrapper) while every assertion passed. Fixed in a4225ad (dropped `max-w-full`). NOT re-verified by screenshot after the fix.

NTF-02 legs:
- answered (60-16 a): eval case, green.
- new version (60-16 b, also the ask notification and the decline): eval case, green.
- review due (60-16 c): eval case through the cron route with the bearer, green.
- next approver at the divert (60-16 d): RED. The publish route accepted the draft into the chain (approval_state pending) but "Your approval is next on <title>." never appeared for the safety manager within 30 s. Not diagnosed; the route calls `notifyNextApprover` inside try/catch after the divert write, so a swallowed error is the first suspect (check Railway logs for "[publish] approver notification failed"). No live probe written.
- after a non-final approval (60-16 d second half): not reached.
- sign-off waiting (60-16 e): not reached in the final pass.
So NTF-02 is NOT proven.

Screenshots READ by eye: 60-requests-supervisor (ok: segmented tabs Inbox / Requests 1, pin 1 equals the segments, row with chip, Accept and Decline), 60-objective-meta (ok: quiet objective line with Agent chip, Confirmed line, no card), 60-ask-picker (DEFECT, fixed as above), 60-overview-worker as seen in the loop failure frame (ok: counts card, objectives, notifications with unread dots, My requests with state chips, Ask for a new SOP), plus the supervisor and admin failure frames. NOT read: 60-ask-person, 60-ask-row, 60-bell-click, 60-composer, 60-composer-machine, 60-composer-sent, 60-decline-dialog, 60-notification-open, 60-objective-editor, 60-objective-meta-dept, 60-objective-meta-person, 60-requests-receipt, 60-requests-tab, 60-sop-objective-rail (context budget). Not captured: the legacy assign address, the zoomed empty overview, the real-org overview (cases not reached).

CSS hits in the local HEAD build (`.next/static/css`): size-5, min-w-5, w-72, line-clamp-2, bg-accent-measure/10, bg-ai/10, bg-accent-decision/10, bg-ink-100, h-18 all compile (9 of 9).

Sibling evals: cut-features, office people, one-screen D-06 failed in one pass each and passed in another; D-06 (supervisor, blank scene, "Machines 0") and the sop-focus annotate / SC3 cases (leftover tick from a half-run annotate case; fixtures script resets it) are order or state residue, not Phase 60 code, and are not diagnosed further.
