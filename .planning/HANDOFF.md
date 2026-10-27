# Handoff — 2026-10-27 (after Phases 65–68 and the ISO / ANZ research)

Pick up here in a fresh context. Read CLAUDE.md, docs/adr/README.md (ADR-0027 to 0030 are new), and this file. Fly.io deploys from master.

## Where things stand

### Shipped and live on sopstart.com
Each phase's `PLAN.md` has an Outcome section with commits, checks, deviations and follow-ups.

| Phase | What | ADR | Migration | Eval |
|---|---|---|---|---|
| 64 Leavers and suspended members | active / suspended / left; RLS re-checks membership | 0024, 0025 | 00082, 00083 | `people.eval.ts` |
| 65 Passkeys | Add / rename / remove on Profile; sign in with a passkey; RP ID `sopstart.com` (never change it) | 0027 | 00085 | `passkeys.eval.ts` |
| 66 Admin MFA and recovery codes | Admins and safety managers need aal2 (TOTP) for admin screens and writes, in the app and in 48 RLS write policies; 10 recovery codes; People "Reset sign-in steps" | 0028 | 00086, 00087 | `mfa.eval.ts` |
| 67 Supervisor-issued recovery | "Give a sign-in code" (People, or "Your workers" under the supervisor's Sign-offs inbox); 30 min, single use, 5 tries; forces a new password | 0029 | 00088 | `signin-code.eval.ts` |
| 68 Security headers | Enforced nonce CSP (proxy), HSTS with preload, nosniff, frame DENY, COOP, Permissions-Policy; `/api/csp-report`; securityheaders.com A+ | 0030 | — | `security-headers.eval.ts` |

Also live today: self-hosted Inter (ADR-0026), and tool search now matches part of a tool name in any case (migration 00084).

The last full deployed eval run passed 143 of 143 with the enforced CSP.

## Since then (2026-10-25 to 27)
- **Homepage:** the "Send us 3 SOPs" button is gone from both places (`f07e55f8`, welcome eval passed). The Founding sites slide text still offers three free conversions, and Enquiries is now the only way in. Ask Simon whether the slide text should change.
- **Enquiries:** `enquiries@sopstart.com` forwards to Simon's Gmail through Cloudflare Email Routing. Verified by a delivered test in the routing log on 2026-10-25.
- **Research done:** `.planning/research/iso-and-anz-hs-best-practice.md` maps ISO 45001 / 9001 §7.5, the AU WHS codes and the **NZ Health and Safety at Work Amendment Act 2026** (in force 1 April 2027) to SOPstart. It covers critical risks, and the new duty on officers to verify that controls are used.

## Next up (pick this up in the new session)
Simon's answers, 2026-10-27:
- **Homepage modules:** build them. They are Phases 70–73 (LOTO, permits, safety meetings, PMs), and the order is in the Phase 69 plan. The homepage keeps listing them until then.
- **Founding slide:** now asks visitors to email three SOPs to enquiries@sopstart.com.
- **Phase 69, critical controls:** all four parts agreed. The plan is `.planning/phases/69-critical-controls/PLAN.md`.

To start, run Phase 69 step 1. Simon reads the enacted Schedule 1A (legislation.govt.nz blocks fetches) and confirms the D-02 risk list. Then build.

Smaller follow-ons from the research, still in the backlog:
- document codes, register export and a "what changed" note on each version (999.5);
- an audit pack export;
- management of change when a machine is edited;
- a "this step isn't how we do it" request from a run.

## Simon's steps
- **Simon and Joe:** on your next admin visit, set up an authenticator app and save your ten recovery codes.
- **HSTS preload:** submitted 2026-10-24 at Simon's call (the site has no production users yet, so any breakage marks the cause). Check its status at hstspreload.org; it should read "pending", then "preloaded".
- **Any new `*.sopstart.com` subdomain** must serve HTTPS from day one, because HSTS covers subdomains.

## Follow-ups (no decision needed)

**Security**
- **Video SOP upload is untested under the enforced CSP.** Its audio extraction worker may need `'wasm-unsafe-eval'`, which would also need a new ADR. Settle it with one real video upload.
- **Sole-admin lockout:** a sole admin who loses their phone and every recovery code can only be recovered by clearing their factors with the service role.
- **Report route:** `/api/csp-report` has no rate limit.
- **Header leak:** `X-Powered-By` is still sent.
- **Policy gaps:** platform-admin policies aren't behind aal2 (ADR-0028), and two admin-named tables still accept any member's writes to their own organisation's rows.
- **TRUNCATE grant:** authenticated still holds Supabase's default TRUNCATE on `organisation_members`. A revoke would tidy it.

**Tests**
- **Local admin probes:** the `tests/phase33–51` probes that make admin writes need the aal2 eval session helper since 00087. About 25 of them haven't been re-run since the OTP budget ran out.
- **Site-editor eval:** `site-editor.eval.ts` should wait for the renamed machine's own save, not any "Saved"; it flaked once.
- **Rate-limited probe:** the `tests/phase46` `IMAGES NEGATIVE` live probe was OTP rate-limited; re-run it once in a quiet window.
- **Lint error:** `src/lib/supabase/middleware.ts:10` has a `prefer-const` error that predates these phases.

**People and approvals**
- **Missing invite data:** an invite sent between migration 00083 and its deploy (2026-10-23) has no invite data in `app_metadata`. The invitee needs a re-send.
- **Reassign picker:** it lists the signed-in admin. Hide self by passing the user id into `InboxRow`.
- **Supervises picker:** an admin can't untick a suspended worker who is already linked.
- **Chart screenshot:** the chart-view eval shot is cut off before the Suspended tag.

**Housekeeping**
- **Bundle baselines:** `/sops/[sopId]` is at 839 against an 837 baseline, and `/` at 867 against 869, both within ±2. Diff the chunk list before any change and never re-capture blindly.
- **Traceability table:** `REQUIREMENTS.md` has 119 IDs missing from it. It's bookkeeping only.

## Process notes
- **GSD is retired (2026-10-24).** Plans are plain `PLAN.md` files, built directly under the project rules: ADRs, same-commit duties, deployed evals.
- **OTP budget:** run the full local suite at most once per gate, and the full deployed eval once per deploy.
- The security phases (65–68) are done. The next phase is proposed under "Next up" and not yet agreed.
