# Phase 08: Video SOP Generation - Research

**Researched:** 2026-04-03
**Domain:** AI video generation from structured SOPs — TTS narration, cloud video rendering, async job pipeline, worker video player
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Build narrated slideshow + screen-recording-style only. Full AI video (avatar/animations — VGEN-03) deferred to a future phase. Validate demand with the two standard formats first.
- **D-02:** Narrated slideshow uses one slide per SOP section (not per step). Hazards slide, PPE slide, Steps slide (sub-bullets for each step), Emergency slide. Keeps videos concise (5-15 slides).
- **D-03:** Screen-recording-style video scrolls through the SOP content with TTS narration synced to the scroll position. Same section-level pacing as slideshow.
- **D-04:** "Video" tab on the SOP detail page, alongside existing section tabs (Hazards, PPE, Steps, etc.). Workers see it only when a generated video exists for that SOP.
- **D-05:** Inline video player within the tab area with native full-screen option. Chapter list below the player showing SOP sections with timestamps. Click a chapter to jump. Playback speed control (0.5x, 1x, 1.5x, 2x).
- **D-06:** Optional admin preview before publishing — admin can preview but isn't required to. Publish button available immediately after generation completes. Admin can re-generate if pronunciation is bad.
- **D-07:** Global NZ industrial vocabulary only (same list from Phase 6). No per-org pronunciation dictionary in Phase 8. Re-generate is the fallback for bad pronunciation.
- **D-08:** TTS via gpt-4o-mini-tts (already in OpenAI SDK). Split by section — one TTS call per section, stitch in video composition. Avoids pauses/stutters on long SOPs.
- **D-09:** Keep generated videos indefinitely. No auto-delete TTL.
- **D-10:** "Video is outdated" warning when SOP updated_at > video generated_at. Amber badge on both admin and worker views. Admin can re-generate; workers still see the old video.
- **D-11:** Generated video URLs excluded from service worker caching (INFRA-03). Videos stream from Supabase Storage, never cached on device.
- **D-12:** Shotstack API for video rendering — cloud-based, no binary dependencies, no Remotion licensing concerns. JSON timeline API for compositing slides + audio.
- **D-13:** video_generation_jobs table with FSM pattern. Stages: analyzing → generating slides → adding narration → rendering → ready.
- **D-14:** Idempotency — if a job already exists for the current SOP version + format, return existing job ID instead of creating a duplicate.
- **D-15:** Worker video viewing creates a completion record of type 'video_view' in the existing sop_completions table. Records the video generation job ID and SOP version. Same audit trail as text walkthrough completions.

### Claude's Discretion

- Shotstack timeline JSON structure and composition details
- Video rendering resolution and format (720p/1080p, MP4)
- Slide design (background color, font size, layout within Shotstack)
- Chapter marker extraction from SOP section boundaries
- How to detect "video fully watched" for completion tracking (percentage threshold or end reached)
- TTS voice selection (gpt-4o-mini-tts voice parameter)
- Admin re-generate workflow details

### Deferred Ideas (OUT OF SCOPE)

- Full AI video (avatar/animations) — VGEN-03. Validate demand with narrated slideshow + screen-recording first.
- Per-org pronunciation dictionary — SSML phoneme tags for custom terms.
- Auto-regenerate on SOP update.
- Video retention TTL.
- Mandatory admin preview.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VGEN-01 | Admin can generate a narrated slideshow video from a published SOP with AI voiceover and one slide per section | Shotstack JSON timeline with one image/text clip per SOP section + gpt-4o-mini-tts per section audio |
| VGEN-02 | Admin can generate a screen-recording-style video with scrolling SOP text synced to AI voice narration | Shotstack timeline with single scrolling HTML clip + full-SOP TTS audio track |
| VGEN-03 | Admin can generate a full AI video with avatar or animated visuals synchronized to narration | DEFERRED per D-01 — not in scope for Phase 8 |
| VGEN-04 | Generated videos include chapter markers per SOP section and timestamps per step for direct navigation | Chapter list component with timestamps extracted from TTS audio duration per section |
| VGEN-05 | Admin can preview generated video and re-generate before publishing to workers | Admin preview panel with re-generate button; published_at field on video_generation_jobs |
| VGEN-06 | Video generation shows async progress with named stages (analyzing → generating → adding narration → finalizing) | Supabase Realtime on video_generation_jobs table; stage stepper reused from ParseJobStatus.tsx pattern |
| VGEN-07 | Workers can access the video version of an SOP from within the existing SOP view with an in-app video player | Video tab added to SopSectionTabs.tsx; HTML5 video player in worker SOP detail page |
| VGEN-08 | Video player supports chapter navigation, timestamp jumps, and playback speed control | video.currentTime API for chapter jumps; playbackRate for speed control; chapter list with click handlers |
| VGEN-09 | Worker video viewing is tracked as a completion event alongside text walkthrough completions | Insert into sop_completions with completion_type='video_view'; video_generation_job_id column added |
| INFRA-03 | Generated videos are excluded from service worker caching to prevent device storage bloat | sw.ts matcher updated to exclude sop-generated-videos bucket URL paths from CacheFirst handler |
</phase_requirements>

