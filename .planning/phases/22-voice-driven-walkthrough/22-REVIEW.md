---
phase: 22-voice-driven-walkthrough
reviewed: 2026-06-25T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - src/app/(protected)/layout.tsx
  - src/app/(protected)/sops/[sopId]/page.tsx
  - src/app/api/sops/[sopId]/ask/route.ts
  - src/app/api/voice/tts/route.ts
  - src/components/layout/TopHeader.tsx
  - src/components/providers/RoleProvider.tsx
  - src/components/sop/voice/WalkthroughVoiceModal.tsx
  - src/components/sop/voice/useTtsPlayback.ts
  - src/components/sop/walkthrough/ImmersiveStepCard.tsx
  - src/components/sop/walkthrough/MobileWalkthrough.tsx
  - src/components/sop/walkthrough/WalkthroughSwitcher.tsx
  - src/lib/journeys/journeys.ts
  - src/lib/parsers/gpt-parser.ts
  - src/lib/parsers/verify-sop.ts
  - src/lib/validators/voice-tts.ts
  - src/lib/voice/deepgram-stream.ts
  - src/lib/voice/extract-keyterms.ts
  - src/lib/voice/intent-classifier.ts
  - src/lib/voice/tts-constants.ts
  - src/lib/voice/voice-qa.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: resolved
resolution: >
  CR-01 + CR-02 fixed in cf00878 — replaced the synchronous imperative-handle
  reads (currentStepText/isAcknowledged) with a reactive onVoiceStateChange push
  from MobileWalkthrough; the host now mirrors fresh voice state into the modal
  (new step read aloud on advance; ack flag reactive). Warning (TTS object-URL
  leak) also fixed in cf00878 (revoke before re-mint + on stop). Remaining
  Warnings/Info are pre-existing/separate concerns left as documented follow-ups:
  /api/sops/[sopId]/ask grounding+verifier parity, ask-route context truncation,
  notification-bell href, dual Q&A backends, slugify collisions.
---

# Phase 22: Code Review Report

**Reviewed:** 2026-06-25
**Depth:** standard (TypeScript / React / Next.js App Router)
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 22 wires the real voice loop (Deepgram STT, intent classification, OpenAI
TTS read-back) into the existing walkthrough. The server-side pieces are solid:
both new API routes (`/api/voice/tts`, `/api/sops/[sopId]/ask`) gate on a live
Supabase session, the TTS route validates with Zod + a per-user concurrency cap
and never uses the service-role client, and no secrets are exposed. The
deepgram-stream WS-auth subprotocol (`bearer`) and the deliberate omission of
`encoding`/`sample_rate` for container audio match the two Phase-22 Learnings and
look correct.

The defects cluster in the **client-side reactivity of the voice bridge** — the
exact non-reactive-ref / stale-closure trap the code comments and the
2026-06-08 / T-22-03-06 Learnings warn about. Two of them defeat the core
features this phase shipped: the wrong step text is read aloud after a voice
"next", and the D-02 safety-acknowledgement gate can be bypassed (or wrongly
triggered) by voice because it reads a frozen value. Both ship green because
the phase's verification was source-contract/grep-level (per the recurring
source-contract blind-spot Learning) and never exercised the live ref bridge in
a browser.

## Critical Issues

### CR-01: Voice "next" reads the OLD step aloud — stale ref read defeats the reactive-mirror fix

**File:** `src/components/sop/walkthrough/WalkthroughSwitcher.tsx:88-97`
**Issue:**
`handleVoiceNext` calls the imperative handle and then *synchronously* reads the
ref to mirror the new step text:

```ts
const handleVoiceNext = () => {
  mwRef.current?.onVoiceNext()
  setCurrentStepText(mwRef.current?.currentStepText ?? '')   // ← still the OLD step
}
```

`onVoiceNext()` routes to `handleMarkComplete` in `MobileWalkthrough`, which
advances the step via `setLocalStepId(next.id)` (React state). The handle's
`currentStepText` getter returns `currentStep?.text`, and `currentStep` is
derived from `localStepId` — a value that does **not** update until
`MobileWalkthrough` re-renders on the next tick. So the line above reads the
*pre-advance* step text. The mirror is set to the old text, the modal's
`currentStepText` prop doesn't change to the new step, and the
VDW-LIT-03 TTS read-aloud either repeats the previous step or doesn't fire.

This is the precise "non-reactive source" trap the file's own header comment and
`MobileWalkthrough.tsx:241-244` warn about — the mirror was added to fix it, but
reading the ref *immediately after* a state-driven advance reintroduces the
staleness. `handleVoicePrev` (line 94-97) has the identical bug.

