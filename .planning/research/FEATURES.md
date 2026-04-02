# Feature Landscape: SOP Creation Pathways (v2.0)

**Domain:** SOP / Procedure Management — Three new creation and delivery pathways
**Researched:** 2026-03-29
**Confidence:** MEDIUM-HIGH (competitor products verified via multiple sources; PWA/platform constraints verified via official docs and real-world reports)

---

## Context: What Already Exists

The following are already built and validated. Do not re-research these.

- Admin uploads PDF/DOCX → AI parses to structured SOP (hazards, PPE, steps, emergency sections)
- Admin reviews parsed output alongside original, edits, publishes
- Workers walk through SOPs step-by-step on mobile with offline access
- Photo evidence capture during completion, supervisor sign-off
- SOP library with search, categories, assignments, versioning
- Multi-tenant with RLS isolation, PWA with offline support

This document covers only the three new pathways.

---

## Pathway 1: Video → SOP

### What It Is

User provides a video (uploaded file, YouTube/Vimeo URL, or in-app recording), the system transcribes the audio and analyzes the content, then structures the transcript into the existing SOP format (title, hazards, PPE, steps, emergency). Admin reviews and publishes.

### Competitive Landscape

Tools in this space: ScreenApp, Trupeer, Guidde, Synthesia, Kommodo, Clueso, Docsie. These tools target software screen recording workflows (SaaS onboarding, product demos). None specifically target industrial safety procedures with mandatory section detection (hazards, PPE, emergency). The safety-specific context is the differentiation here — competitors produce generic numbered steps, not structured industrial SOPs.

---

### Table Stakes (Pathway 1)

Features users already expect from comparable tools. Absence feels like the product is broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| File upload (MP4/MOV) | Standard entry point — tools like ScreenApp and Trupeer show users expect drag-and-drop or file picker with immediate confirmation | LOW | Enforce 500 MB or configurable max; display file size before upload starts |
| YouTube / Vimeo URL paste | Paste-URL is the dominant pattern for video import in 2025 — every transcription tool supports it | LOW | Extract transcript from auto-generated captions first (fast path), fall back to audio transcription (slow path); both YouTube and Vimeo expose this via API |
| Async processing with progress feedback | Video transcription takes 30 seconds to several minutes — users cannot stare at a spinner without context. Research confirms async with step-by-step status updates (uploading → transcribing → structuring → ready) is the minimum viable feedback pattern | MEDIUM | Show named stages, not just a spinner; allow user to navigate away and return; notify when done |
| Structured output into existing SOP format | Users of this product are SOP admins — they expect output in the same section format as PDF-parsed SOPs (hazards, PPE, steps, emergency). A raw transcript dump is not acceptable. | HIGH | Run transcript through same GPT-based structuring pipeline as existing document parsing; confidence scoring must apply |
| Admin review before publish | Every competitor in this space shows a "review and edit" step before publishing. Particularly important for safety-critical content from audio. | MEDIUM | Reuse existing admin review UI; transcript source alongside structured output |
| Section confidence scoring | Existing PDF parser flags low-confidence sections for admin review. Video transcription has higher error rates, especially with industrial terminology (chemical names, equipment identifiers). Same pattern must apply. | MEDIUM | Flag sections where transcript confidence is low or where mandatory SOP sections (hazards, PPE) are absent from the source |
| Basic transcript display/editing | Users need to see what was transcribed before or during review, especially to catch misheard safety-critical terms. Competitors like Exemplary AI show transcript alongside structured output. | MEDIUM | Editable transcript panel alongside structured output in the review screen |

---

### Differentiators (Pathway 1)

