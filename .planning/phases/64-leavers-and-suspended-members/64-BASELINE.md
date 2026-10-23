# Phase 64 live baseline

Taken 2026-10-23 from the live project with `node scripts/apply-phase64-migration.mjs --audit` (read-only; the timing probe runs in a block that always rolls back). No key, token or JWT appears here.

## Raw-claim policies

Every live policy (schemas public and storage) whose qual or with_check contains `auth.jwt()`. The set is exactly the ten names in RESEARCH Q1, so Task 2 scope is unchanged; there are no extras.

| Table | Policy | Cmd | Live qual / with_check (verbatim) |
|---|---|---|---|
| public.escalation_reports | escalation_insert_own | INSERT | with_check `(((organisation_id)::text = (auth.jwt() ->> 'organisation_id'::text)) AND (submitted_by = auth.uid()))` |
| public.escalation_reports | escalation_select_scoped | SELECT | qual `(((organisation_id)::text = (auth.jwt() ->> 'organisation_id'::text)) AND ((submitted_by = auth.uid()) OR ((auth.jwt() ->> 'user_role'::text) = ANY (ARRAY['supervisor'::text, 'admin'::text, 'safety_manager'::text]))))` |
| public.escalation_reports | escalation_update_supervisor | UPDATE | qual `(((organisation_id)::text = (auth.jwt() ->> 'organisation_id'::text)) AND ((auth.jwt() ->> 'user_role'::text) = ANY (ARRAY['supervisor'::text, 'admin'::text, 'safety_manager'::text])))`; with_check `((organisation_id)::text = (auth.jwt() ->> 'organisation_id'::text))` |
| public.sop_voice_notes | voice_notes_insert_own | INSERT | with_check `(((organisation_id)::text = (auth.jwt() ->> 'organisation_id'::text)) AND (created_by = auth.uid()))` |
| public.sop_voice_notes | voice_notes_select_org | SELECT | qual `((organisation_id)::text = (auth.jwt() ->> 'organisation_id'::text))` |
| public.uat_feedback | uat_feedback_insert_own | INSERT | with_check `((user_id = auth.uid()) AND ((organisation_id)::text = (auth.jwt() ->> 'organisation_id'::text)))` |
| public.uat_feedback | uat_feedback_read_org | SELECT | qual `((organisation_id)::text = (auth.jwt() ->> 'organisation_id'::text))` |
| storage.objects | org members can read generated videos | SELECT | qual `((bucket_id = 'sop-generated-videos'::text) AND ((storage.foldername(name))[1] = ((auth.jwt() -> 'app_metadata'::text) ->> 'organisation_id'::text)))` (reads app_metadata, matches nothing; dropped in 00082) |
| storage.objects | voice_bucket_insert_own | INSERT | with_check `((bucket_id = 'sop-voice-notes'::text) AND ((storage.foldername(name))[1] = (auth.jwt() ->> 'organisation_id'::text)) AND (owner = auth.uid()))` |
| storage.objects | voice_bucket_select_org | SELECT | qual `((bucket_id = 'sop-voice-notes'::text) AND ((storage.foldername(name))[1] = (auth.jwt() ->> 'organisation_id'::text)))` |

All ten are `to authenticated`. Set equals the RESEARCH ten: yes.

## Observations own-arm

`sop_observations_read_org` (SELECT, authenticated), live qual:

`(((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin', 'safety_manager', 'supervisor']))) OR (observed_worker_id = auth.uid()))`

The `observed_worker_id = auth.uid()` arm has no organisation predicate. 00082 ANDs `organisation_id = public.current_organisation_id()` into it.

## Helpers

All four are `SECURITY DEFINER`, `search_path = ''`, owner `postgres`, and match their migration source (no later redefinition).

| Function | Returns | Body today |
|---|---|---|
| `current_organisation_id()` | uuid | `nullif(auth.jwt() ->> 'organisation_id', 'null')::uuid` |
| `current_user_role()` | public.app_role | `(auth.jwt() ->> 'user_role')::public.app_role` |
| `custom_access_token_hook(event jsonb)` | jsonb | the 00081 body (approval gate, `active_org_id` lookup, most-recent fallback; neither select filters status) |
| `sop_observation_refs_in_org(uuid, uuid, uuid)` | boolean | sop in org AND a membership row exists for the worker in org (no status test) |

## RLS flags

`public.organisation_members`: `relrowsecurity = true`, `relforcerowsecurity = false`. The helpers read the table as the function owner (postgres), so they do not recurse through the table's own policies.