**Fix:** Drive the mirror from the rendered step instead of reading the ref
post-advance. Lift the current step text to a value the switcher already
re-renders on, or have `MobileWalkthrough` push it up via a callback after the
advance. Minimal version — expose the *target* step text from the handle method
itself, or sync in an effect keyed on the walkthrough's step:

```ts
// In MobileWalkthrough handle: return the next step's text from onVoiceNext
onVoiceNext: () => {
  if (!currentStep) return
  const idx = allSteps.findIndex((s) => s.id === currentStep.id)
  const next = allSteps.slice(idx + 1).find((s) => !completedSteps.has(s.id))
  handleMarkCompleteRef.current(currentStep.id)
  return next?.text ?? ''        // caller mirrors the returned value, not the ref
},

// In WalkthroughSwitcher:
const handleVoiceNext = () => {
  const nextText = mwRef.current?.onVoiceNext()
  if (nextText != null) setCurrentStepText(nextText)
}
```

(Or: subscribe the switcher to the walkthrough store's active-step selector so
`currentStepText` is genuinely reactive rather than ref-mirrored.)

### CR-02: D-02 safety-ack voice gate uses a frozen value — gate can be bypassed or falsely tripped

**File:** `src/components/sop/walkthrough/WalkthroughSwitcher.tsx:116`,
consumed at `src/components/sop/voice/WalkthroughVoiceModal.tsx:252` (closure
captured at `:216-223` / `:239`)
**Issue:**
`isAcknowledged` is passed to the modal by reading the ref directly in JSX:

```tsx
isAcknowledged={mwRef.current?.isAcknowledged ?? false}
```

`mwRef.current` is a ref, not state — the switcher does **not** re-render when
`acknowledged` flips in `MobileWalkthrough`, so the prop is captured once (at
modal-open) and never updates. It is the same non-reactive-ref defect as CR-01,
applied to the safety gate. Worse, the value is then captured a second time
inside a stale closure: `startListening` registers
`h.onFinal((text) => handleFinalTranscript(text))` (`:216-223`), and
`handleFinalTranscript` reads `isAcknowledged` (`:252`). That closure freezes
the prop value from the render in which `startListening` ran.

Two concrete failure modes:
- **False trip:** worker opens the mic *before* acknowledging (modal opens with
  `false`), acknowledges in the underlying walkthrough, then says "next" — voice
  still speaks "Please acknowledge the safety hazards first" and refuses to
  advance, even though tap would work. Voice is now *more* restrictive than tap.
- **Bypass:** because the modal opens with whatever the ref happened to read at
  open time, and the value never re-syncs, the gate's correctness depends purely
  on render timing rather than on the live ack state. A frozen `true` (e.g. modal
  opened after ack, ack later reset via "Start another walkthrough") would let a
  voice "next" through with no live check. The whole point of routing voice
  through `handleMarkComplete` was that voice must not get a weaker gate than tap
  (T-22-03-01/02) — a frozen prop breaks that guarantee.

Note `handleMarkComplete` itself calls `markStepAcknowledged` unconditionally, so
the modal's `isAcknowledged === false` check at `:252` is the *only* thing
standing between a voice command and an advance. A stale value there is a real
safety-gate hole, not cosmetic.

**Fix:** Make the ack state reactive instead of a ref read, and read it live at
command time rather than from a captured closure.

1. In `WalkthroughSwitcher`, subscribe to the live ack state (the
   `useWalkthroughStore` `isAcknowledged(sopId)` selector) and pass *that* as the
   prop, so the switcher re-renders when it changes:
   ```ts
   const isAcknowledged = useWalkthroughStore((s) => s.isAcknowledged(sop.id))
   // ...
   <WalkthroughVoiceModal isAcknowledged={isAcknowledged} ... />
   ```
2. In `WalkthroughVoiceModal`, avoid capturing the prop in the long-lived
   `onFinal` closure — read it from a ref updated each render:
   ```ts
   const ackRef = useRef(isAcknowledged)
   ackRef.current = isAcknowledged
   // in handleFinalTranscript:
   if (ackRef.current === false) { void tts.speak('Please acknowledge…'); return }
   ```

## Warnings

### WR-01: `useTtsPlayback` leaks a blob object URL on every `speak()`