Features specific competitors lack or do poorly, where the safety-focused context creates real value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| In-app camera recording (video → immediate SOP) | No current video-to-SOP competitor supports in-app recording directly — they all require separate recording tools. A supervisor could walk a process on the factory floor, record it, and have a draft SOP in 5 minutes. | HIGH | Uses MediaRecorder API (WebRTC). Critical iOS constraint: Safari does not support MediaRecorder — will require a fallback warning or native media element on iOS. Test thoroughly. |
| Industrial terminology correction pass | Generic transcription (Whisper, GPT-4o Transcribe) handles technical language with 90-95% accuracy but struggles with brand-specific chemical names, NZ-specific nomenclature, equipment model numbers. A post-transcription terminology review step — where admin can add known vocabulary — substantially increases usable accuracy. | MEDIUM | Allow org-level custom vocabulary list. Run transcript through term-matching correction before structuring. |
| Mandatory section detection flag | If a video SOP source has no hazard warnings or PPE discussion in the transcript, the system should flag this explicitly to the admin before publishing — not silently publish a step list. No competitor does this; it is the key safety differentiator. | LOW | Simple check: if structured output has empty hazards/PPE sections, surface a prominent warning on the review screen. |
| Timestamp linking from SOP step to source video | Users of the final SOP can see "(at 2:14 in source video)" on a step and tap to review the original footage for clarification. This is available in tools like Docustream.ai and ScreenApp for screen recording content; rare in safety SOP context. | MEDIUM | Store timestamps with each extracted step; render as optional attribution in admin review; optionally surface to workers on published SOP |

---

### Anti-Features (Pathway 1)

| Anti-Feature | Why Problematic | What to Do Instead |
|--------------|-----------------|-------------------|
| Auto-publish without admin review | Video transcription error rates for industrial terminology run 5-15% (WER) even with GPT-4o Transcribe. Auto-publishing a safety procedure with a transcription error is a liability. | Always require admin review before publish, with no bypass |
| In-app video playback / media player | The output of this pathway is an SOP document, not a media player. Building a full video player is scope creep and competes with existing hosting platforms. | Store source video URL/reference only; link to original hosting platform if needed |
| Real-time transcription (while recording) | Real-time display during in-app recording creates complex state management and has no user benefit — the admin will review the structured output anyway. | Process after recording ends, not during |
| Transcription of any video for any purpose | Positioning as a generic transcription tool bloats scope. The output is always a structured SOP for this product. | Hard-code the output to SOP format; add generic export only if customers explicitly request it post-launch |
| Simultaneous upload of many videos | Batch video import adds significant backend complexity (queue management, storage, cost) and has low demand in the target market — organizations will rarely have more than a handful of "process videos" | Single file/URL at a time for v1; batch as v2 if requested |

---

### Sub-Pathway Comparison: Upload vs URL vs In-App Recording

| Sub-Pathway | User Expectation | Key Technical Constraint | Priority |
|-------------|-----------------|--------------------------|---------|
| File upload (MP4/MOV) | Drag-drop or file picker; processing in under 3 min for 10-min video; clear status updates | OpenAI Whisper API has 25 MB limit; GPT-4o Transcribe supports up to 100 MB via file API; longer videos need chunked processing | P1 |
| YouTube URL | Paste URL, click go; auto-detects existing captions (fast), falls back to audio extraction | YouTube Data API v3 provides caption tracks for most videos; private/corporate YouTube videos may have no captions; third-party services (Apify, AssemblyAI) cover edge cases | P1 |
| Vimeo URL | Same UX as YouTube paste | Vimeo API provides transcript data for videos on paid plans; many enterprise Vimeo videos will have transcripts available; fall back to audio extraction if not | P1 |
| In-app recording | Record, stop, review — same as phone's camera app feel | MediaRecorder API works in Chrome/Android; iOS Safari does NOT support MediaRecorder (as of early 2026) — must display browser warning or restrict feature to Android/Chrome | P2 (after file upload is stable) |

---

### Feature Dependencies (Pathway 1)

```
[Video File Upload]
    └──requires──> [Async Processing Queue]
                       └──requires──> [Transcription Service (Whisper / GPT-4o)]
                                          └──requires──> [SOP Structuring Pipeline]
                                                             └──requires──> [Confidence Scoring]
                                                                                └──requires──> [Admin Review UI (existing)]

[YouTube/Vimeo URL]
    └──requires──> [Caption Extraction API]
                       └──fallback──> [Audio Download + Transcription Service]
                                          └──same path as file upload from here

[In-App Recording]
    └──requires──> [MediaRecorder API (PWA)]
    └──requires──> [iOS Safari fallback warning]
    └──requires──> [Async Processing Queue]
                       └──same path as file upload from here

[Transcript Display]
    └──requires──> [Raw Transcript Storage]
    └──required by──> [Admin Review UI]
```

