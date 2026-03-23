# Pitfalls Research

**Domain:** Mobile-first SOP management SaaS — industrial / blue-collar tradespeople
**Researched:** 2026-03-23
**Confidence:** HIGH (multiple authoritative sources; pitfalls drawn from documented production incidents, official platform limitations, and verified community patterns)

---

## Critical Pitfalls

### Pitfall 1: AI Parser Silently Produces Wrong SOP Steps

**What goes wrong:**
The AI parsing pipeline extracts a numbered step list from an uploaded Word/PDF but gets the order wrong, merges two steps into one, or omits a step entirely — especially when source documents use non-standard heading hierarchies, tables, or embedded figures to convey sequence. Workers follow the extracted (wrong) procedure, creating a safety incident or quality failure.

**Why it happens:**
LLM-based extraction has well-documented hallucination rates of 44–66% on safety-critical content (per published benchmarks). PDFs in particular lose structural context when rendered to text: columns merge, table rows reorder, figure captions appear in the wrong place. Developers test the parser on clean, well-formatted sample documents and assume it generalises.

**How to avoid:**
- Treat every AI parse as a *draft* requiring human sign-off before the SOP goes live. Never auto-publish.
- Build a structured diff view in the admin UI: original document page alongside the parsed output, step-by-step.
- Add confidence scoring per section (hallucination risk is highest for numbered lists inside tables, multi-column layouts, and embedded figure references).
- Store the original document alongside the parsed output permanently — the source of truth is the document, not the extraction.
- Flag low-confidence sections for admin review and block SOP activation until all flags are cleared.

**Warning signs:**
- Parse pipeline skips admin review step ("we'll add review later")
- No confidence scoring in the extraction output
- Original document is discarded after parsing
- Testing only on clean, single-column PDFs

**Phase to address:** Foundation / AI Parsing phase (earliest phase touching document ingestion)

---

### Pitfall 2: Stale SOP Version Served to Workers After Update

**What goes wrong:**
An admin updates an SOP — fixing a safety step — but workers on the floor continue using the cached (old) version for days or weeks. The new version never reaches offline devices. In the worst case, the worker completes an SOP using outdated PPE requirements and the completion record shows the correct procedure was followed when it wasn't.

**Why it happens:**
Service workers are long-lived by design. A PWA installed on a worker's phone can stay open for days without a full reload. Service worker update detection is navigation-triggered and subject to 24-hour browser checks. iOS Safari has additional aggressive caching behaviour that can trap stale content. Developers focus on "make it work offline" and don't plan the "force-update critical SOPs" path.

**How to avoid:**
- Implement SOP versioning at the data layer: every SOP record has a `version` integer. Cached procedure includes the version it was fetched at.
- On every sync (even partial connectivity), worker client checks its cached SOP versions against the server manifest. Mismatches trigger a background re-fetch.
- For critical updates (e.g., safety-flagged SOPs), include a `force_update: true` flag that surfaces an in-app banner: "This procedure has been updated — tap to refresh before continuing."
- Never cache SOP content with a long TTL via HTTP headers; all SOP data comes through the app's own sync layer, not the browser cache.
- Service worker update: implement `skipWaiting()` with a UI prompt so the app shell also updates.

**Warning signs:**
- SOP data cached with `Cache-Control: max-age=86400` or similar HTTP headers
- No version field on SOP records
- No "SOP updated since you last opened it" notification
- Service worker activates lazily without a skip-waiting mechanism

**Phase to address:** Offline / PWA phase; also requires a gating rule in the SOP publishing workflow (Admin phase)

---

### Pitfall 3: iOS Safari Destroys Offline Data and Camera State

**What goes wrong:**
On iOS, PWA storage (IndexedDB, Cache API) is deleted after approximately 7 days of inactivity. A worker returns from a two-week leave, opens the app, and all cached SOPs are gone — they get a blank screen offline. Separately, iOS Safari does not persist camera permissions for PWAs: every session may re-prompt the worker for camera access mid-procedure, breaking the photo-capture evidence flow.

**Why it happens:**
Apple's Intelligent Tracking Prevention applies its storage eviction policy to PWA storage as aggressively as to web cookies. This is a WebKit platform decision, not a bug that will be fixed. Developers test on Android (where behaviour is more permissive) and assume iOS behaves the same.

