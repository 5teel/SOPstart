# Deferred Items — Phase 33

Out-of-scope discoveries logged during plan execution (SCOPE BOUNDARY rule —
not caused by the current task's changes, not fixed).

## 33-01: Pre-existing red test in `tests/phase32/grants-org-isolation.spec.ts`

- **Found during:** Task 2 full-suite sanity run (`npx playwright test --project=phase32 --project=phase32-unit --project=phase33`)
- **Test:** `createGrant/revokeGrant — org-scope guard wired before every write › createGrant verifies subjectId (per type) AND collectionId belong to the caller org BEFORE inserting`
- **Symptom:** `insertIdx` resolves to `-1` — the spec's `body.indexOf("from('access_grants')\n    .insert(")` fails to find the literal in `src/actions/grants.ts`.
- **Cause (very likely):** CLAUDE.md [2026-07-18] learning — worktree checkouts CRLF-normalize source files (repo has no `.gitattributes`), breaking `\n`-literal source-contract specs that expect LF between `.from('access_grants')` and `.insert(`. Confirmed pre-existing: failure reproduces identically against base commit `2ddcaad` (before any 33-01 changes) — `src/actions/grants.ts` and the spec regex are unchanged from base.
- **Scope:** Neither file is in 33-01's `files_modified` list. Out of scope per SCOPE BOUNDARY — not fixed here.
- **Recommendation:** Repoint when `src/actions/grants.ts` is next touched (33-05 extends it with the `sopId` target arm), or fix at the root per the [2026-07-18] learning (add `.gitattributes` with `* text=auto eol=lf`, or normalize `\r\n`→`\n` before matching in the spec).