---

## Pathway 2: File → SOP (Expanded)

### What It Is

Three distinct expansions to the existing PDF/DOCX intake:
1. Photo/image upload with OCR → structured SOP (camera capture or gallery image)
2. Additional file formats: Excel (.xlsx), PowerPoint (.pptx), plain text (.txt, .csv)
3. Improved AI parsing accuracy (better section detection, formatting, handling of complex layouts)

### Competitive Landscape

No competitor in the industrial SOP space specifically supports photo-to-SOP. The capability comes from the document processing / OCR world (Docparser, Mindee, Google Document AI, Azure Form Recognizer). Excel/PowerPoint parsing is available in Azure AI Document Intelligence and as a general capability in OpenAI's file API. The differentiation here is context: these are safety procedures, so accuracy expectations are higher than generic document processing.

---

### Sub-Pathway 2A: Photo / Image Upload with OCR

#### Table Stakes (2A)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Camera capture from device | Mobile users expect a camera-open button, not file-picker only. The target users are on factory floors with printed SOPs. Photo-of-document is the primary use case. | LOW | Use `<input type="file" accept="image/*" capture="environment">` for PWA — this opens the device camera directly on mobile. No additional library needed. |
| Gallery / file picker fallback | Users may already have photos of documents. File picker must accept image formats (JPEG, PNG, HEIC, WebP). | LOW | Standard file input without `capture` attribute covers this |
| Image quality feedback before processing | OCR accuracy is highly sensitive to image quality. A blurry, glare-affected, or rotated photo produces unusable output. Users need to know before they wait 30 seconds. | MEDIUM | Client-side quality check before upload: detect blur (Laplacian variance), detect extreme rotation (above 10°), check minimum resolution. Display "image may be hard to read" warning with option to retake |
| Deskew and preprocessing server-side | Even good photos of printed documents are skewed, have curved pages, and uneven contrast. Server-side preprocessing (deskew, binarization, contrast normalization) improves OCR accuracy by up to 20% per research. | MEDIUM | Apply before passing to OCR model; use established libraries (OpenCV, Pillow, or cloud API preprocessing options) |
| Same structured output as existing parser | Admin expects the same sections (hazards, PPE, steps, emergency) and the same review UI regardless of source. OCR-sourced SOPs must go through the same structuring pipeline. | LOW | Route OCR text output through existing GPT structuring pipeline; same admin review UI |
| Confidence scoring | OCR text quality varies widely. A photo of a damaged document may yield 60% accuracy. Confidence scoring must reflect OCR quality, not just parsing quality. | MEDIUM | Combine OCR confidence score (from vision model) with parsing confidence; surface combined score to admin |

#### Differentiators (2A)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multi-page photo sequence (document "scanning" flow) | A printed SOP may be multiple pages. Allowing sequential photo capture with automatic stitching is the UX of modern mobile document scanners (CamScanner, Apple Notes built-in). No current SOP tool supports this. | HIGH | "Add page" button after each capture; preview strip showing captured pages; reorder/delete pages; submit all for combined OCR pass |
| Handwritten annotation recognition | Many industrial SOPs have handwritten amendments — dates, revised quantities, signatures. Flagging these sections (even if not fully readable) prevents silently discarding safety-relevant handwritten notes. | MEDIUM | Flag regions where handwriting is detected; mark those sections as "requires manual review" in admin UI. Do not attempt to OCR handwriting accurately — flag and defer to human. |
| Existing document plus photo amendment | Admin uploads the base Word/PDF SOP, then photo-captures a handwritten amendment page. System merges and flags the amendments for admin reconciliation. | HIGH | Complex merge logic — defer to v2 unless specifically requested |

#### Anti-Features (2A)

| Anti-Feature | Why Problematic | What to Do Instead |
|--------------|-----------------|-------------------|
| Silent low-quality processing | If the image is too blurry or glare-ridden, running it through OCR produces garbage output that could become a published SOP with wrong safety instructions. | Block processing if quality thresholds are not met; require retake |
| HEIC format without conversion | iOS camera saves in HEIC by default. Most browsers and server libraries do not natively process HEIC. Silently failing is a bad experience. | Convert HEIC to JPEG server-side or client-side before OCR. Display error with instruction if conversion fails. |
| Free-form image types (product photos, site photos) | Users will try uploading a photo of a chemical container or a machine, expecting a SOP. This is not a valid use case and produces nonsensical output. | Detect if uploaded image is unlikely to contain a document (use vision model to classify) and warn the user before processing |