**File:** `src/components/sop/voice/useTtsPlayback.ts:54-66`
**Issue:** Each TTS playback creates an object URL but never revokes it:
```ts
const url = URL.createObjectURL(blob)
audioRef.current.src = url            // previous url is never revoked
```
On a multi-turn voice session (ask-again, per-step read-aloud, barge-in) this
allocates a new blob URL per utterance and holds every one for the page
lifetime. Not a correctness bug, but an unbounded resource leak on the exact hot
path this phase introduces.
**Fix:** Revoke the previous URL when replacing `src` and on the element's
`ended`/`error`:
```ts
const prev = audioRef.current.src
audioRef.current.src = url
if (prev.startsWith('blob:')) URL.revokeObjectURL(prev)
```
Also revoke in `useTtsPlayback`'s cleanup / on component unmount.

### WR-02: Deepgram `onError` can fire before the caller registers its handler

**File:** `src/lib/voice/deepgram-stream.ts:87-115, 142-151`
**Issue:** `startVoiceStream` resolves after `await getUserMedia`, but
`ws.onopen` / `ws.onerror` / `ws.onmessage` are wired before that and can fire
during the same microtask window in which the caller is still chaining
`h.onPartial/onFinal/onError`. `errorCb`/`finalCb` default to no-ops, so a
WebSocket error (e.g. instant 401/handshake failure) that arrives before
`h.onError` is registered is silently swallowed — the modal stays in
`'listening'` forever with no error surfaced. This is plausible because the WS
opens to a remote host while `getUserMedia` is awaited locally.
**Fix:** Accept the callbacks as options to `startVoiceStream({..., onError, onFinal, onPartial})`
so they are installed before any socket event can fire, or buffer the most recent
error/final and replay it when a handler is later attached.

### WR-03: `ws.onerror` fires a generic error even on a clean stop, racing the `stop()` close

**File:** `src/lib/voice/deepgram-stream.ts:115, 152-170`
**Issue:** `ws.onerror = () => errorCb(new Error('WebSocket error'))` is wired
for the connection's whole lifetime. During `stop()` the code sends
`Finalize`/`CloseStream`, stops the recorder, then `ws.close()`. Depending on
ordering, a socket error/abnormal-close event during teardown can invoke
`errorCb` *after* the worker has intentionally stopped, pushing the modal into
`state: 'error'` with a spurious "WebSocket error" right as a normal stop
completes. There is no "stopping" flag to suppress late errors.
**Fix:** Set a `let stopping = false` guard, set it at the top of `stop()`, and
have `ws.onerror`/`ws.onclose` no-op (or only log) when `stopping` is true.

### WR-04: `/api/sops/[sopId]/ask` answers without the grounding/verifier pass that the voice path enforces

**File:** `src/app/api/sops/[sopId]/ask/route.ts:61-95`
**Issue:** This route (consumed by `CommandPalette.tsx`) streams a raw Anthropic
answer with only a system-prompt instruction to "not add information not present
in the SOP." The parallel voice path (`voice-qa.ts` → `verifyTranscriptVsSop`,
mode `voice_qa`) deliberately runs a second adversarial verifier call and
surfaces a flag when an answer is ungrounded (Pitfall 10 fail-safe). The Command
Palette "Ask AI" answer has no such grounding guard and no citation contract, so
the same SOP question can yield a verified, flag-bearing answer via voice but an
unverified answer via the palette. For a safety assistant, that is an
inconsistent and weaker safety posture on a user-facing surface.
**Fix:** Either route both surfaces through `answerSopQuestion` (and stream its
result), or at minimum apply the same grounding system prompt + a post-hoc
verifier/citation step before presenting palette answers. If the streaming UX
must stay, run the verifier after the stream completes and append a flag banner.

### WR-05: `ask` route trusts `slug`-free section ordering and can silently truncate context mid-step

**File:** `src/app/api/sops/[sopId]/ask/route.ts:42-59`
**Issue:** The context builder appends sections/steps and breaks once
`context.length > 12000`, slicing mid-string and appending `[truncated]`. The
truncation happens *after* a whole section is appended, but the check is only
evaluated at the end of each section loop — a single large section can push the
buffer far past 12000 before the check runs, and the `slice(0, 12000)` can cut a
step (and especially a `[WARNING: …]` marker) in half. For a safety SOP, a
silently halved hazard warning fed to the model is a correctness/safety risk, not
just a budgeting nicety.
**Fix:** Check the budget *before* appending each step/section and stop cleanly on
a step boundary, or build the string section-by-section and join with an explicit
per-section cap so a warning is never split. Prefer dropping whole trailing
sections to slicing inside a step.

### WR-06: Notification bell navigates to `/sops`, not notifications

**File:** `src/components/layout/TopHeader.tsx:257-277`
**Issue:** The header bell icon is labelled `aria-label="Notifications"` and
renders `<NotificationBadge />`, but its `<Link href="/sops">` sends the user to
the SOP library. Clicking the unread-notification badge does not take the worker
to anything notification-related — a functional wiring bug (and an a11y
mismatch: the accessible name says "Notifications" while the destination is
SOPs).
**Fix:** Point the link at the real notifications destination (e.g.
`/activity` or a dedicated notifications route), or relabel it to match where it
actually goes.