**How to avoid:**
- Surface a clear "Download for offline use" affordance that the worker must explicitly trigger, rather than relying on passive caching alone.
- Show workers a "Ready offline" indicator per SOP (green = cached, amber = not cached).
- On app open, always attempt a background sync if online; cache freshness timestamps let the app show "last synced: X days ago."
- For photo capture, use a fallback: if `getUserMedia` fails or is blocked, offer a file picker (`<input type="file" capture="environment">`), which works reliably on iOS PWA.
- Document iOS limitations in onboarding: tell admins deploying to iOS-heavy workforces what workers need to do (open app weekly, etc.).
- Consider a "critical SOPs" subset that is aggressively pre-cached and re-synced on every app open.

**Warning signs:**
- Offline testing only done on Chrome/Android
- No UI indicator showing per-SOP offline availability
- Camera access implemented only via `getUserMedia` without file picker fallback
- No "last synced" timestamp surfaced to users

**Phase to address:** Offline / PWA phase

---

### Pitfall 4: Multi-Tenant Data Leakage via Missing Tenant Context

**What goes wrong:**
Org A's workers can see Org B's SOPs, completion records, or user list — either through a missing `WHERE tenant_id = ?` clause in an API query, through a background job that picks up work without establishing tenant scope, or through a shared cache key that omits the tenant dimension. This is a GDPR/data breach event, not just a bug.

**Why it happens:**
Row-Level Security (RLS) at the database level is a strong last line of defence, but it is not the only required control. Common failure modes:
- A background job (e.g., "generate completion report") is queued with tenant context in the request but the job worker loses that context at execution time.
- A cache key like `sop_library_count` is shared across tenants; Tenant B's request hits Tenant A's cached value.
- A new API endpoint is added during a sprint without going through the standard query builder that applies RLS, so it reads raw.

**How to avoid:**
- Use database-level RLS (e.g., Supabase/PostgreSQL RLS) as a safety net, but also enforce `tenant_id` filtering in every application query — defence in depth.
- Every background job payload must include `tenant_id` explicitly. Workers read `tenant_id` from job payload, not from ambient state.
- Cache keys must always include `tenant_id` as a namespace segment: `tenant:{org_id}:sop_count`.
- In tests: run a fixture that creates two orgs, then assert org A's authenticated requests cannot retrieve org B's resources.
- Connection pool middleware: on every connection checkout, set session-level tenant context variable.

**Warning signs:**
- No cross-tenant test fixtures in the test suite
- Cache keys that don't include tenant_id
- Background jobs that infer tenant from "current user" instead of explicit payload
- New endpoints bypassing the shared data access layer

**Phase to address:** Foundation / multi-tenant data model phase (must be baked in from the first database migration, not retrofitted)

---

### Pitfall 5: Glove-Hostile UI Kills Worker Adoption

**What goes wrong:**
Workers on the factory floor wear gloves and can't reliably hit small tap targets. The app requires precise touches to advance steps, capture photos, or sign off — so workers abandon it and revert to paper. Adoption collapses within the first week of rollout regardless of how technically correct the app is. This is the #1 adoption failure pattern in industrial mobile tools.

**Why it happens:**
Developers and designers test the app at their desk with bare hands on clean screens. WCAG touch target guidance (44×44px minimum) is applied nominally but the interactive elements that matter most — "Next step", "Take photo", "Mark complete" — are buried below visible content, require two-tap confirmation, or are placed in the upper corners of the screen where gloved thumbs can't reach.

**How to avoid:**
- Primary actions (Next, Complete, Photo) must be at minimum 72×72px touch targets, thumb-reachable (bottom third of screen), with 16px+ spacing between them.
- Design for one-handed use: no gesture sequences, no long-press to advance, no drag interactions.
- The step-by-step walkthrough should be a full-screen card interface — swipe or large button advance only. No navbar chrome visible during procedure execution.
- Validate on actual gloved hardware before any user testing. Use a nitrile glove and a mid-range Android device (not a premium iPhone).
- Avoid modals and confirmation dialogs in the primary flow — they add a second tap for every action.

**Warning signs:**
- Design comps showing step list as a scrollable table rather than full-screen cards
- Primary CTA buttons smaller than 56×56px
- Sign-off interaction is a text field requiring keyboard input
- No glove testing planned before launch

**Phase to address:** Worker UI / step execution phase (Phase 2 or equivalent); must be validated with user testing before shipping

---

### Pitfall 6: Photo Storage Bloats IndexedDB and Crashes the App