---

### Sub-Pathway 2B: Additional File Formats

#### Table Stakes (2B)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Plain text (.txt) | Lowest-friction format — copy-paste a procedure into a .txt file. Every document parser handles this. | LOW | Extract text, run through existing structuring pipeline. No special handling. |
| PowerPoint (.pptx) | Many industrial training SOPs are maintained as slide decks with one step per slide. Azure AI Document Intelligence maps each slide to a page. OpenAI file API handles PPTX directly. | MEDIUM | Extract slide text and any embedded images; treat each slide as a candidate step; run through structuring pipeline. Speaker notes should be included in extraction. |
| Excel (.xlsx) | Some SOPs maintained as process tables or checklists. Common in manufacturing for equipment calibration procedures with measurement columns. | MEDIUM | Extract tabular data per sheet; AI must interpret tables as step sequences or parameter tables within steps. This is harder than text — more likely to need manual structuring by admin post-parse. Surface low confidence. |
| Consistent upload UI across all formats | Users should not have a different upload flow per format. One upload button with format filtering covers all. | LOW | Extend existing file input `accept` attribute to include `.pptx`, `.xlsx`, `.txt`, `.csv`; backend routes by MIME type to appropriate extraction pipeline |

#### Differentiators (2B)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Table extraction within steps | Excel SOPs often include parameter tables (e.g., "Torque settings: Model A = 12 Nm, Model B = 18 Nm"). Rendering these as readable tables within an SOP step, rather than raw comma-separated text, is better than competitors. | MEDIUM | Detect tabular structures in Excel and PowerPoint during extraction; pass structured table data to GPT for formatting as a Markdown table within the appropriate step |
| Improved section detection for atypical layouts | PowerPoint SOPs often do not use standardized headers. AI must detect "slide 1 = hazard overview" from context, not header text. This requires a stronger structuring pass with examples specific to slide deck formats. | MEDIUM | Format-specific prompt engineering in the structuring pipeline; different prompts/examples for PPTX vs DOCX vs plain text |

#### Anti-Features (2B)

| Anti-Feature | Why Problematic | What to Do Instead |
|--------------|-----------------|-------------------|
| Support for every possible format (.odt, .pages, .rtf, etc.) | Long tail of formats adds maintenance burden with minimal usage. Each format needs its own extraction path. | Limit to: PDF, DOCX (existing), PPTX, XLSX, TXT, images (new). Display "unsupported format" with suggestion for covered formats. |
| Full Excel formula / computation execution | Some Excel SOPs have computed fields. Executing macros or formulas on uploaded files is a security risk. | Extract cell values (not formulas); ignore any formula logic; flag to admin if computed values appear to be present |

---

### Sub-Pathway 2C: Improved AI Parsing Accuracy

This is an infrastructure improvement, not a user-facing feature. Its effects surface as fewer flagged sections, fewer admin corrections, and higher admin trust in parsed output.

#### What "Improved" Means in Practice

| Area | Current State (inferred) | Target | Approach |
|------|--------------------------|--------|----------|
| Section detection | Relies on header text matching | Semantic detection even when headers are absent or non-standard | Few-shot examples with non-standard layouts in structuring prompt |
| Formatting fidelity | Tables may collapse to text; lists may not be detected | Tables render as tables; nested lists preserve hierarchy | Markdown-preserving extraction pipeline; post-processing pass |
| Industrial terminology accuracy | General parsing model has no SOP domain knowledge | Improved through system prompt specificity and domain-specific few-shot examples | Prompt engineering; optionally fine-tuned system prompts per tenant configuration |
| Confidence scoring accuracy | Single confidence score per section | Per-sentence or per-item confidence; better calibrated | Use model logprob data for confidence estimation where available |

---

### Feature Dependencies (Pathway 2)