## Grants

Table level on `public.organisation_members`: `anon`, `authenticated` and `service_role` each hold DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE. `supabase_auth_admin` holds nothing on the table (the hook is SECURITY DEFINER). Column privileges on the five columns (`created_at, id, organisation_id, role, user_id`) follow the table grant for the same three roles. So the blanket UPDATE for `authenticated` and `anon` is what Task 2 narrows to `role` only for `authenticated`.

Session-client updates of `organisation_members` (`grep -rn "organisation_members" src tests scripts`, every update / upsert chain read):

| Where | Client | Columns |
|---|---|---|
| `src/actions/auth.ts:587` `updateMemberRoleSafe` | session (`getSessionContext().supabase`) | `role` only |
| `src/actions/auth.ts` `removeMember` -> `src/lib/members/remove.ts` | service role (delete) | n/a, untouched by the lock |
| `tests/phase33/sop-grant-materialization.spec.ts:337` | service role | `role` |
| `tests/evals/site-templates.eval.ts:65` | service role (`db`) | upsert, service role |
| `scripts/eval-fixtures.mjs`, `seed-demo-orgs.mjs`, `uat-seed-competency.mjs` | service role | upserts, service role |

`role` is the only column any session client updates, so the UPDATE lock in Task 2 is safe.

## Triggers

Non-internal triggers: none on `public.organisation_members`; one on `public.sops` (`set_sop_owner_default` -> `default_sop_owner`, enabled). Nothing interacts with the new status columns.

## sop-videos

`storage.objects` in bucket `sop-videos`: 7 objects, 0 whose first folder is not an organisation id.

Live policy `Authenticated users can read from sop-videos` (SELECT, authenticated): `bucket_id = 'sop-videos'` only. The INSERT / UPDATE policies (`admins_can_upload_sop_videos`, `admins_can_update_sop_videos`) already pin the first folder to `current_organisation_id()`.

**D-19 decision: scope.** Count of non-org-prefixed objects is 0, so 00082 scopes the sop-videos SELECT policy to the organisation folder with `public.current_organisation_id()`. The deployed `home.eval.ts` smoke in Task 3 plus the live policy assertion check it; the INSERT policy stays as is.

Other storage policies on `storage.objects` already use the helpers (site-scenes, sop-documents, sop-images, completion-photos), so the helper redefinition closes them.

## Sessions

`auth.sessions`: 2989 rows. A delete in `revoke_user_sessions` must always carry the user id.

## EXPLAIN before

As the eval-site admin (`eval-site-admin@sopstart.com` in "SOPstart Eval Site", role authenticated, claims built from ids only), rolled back, warm run of each (runs 1-2), run 3 is an earlier single cold run:

| Query | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| `select count(*) from public.sops` (18 rows visible) | 0.096 ms | 0.095 ms | 0.188 ms |
| 50 newest `public.decisions` rows for the org | 11.002 ms | 11.251 ms | 11.291 ms |

Stop threshold for Task 3: either query more than 3x slower AND above 50 ms.

## EXPLAIN after

Same probe after 00082 went live (2026-10-23), warm run, two audit runs:

| Query | Before (runs 1-2) | After run 1 | After run 2 | Ratio |
|---|---|---|---|---|
| `select count(*) from public.sops` (18 rows) | 0.095 - 0.096 ms | 0.228 ms | 0.258 ms | about 2.4x |
| 50 newest `public.decisions` rows | 11.0 - 11.3 ms | 27.26 ms | 26.72 ms | about 2.4x |

Neither is more than 3x slower, and both are far under 50 ms, so the stop threshold is not hit. The extra cost is one indexed `organisation_members` lookup per policy evaluation. Upgrade path if lists grow: wrap helper calls in policies as `(select current_organisation_id())` so Postgres evaluates them once per statement.

## Live assertion run (2026-10-23)

`node scripts/apply-phase64-migration.mjs --assert-only`: all PASS. The suspended probe (rolled back) on `eval-site-worker2` in "SOPstart Eval Site": active claims gave the site, `worker` and 18 sops; after setting the row to suspended the same claims gave NULL organisation, NULL role, 0 sops, 0 members, and the hook returned organisation null and role `pending`. The active probe as the eval-site admin returned the site, `admin`, 18 sops and 6 members with no recursion error. The uat_feedback insert policy accepted an own-row insert. After the run: 0 non-active membership rows and 0 probe rows left behind.