---

## Summary

Phase 8 generates narrated slideshow and screen-recording-style video versions of published SOPs using OpenAI gpt-4o-mini-tts for narration and Shotstack's cloud rendering API for video composition. The architecture is fully async: a POST to `/api/sops/generate-video` creates a `video_generation_jobs` record and returns 202 immediately. TTS calls run per-section (one call per SOP section), and audio URLs are stitched into a Shotstack JSON timeline that produces an MP4. Shotstack either calls a webhook or is polled for completion, at which point the video URL is written back to the job record and surfaced in the worker's SOP view as a "Video" tab.

The code base already provides all the patterns needed: the `parse_jobs` FSM pattern with Supabase Realtime and the stage stepper UI in `ParseJobStatus.tsx`, the `sop_completions` append-only audit table, the `SopSectionTabs.tsx` tab bar for adding the Video tab, and `sw.ts` with a matcher that already targets Supabase storage paths. Phase 8 extends these rather than inventing new patterns.

The primary implementation risks are: Shotstack webhook delivery requiring a publicly accessible endpoint (polling is the safe fallback on localhost), the `sop_completions` table needing a `completion_type` discriminator column to distinguish `video_view` from `walkthrough` completions, and the service worker needing a tighter URL exclusion rule so that video storage paths are not cache-matched by the existing `sop-images-v1` CacheFirst handler.

**Primary recommendation:** Use fetch-only (no SDK) for Shotstack, polling for render status during development (webhook for production), Supabase Realtime for job stage updates on the client, and extend `sop_completions` with a `completion_type` enum column rather than a separate table.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` SDK | ^6.32.0 (installed) | gpt-4o-mini-tts TTS calls per section | Already installed; no new dependency or API key |
| Shotstack API | cloud service | MP4 video rendering from JSON timeline | Locked decision D-12; pure HTTP, no binary, Vercel-safe |
| Supabase | existing | `video_generation_jobs` table, `sop-generated-videos` bucket, Realtime | Project-standard; all existing patterns apply |
| Supabase Realtime | existing | Live stage updates to admin/worker UI | Same pattern as `parse_jobs` — already wired |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fetch` (native) | built-in | Shotstack API calls | Preferred over `@shotstack/shotstack-sdk` to avoid dependency; API is simple enough for typed fetch |
| HTML5 `<video>` element | native | Worker video player | Native, no library needed; `playbackRate` and `currentTime` API cover all D-05 requirements |
| Lucide React icons | installed | Video tab icon, chapter list icons | Already used throughout project |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fetch for Shotstack | `@shotstack/shotstack-sdk` | SDK adds a dependency; the Shotstack API surface for Phase 8 is simple enough (one POST, one GET) that typed fetch interfaces are sufficient and add zero bundle weight |
| Polling for Shotstack status | Webhook callback | Webhook requires a public URL (breaks on localhost); polling on `video_generation_jobs` table via Supabase Realtime avoids this entirely |
| `sop_completions` extension with `completion_type` | Separate `video_view_events` table | Unified audit table keeps supervisor review UI simpler; D-15 explicitly mandates reusing sop_completions |

**Installation:** No new npm packages are required for Phase 8. The existing `openai` SDK at ^6.32.0 covers gpt-4o-mini-tts. Shotstack is called via native `fetch`.

New environment variable required:
```bash
SHOTSTACK_API_KEY=<your_key>
```

**Version verification:**
- `openai`: 6.33.0 current on npm; project has ^6.32.0 — no upgrade needed
- `@shotstack/shotstack-sdk`: 1.x on npm — not installing; using fetch directly

---

## Architecture Patterns

### Recommended Project Structure

New modules for Phase 8 follow the established `src/lib/` pattern:

```
src/
├── lib/
│   └── video-gen/
│       ├── tts.ts               # gpt-4o-mini-tts per-section narration
│       ├── render-slides.ts     # Shotstack JSON timeline for narrated slideshow
│       ├── render-scroll.ts     # Shotstack JSON timeline for screen-recording style
│       └── shotstack-client.ts  # typed fetch wrapper for Shotstack API
├── components/
│   └── sop/
│       ├── SopSectionTabs.tsx   # EXTEND: add Video tab
│       └── VideoPlayer.tsx      # NEW: worker video player with chapters + speed
│   └── admin/
│       ├── VideoGenerationPanel.tsx    # NEW: generate button, format selector, status
│       └── VideoGenerationStatus.tsx   # NEW: stage stepper (mirrors ParseJobStatus.tsx)
├── app/
│   ├── (protected)/
│   │   └── sops/[sopId]/
│   │       └── page.tsx         # EXTEND: add Video tab conditional rendering
│   └── api/
│       └── sops/
│           └── generate-video/
│               └── route.ts     # NEW: trigger video generation job
│           └── generate-video/[jobId]/
│               └── route.ts     # NEW: GET job status (polling fallback)
│           └── video-view/
│               └── route.ts     # NEW: record video view completion
└── types/
    └── sop.ts                   # EXTEND: VideoGenerationJob, VideoGenerationStatus types
supabase/
└── migrations/
    └── 00013_video_generation.sql  # NEW: video_generation_jobs, sop-generated-videos bucket, sop_completions extension
```

