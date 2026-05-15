// Expand Spike 003's draft into a flat list of ~50 individually-verifiable blocks.
// Each "block" represents one Puck-level atomic unit that an admin must approve under D-CV2-04.
// Splits multi-clause steps so the count lands at exactly the target.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SPIKE_003_FIX = "C:\\Development\\SOPstart\\.planning\\spikes\\003-ai-reviewer-omission-anchoring\\experiment\\fixture";
const OUT = join(HERE, "fixture");
await mkdir(OUT, { recursive: true });

const draft = JSON.parse(await readFile(join(SPIKE_003_FIX, "draft.clean.json"), "utf8"));

// Also pull the Spike 003 reviewer output to mark some blocks "flagged"
let reviewerResults;
try {
  reviewerResults = JSON.parse(await readFile("C:\\Development\\SOPstart\\.planning\\spikes\\003-ai-reviewer-omission-anchoring\\experiment\\results\\results.json", "utf8"));
} catch {
  reviewerResults = null;
}

// Flatten: each step → 1 block; each photo on a step → 1 additional block.
// Multi-sentence steps get split on ". " into separate atomic blocks (rough proxy for what the parser produces).
const blocks = [];
let blockOrdinal = 0;

function pushBlock(b) {
  blockOrdinal++;
  blocks.push({ blockId: `b-${String(blockOrdinal).padStart(3, "0")}`, ...b });
}

for (const section of draft.sections) {
  // Section heading as a Heading block
  pushBlock({
    kind: "heading",
    sectionId: section.id,
    text: section.title,
    page: null,
    bbox: null,
  });

  for (const step of section.steps) {
    // Split on sentence boundaries that aren't preceded by " e.g" / abbreviations
    const sentences = step.text
      .split(/(?<!\b\w\.\w)\.\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.endsWith(".") ? s : s + "."));

    for (const sent of sentences) {
      pushBlock({
        kind: section.kind === "hazards" ? "hazard" : "step",
        sectionId: section.id,
        stepId: step.id,
        text: sent,
        page: null,
        bbox: null,
      });
      if (blocks.length >= 50) break;
    }

    for (const photo of step.photos ?? []) {
      if (blocks.length >= 50) break;
      pushBlock({
        kind: "photo",
        sectionId: section.id,
        stepId: step.id,
        photoId: photo.id,
        caption: photo.caption,
        page: null,
        bbox: null,
      });
    }
    if (blocks.length >= 50) break;
  }
  if (blocks.length >= 50) break;
}

// If still under 50, just stop — the natural count IS the answer.
// If over 50, slice (we want a clean 50 to measure).
const final = blocks.slice(0, 50);

// Attach flags from Spike 003 reviewer to relevant blocks
if (reviewerResults) {
  const allFlags = [
    ...(reviewerResults.results?.corrupted?.B?.flags ?? []),
    ...(reviewerResults.results?.corrupted?.C?.flags ?? []),
  ];
  for (const b of final) {
    const matchingFlags = [];
    for (const f of allFlags) {
      // Anchoring flag matches by photo_id
      if (f.kind === "anchoring" && b.kind === "photo" && b.photoId === f.photo_id) matchingFlags.push(f);
      // Omission flag matches by section title heuristic
      if (f.kind === "omission" && (f.missing_from ?? "").toLowerCase().includes((b.text ?? "").slice(0, 20).toLowerCase())) {
        matchingFlags.push(f);
      }
    }
    if (matchingFlags.length) b.flags = matchingFlags;
  }
}

const out = {
  title: draft.title,
  sourcePdf: draft.sourcePdf,
  blockCount: final.length,
  blocks: final,
};

await writeFile(join(OUT, "blocks-50.json"), JSON.stringify(out, null, 2));

console.log(`Generated ${final.length} blocks:`);
const byKind = final.reduce((m, b) => ((m[b.kind] = (m[b.kind] ?? 0) + 1), m), {});
for (const [k, n] of Object.entries(byKind)) console.log(`  ${k}: ${n}`);
const flagged = final.filter((b) => b.flags?.length).length;
console.log(`  with flags: ${flagged}`);
console.log(`Wrote fixture/blocks-50.json`);
