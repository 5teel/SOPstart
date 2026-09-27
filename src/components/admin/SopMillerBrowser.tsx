'use client'

/**
 * Sketch 005 variant C — the middle and right columns of the Miller layout.
 *
 * Scope (the left column) stays server-rendered: changing scope SHOULD refetch,
 * so it is plain Links and the URL carries it. Selecting a SOP must not — it is
 * the hot path, and a search-param push would fire an RSC request through the
 * service worker for every click (CLAUDE.md [2026-05-13]). So selection lives
 * in client state here, and the detail pane renders from data the list already
 * carries. No query runs when you click a row.
 *
 * /sops is a portal to USE a SOP — an admin opening one from here wants the
 * SOP as a worker sees it (read / walk it), not the editor. So the primary
 * action everywhere is the worker view; the builder is the "Edit" side door in
 * the detail pane, the single list→builder chain (SUR-04).
 *
 * Below `lg` there is no room for three columns: the detail pane is dropped and
 * a row becomes a direct link to the worker view. Admin work is desktop-first
 * (Visy interview), but the page must still work on a phone rather than merely
 * not crash on one.
 *
 * Renders as `contents` so the two columns are direct grid children of the
 * page's Miller frame — one flush surface, the same rows and headers the
 * worker list uses (SopWorkerBrowser), not a second styled list.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, PencilLine } from 'lucide-react'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { DepartmentPicker } from '@/components/admin/departments/DepartmentPicker'
import { setSopCategory } from '@/actions/sops'
import { SOP_CATEGORIES } from '@/lib/sop-categories'
import type { SopStatus, Department } from '@/types/sop'
import type { MillerSop } from '@/lib/sop-list/admin-rows'

export type { MillerSop }

const SORTED_CATEGORIES = [...SOP_CATEGORIES].sort((a, b) => a.sort - b.sort)

/** Mirrors the scope column's header so the three columns share one baseline. */
function ColumnHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mono sticky top-0 z-10 hidden items-center gap-2 border-b border-[var(--ink-200)] bg-[var(--paper-2)] px-3 py-2 text-meta uppercase tracking-widest text-[var(--ink-500)] lg:flex">
      {children}
    </h2>
  )
}

/** Second line of a row: category · departments · owner, whichever exist. */
function rowMeta(sop: MillerSop): string {
  const dept = sop.allDepartments ? 'All departments' : sop.departments.join(', ')
  return [sop.categoryLabel, dept, sop.ownerLabel].filter(Boolean).join(' · ')
}