```
[Photo Upload]
    └──requires──> [Client-Side Quality Check]
    └──requires──> [Server-Side Preprocessing (deskew, contrast)]
                       └──requires──> [OCR Model (Vision LLM or Document AI API)]
                                          └──requires──> [SOP Structuring Pipeline (existing)]
                                                             └──requires──> [Admin Review UI (existing)]

[PPTX / XLSX Upload]
    └──requires──> [Format-Specific Extraction Library]
                       └──requires──> [Text + Table Extraction]
                                          └──requires──> [SOP Structuring Pipeline (existing)]

[Plain Text Upload]
    └──requires──> [SOP Structuring Pipeline (existing)]
    (No intermediate extraction step needed)

[Improved Accuracy]
    └──requires──> [Prompt Engineering / System Prompt Revision]
    └──enhances──> [All intake pathways] (not a separate pipeline; improvement applied uniformly)
```

---

## Pathway 3: File → Video SOP

### What It Is

Take an existing parsed SOP (or a document uploaded for parsing) and generate a video version. Three output formats:

1. **Narrated slideshow** — Auto-generated slides/cards from SOP sections with AI voiceover (TTS)
2. **Full AI video** — Generated visuals/animations with narration (AI avatar or visual synthesis)
3. **Screen recording style** — Scrolling SOP content with AI voice overlay

All outputs include searchable timestamps and chapter markers linked to SOP sections.

### Competitive Landscape

This is the most competitive and technically complex pathway. Synthesia dominates enterprise AI training video (avatar-based narration, 240+ avatars, 130 languages, built-in SOP templates). HeyGen competes at similar level. Docustream.ai specifically targets SOP-to-video. These tools cost $50-300/month as standalone products. The differentiation for SafeStart is native integration — generating video from an already-structured SOP in the same platform, output immediately accessible to workers in the same app, with timestamps and chapter navigation linked to the SOP structure. No competitor offers the full integrated loop of intake → structure → deliver as text + video in one product.

---

### Table Stakes (Pathway 3 — All Formats)

Features expected regardless of which output format is chosen.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Chapter markers per SOP section | Users of video learning content in 2025 expect chapter navigation (YouTube has normalized this). Jumping to "PPE Requirements" directly is essential for safety reference use. Tools like Mux and FastPix support AI-generated chapters. | MEDIUM | Map each SOP section (hazards, PPE, steps, emergency) to a chapter; embed chapter markers in video metadata and player UI |
| Timestamps linked to SOP steps | Workers need to navigate to step 7 in a 15-minute video without scrubbing. Step-level timestamps let them jump directly. This is standard in Docustream.ai and ScreenApp. | MEDIUM | Generate timestamp map during video creation; store in SOP record; render as navigation overlay in video player |
| Preview before publishing | Admins must be able to watch the generated video before it becomes visible to workers. Quality control is mandatory — a TTS voice mispronouncing a chemical name is a safety issue. | LOW | Video preview in admin review screen; "Re-generate" and "Publish" buttons |
| AI voice narration (TTS) | All three output formats require narration. ElevenLabs, Google Cloud TTS, and Murf are the standard options in 2025. Quality is now high enough for professional training use. | MEDIUM | Use a clear, neutral professional voice (not conversational). Allow admin to choose from a small set of voice options. ElevenLabs recommended for naturalness; Google Cloud TTS for cost at scale. |
| Worker access to generated video in existing SOP view | The video is supplementary to the text SOP, not a replacement. Workers should be able to tap a "Video version" button within the existing SOP walkthrough screen. | LOW | Attach video URL to SOP record; render optional video player above or alongside the step-by-step walkthrough |
| Generation time feedback | Full AI video generation takes 2-10 minutes for a typical SOP. Async with named stages (analyzing → generating visuals → adding narration → finalizing) is the minimum viable feedback. | MEDIUM | Same async progress pattern as transcription pipeline; email or in-app notification on completion |

---

### Format-Specific Table Stakes

#### Format A: Narrated Slideshow

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One slide/card per SOP section or major step | Slide deck structure maps naturally to SOP sections. Users expect a clean, PowerPoint-like output with minimal text per slide. | MEDIUM | Auto-generate slide content from section summaries, not raw step text; limit to 3-4 bullet points per slide |
| SOP title card and safety warning card first | Industrial safety slides must lead with hazards/PPE before steps — not with title + company logo. | LOW | Enforce slide order: Title → Hazards/PPE card → Steps → Emergency. Non-negotiable for safety. |
| Text legibility standards | Workers may view on phones (small screen) or projection in a meeting room. Text must be readable at both scales. | LOW | Minimum 18pt equivalent font size; high contrast; max 40 words per slide |

