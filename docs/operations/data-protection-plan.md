# Data protection plan — activate at the first paying customer

Status: **ready, not active** (written 2026-10-19). The customer statement in
`docs/customer/data-protection.md` is only true once every step below is ticked. Do not send it before then.

## Trigger

Run this plan when either happens:

- a customer signs a paid agreement, or
- a trial site starts recording real sign-offs or completions it relies on for compliance.

## Today vs after activation

| Layer | Today | After activation |
|---|---|---|
| Database | Supabase nightly backup, 7 kept, same provider and city | Point-in-time recovery (7 days) **plus** a nightly copy at a second provider |
| Files (uploaded SOPs, photos) | No backup | Nightly copy at a second provider, deletes locked for 30 days |
| Most data you can lose (RPO) | 24 hours (files: all of it) | Minutes (database); 24 hours (files) |
| Time to restore (RTO target) | Untested | 4 hours (database), 24 hours (full rebuild elsewhere), tested every quarter |
| Login and invite email | Supabase built-in sender, hourly limit | Own sender, no practical limit |

## Activation checklist

| # | Step | How | Cost (approx.) | Done when |
|---|---|---|---|---|
| 1 | ADR: infrastructure jobs are allowed | New ADR beside ADR-0002: backups and restore tests may run on a schedule (GitHub Actions); app work still runs on the event | — | ADR merged |
| 2 | Point-in-time recovery | Supabase dashboard → project `gknxhqinzjvuupccyojv` → Database → Backups → enable PITR (7 days); it needs the Small compute add-on or above | US$100+/month | Dashboard shows PITR active |
| 3 | Off-site bucket | Cloudflare R2 bucket `sopstart-backup`, location hint Oceania, bucket lock rule 30 days; an API token scoped to that bucket only, stored as GitHub secrets | ~US$1–5/month | Test delete of an object is refused |
| 4 | Nightly off-site copy | GitHub Action `.github/workflows/backup.yml`, daily at 03:00 NZT: `supabase db dump` (roles, schema, data) gzipped to `db/YYYY-MM-DD/`; every storage bucket synced to `storage/` with `rclone`. The workflow fails loudly (GitHub email) on any error | GitHub minutes | First run green, sizes logged |
| 5 | First restore test | New throwaway Supabase project → restore the dump → copy files back → compare row counts per table and object counts per bucket against prod → delete the throwaway project | Pennies | Counts match, written in the runbook log |
| 6 | Restore runbook | `docs/operations/restore-runbook.md`: (a) PITR to a time, (b) full rebuild from R2 into a new Supabase project and re-point Fly secrets, (c) restore one customer's data only. Each with commands and who decides | — | Merged |
| 7 | Own email sender | Resend (rotate the failing key first, via `add-key.ps1`), verify `sopstart.com` sending domain, Supabase → Auth → SMTP settings | Free tier | An invite arrives from `@sopstart.com` |
| 8 | Customer export | Admin can download their org's SOPs (PDF), completions and sign-off ledger (CSV) | Build work | Eval passes on the deploy |
| 9 | Contacts and alerts | Supabase, Fly, Cloudflare and GitHub alert emails reach `simonscott86@gmail.com`; a second person (Joe) has admin on Supabase and Fly | — | Each confirmed |

## Ongoing duties once active

| When | Duty |
|---|---|
| Every day | Backup Action green (GitHub emails a failure) |
| Every quarter | Restore test (step 5), result logged in the runbook |
| Every key rotation | Update GitHub secrets; rerun the backup once |
| Customer leaves | Export handed over on request; their data deleted from the live system within 30 days, and it ages out of backups within the following 30 days |

## If something goes wrong

1. Stop writes if data is being damaged (Fly: scale to 0).
2. Decide the restore point; use PITR first, the R2 copy if Supabase itself is the problem.
3. Tell affected customers what happened, what was lost and when it will be back, the same day.
4. Personal information exposed: notify affected customers and the NZ Privacy Commissioner (and the OAIC if Australian customers are affected) as soon as practicable; aim within 72 hours.
5. Write it up in `docs/LEARNINGS.md`.
