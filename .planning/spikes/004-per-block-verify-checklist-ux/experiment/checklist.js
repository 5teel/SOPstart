// Per-block verify checklist — measures time-to-publish under D-CV2-04 rules:
//   no bulk-tick, no trust-score skip, every block needs an explicit approve/decline.
//
// Instrumented for both human and Playwright runs.
//   window.__spike004 = { ... }  exposes timing + state for the measurement harness.

const blocksRes = await fetch("/fixture/blocks-50.json");
const fixture = await blocksRes.json();
const sourceRes = await fetch("/source.json");
const source = await sourceRes.json();

const listEl = document.getElementById("list");
const sourceTextEl = document.getElementById("sourceText");
const totalCountEl = document.getElementById("totalCount");
const approvedCountEl = document.getElementById("approvedCount");
const progressFillEl = document.getElementById("progressFill");
const publishBtn = document.getElementById("publish");
const flagSummaryEl = document.getElementById("flagSummary");
const statusEl = document.getElementById("status");

const state = {
  blocks: fixture.blocks.map((b, i) => ({ ...b, idx: i, status: "pending", flagsAcknowledged: false })),
  focusIdx: 0,
  startTs: null, // set on first interaction
  perBlockMs: [],
  keystrokes: 0,
  pointerEvents: 0,
  publishedAtMs: null,
  lastInteractionTs: null,
};

totalCountEl.textContent = String(state.blocks.length);
window.__spike004 = state;

function updateProgress() {
  const approved = state.blocks.filter((b) => b.status === "approved").length;
  const declined = state.blocks.filter((b) => b.status === "declined").length;
  const flaggedUnacked = state.blocks.filter((b) => (b.flags?.length ?? 0) > 0 && !b.flagsAcknowledged).length;
  approvedCountEl.textContent = approved;
  progressFillEl.style.width = `${(approved / state.blocks.length) * 100}%`;
  flagSummaryEl.textContent = flaggedUnacked ? `${flaggedUnacked} flagged block${flaggedUnacked === 1 ? "" : "s"} need review` : "";
  publishBtn.disabled = !(approved === state.blocks.length && flaggedUnacked === 0);
  statusEl.textContent = `${approved}/${state.blocks.length} approved · ${declined} declined · ${flaggedUnacked} flagged · ${state.keystrokes}k ${state.pointerEvents}p`;
}

function noteInteraction() {
  const now = performance.now();
  if (state.startTs === null) state.startTs = now;
  state.lastInteractionTs = now;
}