#### Format B: Full AI Video

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| AI avatar or animated visuals synchronized to narration | This is what Synthesia/HeyGen provides. Users expect lip-sync or at minimum visuals that match the topic being narrated. | HIGH | Use an AI avatar API (Synthesia, HeyGen, or D-ID). This pathway has significant external API cost per generation. Budget per SOP video must be considered. |
| Organization branding (logo, color) | Enterprise customers expect branded outputs. Synthesia makes this a paid feature. | MEDIUM | Simple brand overlay: org logo top-right, org color scheme applied to title/chapter cards |

**IMPORTANT: Full AI video generation (Format B) has the highest unit cost and complexity. This format should be P2 — ship Format A (narrated slideshow) and Format C (screen recording style) first, validate demand, then build Format B.**

#### Format C: Screen Recording Style

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| SOP text scrolling at readable pace | The "screen recording style" format is essentially a teleprompter-on-screen with voiceover. Users expect the text scroll rate to match the narration pace. | MEDIUM | Sync scroll timing to TTS audio timing; pre-generate audio, calculate duration per text block, render scroll timing accordingly |
| Section headers visible as text scrolls | Workers watching a 10-minute video need visual anchors. Chapter titles (PPE, Step 3, Emergency) must appear as the narration passes them. | LOW | Overlay section header text at calculated timestamps |
| Playback speed control | Workers watching for reference (not first time) want 1.25x or 1.5x. This is standard browser video player behavior. | LOW | Use standard HTML5 video player controls; playback rate control is native. No custom implementation needed. |

---

### Differentiators (Pathway 3)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Integrated SOP text + video in one experience | Competitors offer either the text SOP platform or the video generation tool, not both in one product. Workers see the text SOP, tap "Watch Video", and the video opens with chapters pre-linked to the sections they just navigated. | MEDIUM | This is an integration differentiator, not a feature to build per se — it comes from building Pathway 3 inside the existing app rather than as a separate tool. |
| Safety-first slide ordering (hazards before steps, always) | General-purpose AI video tools (Synthesia, HeyGen) let users order slides however they want. For safety SOPs, hazards and PPE must come first. No general-purpose tool enforces this. | LOW | Hard-coded slide ordering rule in the generation pipeline. Not configurable. Safety before steps, always. |
| Re-generation on SOP update | When an SOP is edited and a new version is published, the video becomes stale. Auto-detecting this and prompting the admin to regenerate the video (or auto-regenerating if budget allows) is a workflow feature no competitor offers in a SaaS SOP context. | MEDIUM | SOP versioning event triggers "video is outdated" flag on the video record; admin notification with "Regenerate" button |
| Worker video completion tracking | If workers are assigned to watch the video SOP, their completion should be tracked alongside text walkthrough completions. No current tool connects video consumption to compliance records. | MEDIUM | Store video completion event (watched to 80%+ counts as complete) tied to worker/SOP/version record; surfaces in supervisor dashboard |

---

### Anti-Features (Pathway 3)

| Anti-Feature | Why Problematic | What to Do Instead |
|--------------|-----------------|-------------------|
| Full AI video (Format B) as launch priority | Format B requires an AI avatar API with per-generation cost ($0.10-0.50/minute of output) and complex orchestration. Shipping Format B before validating demand for Pathway 3 at all is high-cost, high-risk. | Ship Format A (narrated slideshow) and Format C (scroll + voice) first. Format B on validated demand. |
| Video replacing text SOP for workers | Some workers need offline access; video requires connectivity. Some workers need to reference a specific step quickly; video is slower to navigate than text. | Video is always supplementary, never a replacement for the text SOP. Both always available when online. Offline = text only. |
| Custom voice cloning | "Use our HSE Manager's voice" sounds appealing but introduces legal, ethical, and quality concerns. If the voice sounds wrong, it damages credibility of the safety content. | Use a library of pre-approved professional AI voices. Custom voice cloning as a v3 enterprise feature only, with legal review. |
| Real-time generation preview | Streaming video generation frame-by-frame while processing is technically difficult and provides minimal value — admins will review the full output anyway. | Generate async, notify on completion, admin reviews finished video |
| Interactive video branching ("if you are doing X, watch section Y") | Conditional branching in training video requires significant authoring UI (similar to Articulate Storyline). This is a different product category. | Linear video with chapter navigation is sufficient. Workers who need conditional guidance use the text walkthrough with its optional steps. |