**What goes wrong:**
Workers capture multiple photos per SOP step as evidence. Each photo is stored as a Blob in IndexedDB pending upload. Over a shift, a worker might capture 20–40 photos at 2–4MB each. IndexedDB on mobile has no hard per-record limit but the global storage quota (typically 10–20% of available disk on iOS, ~unlimited on Chrome) can be hit. On iOS, indexing binary data directly in IndexedDB columns causes progressive slowdown and eventual crashes.

**Why it happens:**
Developers store full-size camera captures directly as Base64 strings or index binary Blob fields in IndexedDB. This is a known IndexedDB anti-pattern. On mobile, photos are often 8–12MP JPEG files; without client-side compression, the queue grows unchecked.

**How to avoid:**
- Compress photos client-side before storing: target 1200px max dimension, ~200KB. Use the Canvas API to resize before writing to IndexedDB.
- Store Blobs as unindexed fields only — never create an IndexedDB index on binary data.
- Implement an upload queue: as soon as connectivity is restored, flush photos to cloud storage (S3/Cloudflare R2) and replace the local Blob with a remote URL reference.
- Set a per-worker offline photo quota (e.g., 50 photos max queued) with a warning before the limit.
- Monitor IndexedDB usage via `navigator.storage.estimate()` and show a warning if remaining quota is below a safe threshold.

**Warning signs:**
- Photos stored as Base64 strings in JSON fields
- No client-side image compression before IndexedDB write
- Upload happens only when the user manually submits the completed SOP
- No IndexedDB quota monitoring

**Phase to address:** Photo capture / offline phase

---

### Pitfall 7: Completion Records Are Not Legally Defensible

**What goes wrong:**
A worker is injured. The organisation claims the SOP was followed. The completion record in the system shows "completed" with a timestamp — but the record has no: confirmed SOP version, record of which specific steps were acknowledged, immutable audit trail (records can be edited after the fact), or cryptographic link between the sign-off and the SOP content at that point in time. The record is useless in a legal or regulatory proceeding.

**Why it happens:**
Developers build the "happy path" — worker completes SOP, supervisor approves, status flips to "complete" — without modelling what "defensible completion" means. Completion records are stored as mutable rows. SOP content can be updated in place without versioning. There is no concept of "what exactly did this worker sign off on?"

**How to avoid:**
- Completion records must be append-only. No updates, no deletes — soft-archive only.
- On completion, snapshot: the SOP version number, a hash of the SOP content, the worker's user ID, timestamp (server-side, not client clock), GPS/location if available, photo evidence references.
- Supervisor sign-off creates a second immutable record referencing the completion record ID.
- SOP version history must be retained indefinitely — never hard-delete old versions.
- For regulated industries (chemical handling, electrical work): consider signed PDFs as the completion artefact, generated server-side from the completion record.

**Warning signs:**
- Completion table has UPDATE or DELETE permissions in the ORM
- SOP content is edited in-place without version increment
- Timestamps come from client device clock rather than server
- No SOP version field on completion records

**Phase to address:** Completion tracking / supervisor sign-off phase

---

### Pitfall 8: Offline Sync Conflict Blindness

**What goes wrong:**
Two workers download the same SOP assignment offline. Worker A completes the SOP on their phone without connectivity. The supervisor, assuming the SOP is unstarted, re-assigns it to Worker B, who also completes it offline. When both devices sync, the system has two completion records for the same assignment, or worse, the last-write-wins strategy silently discards one record. No-one knows which completion stands.

**Why it happens:**
Last-write-wins is the path of least resistance for offline sync. Developers implement it early and never revisit it, because conflicts seem unlikely in testing. In production, factory shift handovers, reassignments, and spotty connectivity create real conflicts frequently.

**How to avoid:**
- For safety-critical completion records: adopt an append-only event log approach. Never merge — both completions are recorded, and a supervisor reviews any duplicates.
- Assign each offline operation a client-generated UUID + client timestamp + device ID so the server can detect duplicates.
- On sync, server returns a conflict manifest if duplicates are detected; client displays a "Review required" banner.
- Do not use last-write-wins for completion records. It is acceptable for draft step progress but not for signed-off records.
- Test explicitly: simulate two devices syncing the same completion and verify both records are preserved.

**Warning signs:**
- Sync layer uses `upsert` on completion records (last-write-wins by construction)
- No client-side UUID on offline-created records
- Conflict resolution not mentioned in any design document
- No test covering concurrent offline completion of the same SOP