export function SopMillerBrowser({
  sops,
  scopeLabel,
  departments,
  hideStatus,
  query = '',
  onClearFilter,
}: {
  sops: MillerSop[]
  scopeLabel: string
  /** Pre-fetched by the page — the detail pane never fetches. */
  departments: Department[]
  /** The scope's own status: rows don't repeat it as a chip (2026-09-15 readability review). */
  hideStatus?: string
  /** The live search term, for the empty message only — the lens filters. */
  query?: string
  /** Present when the list is a server-side collection filter; renders the way back. */
  onClearFilter?: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // First row selected until you pick another — the detail pane is never blank.
  const selected = sops.find((s) => s.id === selectedId) ?? sops[0] ?? null

  return (
    <div className="contents">
      {/* ── Middle column: the list ─────────────────────────────── */}
      <div className="min-w-0 lg:overflow-y-auto lg:border-r lg:border-[var(--ink-200)]">
        <ColumnHeader>
          <span>{scopeLabel}</span>
          <span className="text-[var(--ink-300)]">— {sops.length}</span>
          {onClearFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="ml-auto normal-case tracking-normal text-[var(--ink-700)] underline hover:text-[var(--ink-900)]"
            >
              Clear filter
            </button>
          )}
        </ColumnHeader>

        {sops.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
            <p className="text-sm font-semibold text-[var(--ink-900)]">
              {query ? `Nothing matches “${query}”` : `Nothing in ${scopeLabel}`}
            </p>
            <p className="text-xs text-[var(--ink-500)]">
              {query ? 'Try a shorter word.' : 'Pick another scope on the left.'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2 lg:gap-0">
            {sops.map((sop) => {
              const isSelected = sop.id === selected?.id
              return (
                <li key={sop.id}>
                  {/* Desktop: select into the detail pane, no navigation. */}
                  <button
                    type="button"
                    onClick={() => setSelectedId(sop.id)}
                    data-testid="miller-row"
                    data-selected={isSelected ? 'true' : undefined}
                    className={`hidden w-full items-center gap-3 border-b border-[var(--ink-100)] px-3 py-2 text-left transition-colors lg:flex ${
                      isSelected ? 'bg-[var(--ink-900)]' : 'hover:bg-[var(--paper-2)]'
                    }`}
                  >
                    <RowBody sop={sop} hideStatus={hideStatus} selected={isSelected} />
                  </button>

                  {/* Below lg there is no detail column, so the row is the link — to the SOP, not the editor. */}
                  <Link
                    href={`/sops/${sop.id}`}
                    className="flex min-h-tap-glove w-full items-center gap-3 rounded-lg border border-[var(--ink-100)] bg-white px-4 py-3 lg:hidden"
                  >
                    <RowBody sop={sop} hideStatus={hideStatus} selected={false} />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── Right column: detail ────────────────────────────────── */}
      <aside className="hidden overflow-y-auto bg-[var(--paper-2)] lg:block">
        <ColumnHeader>Selected</ColumnHeader>
        <div className="p-4">
          {!selected ? (
            <p className="py-8 text-center text-sm text-[var(--ink-500)]">
              Pick a SOP to see its detail here.
            </p>
          ) : (
            <>
              <p
                className={`text-reading font-bold leading-snug ${
                  selected.untitled ? 'italic text-[var(--ink-700)]' : 'text-[var(--ink-900)]'
                }`}
              >
                {selected.displayTitle}
              </p>
              <div className="mb-3 mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={selected.status as SopStatus} />
                {selected.flagLabel && (
                  <span className={`mono inline-block rounded px-1.5 py-0.5 text-meta ${selected.flagStyle ?? ''}`}>
                    {selected.flagLabel}
                  </span>
                )}
              </div>

              {/* The primary action sits above the facts and opens the SOP as
                  a worker sees it. Edit is the one list→builder chain (SUR-04). */}
              <div className="mb-1.5 flex gap-2">
                <Link
                  href={`/sops/${selected.id}`}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--ink-900)] px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                >
                  <BookOpen size={14} aria-hidden="true" />
                  Open
                </Link>
                <Link
                  href={`/admin/sops/builder/${selected.id}`}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--ink-300)] bg-[var(--paper-1)] px-3 py-2.5 text-sm text-[var(--ink-700)] hover:border-[var(--ink-900)] hover:text-[var(--ink-900)]"
                >
                  <PencilLine size={14} aria-hidden="true" />
                  Edit
                </Link>
              </div>
              <Link
                href={`/admin/sops/${selected.id}/versions`}
                className="mb-4 block text-center text-meta text-[var(--ink-500)] underline-offset-2 hover:text-[var(--ink-900)] hover:underline"
              >
                Version history
              </Link>

              {/* The two fields that are most often missing are editable HERE.
                  The detail pane is where you notice the gap, so bouncing to
                  the builder to change one field is the trip this layout
                  exists to remove. Everything else stays read-only. */}
              <CategoryField key={`cat-${selected.id}`} sop={selected} />
              <DepartmentField key={`dept-${selected.id}`} sop={selected} departments={departments} />

              <dl>
                <Field label="Owner" value={selected.ownerLabel} />
                <Field label="Updated" value={selected.age === 'today' ? 'today' : `${selected.age} ago`} />
                {selected.confidence !== null && (
                  <Field label="Parse" value={`${Math.round(selected.confidence * 100)}% confident`} />
                )}
              </dl>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

/** `hideStatus`: the scope's own status — a chip that repeats the scope on every row is noise (2026-09-15 readability review). */
function RowBody({ sop, hideStatus, selected }: { sop: MillerSop; hideStatus?: string; selected: boolean }) {
  const meta = rowMeta(sop)
  return (
    <>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-ui font-semibold ${
            sop.untitled ? 'italic' : ''
          } ${selected ? 'text-white' : sop.untitled ? 'text-[var(--ink-700)]' : 'text-[var(--ink-900)]'}`}
          title={sop.untitled ? `Untitled — showing the file name: ${sop.displayTitle}` : sop.displayTitle}
        >
          {sop.displayTitle}
        </span>
        {meta && (
          <span className={`mono block truncate text-meta ${selected ? 'text-white/70' : 'text-[var(--ink-500)]'}`}>
            {meta}
          </span>
        )}
      </span>
      {sop.stuck && (
        <span className={`mono flex-shrink-0 rounded px-1.5 py-0.5 text-meta ${selected ? 'bg-white/20 text-white' : 'bg-accent-escalate/20 text-accent-escalate'}`}>
          Stuck
        </span>
      )}
      {sop.flagLabel && !sop.stuck && (
        <span className={`mono flex-shrink-0 rounded px-1.5 py-0.5 text-meta ${selected ? 'bg-white/20 text-white' : sop.flagStyle ?? ''}`}>
          {sop.flagLabel}
        </span>
      )}
      {sop.status !== hideStatus && (
        <span className={selected ? 'flex-shrink-0 [&>span]:bg-white/20 [&>span]:text-white' : 'flex-shrink-0'}>
          <StatusBadge status={sop.status as SopStatus} />
        </span>
      )}
      <span className={`mono w-9 flex-shrink-0 text-right text-meta ${selected ? 'text-white/70' : 'text-[var(--ink-500)]'}`}>
        {sop.age}
      </span>
    </>
  )
}

/**
 * Category, editable in place.
 *
 * `router.refresh()` after the write, NOT before: the scope counts and the
 * row's own chips are server-rendered, so a save has to re-run the page to
 * stay honest — assigning a department while filtered to "No department"
 * should drop the row out of the list. This is the ONLY navigation in this
 * component; selecting a SOP must never trigger one (CLAUDE.md [2026-05-13]).
 */
function CategoryField({ sop }: { sop: MillerSop }) {
  const router = useRouter()
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [value, setValue] = useState(sop.categorySlug ?? '')

  return (
    <div className="mb-2 border-b border-dotted border-[var(--ink-200)] pb-2">
      <label className="mb-1 block text-meta text-[var(--ink-500)]" htmlFor={`cat-${sop.id}`}>
        Category
      </label>
      <select
        id={`cat-${sop.id}`}
        data-testid="miller-category-select"
        value={value}
        disabled={saving}
        onChange={(e) => {
          const next = e.target.value || null
          setValue(e.target.value)
          setError(null)
          startSaving(async () => {
            const res = await setSopCategory(sop.id, next)
            if ('error' in res) {
              setError(res.error)
              setValue(sop.categorySlug ?? '')
              return
            }
            router.refresh()
          })
        }}
        className="w-full rounded border border-[var(--ink-300)] bg-white px-2 py-1.5 text-xs text-[var(--ink-900)] disabled:opacity-60"
      >
        <option value="">— Not set —</option>
        {SORTED_CATEGORIES.map((c) => (
          <option key={c.slug} value={c.slug}>{c.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-meta text-accent-escalate">{error}</p>}
    </div>
  )
}

/**
 * Department, editable in place. DepartmentPicker in `sop` mode with a real
 * sopId and localOnly OFF writes through assignSopDepartments itself — the
 * grant-backed path (D-11), never a direct sop_departments insert.
 */
function DepartmentField({
  sop,
  departments,
}: {
  sop: MillerSop
  departments: Department[]
}) {
  const router = useRouter()

  if (departments.length === 0) return null

  return (
    <div className="mb-3 border-b border-dotted border-[var(--ink-200)] pb-2">
      <p className="mb-1 text-meta text-[var(--ink-500)]">Department</p>
      {sop.departments.length === 0 && !sop.allDepartments && (
        <p className="mb-1 rounded border border-accent-decision/30 bg-accent-decision/10 px-2 py-1 text-xs text-accent-decision">
          Not set — nobody can be assigned this.
        </p>
      )}
      <DepartmentPicker
        mode="sop"
        sopId={sop.id}
        departments={departments}
        selectedIds={sop.departmentIds}
        allDepartments={sop.allDepartments}
        onChange={() => router.refresh()}
      />
    </div>
  )
}

/** A detail row. Renders "Not set" muted rather than hiding — an absent
 *  department is the thing an admin most needs to notice. */
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2 border-b border-dotted border-[var(--ink-200)] py-1.5 text-xs last:border-b-0">
      <dt className="w-tap-row flex-shrink-0 text-meta text-[var(--ink-500)]">{label}</dt>
      <dd className={`min-w-0 flex-1 ${value ? 'text-[var(--ink-900)]' : 'text-[var(--ink-300)]'}`}>
        {value ?? 'Not set'}
      </dd>
    </div>
  )
}
