# Phase 4: Completion and Sign-off - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Worker completions are durably recorded with photo evidence and SOP version snapshot. Supervisors can review and approve/reject completions. Completion records are immutable (app-enforced). This is the final phase — it closes the loop from SOP assignment through worker execution to supervisor verification.

</domain>

<decisions>
## Implementation Decisions

### Completion Recording
- **D-01:** Manual submit — worker taps "Submit Completion" button after finishing all steps (not automatic after last step)
- **D-02:** Progress saves automatically — worker can close and resume later (partial completion persisted)
- **D-03:** Workers can complete the same SOP multiple times — every completion is a separate record (workers redo SOPs regularly for recurring procedures)
- **D-04:** Completion record captures: SOP version number, content hash, worker user ID, server-side timestamp, all photo references, step completion data

### Photo Evidence
- **D-05:** Per-step photo requirement — admin marks specific steps as requiring photo evidence during SOP review (not all steps, not all SOPs)
- **D-06:** Multiple photos per step — worker can attach several photos (e.g., before/after shots)
- **D-07:** Photos queue locally and auto-upload when back online — offline photo capture fully supported
- **D-08:** Photos compressed client-side before IndexedDB write (Canvas resize ~200KB target per research)

### Supervisor Review
- **D-09:** Activity feed layout — chronological list (newest first) with filters for grouping by SOP and by worker
- **D-10:** Summary card in the list — worker name, SOP title, date, photo count, status. Tap for full detail view.
- **D-11:** Full detail view — step-by-step showing what the worker did, their photos per step, timestamps
- **D-12:** Reject with reason — supervisor must enter a reason when rejecting. Worker gets notified to redo.
- **D-13:** Supervisors see only their explicitly-assigned workers (from Phase 1 D-12)
- **D-14:** Safety Manager sees ALL completions org-wide (from Phase 1 D-14)

### Audit Trail
- **D-15:** App-enforced immutability — app prevents edits/deletes on completion records, but database allows for emergency corrections by service role
- **D-16:** Full snapshot at completion — SOP version number + content hash + worker ID + server-side timestamp + all photo references + step completion timestamps
- **D-17:** Supervisor sign-off creates a second immutable record (the approval/rejection is its own timestamped record, not a mutation of the completion)

### Claude's Discretion
- Completion FSM state machine design (not_started → in_progress → pending_sign_off → signed_off/rejected)
- Photo compression implementation details
- Offline photo queue and sync implementation
- Activity feed pagination approach
- Filter UI design for supervisor feed
- How "photo required" flag is stored on steps (likely a boolean on sop_steps)
- Notification to worker on rejection

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Vision, core value, NZ market context
- `.planning/REQUIREMENTS.md` — COMP-01 through COMP-07
- `.planning/ROADMAP.md` — Phase 4 details, success criteria, plan breakdown

### Research
- `.planning/research/STACK.md` — sharp for compression, Supabase Storage
- `.planning/research/ARCHITECTURE.md` — Completion FSM, append-only records
- `.planning/research/PITFALLS.md` — Photo storage bloat, completion record legal defensibility, offline sync conflicts

### Phase 3 Output (build on this)
- `src/stores/walkthrough.ts` — Walkthrough state (step completions, safety ack)
- `src/lib/offline/db.ts` — Dexie DB schema (extend with completions table)
- `src/lib/offline/sync-engine.ts` — Sync engine (extend for completion upload)
- `src/hooks/useSopDetail.ts` — SOP detail hook
- `src/components/sop/StepItem.tsx` — Step component (add photo capture button)
- `src/app/(protected)/sops/[sopId]/walkthrough/page.tsx` — Walkthrough page (add submit button)

### Phase 1 Output
- `src/types/auth.ts` — AppRole (supervisor, safety_manager roles)
- `supabase/migrations/` — Existing schema (00001-00009)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/walkthrough.ts` — Already tracks step completion state (completedSteps Set)
- `src/lib/offline/db.ts` — Dexie DB (add completions + photoQueue tables)
- `src/lib/offline/sync-engine.ts` — Sync engine pattern (extend for completion sync)
- `src/components/sop/StepItem.tsx` — Step row with completion state (add camera icon)
- `src/components/admin/StatusBadge.tsx` — Reusable badge (reuse for completion status)
- `src/hooks/useNotifications.ts` — Notification polling (reuse for worker rejection notifications)
- Browser `<input capture="environment">` pattern already used in Phase 2 UploadDropzone

### Established Patterns
- Server actions with Zod in `src/actions/`
- Supabase RLS with `current_organisation_id()`
- Offline-first: write to Dexie, sync on reconnect
- Presigned URL for file uploads to Supabase Storage
- TanStack Query with offlineFirst mode

### Integration Points
- Supervisor dashboard at `src/app/(protected)/dashboard/page.tsx` (currently placeholder text)
- Worker walkthrough page gets "Submit Completion" button
- StepItem gets camera capture icon
- Dexie DB schema extended with completions + photo queue
- New migrations for completions and completion_photos tables
- BottomTabBar "Activity" tab links to completion feed

</code_context>

<specifics>
## Specific Ideas

- **Recurring SOPs** — Workers redo SOPs regularly (e.g., weekly machine shop cleaning). Multiple completions per SOP is essential, not just allowed.
- **Per-step photo requirements** — Admin sets this during SOP review phase. Some steps genuinely need photographic evidence (e.g., "photo of PPE worn", "photo of area after cleanup"). Others don't.
- **Reject with reason** — The supervisor's rejection reason should be visible to the worker so they know what to fix when redoing.
- **Activity tab** — The BottomTabBar already has an "Activity" tab. This becomes the supervisor's completion feed and the worker's completion history.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-completion-and-sign-off*
*Context gathered: 2026-03-25*