**Phase to address:** Offline / sync phase (must be designed before the first completion record is written)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Auto-publish AI-parsed SOPs without admin review | Faster demo, less admin friction | Safety incident from wrong step order; legal liability | Never — always require human sign-off |
| Store photos as Base64 in JSON columns | Simpler code path | IndexedDB crashes on mobile; 3–5x storage bloat | Never |
| Single `tenant_id` filter in application code, no RLS | Simpler to build initially | Cross-tenant data leak on any missed filter; impossible to audit | Never for prod |
| In-place SOP content edits, no versioning | Easier admin UI | Defensibility failure; workers on stale versions with no detection | Never for regulated content |
| Client-side timestamps on completion records | Works without server round-trip offline | Tamper risk; device clock skew invalidates audit trail | MVP only if server-side timestamp added on sync |
| Hardcode tenant context in session, not per-request | Less boilerplate | Background job leaks tenant context across jobs | Never |
| Skip `skipWaiting()` in service worker | Simpler update logic | Workers stuck on old app version for days after deployment | Never for production |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| AI parsing (OpenAI/Claude) | Send entire raw PDF text as one prompt; assume output matches source structure | Extract with document-structure-aware tools (e.g., Azure Document Intelligence, LlamaParse) first; then send structured sections to LLM for cleaning/classification |
| iOS PWA camera | Rely solely on `getUserMedia()` for photo capture | Always include `<input type="file" accept="image/*" capture="environment">` as fallback; test both code paths on iOS 17+ |
| Background Sync API | Assume it works on all platforms | Background Sync is Chromium-only (2026); Firefox disabled, Safari not implemented. Queue locally in IndexedDB and sync on app foreground/online events instead |
| PostgreSQL RLS | Enable RLS and assume it covers all data paths | RLS does not apply to superuser connections; does not block bulk import tools; does not prevent timing-attack row count inference. Layer application-level tenant_id filtering on top |
| Cloud photo storage (S3/R2) | Upload full-size captures directly from device | Compress client-side first (Canvas resize to 1200px); generate a server-side pre-signed URL for direct upload; never route large binary through your API server |
| SOP document parsing (PDF) | Use `pdf.js` text extraction alone | Multi-column PDFs produce garbled text order; use a dedicated document intelligence service that preserves layout and table structure |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching full SOP library on every app open | Slow initial load; high bandwidth on spotty connections | Fetch only delta changes since last sync (use `updated_at` cursor); send a manifest of SOP IDs + versions first | 50+ SOPs per org |
| Storing all SOP images in the same IndexedDB object store as text data | Progressive slowdown; eventual crash on mobile | Separate object stores for binary (Blob) and structured (JSON) data; use unindexed Blob fields | >20 images cached |
| Loading all completion records for supervisor dashboard in one query | Page timeout; OOM on large orgs | Paginate by date range; index on `(tenant_id, completed_at)`; never `SELECT *` completion records | >500 completions per org |
| Service worker pre-caching entire SOP library on install | 50-500 SOPs × images = install fails on low-storage devices | Pre-cache only app shell and assigned SOPs for that worker; lazy-cache others on first view | Orgs with 100+ image-heavy SOPs |
| Synchronous IndexedDB reads blocking the UI thread | UI freezes during SOP navigation | All IndexedDB operations must be async; use Dexie.js or similar to avoid raw IDB callback hell | Any device |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Returning all tenant SOPs from a shared `/api/sops` endpoint filtered only in the frontend | Any authenticated user can enumerate another org's SOPs via API | All data endpoints enforce tenant_id server-side; frontend filtering is display-only, never security |
| Completion records deletable by SOP admins | Admins can erase evidence of non-compliance before a safety audit | Completion records are write-once; provide archive/hide UI that does not physically delete |
| AI parsing API key embedded in frontend bundle | API key exposed; attacker can run unlimited LLM queries at your cost | All AI calls are server-side only; never expose API keys to the client |
| No rate-limiting on SOP upload endpoint | Denial of service via large PDF spam; runaway AI parsing costs | Per-tenant upload rate limit (e.g., 20 documents/hour); max file size enforcement (50MB); file type validation before parsing |
| Photo evidence URLs are permanent public S3 links | Evidence photos publicly accessible if URL is guessed | Photos stored in private S3 bucket; served via short-lived signed URLs (1 hour expiry) scoped per tenant |
| JWT does not include tenant_id claim | Tenant context must be looked up from DB on every request, creating lookup-skip vulnerabilities | Embed `tenant_id` and `role` in the JWT; validate server-side on every request before any data access |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| SOP displayed as a scrollable document (replicate Word layout) | Worker loses place, skips steps, reads the wrong section on a small screen | Step-by-step card interface: one step visible at a time, explicit "Next" and "Back" actions |
| Sign-off requires typing name or signature | Workers with gloves cannot type; frustrating on a factory floor | Biometric confirmation (Face ID / fingerprint via Web Authentication API) or PIN tap, not text input |
| No visual indication of offline status | Worker doesn't know if their completion was saved; anxiety; duplicate submissions | Persistent status banner: green "Online — syncing", amber "Offline — saved locally", with last-sync time |
| Step requires scrolling to see photo capture button | Worker on a ladder or in an awkward position can't scroll and act | Photo capture button is always sticky/visible on photo-required steps — never below the fold |
| SOP search requires exact keyword match | Worker types "chemical spill" and gets zero results because the SOP says "hazardous material release" | Full-text search with fuzzy matching and section-type filters (Hazards, PPE, Emergency) |
| Supervisor sign-off requires same device as worker | Supervisor is remote or on a different shift | Supervisor sign-off via separate supervisor session; completion record status shows "pending supervisor review" |