---

### Feature Dependencies (Pathway 3)

```
[Video SOP Generation]
    └──requires──> [Parsed + Published SOP (existing)]
                       └──requires──> [SOP Structuring Pipeline (existing)]

[All Formats]
    └──requires──> [TTS Service (ElevenLabs / Google Cloud TTS)]
    └──requires──> [Video Rendering Service]
    └──requires──> [Async Processing Queue]
    └──requires──> [Video Storage + CDN (e.g. Cloudflare R2 + Stream, Mux, or Bunny.net)]
    └──requires──> [Admin Preview UI]
    └──requires──> [Worker Video Player UI]

[Format A: Narrated Slideshow]
    └──requires──> [Slide Generation from SOP Sections]
    └──requires──> [TTS Audio per Slide]
    └──requires──> [Slide-to-Video Compositor]

[Format B: Full AI Video]
    └──requires──> [AI Avatar API (Synthesia / HeyGen / D-ID)]
    └──requires──> [Script Generation from SOP]
    └──requires──> [High external API cost — budget required]

[Format C: Screen Recording Style]
    └──requires──> [Scroll Timing Calculator (text block duration from TTS)]
    └──requires──> [Video Rendering (scrolling text + audio sync)]

[Chapter Navigation]
    └──requires──> [Timestamp Map per Section/Step]
    └──requires──> [Video Player with Chapter Markers]
    └──requires──> [Mux Player or equivalent with chapter API support]

[Video Completion Tracking]
    └──requires──> [Completion Tracking System (existing)]
    └──requires──> [Video Player Progress Events]
    └──enhances──> [Supervisor Dashboard (existing)]
```

---

## Cross-Pathway Feature Comparison

| Feature Area | Pathway 1 (Video→SOP) | Pathway 2 (File→SOP) | Pathway 3 (File→Video) |
|---|---|---|---|
| Async processing queue | Required | Required | Required |
| Admin review before publish | Required | Required (reuse existing) | Required (preview) |
| Confidence scoring | Required (transcript quality) | Required (OCR/parse quality) | N/A (human script) |
| Offline support | Text output cached offline (existing) | Text output cached offline (existing) | Video NOT available offline |
| Complexity | MEDIUM-HIGH | LOW-MEDIUM | HIGH |
| External API dependency | Transcription (Whisper/GPT-4o) | OCR (Vision LLM) | TTS + Video render |
| Unique iOS constraint | MediaRecorder not supported on Safari (in-app recording only) | HEIC conversion needed | No significant iOS constraint |
| Rollout order | P1 (file upload + URL), P2 (in-app recording) | P1 (photo OCR, plain text), P1 (PPTX/XLSX) | P1 (Format A+C), P2 (Format B) |

---

## Overall MVP Recommendation for v2.0

### Launch With (v2.0)

Minimum viable scope that demonstrates all three pathways without the highest-cost/risk sub-features.

- [ ] **P1: Video file upload (MP4/MOV) → SOP** — Core Pathway 1 entry point; async processing; transcript display; structured output via existing pipeline; admin review
- [ ] **P1: YouTube/Vimeo URL → SOP** — Most common real-world video source; caption-first fast path; audio fallback
- [ ] **P1: Photo/image upload → SOP** — Pathway 2A; camera capture + gallery; server-side preprocessing; quality warning before processing
- [ ] **P1: PPTX/XLSX/TXT upload → SOP** — Pathway 2B; extend existing upload with new MIME type routing
- [ ] **P1: Narrated slideshow (Format A)** — Pathway 3, lowest complexity format; TTS; chapter markers; admin preview
- [ ] **P1: Screen recording style (Format C)** — Pathway 3, second-lowest complexity; scroll-sync to TTS audio; no external avatar API
- [ ] **P1: Worker video access within SOP** — In-app video player on published SOP record; chapter navigation; completion tracking event

