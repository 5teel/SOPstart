# Phase 59 deferred items

- **[RESOLVED in 89a576b8]** `tests/phase40/dat01-category-column.spec.ts` write-site census: `src/lib/governance/owner-review.ts` classified as a justified exemption (a review stamp changes no category); the full suite at the phase gate shows the spec green.
- **[open]** `materializeOrgAccess()` in `src/actions/grants.ts` has no caller now that the org-model write actions are gone. It is an admin-guarded server action, left in place (not in the plan's delete list); remove it with its spec pins in a later cleanup.
- **[Phase 61]** "Record observation" has no supervisor entry point (the Activity view was the only supervisor route into `RecordObservationModal`); admins record from the `/admin/training` person panel.
- **[minor, cosmetic]** "From x · 1 photo" wraps to two lines in the 400 px Inbox row; the lightbox shows prev/next arrows with a single photo; the red NO OWNER badge (Phase 54) and the amber "No owner" meta chip (59-07) state the same thing on a machine-panel row.
- **[eval]** The People case sends a real invite email per full run; the project's built-in SMTP allows about one an hour, so full `npm run eval` runs must be spaced.
