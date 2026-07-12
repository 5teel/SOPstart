# Phase 29: Approval Chains - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning
**Mode:** Autonomous (grey areas resolved by Claude under Simon's locked north star; Simon reviews on completion)

<domain>
## Phase Boundary

Admins can optionally define a per-category multi-step approval chain (1–4 ordered steps) that gates publish ONLY when configured. SOPs in categories without a chain publish exactly as today — byte-identical behavior, zero added friction. One-click approve from the SOP and the governance queue; no separate approval console. Chain snapshotted per version; approval history visible in version history.

**NORTH STAR:** ease of use first. The chain is opt-in per category; the default experience is unchanged. Approving must be ONE click from where the approver already is. Visy context: "3-4 managers before approval" for safety-critical SOPs; chains must be editable per version because org structures change.

</domain>

<decisions>
## Implementation Decisions

### D29-01 — Chain definition: org-scoped `approval_chains` table keyed by category
Columns: organisation_id, category (text, matches `sops.category`; `'default'` NOT supported — chains are deliberately per-category only, no org-wide catch-all that would make every publish gated), steps jsonb (ordered array of 1–4 `{ role?: AppRole, userId?: string, label: string }`), created_by, timestamps. Follows the `sop_review_cadences`/`ai_model_settings` shape (00042/00043 precedent): SELECT via `current_organisation_id()` (the 00044-fixed predicate — NOT the app_metadata path), writes via service-role action with org self-enforcement.

### D29-02 — Per-version snapshot: `approval_snapshot` jsonb on the SOP (or version row)
When a publish is REQUESTED for an SOP whose category has a chain, the chain's steps are copied into a snapshot at that moment. The live chain can change freely; in-flight and historical approvals keep the snapshot they started with (APR-02). Store approvals in an append-only `sop_approvals` table: sop_id, org_id, version, step_index, approver_user_id, action ('approved' | 'changes_requested'), comment (optional), created_at — completions/review_events mirror, INSERT-only RLS with `approver_user_id = auth.uid()`.

### D29-03 — Publish flow integration: "request publish" state, NOT a parallel pipeline
Reuse the existing publish route as the single entry. When a chain applies: first POST puts the SOP into `pending_approval` (new value on the existing status lifecycle — additive enum value or a nullable `approval_state` column; prefer the COLUMN to avoid touching the status enum that worker/library queries filter on — LOCKED: new nullable `sops.approval_state` column, values NULL | 'pending' | 'approved', so all existing status-based code paths are untouched). Each one-click approve records a `sop_approvals` row; when the final step approves, the SAME publish logic completes automatically (APR-04) — server-side, no extra admin click. "Request changes" clears the pending state back to draft with the comment surfaced. NO chain configured → route behaves byte-identically to today (source-contract test must prove the no-chain path is untouched).

### D29-04 — Approver resolution: role-based or named-member steps
A step matches if (userId set and caller is that user) OR (role set and caller has that role in the org). Steps approve strictly in order — the "who's next" pointer is the first step index with no approval row.

### D29-05 — Approval surfaces: exactly two, both existing
(1) SOP detail/builder publish stage shows the pending chain (step list, who's next, one-click Approve / Request changes for the matching approver). (2) Governance queue gains an `awaiting_approval` flag/chip — rows where the caller is the next approver get the one-click Approve action inline. NO new routes, NO approval console (APR-03). Chain CONFIG lives as a small section on the existing `/admin/governance` page (an "Approval chains" panel — category picker + 1–4 step editor), not a new route.

### D29-06 — Approval history in version history (APR-05)
The existing `/admin/sops/[sopId]/versions` surface renders `sop_approvals` rows (who, when, action, step label) grouped by version. Read-only addition.

### D29-07 — No notifications this phase
Same as Phase 28: the queue + pending state IS the surfacing. Email/digest stays in Future Requirements.

### D29-08 — Worker surfaces: ZERO change
Workers never see approval state. `pending_approval` SOPs remain drafts from the worker's perspective (not visible until published, exactly as drafts are today).

### Claude's Discretion
Exact component naming, step-editor UX details (within paper/ink language), jsonb schema details, and whether approval_state lives on sops vs a side table — planner decides within the locked column-not-enum constraint.

</decisions>

<code_context>
## Existing Code Insights

- **Publish route:** `src/app/api/sops/[sopId]/publish/route.ts` — single draft→published transition; Phase 28 added review-clock reset + MR-01 rowcount gating (409 on non-draft). Phase 29 wraps the top of this flow. The `unverified_blocks` 400 gate must still run BEFORE pending_approval is entered (an unverified SOP can't even request publish).
- **Governance queue:** `src/actions/governance.ts` `listGovernanceQueue` + `GovernanceRow.flags` — add `awaiting_approval` flag; classifier in `src/lib/governance/classify.ts` is pure — extend `GovernanceInput` additively.
- **Settings-table precedent:** `sop_review_cadences` (00043) + the 00044 RLS fix — copy exactly; do NOT use the `app_metadata` JWT path (HR-01 class).
- **Append-only precedent:** `sop_review_events` (00043) with `reviewed_by = auth.uid()` INSERT policy.
- **Version history surface:** `/admin/sops/[sopId]/versions` (Phase 23) — approval history renders here.
- **Roles:** AppRole in `src/types/auth.ts` (worker/supervisor/admin/safety_manager). Role-based steps use these.
- **Next migration number: 00045.**
- **Gates:** journeys.ts if any route changes (none expected); playwright phase29 projects registered same-plan as specs; tsc + npm run build final; NZ dates.

</code_context>

<specifics>
## Specific Ideas

- The chain step editor: category dropdown (from existing sops categories in org) + up to 4 rows of "role OR member" pickers with drag order — keep it one panel, no wizard.
- Approve button must be optimistic-feeling (instant feedback) and idempotent server-side (double-click = one approval row; unique constraint on sop_id+version+step_index).
- "Request changes" requires a comment (one-line input inline) — that comment is the accuracy signal back to the owner; it lands on the SOP as the reason it returned to draft (surface in builder publish stage).

</specifics>

<deferred>
## Deferred Ideas

- Email/notification on pending approval (Future Requirements)
- Cross-site Discipline Leader approver role (needs multi-site signal)
- Delegated/vacation approver fallback (no pull yet)
- Org-wide default chain (deliberately excluded — would gate every publish, violating north star)

</deferred>