### Pattern 1: Shotstack Timeline for Narrated Slideshow

**What:** Each SOP section becomes a Shotstack clip with a text/image asset and a timed audio track. Section durations are determined by the TTS audio length. Chapter timestamps are the cumulative sum of prior section durations.

**When to use:** VGEN-01 — narrated slideshow format

```typescript
// Source: Shotstack API docs https://shotstack.io/docs/api/
// Typed fetch, no SDK dependency
interface ShotstackClip {
  asset: { type: 'html'; html: string } | { type: 'image'; src: string }
  start: number   // seconds from video start
  length: number  // duration in seconds (= TTS audio length for this section)
}

interface ShotstackEdit {
  timeline: {
    tracks: Array<{ clips: ShotstackClip[] }>
    soundtrack?: { src: string; effect?: 'fadeIn' | 'fadeOut'; volume?: number }
  }
  output: { format: 'mp4'; resolution: 'hd' }  // 1280x720
  callback?: string  // optional webhook URL
}
```

**How section clips map to SOP sections:**

```
Section: Hazards
  → TTS call: openai.audio.speech.create({ model: 'gpt-4o-mini-tts', input: hazardsText })
  → audio stored: sop-generated-videos/{orgId}/{sopId}/audio/hazards.mp3
  → clip: { asset: { type: 'html', html: hazardsSlideHtml }, start: 0, length: audioDurationSecs }

Section: PPE
  → TTS call: openai.audio.speech.create({ model: 'gpt-4o-mini-tts', input: ppeText })
  → clip: { start: hazardsDuration, length: ppeDuration }

...and so on for each section
```

**Chapter markers extracted from cumulative durations:**

```typescript
// Each section's start time is the chapter timestamp
const chapters = sections.map((section, i) => ({
  sectionId: section.id,
  title: section.title,
  timestamp: sections.slice(0, i).reduce((sum, s) => sum + s.audioDuration, 0),
}))
// Store chapters array in video_generation_jobs.chapter_markers JSONB column
```

### Pattern 2: Shotstack Timeline for Screen-Recording Style

**What:** A single scrolling HTML asset covers the entire SOP content. The full audio track is all section TTS stitched together. The HTML asset uses a CSS scroll animation timed to section boundaries.

**When to use:** VGEN-02 — screen-recording style format

```typescript
// Single audio track = all sections concatenated
// Shotstack soundtrack object for full-video audio
const edit: ShotstackEdit = {
  timeline: {
    tracks: [{
      clips: [{
        asset: { type: 'html', html: fullSopHtml },  // full SOP rendered to HTML
        start: 0,
        length: totalDuration,
      }]
    }],
    soundtrack: {
      src: stitchedAudioUrl,  // all sections concatenated server-side
      effect: 'fadeIn',
    }
  },
  output: { format: 'mp4', resolution: 'hd' },
}
```

**Audio stitching for screen-recording format:** Concatenate all per-section MP3 audio buffers server-side by appending binary data. No ffmpeg needed — MP3 files can be concatenated directly as binary for simple playback (no gapless encoding required for this use case). Store as single file in Supabase Storage and pass URL to Shotstack soundtrack.

### Pattern 3: Async Job FSM (mirrors parse_jobs)

**What:** `video_generation_jobs` table with FSM status field and named `current_stage`. Supabase Realtime subscription on the client updates UI. Fallback polling if Realtime doesn't fire within 5 seconds.

**Stages (D-13):**

| Stage key | UI label | What happens |
|-----------|----------|--------------|
| `analyzing` | Analyzing | Fetch SOP sections, compute script text per section |
| `generating_audio` | Generating narration | Loop sections, one TTS call each; store audio to Storage |
| `rendering` | Rendering video | POST to Shotstack; return jobId; enter poll/webhook wait |
| `ready` | Ready | Shotstack render complete; video URL written to job record |
| `failed` | Failed | Error message stored; admin can re-generate |

```typescript
// Source: established pattern from parse_jobs FSM (migration 00004 + ParseJobStatus.tsx)
// video_generation_jobs FSM status update — server-side
await supabase
  .from('video_generation_jobs')
  .update({ current_stage: 'generating_audio', updated_at: new Date().toISOString() })
  .eq('id', jobId)
```

### Pattern 4: Shotstack Status Polling (Webhook Fallback)

**What:** After POSTing the edit to Shotstack, store the Shotstack render ID in `video_generation_jobs.shotstack_render_id`. A separate polling loop (or Supabase Edge Function cron, or simple setInterval in the API route with a keepalive trick) checks `GET /render/{id}` until status is `done` or `failed`.

**Recommendation for Phase 8 (no Inngest):** Poll from within the API route handler using a `while` loop with 5-second sleeps, guarded by a 240-second timeout. Vercel Pro allows up to 300 seconds. On completion, update `video_generation_jobs` and Supabase Realtime propagates to the client.

