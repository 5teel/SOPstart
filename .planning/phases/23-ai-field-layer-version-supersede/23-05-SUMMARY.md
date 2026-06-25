---
phase: 23-ai-field-layer-version-supersede
plan: "05"
subsystem: version-supersede-ui
tags: [afl-ver, version-diff, sop-card-badge, admin-versions, journeys]
dependency_graph:
  requires: ["23-01", "23-03"]
  provides: [version-diff-page, versions-page-buttons, updated-badge]
  affects: [admin-versions-page, sop-library-card, worker-sop-library]
tech_stack:
  added: []
  patterns:
    - diffBlockContent reuse for client-side diff (D-07)
    - admin client for superseded version fetch (Pitfall 5)
    - published_at-vs-submitted_at badge comparison (no schema change)
    - showUploadConfirm inline-confirmation pattern extended to clone/restore
key_files:
  created:
    - src/app/(protected)/admin/sops/[sopId]/versions/diff/page.tsx
  modified:
    - src/actions/versioning.ts
    - src/app/(protected)/admin/sops/[sopId]/versions/page.tsx
    - src/components/sop/SopLibraryCard.tsx
    - src/app/(protected)/sops/page.tsx
    - src/lib/journeys/journeys.ts
decisions:
  - "getSopVersionForDiff uses createAdminClient() and self-enforces org-scope via JWT claim (T-23-05-01 mitigated)"
  - "Diff computed client-side via diffBlockContent — no DB call in diff loop (RESEARCH anti-pattern avoidance)"
  - "Updated badge triggers on ANY newer published version; never hardcoded (D-08, D-09, T-23-05-02 mitigated)"
  - "lastCompletionMap built by RLS-scoped sop_completions query — worker sees only own completions (T-23-05-03)"
  - "Restore inline confirmation mirrors showUploadConfirm pattern; handleRestore wired to restoreVersionAsNew (CLAUDE.md 2026-06-05)"
metrics:
  duration: "399s"
  completed_date: "2026-06-26"
  tasks_completed: 3
  tasks_total: 4
  files_changed: 6
---

# Phase 23 Plan 05: Version UI — Diff Page + Buttons + Updated Badge Summary

**One-liner:** Side-by-side version diff page (admin client fetch + diffBlockContent), Edit-into-new-version/Restore/Compare wired to 23-03 actions, and AFL-VER-04 "Updated since last completion" badge on the SOP card.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Side-by-side version diff page (AFL-VER-02 / D-07) | `6a2684a` | versioning.ts (getSopVersionForDiff), versions/diff/page.tsx |
| 2 | Versions page — Edit-into-new-version + Restore + Compare | `c2ee785` | versions/page.tsx |
| 3 | "Updated since last completion" badge (AFL-VER-04 / D-08) | `a55fdff` | SopLibraryCard.tsx, sops/page.tsx |
| journeys | journeys.ts update (same-change rule) | `732b881` | journeys.ts |
| 4 | Human-verify on sopstart.com | — | CHECKPOINT — awaiting |

## What Was Built

### Task 1: Version diff page (`/admin/sops/[sopId]/versions/diff?a=&b=`)

- `getSopVersionForDiff(sopId)` added to `versioning.ts`: uses `createAdminClient()` to fetch superseded versions (RESEARCH Pitfall 5); self-enforces org-scope via JWT `organisation_id` claim (T-23-05-01).
- `diff/page.tsx`: reads `?a` and `?b` search params; fetches both versions via the new action; computes diff **client-side** using `diffBlockContent()` (D-07 reuse — no custom diff algo, no DB call in the loop).
- Renders side-by-side: version A (left) / version B (right); changed fields highlighted amber; Current/Superseded badges; empty/unchanged sections handled.
- Back-link to versions page.

### Task 2: Versions page buttons (AFL-VER-01 / D-05/D-06)

- **"Edit into new version"** button: `handleClone()` calls `cloneSopAsDraft(currentSop.id)` → `router.push('/admin/sops/builder/<newDraftId>')`.
- **"Restore"** per non-current version row: `handleRestore(versionId)` calls `restoreVersionAsNew(versionId)` → router.push to builder.
- **"Compare"** link per non-current row: `→ /admin/sops/[sopId]/versions/diff?a=<versionId>&b=<currentId>`.
- All actions use inline confirmation cards (mirrors existing `showUploadConfirm` pattern).
- Existing **"Upload New Version"** button retained (D-05 — re-upload stays available).
- All handlers are wired — no empty `onClick` (CLAUDE.md 2026-06-05).

### Task 3: Updated badge (AFL-VER-04 / D-08)

- `SopLibraryCard`: new `hasNewerVersion?: boolean` prop; renders `data-updated-badge="true"` element (accent-signoff yellow) only when true; badge has no `onClick`/router.push (D-09 — informational only).
- `sops/page.tsx` `YourSopsSection`: adds `worker-last-completions` TanStack Query fetching `sop_completions.submitted_at` per SOP (RLS-scoped to current user, T-23-05-03 mitigated); `hasNewerVersion()` computes `published_at > lastCompleted`; no schema change needed (RESEARCH AFL-VER-04).
- Never hardcoded: badge derives from the real comparison prop (T-23-05-02 mitigated, 23-00 stub asserts this).

### journeys.ts

- Expanded `version-supersede` journey to cover D-05 clone, D-06 restore, D-07 diff.
- Added `/admin/sops/[sopId]/versions/diff` as a mapped screen (same-change rule).
- Full journeys.ts edit deferred to Plan 23-07 for final tidying; this change satisfies the CLAUDE.md same-change rule for the new route.

## Test Results

```
npx playwright test --project=phase23-stubs
35 passed, 1 skipped (runtime fixme — expected)

AFL-VER-01: cloneSopAsDraft called in versions page ✓
AFL-VER-02: diff page exists + imports diffBlockContent ✓
AFL-VER-03: restoreVersionAsNew exported + append-only ✓
AFL-VER-04: data-updated-badge present + wired + no re-walk ✓
npx tsc --noEmit: clean ✓
```

## Deviations from Plan

**None - plan executed exactly as written.**

The `getSopVersionForDiff` server action was added to `versioning.ts` (not called out explicitly in the plan) as a necessary supporting function for the diff page — it is the fetch mechanism the plan required. This is an implementation detail, not a deviation.

## Known Stubs

None. All features are wired to real data:
- Diff page fetches real SOP versions via admin client.
- Clone/restore buttons invoke real server actions.
- Updated badge derives from real `sop_completions.submitted_at` vs `sops.published_at` comparison.

## Threat Flags

No new threat surface beyond what was declared in the plan's threat model (T-23-05-01/02/03/SC all mitigated as implemented).

## Checkpoint: Task 4 Awaiting Human Verification

**Deploy pushed** to `master` → Railway auto-deploys to sopstart.com.

Verification steps per plan:
1. As admin: open a published SOP → Versions → "Edit into new version" → confirm landing in builder on new draft.
2. Publish it → confirm prior version shows "Superseded".
3. Versions page → "Compare" → confirm side-by-side diff highlights changed blocks.
4. "Restore" on an older version → confirm new draft created (old version not reactivated).
5. As worker: complete an SOP → admin publishes new version → worker library shows "Updated" badge.

## Self-Check: PASSED

- `src/app/(protected)/admin/sops/[sopId]/versions/diff/page.tsx` — FOUND
- `src/components/sop/SopLibraryCard.tsx` — FOUND (data-updated-badge present)
- `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` — FOUND (cloneSopAsDraft/restoreVersionAsNew wired)
- Commits 6a2684a, c2ee785, a55fdff, 732b881 — all in git log