## Info

### IN-01: Modal posts to `/api/voice/query` while the new route added this phase is `/api/sops/[sopId]/ask`

**File:** `src/components/sop/voice/WalkthroughVoiceModal.tsx:305`
**Issue:** Two parallel Q&A backends now exist — `/api/voice/query`
(verifier-backed, used by the modal) and `/api/sops/[sopId]/ask` (streaming, used
by the command palette). This is intentional per the research doc, but the
duplication of system prompts and the divergence in grounding behaviour (see
WR-04) is a maintenance hazard. Consider consolidating onto `answerSopQuestion`.

### IN-02: `audioUnlocked` "silent play" actually plays whatever `src` is set

**File:** `src/components/sop/voice/WalkthroughVoiceModal.tsx:196-202`
**Issue:** The comment says "Trigger with empty src to unlock context without
playing real audio," but no empty/silent `src` is assigned before
`audioRef.current.play()`. On the first mic press the element has no src (no-op,
fine), but if a prior TTS left a `src` set, this gesture-time `play()` would
briefly replay the previous answer. Low impact because `tts.stop()` follows, but
the code does not match its comment.
**Fix:** Assign a silent/empty data-URI src before the unlock `play()`, or drop
the misleading comment.

### IN-03: `splitAnswer` / citation regex trusts model output; chip labels rendered verbatim

**File:** `src/components/sop/voice/WalkthroughVoiceModal.tsx:71-91, 564-578`
**Issue:** Not an XSS issue (rendered as React children, no
`dangerouslySetInnerHTML`), but `slugify(label)` can collapse distinct section
titles to the same slug, and `scrollToSection` will then scroll to the wrong
section on a citation-chip click. Edge-case UX correctness, not security.
**Fix:** Prefer matching on the exact `data-section-title` attribute (already a
fallback at `:334`) before falling back to the slug.

### IN-04: `MobileWalkthrough` handle deps omit values it reads via refs (intentional but brittle)

**File:** `src/components/sop/walkthrough/MobileWalkthrough.tsx:250-268`
**Issue:** `useImperativeHandle` depends on `[currentStep, prevStep, acknowledged]`
with `exhaustive-deps` disabled; `currentStepText`/`isAcknowledged` getters read
those closed-over values. This works today but is exactly the surface that CR-01
/ CR-02 fall out of — the getters return values frozen at the dep snapshot.
Documenting here so the fix for CR-01/CR-02 also revisits this handle's contract
(prefer returning fresh values from the methods over getter closures).

---

## Summary Table

| ID    | Severity | File | Issue |
|-------|----------|------|-------|
| CR-01 | Critical | WalkthroughSwitcher.tsx:88-97 | Stale ref read after `onVoiceNext()` → wrong/old step read aloud (defeats VDW-LIT-03) |
| CR-02 | Critical | WalkthroughSwitcher.tsx:116 / VoiceModal.tsx:252 | D-02 ack gate uses frozen non-reactive ref + stale closure → gate false-trips or bypasses |
| WR-01 | Warning  | useTtsPlayback.ts:54-66 | Object URL never revoked — unbounded blob leak per utterance |
| WR-02 | Warning  | deepgram-stream.ts:87-151 | Early WS error swallowed before caller registers `onError` |
| WR-03 | Warning  | deepgram-stream.ts:115,152-170 | `ws.onerror` during clean stop pushes spurious `error` state |
| WR-04 | Warning  | api/sops/[sopId]/ask/route.ts:61-95 | Palette answers skip the grounding/verifier pass the voice path enforces |
| WR-05 | Warning  | api/sops/[sopId]/ask/route.ts:42-59 | Context truncation can split a step / hazard warning mid-string |
| WR-06 | Warning  | TopHeader.tsx:257-277 | Notification bell links to `/sops`, not notifications (functional + a11y) |
| IN-01 | Info     | WalkthroughVoiceModal.tsx:305 | Two parallel Q&A backends — consolidation hazard |
| IN-02 | Info     | WalkthroughVoiceModal.tsx:196-202 | iOS-unlock `play()` doesn't match its "silent src" comment |
| IN-03 | Info     | WalkthroughVoiceModal.tsx:71-91 | `slugify` collisions can scroll citation chips to wrong section |
| IN-04 | Info     | MobileWalkthrough.tsx:250-268 | Imperative-handle getters return dep-frozen values (root of CR-01/02) |

_Reviewed: 2026-06-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
