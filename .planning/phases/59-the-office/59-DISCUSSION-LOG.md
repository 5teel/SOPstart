# Phase 59: The Office — Discussion Log

**Date:** 2026-10-05
**Mode:** auto (Simon: "keep going" after Phase 58; standing rule — make judgment calls, minimise questions). Every selection below is Claude's recommended option; Simon can redirect any of them before `/gsd-plan-phase 59`.

## Areas and selections

| Area | Question | Options considered | Selected |
|---|---|---|---|
| Where the Office lives | Pane body with `&tab=` vs a `/office` route | tab address in the detail pane (contract: rooms are not pages) / a route | **Pane body, `/?place=office&tab=…`** |
| Wide pane | Which tabs widen | all tabs / only the table tabs (contract list) | **Decisions · People · Access widen; Inbox stays 400px with a photo lightbox** |
| Inbox row model | Keep Phase 54 stuck/machines rows? | drop them / keep because each has one action | **Keep: Try again · Write a SOP** |
| Sign-off from the inbox | Expanded row vs sheet vs keep the review page | accordion row + lightbox / sheet / page | **Accordion row, photos → lightbox, Reject requires a note** |
| Approve from the inbox | How does the approver read the SOP | inline read / link to browse state | **Link to browse state with `?from=office`** |
| Owner + review date | Where it shows | meta line under every admin SOP row + editor This SOP block | **Both** |
| Decisions tab | Table vs feed; filter grouping | raw kinds / plain-word groups | **Table newest-first, plain-word chip groups, 50 + Show older** |
| New ledger kinds | Log role/invite/remove? | skip / add kinds | **Add `role_change`, `member_invited`, `member_removed` (additive migration)** |
| People & roles | Table design | table with inline role select + existing dept picker | **Table in the wide pane; Invite above; Remove with confirm** |
| Access | Mount vs link | mount `AdminAccessLens` in the wide pane / keep the route | **Mount unchanged; `/admin/access` redirects** |
| Role views | Supervisor / worker scope | — | **Supervisor: Inbox (own rows) + Decisions; Worker: unchanged until Phase 60/61** |
| Deletions | What goes now | — | **`/governance`, `/admin/team`, `/admin/access` page, org-model views, supervisor `/activity` halves** |

## Deferred (noted, not acted on)
Requests tab (60) · notifications (60) · worker My sign-offs + `/activity` deletion (61) · org-wide forward-jump default · per-SOP approval history surface · refresher interval UI (61).

## Claude's discretion
Accordion vs sheet, thumbnail size, lightbox implementation, paging cursor, relative time formatting, "cleared today" counting, per-tab skeletons, phone collapse.