---

## "Looks Done But Isn't" Checklist

- [ ] **AI Parser:** Has a human review step before SOPs go live — verify there is no way to bypass admin sign-off and publish directly.
- [ ] **Offline mode:** Test with Airplane mode + kill and reopen the app — verify cached SOPs load, in-progress steps resume, and no data loss on restart.
- [ ] **iOS Safari:** Test camera capture, offline storage, and app reload on a real iOS device (not Chrome emulation) — permission re-prompts and storage eviction behave differently.
- [ ] **Tenant isolation:** Create two test orgs and verify that every API endpoint (not just the UI) returns 403 or empty results when accessing the other org's data.
- [ ] **SOP version update:** Update a published SOP and verify an active worker session detects the change within one sync cycle, not just on next manual open.
- [ ] **Completion records:** Attempt to edit or delete a completion record via the API with admin credentials — verify it is rejected (append-only).
- [ ] **Photo bloat:** Queue 30 offline photos (compressed) on a low-end device and verify IndexedDB remains responsive and quota warnings appear before storage is full.
- [ ] **Background jobs:** Run a report-generation job and verify the tenant_id in the output matches the requesting org — not the last job that ran.
- [ ] **Service worker update:** Deploy a new version and verify workers see the update prompt within one navigation, not after 24 hours.
- [ ] **Glove test:** Complete a full SOP start-to-finish wearing nitrile gloves on the smallest supported screen size.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| AI parser produced wrong SOP steps (already published) | HIGH | Immediately unpublish affected SOPs; notify active users; admin re-reviews and corrects; log which workers followed the wrong version; legal review if safety-relevant |
| Stale SOP version shown after safety update | HIGH | Force-cache-bust via service worker version bump + push notification to all active workers; confirm receipt in audit log |
| Cross-tenant data leak discovered | CRITICAL | Immediate incident response: identify scope (which tenants, which data, what duration); notify affected orgs; regulatory notification if PII/safety data; fix query; audit all similar endpoints |
| iOS storage eviction wipes cached SOPs | LOW | User-facing: prompt to re-download; mitigate by adding visible "re-sync for offline" affordance; no data loss (server has everything) |
| Completion record conflict from dual offline sync | MEDIUM | Surface conflict to supervisor for manual resolution; never auto-discard; both records preserved; supervisor marks one canonical |
| Photo queue fills device storage | LOW | Delete oldest unsynced photos after warning; worker re-captures; show storage warning early enough to prevent silent failure |
| Background job ran with wrong tenant context | HIGH | Audit which jobs ran in the affected window; diff output records against expected tenant; manual correction; add tenant context assertion at job entry point |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| AI parser produces wrong SOP steps | Foundation / AI Parsing | Integration test: feed 5 varied real-world SOPs, confirm admin review gate blocks publication |
| Stale SOP version served after update | Offline / PWA | Test: update SOP on server, verify client detects version mismatch within one sync cycle |
| iOS Safari destroys offline data / camera | Offline / PWA | Manual test on real iOS device: Airplane mode + camera capture + 7-day inactivity simulation |
| Multi-tenant data leakage | Foundation / Data Model | Automated test: two-tenant fixture + cross-org API request returns 403/empty |
| Glove-hostile UI | Worker UI / Step Execution | Glove usability test before any user testing session |
| Photo bloat crashes IndexedDB | Photo Capture / Offline | Load test: 40 queued compressed photos on a mid-range Android; verify no crash, quota warning fires |
| Completion records not legally defensible | Completion Tracking / Sign-off | Audit: verify no UPDATE/DELETE on completion table; check SOP version hash is stored |
| Offline sync conflict blindness | Offline / Sync Engine | Test: two devices complete same SOP offline, sync, verify both records preserved |
| Background job tenant context leak | Background Jobs / Async Work | Test: enqueue job for tenant A immediately after tenant B job; verify output is scoped to tenant A |
| Service worker update delay | PWA Shell / Deployment | Deploy canary, verify skipWaiting prompt appears within one navigation on all open tabs |