```typescript
// Shotstack render status polling — runs inside /api/sops/generate-video route
const SHOTSTACK_BASE = 'https://api.shotstack.io/edit/v1'

async function pollShotstackRender(renderId: string, apiKey: string): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < 240_000) {
    await new Promise(r => setTimeout(r, 5000))
    const res = await fetch(`${SHOTSTACK_BASE}/render/${renderId}`, {
      headers: { 'x-api-key': apiKey }
    })
    const data = await res.json()
    if (data.response.status === 'done') return data.response.url
    if (data.response.status === 'failed') throw new Error(data.response.error)
  }
  throw new Error('Render timed out after 240 seconds')
}
```

### Pattern 5: Video View Completion Tracking

**What:** When a worker reaches >= 80% of the video duration (or the video `ended` event fires), insert into `sop_completions` with `completion_type = 'video_view'`. The video_generation_job_id is also stored for traceability.

**Threshold choice:** `ended` event fires when the video reaches its natural end. Using `timeupdate` to check `currentTime / duration >= 0.8` allows tracking workers who don't watch the final moments but have seen the substance. Use 0.8 as threshold — fire once, do not re-fire.

```typescript
// Client-side in VideoPlayer.tsx
const handleTimeUpdate = useCallback(() => {
  if (videoRef.current && !viewTracked.current) {
    const { currentTime, duration } = videoRef.current
    if (duration > 0 && currentTime / duration >= 0.8) {
      viewTracked.current = true
      recordVideoView({ sopId, sopVersion, videoJobId })
    }
  }
}, [sopId, sopVersion, videoJobId])
```

### Pattern 6: Service Worker Video Exclusion

**What:** The current sw.ts CacheFirst handler matches `url.hostname.includes('supabase.co') && url.pathname.includes('/storage/')` — this would catch video URLs too. The exclusion must exclude `sop-generated-videos` bucket paths.

```typescript
// src/app/sw.ts — CURRENT (catches all storage, including videos)
matcher({ url }: { url: URL }) {
  return url.hostname.includes('supabase.co') && url.pathname.includes('/storage/')
}

// UPDATED — exclude sop-generated-videos bucket
matcher({ url }: { url: URL }) {
  return (
    url.hostname.includes('supabase.co') &&
    url.pathname.includes('/storage/') &&
    !url.pathname.includes('/sop-generated-videos/')
  )
}
```

### Anti-Patterns to Avoid

- **Generating video synchronously in a request:** Shotstack renders take 30-120 seconds. Never await the full render in an HTTP handler. Return 202 immediately, poll in background.
- **Caching video URLs in Dexie:** Video URLs must not be synced to IndexedDB. The SOP record synced to Dexie must not embed `video_url` fields. Fetch video availability separately, online-only.
- **Storing TTS audio as base64 in DB:** Store audio files in Supabase Storage and pass public/presigned URLs to Shotstack. Base64 in DB rows will bloat the table.
- **One TTS call for entire SOP:** Long SOPs produce TTS stutters at the split point. D-08 mandates per-section calls.
- **Using @shotstack/shotstack-sdk npm package:** The package adds 50+ KB to server bundle and its API is not materially simpler than fetch. Use typed fetch directly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video rendering / compositing | Custom ffmpeg pipeline | Shotstack API | Server-side ffmpeg binary breaks Vercel deployments; binary exceeds 50 MB function limit |
| TTS narration | Recording audio or using browser SpeechSynthesis | `openai.audio.speech.create` | Already in installed SDK; industrial-quality voice; consistent output |
| Real-time job status push | WebSocket server | Supabase Realtime (`postgres_changes` on `video_generation_jobs`) | Established pattern from parse_jobs; zero new infrastructure |
| Chapter timestamp calculation | Video analysis tool | Compute from TTS audio durations during generation | Exact section durations known at generation time; store in JSONB column |
| Video player library | Custom video player with chapters | Native HTML5 `<video>` + `currentTime` / `playbackRate` API | All required features (chapters, speed, fullscreen) supported natively on iOS and Android |

---

## Common Pitfalls

### Pitfall 1: Service Worker Caches Videos (INFRA-03)

**What goes wrong:** The existing sw.ts `sop-images-v1` CacheFirst rule matches ALL Supabase storage paths. When a worker's browser first loads a generated video, the service worker caches it. A 5-minute SOP video at 720p is 50-100 MB. Industrial devices fill up fast, and PWA storage eviction on iOS kills everything.

**Why it happens:** The sw.ts matcher is too broad — it was written for SOP images (hundreds of KB) and will catch video URLs unless explicitly excluded.

**How to avoid:** Update the sw.ts matcher in the same Wave as adding video URLs to the SOP data model. Never let a release ship where video URLs exist in the app but the exclusion rule is not yet in place.

**Warning signs:** Any code that calls `useSopDetail` or fetches SOP data starts returning a `video_url` field without a corresponding sw.ts exclusion rule update.

### Pitfall 2: Duplicate Video Generation Jobs (Idempotency)

**What goes wrong:** Admin clicks "Generate" twice, or a client retry creates two concurrent Shotstack renders for the same SOP. Two video records exist; workers see inconsistent state.

**Why it happens:** The generate endpoint is not idempotent by default. Network flakiness causes double-submits.

**How to avoid:** D-14 — before creating a new `video_generation_jobs` row, check if one exists with `(sop_id, format, sop_version)` and a status other than `failed`. If found, return the existing job ID. Use a unique constraint on `(sop_id, format, sop_version)` in the DB to enforce at the database level.

