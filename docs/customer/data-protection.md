# How SOPstart protects your data

_Send only once `docs/operations/data-protection-plan.md` is fully activated._

## Where your data lives

- Your SOPs, records and photos are stored in **Sydney, Australia** (Supabase, on Amazon Web Services). The app runs in the same city (Fly.io).
- Everything is encrypted in transit (HTTPS) and at rest (AES-256).

## Who can see it

- **Only people you invite.** There is no public sign-up. Every new account is also approved by SOPstart before it can open anything.
- **Your data is walled off from other companies** at the database level, not just in the app. Each request is checked against your organisation.
- **Inside your company, access follows roles** (worker, supervisor, admin, safety manager). Only admins invite people or change SOPs.
- **Every change is recorded.** Approvals, sign-offs, edits and invitations go into a permanent log showing who did what and when. Entries cannot be edited or deleted.

## Backups

| Protection | What it means for you |
|---|---|
| Continuous database backup | We can return your data to any moment in the last 7 days, to within minutes |
| Nightly copy at a second, independent provider (Cloudflare) | If our main provider failed completely, your SOPs, records and photos still exist elsewhere |
| Backups locked against deletion for 30 days | Not even a mistake or a stolen password can erase them |
| Restore tested every quarter | We prove the backups work, not just that they exist |

**Our targets:** lose no more than a few minutes of database records (photos: no more than one day). Service restored within 4 hours from our backups, or within 24 hours if we must rebuild with another provider.

## The AI

- To convert a SOP, its text is sent to **OpenAI** (to write the clear version) and **Anthropic** (to check it).
- Both providers' business terms say this data is **not used to train their models**.
- Pictures inside your SOP documents are read by OpenAI so their labels and warnings aren't lost. Photos workers take during a job are never sent to either AI.
- Nobody sees an AI-written version until one of your admins has read and approved it. Workers always sign against your original wording.

## Your data stays yours

- You can **download your SOPs, completion records and sign-off log** at any time.
- If you leave, we give you a full export on request. We **delete your data within 30 days**, and it leaves our backups within the next 30.

## If something goes wrong

- If your data is affected, we tell you **the same day**: what happened, what was lost and when it will be back.
- If personal information is exposed, we also notify the Privacy Commissioner, as New Zealand law requires.

Questions: enquiries@sopstart.com
