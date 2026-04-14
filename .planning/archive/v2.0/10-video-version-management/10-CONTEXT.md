# Phase 10: Video Version Management - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins can generate multiple video versions from a single published SOP, label and manage each version, and control which version workers see. Includes version list UI, edit/archive/publish controls, and updated worker experience. Does NOT change video generation pipeline internals (TTS, Shotstack rendering) — only how versions are stored, displayed, and managed.
</domain>

<decisions>
## Implementation Decisions

### Version Identity
- **D-01:** Each generation creates a new version. Every time admin clicks "Generate new version", a new `video_generation_jobs` row is created with an auto-incrementing version number scoped to the SOP. Old versions are preserved until archived. The UNIQUE constraint `(sop_id, format, sop_version)` must be dropped and replaced with a version sequence.

### Version Limits
- **D-02:** Unlimited versions per SOP. Admin manages manually — can archive old ones to reduce clutter. No auto-deletion or cap.

### Published Version (Worker View)
- **D-03:** One published version per SOP at a time. Admin explicitly publishes one version; workers see only that one in the Video tab. All other versions are admin-only (visible on the admin video management page). Publishing a new version auto-unpublishes the previous one.

### Version Labels
- **D-04:** Auto-label as v1, v2, v3 (based on creation order) plus an optional admin-editable name (e.g., "Final cut", "Simplified", "Training day version"). Label stored as nullable `label` column on `video_generation_jobs`.

### Delete / Archive Behaviour
- **D-05:** Archive model — "deleting" a version marks it as archived (hidden from the main list, moved to a collapsible "Archived" section). Storage is not immediately cleaned up. Admins can permanently delete from the archive if needed. This prevents accidental loss while keeping the list clean.

### Re-generate vs New Version
- **D-06:** "Re-generate" always creates a new version. The button is renamed to "Generate new version". Old version is preserved. If the admin wants the old one gone, they archive it after the new one is ready. No overwrite behaviour.

### Claude's Discretion
- Version number assignment mechanism (DB sequence vs application-level counter)
- Archive UI layout (collapsible section vs separate tab vs toggle filter)
- Whether version comparison view is needed (side-by-side) — defer unless trivial
- Exact label character limit
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Video generation schema
- `supabase/migrations/00013_video_generation.sql` — current `video_generation_jobs` table with UNIQUE constraint to drop
- `supabase/migrations/00015_fix_video_gen_rls.sql` — RLS policies on video_generation_jobs

### Video generation pipeline
- `src/lib/video-gen/pipeline.ts` — pipeline orchestrator (idempotency check at line 73-106 needs updating)
- `src/app/api/sops/generate-video/route.ts` — API route with UNIQUE-based idempotency (line 73-127 needs rework)
- `src/actions/video.ts` — `regenerateVideo` server action (reuses existing job — needs to create new version instead)

### Admin video UI
- `src/components/admin/VideoGeneratePanel.tsx` — format picker + generation trigger (rename button, add version list)
- `src/components/admin/VideoGenerationStatus.tsx` — generation progress stepper
- `src/components/admin/VideoAdminPreview.tsx` — admin video preview player
- `src/components/admin/VideoOutdatedBanner.tsx` — outdated warning banner
- `src/app/(protected)/admin/sops/[sopId]/video/page.tsx` — admin video page (needs version list)

### Worker video experience
- `src/components/sop/VideoTabPanel.tsx` — worker video player with chapters
- `src/hooks/useVideoGeneration.ts` — fetches published video for worker view (query needs `published=true` filter — already has it)

### Library indicator
- `src/components/admin/VideoJobIndicator.tsx` — library badge showing generating/ready state
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **VideoGeneratePanel** — already has format picker with radio cards. Add version list below the picker.
- **VideoGenerationStatus** — stepper component for generation progress. Reusable per-version.
- **VideoAdminPreview** — video player with publish/unpublish toggle. Needs to work per-version.
- **VideoJobIndicator** — library badge. Already checks for active + ready jobs. Works with multi-version.
- **VideoOutdatedBanner** — compares SOP updated_at vs video completed_at. Works per-version.

### Established Patterns
- `published` boolean on `video_generation_jobs` — already controls worker visibility. D-03 uses this: set `published=false` on all other versions when publishing one.
- RLS uses `public.current_organisation_id()` on all tables — new columns/constraints must follow this.
- Realtime + polling hybrid for status updates — established in Phase 6/8.

### Integration Points
- **generate-video route** — currently enforces UNIQUE idempotency. Must allow multiple rows per SOP. New version number assigned on insert.
- **regenerateVideo action** — currently resets existing job. Must create a new job row instead.
- **useVideoGeneration hook** — already filters `published=true`. No change needed for worker view.
- **VideoGeneratePanel** — needs version list UI below the format picker. Each version row: label, format, status, created date, publish/archive/edit controls.
</code_context>

<specifics>
## Specific Ideas

- Version list should be compact — one row per version with inline actions (publish, archive, edit label)
- Active/generating version should show at the top with live progress
- "Generate new version" button should be prominent but not confused with "Publish"
- Archived versions in a collapsible section at the bottom — "Show N archived versions"
- Publishing a version should show a brief confirmation since it changes what workers see
</specifics>

<deferred>
## Deferred Ideas

- Version comparison (side-by-side video player) — future phase if admins request it
- Auto-archive on publish (automatically archive the previously published version) — could be a setting
- Storage quota management (total video storage per org) — separate infrastructure concern
- Version notes/changelog (why this version was created) — nice-to-have, not blocking
</deferred>

---

*Phase: 10-video-version-management*
*Context gathered: 2026-04-07*
