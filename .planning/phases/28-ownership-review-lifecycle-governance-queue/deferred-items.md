# Deferred Items — Phase 28

## Out-of-scope discovery: Phase 21-27 planning docs missing from working tree

**Found during:** 28-01 final commit prep (`git status --short .planning/`)

**Issue:** ~200 files under `.planning/phases/21-safety-critical-parsing/` through
`.planning/phases/27-ai-provider-settings-formal-spec-pass/` (PLAN/SUMMARY/CONTEXT/
RESEARCH/PATTERNS/REVIEW/VALIDATION/VERIFICATION/etc.) are absent from disk but still
tracked in git as of `c29cc20` (last commit before this session). `git status --short`
shows them all as `D` (deleted, unstaged). Not present under `.planning/archive/` either
(only `v2.0/` and `v3.0/` exist there) — so this isn't a milestone-archive move, the files
appear to have been deleted from the working tree by some out-of-band process before this
execution session began.

**Scope decision:** Out of scope for plan 28-01 (schema/backfill only). Per the executor's
scope-boundary rule, NOT fixed and NOT included in this plan's commits — `git add` was used
with explicit file paths throughout (never `-A`/`.`), so none of these deletions were swept
into the 28-01 commits.

**Recommended next action:** Simon/orchestrator should investigate before the next commit
touching `.planning/` broadly (e.g. `/gsd-verify-work` or a future `git add -A` anywhere) —
if these deletions are unintentional, restore from `git show c29cc20:<path>`; if intentional
(e.g. a manual cleanup), stage and commit them explicitly with their own commit message
rather than letting them ride along inside an unrelated commit.