**Warning signs:** No unique constraint on the `video_generation_jobs` table; no idempotency check before INSERT.

### Pitfall 3: Vercel Function Timeout on Long SOPs

**What goes wrong:** A 20-section SOP takes 20 TTS calls + Shotstack rendering. At 2-3 seconds per TTS call, that is 40-60 seconds of TTS alone, plus 30-90 seconds for Shotstack to render. Total exceeds the Vercel Pro 300-second function timeout.

**Why it happens:** Everything runs synchronously in a single function invocation.

**How to avoid:** Separate the generation into two API routes: (1) `/api/sops/generate-video` — creates the job, triggers async work, returns 202; (2) A long-running background execution pattern. The simplest approach within Vercel limits: TTS calls are fast (2-3 sec each) and parallelisable via `Promise.all`. Run all TTS calls concurrently (not sequentially). Shotstack rendering is external and does not block the function — poll its status in a separate light-weight GET handler. Cap total function execution at 240 seconds.

**Warning signs:** `await`-chained TTS calls in a loop instead of `Promise.all`; no timeout guard on polling.

### Pitfall 4: sop_completions Lacks completion_type Discriminator

**What goes wrong:** The existing `sop_completions` table has no way to distinguish `walkthrough` completions from `video_view` completions. The supervisor activity feed shows all completions and cannot filter by type. Reports are meaningless.

**Why it happens:** D-15 mandates reusing `sop_completions` but the existing schema does not have a `completion_type` column.

**How to avoid:** Migration 00013 must add `completion_type` text column with a CHECK constraint (`'walkthrough'`, `'video_view'`). All existing rows default to `'walkthrough'`. All new Phase 4 completion inserts must explicitly set `completion_type = 'walkthrough'` (or rely on the DEFAULT). Phase 8 inserts set `completion_type = 'video_view'`.

**Warning signs:** Inserting video views into `sop_completions` without adding the `completion_type` column first.

### Pitfall 5: Video "Outdated" Flag Uses Wrong Comparison

**What goes wrong:** The "video is outdated" amber badge (D-10) is shown when `sop.updated_at > job.created_at`. But if the admin triggers re-generation immediately after publishing, the comparison must use the job's actual render completion time (`completed_at`), not `created_at`, otherwise the badge shows during the render period itself.

**Why it happens:** `created_at` is set when the job is queued. The SOP `updated_at` may be newer than the job `created_at` if the SOP was edited after the job was queued but before it finished rendering.

**How to avoid:** Use `video_generation_jobs.completed_at` (set when status = `ready`) for the comparison: `sop.updated_at > job.completed_at`. If `completed_at` is NULL (job still running), do not show the outdated badge.

### Pitfall 6: TTS Mispronounces Industrial Terminology

**What goes wrong:** gpt-4o-mini-tts pronounces "kPa" as "kappa", "SCBA" letter-by-letter correctly but "PPE" as "poppy", and NZ place names (Taupo, Whanganui) are mangled. Workers lose trust in the audio track.

**Why it happens:** Industrial vocabulary and NZ te reo Maori place names are underrepresented in TTS training data.

**How to avoid:** D-07 — use the existing NZ industrial vocabulary list from Phase 6. Pass it as a system prompt / `instructions` parameter to gpt-4o-mini-tts: "Speak clearly and at a measured pace. This is a New Zealand industrial safety procedure. Pronounce: PPE as P-P-E, kPa as kilopascals, SCBA as S-C-B-A." The `gpt-4o-mini-tts` model accepts a freeform `instructions` string for style and pronunciation guidance. D-06/D-07 make re-generate the fallback, not a pronunciation dictionary.

### Pitfall 7: Video URL Leaked Into Dexie Offline Sync

**What goes wrong:** The `useSopDetail` hook or sync engine stores a `video_url` field from the SOP or job record into Dexie (IndexedDB). When the worker is offline, the `<video>` element tries to load the URL and fails silently or throws an unhandled error.

**Why it happens:** Video availability is fetched from the same Supabase query as SOP sections, and the Dexie schema does not exclude individual fields.

**How to avoid:** Video availability must be fetched in a separate online-only query, not bundled into the SOP sync that writes to Dexie. The `VideoPlayer.tsx` component should be wrapped in an online-status guard that hides the Video tab entirely when `useOnlineStatus()` returns false.

---

## Code Examples

Verified patterns from official sources and established project code:

### TTS Call per Section

```typescript
// src/lib/video-gen/tts.ts
// Source: openai SDK v6 (installed at ^6.32.0)
// gpt-4o-mini-tts — voices: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateSectionAudio(
  sectionText: string,
  sectionType: string,
): Promise<{ buffer: Buffer; durationEstimateSeconds: number }> {
  const instructions =
    'Speak clearly and at a measured pace suitable for an industrial safety procedure ' +
    'in New Zealand. Pronounce: PPE as P-P-E, kPa as kilopascals, SCBA as S-C-B-A. ' +
    (sectionType === 'hazards' ? 'Use a calm but serious tone for hazards.' : '')

  const response = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: 'nova',          // Clear, authoritative — good for safety narration
    input: sectionText,
    instructions,
  })

  const buffer = Buffer.from(await response.arrayBuffer())
  // Estimate duration: MP3 at ~32 kbps → roughly (bytes / 4000) seconds
  const durationEstimateSeconds = buffer.length / 4000

  return { buffer, durationEstimateSeconds }
}
```