### Defer to v2.1+

- [ ] **P2: In-app camera recording → SOP** — iOS Safari blocker makes this Android/Chrome-only until Safari MediaRecorder support; defer until platform support improves or iOS-specific fallback is designed
- [ ] **P2: Full AI video (Format B)** — High cost per generation; validate demand with Formats A and C first
- [ ] **P2: Multi-page photo sequence** — Useful but complex; single-page photo is sufficient for v2.0
- [ ] **P2: Re-generation on SOP update** — Nice-to-have; versioning + video tracking covers the gap for v2.0
- [ ] **P2: Custom vocabulary for transcription** — Improves accuracy; implement after first real-world usage reveals which terms are most commonly misheard

---

## Sources

- [ScreenApp — How to Automatically Create an SOP from a Video (Ultimate Guide 2025)](https://screenapp.io/blog/how-to-create-sop-from-video-ai)
- [Docsie — Loom Video to SOP Converter 2026](https://www.docsie.io/blog/articles/loom-video-to-sop-converter-2026/)
- [Trupeer AI — How to Create Effective Video SOPs](https://www.trupeer.ai/blog/how-to-create-effective-video-sops)
- [Synthesia — How to Create Effective Video SOPs](https://www.synthesia.io/post/video-sop)
- [Docustream.ai — Convert SOPs Into Training Videos](https://docustream.ai/sop-to-video/)
- [HeyGen — AI Video Generator / SOP Video Generator](https://www.heygen.com/video/sop-video-generator)
- [Mux — AI-Generated Chapters for Your Videos](https://www.mux.com/blog/ai-generated-chapters-for-your-videos-with-mux-player)
- [FastPix — AI-Generated Chapters Developer's Guide](https://www.fastpix.io/blog/ai-generated-chapters-for-your-videos-a-developers-guide)
- [Progressier — Video Recording PWA Demo](https://progressier.com/pwa-capabilities/video-recording)
- [SimiCart — How to Access the Camera in a PWA (2025)](https://simicart.com/blog/pwa-camera-access/)
- [Vimeo Developer API — Transcript Metadata Reference](https://developer.vimeo.com/api/reference/response/transcript-metadata)
- [OpenAI — Speech to Text API Guide](https://developers.openai.com/api/docs/guides/speech-to-text)
- [OpenAI Whisper Review 2026 — Accuracy Benchmarks](https://diyai.io/ai-tools/speech-to-text/reviews/openai-whisper-review/)
- [Scanbot — How Image Pre-Processing Enhances OCR Accuracy](https://scanbot.io/blog/improve-ocr-accuracy-with-image-processing/)
- [Docparser — Improve OCR Accuracy with Advanced Image Preprocessing](https://docparser.com/blog/improve-ocr-accuracy/)
- [v7labs — Document Processing Platform Guide: AI, OCR & IDP Solutions 2025](https://www.v7labs.com/blog/document-processing-platform)
- [Microsoft Learn — Azure AI Document Intelligence Structured Content](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/document/elements)
- [Flowith — HeyGen 5.0 vs Synthesia 2.0: Which AI Avatar Platform for Enterprise Training?](https://flowith.io/blog/heygen-5-0-vs-synthesia-enterprise-training-videos/)
- [AWS Blog — Accelerate Video Q&A Workflows Using Amazon Bedrock and Amazon Transcribe](https://aws.amazon.com/blogs/machine-learning/accelerate-video-qa-workflows-using-amazon-bedrock-knowledge-bases-amazon-transcribe-and-thoughtful-ux-design/)
- [Lollypop Design — Boost SaaS UX with Smarter Progress Indicators (2025)](https://lollypop.design/blog/2025/november/progress-indicator-design/)
- [3Play Media — File Size and Duration Limits](https://support.3playmedia.com/hc/en-us/articles/227730188-File-Size-and-Duration-Limits)
- [OpenAI Community — GPT-4o Transcribe Audio Length Limits](https://community.openai.com/t/gpt-4o-transcribe-audio-length-limits/1148374)

---

*Feature research for: SOP Creation Pathways v2.0 — Video → SOP, File → SOP (expanded), File → Video SOP*
*Researched: 2026-03-29*
