# Deployed-site eval — 2026-10-06T03:28:30.101Z

Target: https://sopstart.com · commit 5705480 · 78 passed / 2 failed / 6 skipped

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
| ❌ | office cases › people: wide pane, invite with a role, Invited chip, role change both ways, remove with confirmation (59-11) | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed |
| ⏭ | office cases › people at 1024x768: the stacked layout, nothing clipped (59-11) |  |
| ⏭ | office cases › access: the wiring screen renders in the wide pane, the map re-centres, a sop address pins it (59-11) |  |
| ⏭ | office cases › supervisor Office: Inbox and Requests only, a people tab address falls back to the inbox (59-13, 60-11) |  |
| ⏭ | office cases › legacy addresses (governance, team, access with a sop, attention view) land on the right Office place; assert the rendered place, not the status (59-13) |  |
| ⏭ | office cases › the training bridge: the Smoko room links it, the matrix renders, Back returns to the Smoko room (59-13) |  |
| ⏭ | office cases › a non-owner completion address lands on the Office; the walker still sees their own (59-15) |  |
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
| ✅ | Phase 57 — the one screen (deployed) › D-06: the supervisor sees the Office card, and its pin equals the pane Inbox list plus open requests (59-12, 60-05) |  |
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
| ✅ | requests cases › composer opens from the machine panel; the ask picker works in role mode and person mode (60-12) |  |
| ✅ | requests cases › objective on a machine, a department and a person; an agent-set objective is confirmed (60-13) |  |
| ✅ | requests cases › SOP objective in This SOP and browse; a second request raised from browse, never in the walk (60-14) |  |
| ✅ | requests cases › the loop, twice: accepted, then declined with a reason; bell count, bell click, open to My requests, mark-read (60-16 a) |  |
| ✅ | requests cases › ask then a new version: due on the badge and Now card, the new version notifies, the decline reaches the supervisor (60-16 b) |  |
| ✅ | requests cases › review due sweep notifies the SOP owner once (60-16 c) |  |
| ✅ | requests cases › two-step approval chain: the divert and a non-final approval each name the next approver (60-16 d) |  |
| ✅ | requests cases › a sent walk notifies the supervisor, who finds the sign-off row (60-16 e) |  |
| ✅ | requests cases › overview structure: order, empty states, the Office line, the zoomed bell and the real org read-only (60-16 f) |  |
| ✅ | requests cases › the old assign address lands on the SOP edit surface (rendered place, not status) (60-17) |  |
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
| ❌ | admin: editor, parsing, versions and publish › D-03 58-annotate: add a photo, Annotate, draw one shape, Save -- the photo changes and the tick clears; Esc on a second open saves nothing | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoHaveCount[2m([22m[32mexpected[39m[2m)[22m failed |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › A -- every SOP has an ok conversion run; convert fixture counts match the known answer; library-linked SOPs converted |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › B -- the focus screen (browse) and the editor render the converted fixture |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › C -- standards: add, attach to the SOP and a section, worker sees the label, rename, remove |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › D -- placement: machine + department, or Whole site |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › E -- owner change, completion reject and an AI write each write one decision; the AI one names the agent |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › F -- ledger is non-empty, refuses service-key update and delete, refuses an unnamed agent |  |

Screenshots (inspect these — CSS/sizing bugs are invisible to assertions): `.planning\evals\latest\57-admin-edit-refused.png`, `.planning\evals\latest\57-admin-edit.png`, `.planning\evals\latest\57-admin-machine.png`, `.planning\evals\latest\57-admin-office.png`, `.planning\evals\latest\57-admin-overview.png`, `.planning\evals\latest\57-admin-workshop.png`, `.planning\evals\latest\57-bridge-activity.png`, `.planning\evals\latest\57-real-org-noticeboard.png`, `.planning\evals\latest\57-real-org-office.png`, `.planning\evals\latest\57-real-org-overview.png`, `.planning\evals\latest\57-real-org-smoko.png`, `.planning\evals\latest\57-real-org-workshop.png`, `.planning\evals\latest\57-supervisor-overview.png`, `.planning\evals\latest\57-worker-mobile.png`, `.planning\evals\latest\57-worker-noticeboard.png`, `.planning\evals\latest\57-worker-overview.png`, `.planning\evals\latest\57-worker-search.png`, `.planning\evals\latest\57-worker-zoomed.png`, `.planning\evals\latest\58-back-place.png`, `.planning\evals\latest\58-browse-real-org.png`, `.planning\evals\latest\58-browse-worker.png`, `.planning\evals\latest\58-edit-admin.png`, `.planning\evals\latest\58-edit-ai-findings.png`, `.planning\evals\latest\58-edit-blank.png`, `.planning\evals\latest\58-edit-publish-dialog.png`, `.planning\evals\latest\58-parse-failed.png`, `.planning\evals\latest\58-parsing-video.png`, `.planning\evals\latest\58-parsing.png`, `.planning\evals\latest\58-phone-rail.png`, `.planning\evals\latest\58-phone-walk.png`, `.planning\evals\latest\58-publish-done.png`, `.planning\evals\latest\58-publish-ready.png`, `.planning\evals\latest\58-resume.png`, `.planning\evals\latest\58-review.png`, `.planning\evals\latest\58-sent.png`, `.planning\evals\latest\58-superseded.png`, `.planning\evals\latest\58-this-sop.png`, `.planning\evals\latest\58-walk-hazard.png`, `.planning\evals\latest\58-walk-jump-on.png`, `.planning\evals\latest\58-walk-locked-rail.png`, `.planning\evals\latest\58-walk-photo-required.png`, `.planning\evals\latest\58-walk-ppe.png`, `.planning\evals\latest\59-approve-open.png`, `.planning\evals\latest\59-decisions-hover.png`, `.planning\evals\latest\59-decisions.png`, `.planning\evals\latest\59-inbox-empty.png`, `.planning\evals\latest\59-inbox.png`, `.planning\evals\latest\59-owner-meta.png`, `.planning\evals\latest\59-people-invite.png`, `.planning\evals\latest\59-people.png`, `.planning\evals\latest\59-real-org-office.png`, `.planning\evals\latest\59-receipt.png`, `.planning\evals\latest\59-reject-dialog.png`, `.planning\evals\latest\59-signoff-lightbox.png`, `.planning\evals\latest\59-signoff-open.png`, `.planning\evals\latest\59-signoff-override.png`, `.planning\evals\latest\59-signoff-supervisor.png`, `.planning\evals\latest\59-supervisor-signoff.png`, `.planning\evals\latest\59-supervisor.png`, `.planning\evals\latest\59-this-sop.png`, `.planning\evals\latest\59-worker-sent-back.png`, `.planning\evals\latest\60-ask-person.png`, `.planning\evals\latest\60-ask-picker.png`, `.planning\evals\latest\60-ask-row.png`, `.planning\evals\latest\60-bell-click.png`, `.planning\evals\latest\60-bell.png`, `.planning\evals\latest\60-composer-machine.png`, `.planning\evals\latest\60-composer-sent.png`, `.planning\evals\latest\60-composer.png`, `.planning\evals\latest\60-decline-dialog.png`, `.planning\evals\latest\60-legacy-assign.png`, `.planning\evals\latest\60-notification-open.png`, `.planning\evals\latest\60-objective-editor.png`, `.planning\evals\latest\60-objective-meta-dept.png`, `.planning\evals\latest\60-objective-meta-person.png`, `.planning\evals\latest\60-objective-meta.png`, `.planning\evals\latest\60-overview-admin.png`, `.planning\evals\latest\60-overview-empty.png`, `.planning\evals\latest\60-overview-worker.png`, `.planning\evals\latest\60-real-org-overview.png`, `.planning\evals\latest\60-requests-receipt.png`, `.planning\evals\latest\60-requests-supervisor.png`, `.planning\evals\latest\60-requests-tab.png`, `.planning\evals\latest\60-sop-objective-rail.png`, `.planning\evals\latest\access-wiring-only.png`, `.planning\evals\latest\cut-builder-tools.png`, `.planning\evals\latest\cut-existing-completion.png`, `.planning\evals\latest\cut-existing-sop.png`, `.planning\evals\latest\cut-login.png`, `.planning\evals\latest\cut-new-ai.png`, `.planning\evals\latest\cut-not-found.png`, `.planning\evals\latest\cut-profile.png`, `.planning\evals\latest\cut-sign-up.png`, `.planning\evals\latest\cut-upload.png`, `.planning\evals\latest\cut-versions.png`, `.planning\evals\latest\cut-walk-phone.png`, `.planning\evals\latest\cut-walk-signoff.png`, `.planning\evals\latest\cut-worker-plant.png`, `.planning\evals\latest\editor-machines.png`, `.planning\evals\latest\ledger-b-browse.png`, `.planning\evals\latest\ledger-b-editor-hazards.png`, `.planning\evals\latest\ledger-b-editor.png`, `.planning\evals\latest\ledger-c-panel.png`, `.planning\evals\latest\ledger-c-worker-read.png`, `.planning\evals\latest\ledger-c-worker-removed.png`, `.planning\evals\latest\ledger-c-worker-renamed.png`, `.planning\evals\latest\ledger-d-machine.png`, `.planning\evals\latest\ledger-d-whole-site.png`, `.planning\evals\latest\ledger-e-owner.png`, `.planning\evals\latest\ledger-e-reject.png`, `.planning\evals\latest\site-editor.png`, `.planning\evals\latest\site-empty.png`

---
## 60-18 continuation notes (final run, commit 5705480)

Full deployed run: 78 passed / 2 failed / 6 skipped. Failures: (1) office people case, `email rate limit exceeded` on the invite (Supabase Auth email budget, environmental; the case passed in the earlier full runs at 90f467a and 5ca988b); (2) sop-focus annotate (leftover tick from a half-run annotate case, sibling residue, not Phase 60). The 6 skips are the serial office cases after the People failure; they were re-run once directly and all 6 passed.

Requests file: every case green in the final run, including 60-16 d, e, f and 60-17 (also run alone with retries off: 4 passed).

60-16 d diagnosis: the divert-time notification and the product were fine (the safety manager's row appears). The second half failed because the eval loaded the admin overview straight after clicking Approve; the bell does not poll, so the page was read before the server action wrote the next-approver row. Eval defect, fixed by waiting for the approved row to leave the safety manager's inbox before the admin loads. No product change. (The earlier "never appeared" report did not reproduce at the deployed HEAD.)

Screenshots read by eye (all 23 `60-*.png`):
- 60-ask-picker: fixed. Role mode popover is a normal-width card with four roles, counts, Ask Workers / Don't ask. It overlays the row beneath it as a popover should.
- 60-ask-person: ok. Person search, two matches, long email truncated with an ellipsis, Ask button wraps the address onto two lines but is not clipped.
- 60-ask-row: ok. Worker overview: Now card, due count, objective line, one unread Answered notification, Ask of you row with Decline, Answered rows with state chips.
- 60-bell: ok. Admin overview, bell 44 px with count 1, notification Review with date, Show read link.
- 60-bell-click: ok. Worker with the search term Press: two Answered notifications, an open Observe request with Withdraw, accepted rows.
- 60-composer: ok. Make a request dialog on the SOP page, two kinds (Change, Observe), 0 / 500 counter, Send disabled until 10 characters.
- 60-composer-machine: ok. Same dialog from the machine panel with the extra Write a new SOP kind; machine panel behind it recessed.
- 60-composer-sent: ok. Receipt line "Request sent. You'll see its answer under My requests." with a tick; the machine pin shows the badge.
- 60-decline-dialog: ok. Reason required (10 characters or more), Decline request disabled, Keep it open; the agent request row behind carries the Agent chip.
- 60-legacy-assign: ok. The old assign address lands on the SOP edit surface with the This SOP block; the lower rail rows (Ask someone to do this, Category) are cut by the viewport, scrolled in the pane.
- 60-notification-open: ok. Worker with two unread notifications (Asked, Answered) and the asked row with Decline.
- 60-objective-editor: ok. Objective textarea, 23 / 200, optional By date, Save objective (grey until changed), Don't change it, Remove objective in the escalate colour.
- 60-objective-meta: ok (read earlier). 60-objective-meta-dept: ok. Department panel, quiet objective line, "Objective set - logged in the decision ledger". 60-objective-meta-person: ok. People and roles list with a person's objective line, Change, ledger line; the row grew but nothing is clipped.
- 60-overview-admin: ok. Order objectives, notifications, then the rest; notifications and objective lines quiet.
- 60-overview-empty: ok. Idle supervisor: no notifications or requests blocks, counts and objectives only; reads "0 walks are waiting for your sign-off." (acceptable, not worth a change).
- 60-real-org-overview: ok. Real org isometric scene with pins and rooms, Office 12, Set a site objective, no objective yet; machine list runs under the footer and scrolls.
- 60-requests-receipt: ok. Accepted receipt with a tick, ledger line and an Open the SOP link; empty state "No requests waiting."
- 60-requests-supervisor and 60-requests-tab: ok. Segmented Inbox / Requests, count 1 on the tab, Accept and Decline, Agent chip.
- 60-sop-objective-rail: ok. This SOP rail with an Objective block, Change, ledger line, Standards, Let workers jump ahead.
- 60-overview-worker: ok (seen in the loop frames).

Cron schedules (Task 2) remain a Railway dashboard action for Simon; the eval calls the routes directly with the bearer.