### Shotstack Timeline POST (Narrated Slideshow)

```typescript
// src/lib/video-gen/shotstack-client.ts
// Source: Shotstack API docs https://shotstack.io/docs/api/
// Using fetch directly — no @shotstack/shotstack-sdk dependency

const SHOTSTACK_BASE = 'https://api.shotstack.io/edit/v1'
const API_KEY = process.env.SHOTSTACK_API_KEY!

export async function submitShotstackRender(edit: ShotstackEdit): Promise<string> {
  const res = await fetch(`${SHOTSTACK_BASE}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(edit),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Shotstack submit failed: ${res.status} ${err}`)
  }
  const data = await res.json()
  return data.response.id  // Shotstack render ID
}

export async function getShotstackRender(renderId: string): Promise<{
  status: 'queued' | 'fetching' | 'rendering' | 'saving' | 'done' | 'failed'
  url?: string
  error?: string
}> {
  const res = await fetch(`${SHOTSTACK_BASE}/render/${renderId}`, {
    headers: { 'x-api-key': API_KEY },
  })
  const data = await res.json()
  return {
    status: data.response.status,
    url: data.response.url,
    error: data.response.error,
  }
}
```

### Shotstack Edit Object for Narrated Slideshow

```typescript
// src/lib/video-gen/render-slides.ts
// One clip per SOP section — background dark (#111827 = steel-900), white text overlay
// Audio track per section attached as separate audio clip on its own track

function buildSlideshowEdit(sections: SectionWithAudio[]): ShotstackEdit {
  let currentStart = 0
  const videoClips: ShotstackClip[] = []
  const audioClips: ShotstackClip[] = []

  for (const section of sections) {
    const slideHtml = `
      <html><body style="margin:0;background:#111827;font-family:sans-serif;padding:48px;box-sizing:border-box;width:1280px;height:720px;display:flex;flex-direction:column;justify-content:center">
        <h1 style="color:#f59e0b;font-size:36px;margin:0 0 24px">${section.title}</h1>
        <div style="color:#f3f4f6;font-size:22px;line-height:1.6">${section.contentHtml}</div>
      </body></html>
    `
    videoClips.push({
      asset: { type: 'html', html: slideHtml, width: 1280, height: 720 },
      start: currentStart,
      length: section.audioDuration,
    })
    audioClips.push({
      asset: { type: 'audio', src: section.audioStorageUrl },
      start: currentStart,
      length: section.audioDuration,
    })
    currentStart += section.audioDuration
  }

  return {
    timeline: { tracks: [{ clips: videoClips }, { clips: audioClips }] },
    output: { format: 'mp4', resolution: 'hd' },  // 1280x720
  }
}
```

### Video Generation Job FSM (DB schema outline)

```sql
-- Part of migration 00013_video_generation.sql
CREATE TYPE public.video_gen_status AS ENUM (
  'queued', 'analyzing', 'generating_audio', 'rendering', 'ready', 'failed'
);

CREATE TYPE public.video_format AS ENUM ('narrated_slideshow', 'screen_recording');

CREATE TABLE public.video_generation_jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id     uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  sop_id              uuid NOT NULL REFERENCES public.sops(id),
  sop_version         int NOT NULL,
  format              public.video_format NOT NULL,
  status              public.video_gen_status NOT NULL DEFAULT 'queued',
  current_stage       text DEFAULT NULL,
  shotstack_render_id text DEFAULT NULL,
  video_url           text DEFAULT NULL,
  chapter_markers     jsonb DEFAULT NULL,  -- [{sectionId, title, timestamp}]
  error_message       text DEFAULT NULL,
  created_by          uuid NOT NULL REFERENCES auth.users(id),
  completed_at        timestamptz DEFAULT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Idempotency: only one active job per sop+format+version
  UNIQUE (sop_id, format, sop_version)
);

-- Extension to sop_completions for video_view type (D-15)
ALTER TABLE public.sop_completions
  ADD COLUMN IF NOT EXISTS completion_type text NOT NULL DEFAULT 'walkthrough'
    CHECK (completion_type IN ('walkthrough', 'video_view'));
ALTER TABLE public.sop_completions
  ADD COLUMN IF NOT EXISTS video_job_id uuid REFERENCES public.video_generation_jobs(id);
```

### SopSectionTabs Video Tab Addition

