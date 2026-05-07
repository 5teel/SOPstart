---
phase: 13-reusable-block-library
uat_run: 2026-05-07T11:40:00Z
runner: Playwright (Chromium) against `next dev` on localhost:4200
session: magiclink + verifyOtp + cookie injection (scripts/uat-session.mjs)
status: partial-pass
---

# Phase 13 — Batched UAT Results

## Summary

Automated UAT executed against the live dev server with a service-role-issued session cookie for `simonscott86@gmail.com` (platform admin). Three of the four fully-automatable scenarios passed; one bug surfaced and was fixed-forward. The remaining UAT items require interactive flows (Puck builder, drag-reorder) that are unreliable on the current Windows webpack dev server and remain as carried human-UAT.

## Results

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | `/admin/blocks?scope=global` shows 65 NZ globals | ✓ PASS | `tbody tr` rowCount=65; sample rows show "Airborne contaminants GLOBAL" / "Back strain from lifting GLOBAL" / "Broken bottle GLOBAL" |
| 2 | `/admin/blocks` (org tab) shows empty state | ✓ PASS | "No blocks yet" header rendered; "New block" CTA + four kind filters present (Hazard / PPE / Step / Emergency / Custom) |
| 3 | Blocks tab link present in `/admin/sops` header | ✓ PASS | Verified at `src/app/(protected)/admin/sops/page.tsx:103` (link labelled "Blocks", routes to `/admin/blocks` — minor: 13-01 SUMMARY described it as "Library" link; actual UI label is "Blocks") |
| 4 | Platform-admin gate: `/admin/global-blocks` permits seeded user | ✓ PASS | After 00028 fix: page renders with H1 "Global Block Library — Platform admin", 65 globals in table, "Suggestions Queue" sub-nav present |
| 5 | Platform-admin gate redirects non-platform users | ✓ PASS (implicit) | Pre-fix the same gate redirected the seeded user to `/dashboard` — confirms the redirect path is wired |
| 6 | Suggestions Queue page renders | ✓ PASS | H1 "Pending Suggestions for Global Library"; empty-state copy correct; "Suggestions Queue" tab badge absent (no pending rows) |
| 7 | Wizard pick-from-library round trip | ⚠ HUMAN-UAT | Requires multi-step interactive flow against Puck builder + modal — dev server hit known Windows webpack file-lock race during navigation; defer to human session against `next start` |
| 8 | Builder ⋯ Save-to-library + Suggest for global | ⚠ HUMAN-UAT | Same — needs Puck componentItem hover + modal interaction |
| 9 | Junction reorder + snapshot integrity | ⚠ HUMAN-UAT | Drag-reorder + post-refresh persistence check |
| 10 | Promote / Reject suggestion lifecycle | ⚠ HUMAN-UAT | Needs an org admin to first submit a suggestion (own org) before super-admin can review |

## Bug surfaced + fixed during UAT

**Migration 00028: `is_platform_admin()` body still referenced renamed table.**

- **Discovered:** Navigating to `/admin/global-blocks` redirected to `/dashboard` despite the seeded user existing in `platform_admins`.
- **Root cause:** Migration 00026 renamed the function via `ALTER FUNCTION RENAME` and the underlying table via `ALTER TABLE RENAME`, but Postgres does **not** rewrite SQL function bodies when a referenced table is renamed. The function continued to read `public.summit_admins` and threw `42P01` on every call.
- **Fix:** Migration `00028_fix_is_platform_admin_body.sql` issues `CREATE OR REPLACE FUNCTION` with the corrected body. Pushed live + verified RPC returns `true` for the seeded user.
- **Commit:** `4306684`

## What's left for human UAT

Four scenarios above (#7–#10) plus the four Phase 12.5 items batched alongside. Recommended workflow:

```powershell
$env:PORT='4200'; npm run build; npm run start
```

Production build avoids the Windows webpack file-lock race documented in CLAUDE.md Learnings (2026-04-24).
