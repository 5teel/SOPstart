// AI reviewer Jobs B (omission) + C (anchoring) — Phase 20 D-CV2-05.
// Two structured Anthropic SDK calls per draft. Source is passed with cache_control: ephemeral
// so the SECOND call (Job C after Job B) hits the prompt-cache and pays input-token savings.

import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const MODEL = process.env.SPIKE_MODEL || "claude-sonnet-4-5"; // current available Sonnet; override via env
const MAX_OUTPUT_TOKENS = 4000;

function loadEnvFromDotEnv() {
  // tsx + dotenv may not be installed in spike's node_modules; read .env.local directly
  const fs = require("node:fs");
  try {
    const text = fs.readFileSync("C:\\Development\\SOPstart\\.env.local", "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnvFromDotEnv();

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing — add it to .env.local");

const anthropic = new Anthropic({ apiKey });

// --- Job B: omission reverse-scan ---
const JOB_B_SYSTEM = `You are a safety auditor reviewing an AI-converted Standard Operating Procedure (SOP) draft against its source document.

Your job (Job B — OMISSION reverse-scan): scan the SOURCE TEXT and identify any safety-critical content that is PRESENT in the source but MISSING from the structured draft.

A safety-critical omission is content that, if left out, could lead a worker to injury, equipment damage, or non-compliance. Examples:
- Hazard warnings (especially "Do not …" / "Never …" / "Serious injuries may result …" type warnings)
- Mandatory PPE that is named in the source
- Emergency procedures (E-STOP locations, what to do if X happens)
- Numerical thresholds with safety implications (temperatures, pressures, torques, frequencies)
- Required pre-checks / lockouts before starting a task
- Approved compound / material restrictions

NOT a safety-critical omission:
- General prose that paraphrases an existing draft step
- Administrative metadata (revision history, approval signatures, references to other documents)
- Decorative captions on images
- Examples / illustrations that don't add safety information beyond what the draft already contains

CRITICAL: report at most the TOP 5 most serious omissions. Skip simplification/paraphrase. Keep \`description\` ≤ 100 chars.

Respond with a JSON array only — no prose, no markdown, no explanation.
Each element: { "severity": "critical"|"warning", "kind": "omission", "source_quote": "exact quote from source (≤120 chars)", "source_location_hint": "page or section", "missing_from": "draft section title", "description": "what is omitted (≤100 chars)" }
If no safety-critical omissions found, respond with exactly: []`;

// --- Job C: anchoring check ---
const JOB_C_SYSTEM = `You are a safety auditor reviewing an AI-converted Standard Operating Procedure (SOP) draft.

Your job (Job C — ANCHORING check): for every photo/image attached to a step in the draft, verify that the photo's caption + content describes something relevant to THAT step. The source document is the ground truth for what each image actually depicts and which step it belongs to.

An ANCHORING error is when a photo is attached to a step whose instructions are unrelated to the photo's caption/subject. Examples of anchoring errors:
- Photo captioned "Swab Cycle Switch on the control panel" attached to a step about "swabbing bottom plates" → ANCHORING ERROR (the photo describes a control-panel switch but the step describes bottom-plate swabbing technique)
- Photo captioned "Run Indicator Light" attached to a step about "preparing swab brushes" → ANCHORING ERROR
- Photo captioned "Pre-Coated vs Uncoated blanks" attached to a step that mentions blank coating → CORRECT (photo subject matches step content)

Be strict: an image attached to a step it does not describe is a safety risk because workers may be confused about WHICH equipment the step refers to.

Respond with a JSON array only — no prose, no markdown, no explanation.
Each element: { "severity": "critical"|"warning", "kind": "anchoring", "photo_id": "string", "current_step_id": "string", "current_step_text_snippet": "first 120 chars of the step text", "photo_caption": "the caption as it appears in the draft", "description": "why this photo doesn't belong on this step", "suggested_step_id": "the step ID where this photo should be anchored, or null if unclear" }
If every photo is correctly anchored, respond with exactly: []`;

// Builds the user-content blocks. Source goes first WITH cache_control so re-use is free.
function buildContent(sourceText, draft, jobLabel) {
  return [
    {
      type: "text",
      text: `--- SOURCE DOCUMENT (PDF: ${draft.sourcePdf}) ---\n${sourceText}\n--- END SOURCE ---`,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: `--- DRAFT STRUCTURED SOP ---\n${JSON.stringify(draft, null, 2)}\n--- END DRAFT ---\n\nRun ${jobLabel}. Return JSON array only.`,
    },
  ];
}

function parseJsonResponse(textOut, ctx) {
  let t = textOut.trim();
  // strip ```json …``` if present
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  }
  try {
    const j = JSON.parse(t);
    if (!Array.isArray(j)) throw new Error("not an array");
    return j;
  } catch (e) {
    throw new Error(`${ctx} parse failed: ${e?.message} | raw: ${t.slice(0, 200)}`);
  }
}

export async function runJobB(sourceText, draft) {
  const t0 = Date.now();
  const r = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: JOB_B_SYSTEM,
    messages: [{ role: "user", content: buildContent(sourceText, draft, "Job B (omission reverse-scan)") }],
  });
  const ms = Date.now() - t0;
  const text = r.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
  const flags = parseJsonResponse(text, "JobB");
  return {
    job: "B",
    flags,
    usage: r.usage,
    wallMs: ms,
    rawText: text.slice(0, 500),
  };
}

export async function runJobC(sourceText, draft) {
  const t0 = Date.now();
  const r = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: JOB_C_SYSTEM,
    messages: [{ role: "user", content: buildContent(sourceText, draft, "Job C (anchoring check)") }],
  });
  const ms = Date.now() - t0;
  const text = r.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
  const flags = parseJsonResponse(text, "JobC");
  return {
    job: "C",
    flags,
    usage: r.usage,
    wallMs: ms,
    rawText: text.slice(0, 500),
  };
}

// CLI: node reviewer.mjs <fixture-dir> <variant>
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const [, , fixDir = "fixture", variant = "clean"] = process.argv;
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const HERE = dirname(fileURLToPath(import.meta.url));
  const fix = join(HERE, fixDir);
  const source = JSON.parse(await readFile(join(fix, "source.json"), "utf8"));
  const draft = JSON.parse(await readFile(join(fix, `draft.${variant}.json`), "utf8"));
  const sourceText = source.pages.map((p) => `[Page ${p.pageNum}] ${p.text}`).join("\n\n");
  console.log(`=== Reviewing ${variant} draft against ${source.pdf} (${sourceText.length} chars source) ===`);
  const B = await runJobB(sourceText, draft);
  console.log(`Job B: ${B.flags.length} flags · ${B.wallMs}ms · usage:`, B.usage);
  console.log(JSON.stringify(B.flags, null, 2));
  const C = await runJobC(sourceText, draft);
  console.log(`Job C: ${C.flags.length} flags · ${C.wallMs}ms · usage:`, C.usage);
  console.log(JSON.stringify(C.flags, null, 2));
}