```typescript
// src/components/sop/SopSectionTabs.tsx — extend with Video tab
// Tab is only rendered when hasVideo=true prop is passed
// Existing tab structure is preserved exactly

interface SopSectionTabsProps {
  sections: SopSection[]
  activeType: string
  onTabChange: (type: string) => void
  hasVideo?: boolean   // NEW: show Video tab only when a generated video exists
}

// In the return JSX, after the sections.map():
{hasVideo && (
  <button
    type="button"
    onClick={() => onTabChange('video')}
    className={[
      'flex-shrink-0 flex flex-col items-center justify-end px-4 h-[52px] gap-1 relative whitespace-nowrap',
      'text-[13px] font-semibold transition-colors',
      activeType === 'video'
        ? 'text-brand-yellow border-b-2 border-brand-yellow'
        : 'text-steel-400 hover:text-steel-100',
    ].join(' ')}
  >
    <span className="flex items-center gap-1">
      <Play size={16} />
      Video
    </span>
  </button>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side FFmpeg for video rendering | Cloud rendering API (Shotstack) | 2024-2025 | Eliminates binary dependency; works on Vercel serverless |
| `whisper-1` for TTS | `gpt-4o-mini-tts` (more voices, instructions param) | March 2025 | Instructions parameter enables pronunciation guidance |
| ElevenLabs for quality TTS | OpenAI `gpt-4o-mini-tts` for cost efficiency | 2025 | $3/million chars vs ElevenLabs $5/30K credits; adequate for industrial narration |
| Polling-only for async job status | Supabase Realtime + polling fallback | Phase 2 (project) | Already established in this codebase for parse_jobs |

**Deprecated/outdated in this phase:**
- Remotion `@remotion/renderer`: not viable on Vercel (Chromium binary, 120 MB+); company SaaS license required. Do not use.
- `fluent-ffmpeg` / `ffmpeg-static` for video composition: binary exceeds Vercel limits for rendering. Acceptable only for audio extraction from video (Phase 6 pattern), not for MP4 compositing.

---

## Open Questions

1. **Shotstack webhook vs polling in production**
   - What we know: webhooks require a publicly accessible URL; polling works everywhere but holds the Vercel function open
   - What's unclear: whether Vercel Fluid Compute (800s timeout) is available on the project's plan tier
   - Recommendation: implement polling-in-route-handler for Phase 8; design the job table so a webhook handler route can be added later without schema changes (keep `shotstack_render_id` on the job record)

2. **Video audio stitching for screen-recording format**
   - What we know: binary MP3 concatenation works for basic playback but may produce a brief gap at splice points
   - What's unclear: whether the gap is perceptible for typical 2-8 section SOPs
   - Recommendation: implement binary concatenation for Wave 1; if gap is audible in testing, switch to Shotstack's multi-track audio approach (same as narrated slideshow but with a single video asset)

3. **sop_completions unique constraint for video_view**
   - What we know: the existing table has no unique constraint per worker+sop+type (text walkthroughs are append-only by design, COMP-07)
   - What's unclear: should multiple video views create multiple records (full audit trail) or be deduplicated
   - Recommendation: allow multiple video_view records per worker per SOP — consistent with the append-only audit trail pattern; supervisors see the latest view in the activity feed

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All server-side video-gen modules | Yes | 22.16.0 | — |
| OpenAI SDK | gpt-4o-mini-tts TTS calls | Yes | ^6.32.0 installed | — |
| `OPENAI_API_KEY` | TTS generation | Yes (in .env.local) | — | — |
| `SHOTSTACK_API_KEY` | Video rendering | Not configured | — | Must be added before Wave 1 video generation runs |
| Supabase project | DB + Storage | Yes (existing) | — | — |
| `sop-generated-videos` bucket | Video storage | Not yet created | — | Created in migration 00013 |

**Missing dependencies with no fallback:**
- `SHOTSTACK_API_KEY` — blocks all video rendering; must be provisioned before Wave 1 of the video generation pipeline. Admin signs up at shotstack.io; add to `.env.local` and Vercel environment variables.

**Missing dependencies with fallback:**
- `sop-generated-videos` Supabase Storage bucket — created by migration 00013 (Wave 0 database task)

---

## Validation Architecture

Nyquist validation is enabled (`nyquist_validation: true` in .planning/config.json).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (already installed and configured) |
| Config file | `playwright.config.ts` (project root) |
| Quick run command | `npx playwright test --project phase8-stubs` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VGEN-01 | Admin triggers narrated slideshow generation, job progresses through stages to ready | e2e stub | `npx playwright test --project phase8-stubs video-gen-slideshow.test.ts` | No — Wave 0 |
| VGEN-02 | Admin triggers screen-recording generation, job progresses to ready | e2e stub | `npx playwright test --project phase8-stubs video-gen-scroll.test.ts` | No — Wave 0 |
| VGEN-03 | DEFERRED — not in scope | — | — | — |
| VGEN-04 | Chapter markers present in job record after generation | e2e stub | `npx playwright test --project phase8-stubs video-chapters.test.ts` | No — Wave 0 |
| VGEN-05 | Admin can preview video and re-generate; outdated badge appears after SOP edit | e2e stub | `npx playwright test --project phase8-stubs video-admin-preview.test.ts` | No — Wave 0 |
| VGEN-06 | Stage stepper advances through named stages in admin UI | e2e stub | `npx playwright test --project phase8-stubs video-gen-slideshow.test.ts` | No — Wave 0 |
| VGEN-07 | Video tab appears on SOP detail page when video exists; hidden when none | e2e stub | `npx playwright test --project phase8-stubs video-player.test.ts` | No — Wave 0 |
| VGEN-08 | Chapter navigation jumps video to correct timestamp; speed control changes playback rate | e2e stub | `npx playwright test --project phase8-stubs video-player.test.ts` | No — Wave 0 |
| VGEN-09 | Video view event recorded in sop_completions after watching >= 80% | e2e stub | `npx playwright test --project phase8-stubs video-completion.test.ts` | No — Wave 0 |
| INFRA-03 | Video URL patterns excluded from service worker CacheFirst handler | e2e stub | `npx playwright test --project phase8-stubs sw-video-exclusion.test.ts` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx playwright test --project phase8-stubs`
- **Per wave merge:** `npm run test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/video-gen-slideshow.test.ts` — covers VGEN-01, VGEN-06
- [ ] `tests/video-gen-scroll.test.ts` — covers VGEN-02
- [ ] `tests/video-chapters.test.ts` — covers VGEN-04
- [ ] `tests/video-admin-preview.test.ts` — covers VGEN-05
- [ ] `tests/video-player.test.ts` — covers VGEN-07, VGEN-08
- [ ] `tests/video-completion.test.ts` — covers VGEN-09
- [ ] `tests/sw-video-exclusion.test.ts` — covers INFRA-03
- [ ] `playwright.config.ts` — add `phase8-stubs` project with `testMatch: /video-gen|video-player|video-chapters|video-admin|video-completion|sw-video/`

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 8 |
|-----------|-------------------|
| Dark theme by default (`bg-steel-900`, `text-brand-yellow`) | All new UI components (VideoGenerationPanel, VideoPlayer, VideoGenerationStatus) use steel/brand-yellow tokens |
| PWA-first: large tap targets (glove-friendly), mobile-optimized | Video tab and chapter list buttons: `min-h-[72px]` for primary actions; chapter jump buttons `min-h-[44px]` (admin/desktop context per UI-SPEC) |
| Supabase RLS for all data access; `admin.ts` client for elevated operations only | video_generation_jobs needs RLS; admin client used for video job creation and storage writes |
| Server actions in `src/actions/` for mutations; API routes for complex operations | Video generation trigger via API route `/api/sops/generate-video`; video view completion via server action `src/actions/video.ts` |
| Zod schemas in `src/lib/validators/` for all form/API validation | New Zod schema for generate-video request body |
| Database migrations in `supabase/migrations/` numbered sequentially | Next migration: `00013_video_generation.sql` |
| CLAUDE.md Project Standards: CLAUDE.md `## Learnings` section | Log any Shotstack API surprises or sop_completions extension lessons at end of phase |
| Verify the target before editing (42 wrong-approach instances) | Before editing `SopSectionTabs.tsx` and `sw.ts`, re-read both files (already done) |
| Self-review every edit before moving on | Check variable scoping and serialization boundaries on Shotstack typed fetch interfaces |