---

## Sources

- [Your Standard Operating Procedure Program Failed (Now What?) — MaintainX](https://www.getmaintainx.com/blog/standard-operating-procedure-program)
- [Common Mistakes When Converting Paper SOPs to Digital — OrcaLean](https://www.orcalean.com/article/common-mistakes-when-converting-paper-sops-to-digital)
- [Why Operators Struggle With SOPs — OrcaLean](https://www.orcalean.com/article/why-u.s.-operators-struggle-with-sop-complianceand-how-to-fix-it-digitally)
- [PWA iOS Limitations and Safari Support — MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [Camera Access Issues in iOS PWA — STRICH Knowledge Base](https://kb.strich.io/article/29-camera-access-issues-in-ios-pwa)
- [Multi-Tenant Leakage: When Row-Level Security Fails in SaaS — InstaTunnel/Medium](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c)
- [Tenant Isolation Checklist for SaaS Prototypes — fixmymess.ai](https://fixmymess.ai/blog/tenant-isolation-checklist-saas-prototypes)
- [Building An Offline-Friendly Image Upload System — Smashing Magazine](https://www.smashingmagazine.com/2025/04/building-offline-friendly-image-upload-system/)
- [IndexedDB Max Storage Size Limit — RxDB](https://rxdb.info/articles/indexeddb-max-storage-limit.html)
- [Keep storing large images, just don't index binary data — David Fahlander / Dexie.js](https://medium.com/dexie-js/keep-storing-large-images-just-dont-index-the-binary-data-itself-10b9d9c5c5d7)
- [Offline-First Mobile App Architecture: Syncing, Caching, and Conflict Resolution — DEV Community](https://dev.to/odunayo_dada/offline-first-mobile-app-architecture-syncing-caching-and-conflict-resolution-1j58)
- [Conflict Resolution in Offline-First Apps — Medium](https://shakilbd.medium.com/conflict-resolution-in-offline-first-apps-when-local-and-remote-diverge-12334baa01a7)
- [Hallucination-Free LLMs: The future of OCR and data extraction — Cradl AI](https://www.cradl.ai/post/hallucination-free-llm-data-extraction)
- [From hallucinations to hazards: benchmarking LLMs for safety-critical systems — ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0925753525002814)
- [Offline and background operation — PWA docs, MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- [When 'Just Refresh' Doesn't Work: Taming PWA Cache Behavior — Infinity Interactive](https://iinteractive.com/resources/blog/taming-pwa-cache-behavior/)
- [Preventing Cross-Tenant Data Leakage in Multi-Tenant SaaS — Agnite Studio](https://agnitestudio.com/blog/preventing-cross-tenant-leakage/)
- [Tenant Data Isolation: 5 Patterns That Actually Work — Propelius](https://propelius.tech/blogs/tenant-data-isolation-patterns-and-anti-patterns/)
- [UI/UX Design in Manufacturing — OEE IntelliSuite/Medium](https://medium.com/@hopeful_rajah_koala_193/ui-ux-design-in-manufacturing-f425481afe1c)
- [Touch Target Optimization — Garanord](https://garanord.md/touch-target-optimization-designing-finger-friendly-interfaces-for-mobile-devices/)

---

*Pitfalls research for: SOP Assistant — mobile-first SOP management SaaS for blue-collar tradespeople*
*Researched: 2026-03-23*
