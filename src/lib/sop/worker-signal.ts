/**
 * The published library row the home list reads (Phase 63). The per-SOP
 * classifiers that used to live here (pins, panel states, the Now queue) went with
 * the rooms (ADR-0005); the home shows no due / refresher state (ADR-0004 rule 2).
 *
 * Plain module, no directive -- a type only, importable from client and server code.
 */

/** The published library row a worker card reads. */
export type WorkerSopRow = {
  id: string
  title: string | null
  sop_number: string | null
  category_slug: string | null
  department: string | null
  published_at: string | null
  /** 'site' = a site-wide SOP; kept in sync by a trigger, never written by the UI. */
  placement?: 'machine' | 'site' | null
}
