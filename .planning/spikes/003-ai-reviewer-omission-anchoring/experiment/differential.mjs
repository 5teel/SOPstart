// Differential measurement: run both jobs against clean + corrupted, compare, decide verdict.
import { runJobB, runJobC } from "./reviewer.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixture");
const RESULTS = join(HERE, "results");
await mkdir(RESULTS, { recursive: true });

const source = JSON.parse(await readFile(join(FIX, "source.json"), "utf8"));
const sourceText = source.pages.map((p) => `[Page ${p.pageNum}] ${p.text}`).join("\n\n");
const expected = JSON.parse(await readFile(join(FIX, "expected-defects.json"), "utf8"));

const variants = ["clean", "corrupted"];
const results = {};

for (const v of variants) {
  const draft = JSON.parse(await readFile(join(FIX, `draft.${v}.json`), "utf8"));
  console.log(`\n=== ${v} draft ===`);
  const B = await runJobB(sourceText, draft);
  console.log(`  Job B: ${B.flags.length} flags · ${B.wallMs}ms · input=${B.usage.input_tokens} cache_create=${B.usage.cache_creation_input_tokens} cache_read=${B.usage.cache_read_input_tokens} output=${B.usage.output_tokens}`);
  const C = await runJobC(sourceText, draft);
  console.log(`  Job C: ${C.flags.length} flags · ${C.wallMs}ms · input=${C.usage.input_tokens} cache_create=${C.usage.cache_creation_input_tokens} cache_read=${C.usage.cache_read_input_tokens} output=${C.usage.output_tokens}`);
  results[v] = { B, C };
}

// ---- Verdict scoring ----
// Job B injection: dropped 'step-swab-5-safety' = "Do not put your thumb or finger through the ring..."
// Pass if corrupted's Job B has a flag whose source_quote OR description mentions "thumb" or "ring"
//   AND the same flag is NOT in clean's Job B
const corruptedBFlags = results.corrupted.B.flags;
const cleanBFlags = results.clean.B.flags;
// Word-boundary regex to avoid matching "ring" inside "training"/"during"/"starting".
// The injected defect quote is "Do not put your thumb or finger through the ring".
const ringMatch = (f) => /\bthumb|\bfinger|\bring\b/i.test(`${f.source_quote ?? ""} ${f.description ?? ""}`);
const cleanHasRingFlag = cleanBFlags.some(ringMatch);
const corruptedHasRingFlag = corruptedBFlags.some(ringMatch);
const jobBPass = corruptedHasRingFlag && !cleanHasRingFlag;

// Job C injection: photo-swab-cycle-switch moved from step-swab-3 → step-mould-5
// Pass if corrupted's Job C contains a flag with photo_id 'photo-swab-cycle-switch' AND current_step_id 'step-mould-5'
//   AND clean's Job C is empty (or doesn't flag the same photo)
const corruptedCFlags = results.corrupted.C.flags;
const cleanCFlags = results.clean.C.flags;
const swapMatch = (f) => (f.photo_id ?? "").includes("swab-cycle") && (f.current_step_id ?? "").includes("mould");
const corruptedHasSwapFlag = corruptedCFlags.some(swapMatch);
const cleanHasSwapFlag = cleanCFlags.some(swapMatch);
const jobCPass = corruptedHasSwapFlag && !cleanHasSwapFlag;

// Token + cost projection (Sonnet 4.5 pricing as of 2026-05)
const PRICE = { input: 3.0, cache_create: 3.75, cache_read: 0.30, output: 15.0 }; // $ per million tokens
function costOf(usage) {
  return (
    ((usage.input_tokens ?? 0) * PRICE.input +
      (usage.cache_creation_input_tokens ?? 0) * PRICE.cache_create +
      (usage.cache_read_input_tokens ?? 0) * PRICE.cache_read +
      (usage.output_tokens ?? 0) * PRICE.output) /
    1_000_000
  );
}
const costs = {};
let total = 0;
for (const v of variants) {
  const b = costOf(results[v].B.usage);
  const c = costOf(results[v].C.usage);
  costs[v] = { B: b, C: c, total: b + c };
  total += b + c;
}

const verdict = {
  jobB: { pass: jobBPass, evidence: { cleanHasRingFlag, corruptedHasRingFlag } },
  jobC: { pass: jobCPass, evidence: { cleanHasSwapFlag, corruptedHasSwapFlag, corruptedCFlagCount: corruptedCFlags.length } },
  overall: jobBPass && jobCPass ? "VALIDATED" : "FAILED",
  cleanFlagCounts: { B: cleanBFlags.length, C: cleanCFlags.length },
  corruptedFlagCounts: { B: corruptedBFlags.length, C: corruptedCFlags.length },
  injected: {
    B: expected.omission,
    C: expected.anchoring,
  },
  costs,
  totalCostUsd: total,
};

await writeFile(join(RESULTS, "results.json"), JSON.stringify({ results, verdict }, null, 2));

console.log("\n=== VERDICT ===");
console.log(`Job B (omission catch): ${jobBPass ? "PASS ✓" : "FAIL ✗"}`);
console.log(`  clean had ring-flag? ${cleanHasRingFlag}  · corrupted had ring-flag? ${corruptedHasRingFlag}`);
console.log(`Job C (anchoring catch): ${jobCPass ? "PASS ✓" : "FAIL ✗"}`);
console.log(`  clean flagged swap? ${cleanHasSwapFlag}  · corrupted flagged swap? ${corruptedHasSwapFlag}`);
console.log(`Overall: ${verdict.overall}`);
console.log(`\nTotal API cost: $${total.toFixed(4)}`);
console.log(`  clean run: $${costs.clean.total.toFixed(4)}  (B=$${costs.clean.B.toFixed(4)} C=$${costs.clean.C.toFixed(4)})`);
console.log(`  corrupted: $${costs.corrupted.total.toFixed(4)}  (B=$${costs.corrupted.B.toFixed(4)} C=$${costs.corrupted.C.toFixed(4)})`);
