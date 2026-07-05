-- ============================================================
-- 00041 — lock down match_sop_agent_metadata (Phase 26.5 review fix CR-01)
--
-- 00040 shipped this SECURITY DEFINER RPC with a caller-supplied
-- p_organisation_id and no REVOKE — Supabase's default privileges grant
-- EXECUTE on new public functions to anon/authenticated via PUBLIC, and
-- PostgREST exposes it at POST /rest/v1/rpc/match_sop_agent_metadata. Any
-- authenticated user in org A could pass org B's UUID and read org B's
-- sop_ids ranked by semantic similarity (cross-tenant disclosure — same
-- family as CLAUDE.md 2026-06-15/2026-06-26).
--
-- Fix: the ONLY intended caller is the service-role client
-- (src/lib/agent-layer/similarity.ts), which passes the org explicitly and
-- self-enforces. So REVOKE from client roles and keep the parameter —
-- deriving org from a JWT is impossible for the service-role caller anyway
-- (no org claim on the service key).
--
-- Also (IN-01, folded in per the review): exclude embedding IS NULL rows so
-- under-populated orgs don't get null-similarity padding rows.
-- ============================================================

create or replace function public.match_sop_agent_metadata(
  p_organisation_id uuid,
  query_embedding vector(1024),
  match_count int default 10
)
returns table (sop_id uuid, similarity float)
language sql stable security definer
as $$
  select sop_id, 1 - (embedding <=> query_embedding) as similarity
  from public.sop_agent_metadata
  where organisation_id = p_organisation_id
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count
$$;

-- Service-role only: strip the default PUBLIC grant and the client roles.
revoke execute on function public.match_sop_agent_metadata(uuid, vector, int)
  from public, anon, authenticated;
grant execute on function public.match_sop_agent_metadata(uuid, vector, int)
  to service_role;

comment on function public.match_sop_agent_metadata is
  'Phase 26.5 D-03: pgvector cosine-similarity search over sop_agent_metadata.embedding. EXECUTE is revoked from anon/authenticated/PUBLIC (00041, review fix CR-01) — service_role only. The caller (src/lib/agent-layer/similarity.ts, createAdminClient) passes p_organisation_id explicitly and self-enforces org-scope (CLAUDE.md 2026-06-15/2026-06-26).';