---

## Sources

### Primary (HIGH confidence)

- Shotstack API docs at `https://shotstack.io/docs/api/` — render endpoint, webhook support, timeline JSON structure verified
- Shotstack pricing at `https://shotstack.io/pricing/` — $0.20/min subscription, $0.30/min PAYG confirmed
- OpenAI SDK v6 installed at `^6.32.0` — `openai.audio.speech.create` with `gpt-4o-mini-tts` confirmed in existing STACK.md research
- `gpt-4o-mini-tts` voice parameter — 11 voices (alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse); `instructions` parameter for pronunciation guidance — verified via WebSearch against OpenAI community and docs
- Existing codebase — `ParseJobStatus.tsx`, `SopSectionTabs.tsx`, `completionStore.ts`, `sw.ts`, `db.ts`, migrations 00010–00012 — read directly
- `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `SUMMARY.md` — prior milestone research (2026-03-29) — HIGH confidence for Shotstack decision rationale, Remotion exclusion reasoning

### Secondary (MEDIUM confidence)

- `https://community.openai.com/t/new-tts-model-gpt-4o-mini-tts-ignoring-speed-parameter/` — confirmed `speed` param behavior and `instructions` param in gpt-4o-mini-tts
- Shotstack webhook community thread — confirmed webhook payload format and that signed payloads are not supported (validate by re-fetching render status with API key)
- MP3 binary concatenation for audio stitching — established technique for same-bitrate same-sample-rate MP3 files; adequate for non-gapless playback

### Tertiary (LOW confidence — validate at implementation)

- TTS duration estimation from buffer size (`buffer.length / 4000`) — approximate; actual duration should be measured by tracking audio element duration or using a metadata parse library if precision is needed for chapter timestamps
- 80% watch threshold for video_view completion — chosen by discretion; validate with team/stakeholders if completion rate tracking becomes a compliance requirement

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Shotstack and gpt-4o-mini-tts both verified against official docs and prior research; no new npm packages required
- Architecture: HIGH — all patterns (FSM job table, Realtime, stage stepper, sop_completions extension) are established in the codebase; only minor schema extensions needed
- Pitfalls: HIGH — service worker caching pitfall verified by reading sw.ts directly; idempotency and timeout pitfalls drawn from verified Vercel constraints and established project patterns

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (Shotstack pricing and API stable; gpt-4o-mini-tts model stable since March 2025)