function renderBlock(b) {
  const el = document.createElement("div");
  el.className = "block";
  el.dataset.idx = String(b.idx);
  if (b.flags?.length) el.classList.add("has-flag");
  const kindClass = `kind-${b.kind}`;
  const sectionLabel = b.sectionId ?? "";
  el.innerHTML = `
    <div class="ordinal">#${String(b.idx + 1).padStart(2, "0")}</div>
    <div class="body">
      <div class="text"><span class="kind-tag ${kindClass}">${b.kind}</span>${escapeHtml(b.text ?? b.caption ?? "")}</div>
      <div class="meta">${sectionLabel}${b.stepId ? " · " + b.stepId : ""}${b.flags?.length ? ` · ${b.flags.length} flag${b.flags.length === 1 ? "" : "s"}` : ""}</div>
    </div>
    <div class="actions">
      <button class="btn btn-approve" data-action="approve">Approve</button>
      <button class="btn btn-decline" data-action="decline">Decline</button>
    </div>
    ${b.flags?.length ? `<div class="flag-list">${b.flags.map((f) => `
      <div class="flag"><span class="sev">${f.severity}</span>${escapeHtml(f.description ?? "")}</div>
    `).join("")}<div style="margin-top:4px; font-size:11px; color: var(--muted);">Approving acknowledges these flags.</div></div>` : ""}
  `;
  el.addEventListener("click", (e) => {
    setFocus(b.idx);
    const action = (e.target.closest("[data-action]"))?.dataset.action;
    if (action) {
      state.pointerEvents++;
      handleAction(b.idx, action);
    }
  });
  return el;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function setFocus(idx) {
  state.focusIdx = idx;
  for (const el of listEl.children) el.classList.toggle("focused", Number(el.dataset.idx) === idx);
  // scroll into view
  listEl.children[idx]?.scrollIntoView({ behavior: "auto", block: "center" });
  updateSourcePanel();
}

function updateSourcePanel() {
  const b = state.blocks[state.focusIdx];
  // For this spike: show the section's source content as best-effort matched by section ID.
  // (No actual page mapping in the fixture — Plan 20-05 will join through block_provenance.region.)
  const sectionTitle = b?.sectionId ?? "";
  // Show the entire source text dimmed, highlight any line that mentions the block text snippet (first 30 chars)
  const needle = (b.text ?? b.caption ?? "").slice(0, 30).toLowerCase();
  let out = "";
  for (const p of source.pages) {
    const txt = p.text;
    const hit = needle && txt.toLowerCase().includes(needle);
    if (hit) {
      const i = txt.toLowerCase().indexOf(needle);
      const before = escapeHtml(txt.slice(Math.max(0, i - 80), i));
      const match = escapeHtml(txt.slice(i, i + needle.length));
      const after = escapeHtml(txt.slice(i + needle.length, i + needle.length + 200));
      out += `<div style="margin-bottom:12px;"><div style="color: var(--muted); font-size:11px;">Page ${p.pageNum}</div>${before}<mark style="background: var(--highlight);">${match}</mark>${after}</div>`;
    }
  }
  if (!out) out = `<div style="color: var(--muted);">No exact match in source. Use the block text to locate the relevant page.</div>`;
  sourceTextEl.innerHTML = out;
}

function handleAction(idx, action) {
  noteInteraction();
  const b = state.blocks[idx];
  const prev = b.status;
  if (action === "approve") {
    if (b.flags?.length && !b.flagsAcknowledged) b.flagsAcknowledged = true;
    b.status = "approved";
  } else if (action === "decline") {
    b.status = "declined";
  } else if (action === "toggle") {
    b.status = b.status === "approved" ? "pending" : "approved";
    if (b.status === "approved" && b.flags?.length) b.flagsAcknowledged = true;
  }
  // record per-block time (since last interaction)
  if (state.perBlockMs[idx] == null && b.status !== "pending") {
    state.perBlockMs[idx] = state.lastInteractionTs ?? performance.now();
  }
  // update DOM
  const el = listEl.children[idx];
  el.classList.toggle("approved", b.status === "approved");
  el.classList.toggle("declined", b.status === "declined");
  el.querySelector('.btn-approve').classList.toggle('active', b.status === 'approved');
  el.querySelector('.btn-decline').classList.toggle('active', b.status === 'declined');
  updateProgress();
}

function init() {
  for (const b of state.blocks) listEl.appendChild(renderBlock(b));
  setFocus(0);
  updateProgress();
}

publishBtn.addEventListener("click", () => {
  state.publishedAtMs = performance.now() - (state.startTs ?? performance.now());
  statusEl.textContent = `PUBLISHED · ${(state.publishedAtMs / 1000).toFixed(1)} s wall · ${state.keystrokes} keys · ${state.pointerEvents} clicks`;
});

document.addEventListener("keydown", (e) => {
  if (e.target?.matches?.("input, textarea")) return;
  state.keystrokes++;
  noteInteraction();
  if (e.key === "j" || e.key === "ArrowDown") {
    e.preventDefault();
    setFocus(Math.min(state.blocks.length - 1, state.focusIdx + 1));
  } else if (e.key === "k" || e.key === "ArrowUp") {
    e.preventDefault();
    setFocus(Math.max(0, state.focusIdx - 1));
  } else if (e.key === "a") {
    handleAction(state.focusIdx, "approve");
    setFocus(Math.min(state.blocks.length - 1, state.focusIdx + 1));
  } else if (e.key === "d") {
    handleAction(state.focusIdx, "decline");
  } else if (e.key === "Enter") {
    updateSourcePanel();
  }
});

init();
