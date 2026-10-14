'use client'

/**
 * Phase 57 (D-08, D-22, PLC-05): add, rename and remove departments
 * from the site editor -- no departments screen. A department is a name; its
 * colour is its map area colour by order (ADR-0013 retired the picker: an admin
 * could paint a department a safety-sign colour). Its zone stays the hull of its machines. Remove is refused by the
 * server while a machine, a SOP visibility rule, a person or a library item
 * still uses it.
 *
 * ADR-0010: a department can sit inside another one (the site map draws it as a
 * sub-area you reach by clicking its parent), and the org picks how the map packs
 * its areas.
 */
import { useState } from 'react'
import { archiveDepartment, createDepartment, updateDepartment } from '@/actions/departments'
import { setSiteMapPacking } from '@/actions/site-map'
import { areaColourVar, deptPath } from '@/lib/library/areas'
import { DEPT_COLOURS } from '@/lib/site/departments'
import type { SiteDepartment } from '@/lib/validators/site'

interface DepartmentsStripProps {
  departments: SiteDepartment[]
  packing: 'balanced' | 'rows'
  onChanged(): void
}

const PACKING_LABEL = { balanced: 'Balanced', rows: 'Rows' } as const

/** Departments in map order: each level by name, sub-areas under their parent. Index i wears --area-(i+1). */
export function treeOrder(departments: SiteDepartment[]): Array<{ dept: SiteDepartment; depth: number }> {
  const raw = new Map(departments.map((d) => [d.id, d.parent_id]))
  const parentOf = (id: string) => deptPath(raw, id).at(-2) ?? null
  const byName = (a: SiteDepartment, b: SiteDepartment) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  const out: Array<{ dept: SiteDepartment; depth: number }> = []
  const walk = (parent: string | null, depth: number) => {
    for (const d of departments.filter((x) => parentOf(x.id) === parent).sort(byName)) {
      out.push({ dept: d, depth })
      walk(d.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function DepartmentRow({ dept, areaIndex, depth, parents, onChanged }: { dept: SiteDepartment; areaIndex: number; depth: number; parents: SiteDepartment[]; onChanged(): void }) {
  const [name, setName] = useState(dept.name)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [refused, setRefused] = useState<string | null>(null)

  async function commitRename() {
    const next = name.trim()
    if (!next) {
      setName(dept.name)
      return
    }
    if (next === dept.name) return
    setPending(true)
    setMessage(null)
    const result = await updateDepartment({ id: dept.id, name: next })
    setPending(false)
    if ('error' in result) {
      setName(dept.name)
      setMessage("Couldn't rename - try again")
      return
    }
    onChanged()
  }

  async function pickParent(parentId: string | null) {
    setPending(true)
    setMessage(null)
    const result = await updateDepartment({ id: dept.id, parentId })
    setPending(false)
    if ('error' in result) {
      setMessage("Couldn't move it - try again")
      return
    }
    onChanged()
  }

  async function handleRemove() {
    setPending(true)
    setMessage(null)
    setRefused(null)
    const result = await archiveDepartment(dept.id)
    setPending(false)
    if ('success' in result) {
      onChanged()
      return
    }
    if (result.machines !== undefined || result.sops !== undefined) {
      setRefused(
        `${dept.name} is still used by ${plural(result.machines ?? 0, 'machine')}, ${plural(result.sops ?? 0, 'SOP rule')}, ${plural(result.blocks ?? 0, 'library item')} and ${result.people === 1 ? '1 person' : `${result.people ?? 0} people`}. Move them first.`,
      )
      return
    }
    setMessage("Couldn't remove - try again")
  }

  return (
    <div data-testid="dept-strip-row" data-dept-id={dept.id} data-depth={depth} className="flex flex-col gap-2 rounded-lg border border-ink-200 p-3">
      <div className="flex items-center gap-2">
        <span data-testid="dept-strip-dot" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: areaColourVar(areaIndex) }} />
        <input
          data-testid="dept-strip-rename"
          aria-label={`Rename ${dept.name}`}
          value={name}
          maxLength={100}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void commitRename()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className="min-h-tap min-w-0 flex-1 rounded-lg border border-ink-300 bg-paper px-3 text-ui text-ink-900"
        />
        <button
          type="button"
          data-testid="dept-strip-remove"
          disabled={pending}
          onClick={() => void handleRemove()}
          className="min-h-tap shrink-0 rounded-lg border border-ink-300 px-3 text-ui text-ink-900 disabled:opacity-40"
        >
          Remove
        </button>
      </div>
      <label className="flex items-center gap-2 text-meta text-ink-600">
        Sits inside
        <select
          data-testid="dept-strip-parent"
          aria-label={`What ${dept.name} sits inside`}
          value={dept.parent_id ?? ''}
          disabled={pending}
          onChange={(e) => void pickParent(e.target.value || null)}
          className="min-h-tap min-w-0 flex-1 rounded-lg border border-ink-300 bg-paper px-2 text-ui text-ink-900"
        >
          <option value="">The whole site</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {refused && (
        <p data-testid="dept-strip-refused" role="alert" className="text-meta text-accent-hazard">
          {refused}
        </p>
      )}
      {message && (
        <p role="alert" className="text-meta text-accent-hazard">
          {message}
        </p>
      )}
    </div>
  )
}

export function DepartmentsStrip({ departments, packing, onChanged }: DepartmentsStripProps) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [packingError, setPackingError] = useState<string | null>(null)
  // Same order the map names its areas in (tree order, by name), so a department keeps its map colour.
  const areaOrder = treeOrder(departments)
  // What a department may not sit inside: itself and its own sub-areas (the rows after it that are deeper).
  const within = (id: string): Set<string> => {
    const out = new Set([id])
    const at = areaOrder.findIndex((x) => x.dept.id === id)
    for (const { dept, depth } of areaOrder.slice(at + 1)) {
      if (depth <= areaOrder[at].depth) break
      out.add(dept.id)
    }
    return out
  }

  async function pickPacking(next: 'balanced' | 'rows') {
    if (next === packing) return
    setPackingError(null)
    const result = await setSiteMapPacking(next)
    if ('error' in result) {
      setPackingError("Couldn't change the map layout - try again")
      return
    }
    onChanged()
  }

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    setAddError(null)
    const colour = DEPT_COLOURS[departments.length % DEPT_COLOURS.length]
    const result = await createDepartment({ name, colour })
    setAdding(false)
    if ('error' in result) {
      setAddError("Couldn't add the department - try again")
      return
    }
    setNewName('')
    onChanged()
  }

  return (
    <div data-testid="dept-strip" className="rounded-lg border border-ink-200 bg-paper-1 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-ui font-medium text-ink-900">Departments</h2>
        <div className="flex items-center gap-2 text-meta text-ink-600">
          Site map layout
          <span className="seg" data-testid="map-packing">
            {(['balanced', 'rows'] as const).map((p) => (
              <button key={p} type="button" data-testid="map-packing-option" data-packing={p} aria-pressed={packing === p} onClick={() => void pickPacking(p)}>
                {PACKING_LABEL[p]}
              </button>
            ))}
          </span>
        </div>
      </div>
      {packingError && (
        <p role="alert" className="mt-2 text-meta text-accent-hazard">
          {packingError}
        </p>
      )}
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {areaOrder.map(({ dept: d, depth }, i) => {
          const blocked = within(d.id)
          return (
            <DepartmentRow
              key={`${d.id}:${d.name}:${d.colour}:${d.parent_id ?? ''}`}
              dept={d}
              areaIndex={i}
              depth={depth}
              parents={departments.filter((p) => !blocked.has(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))}
              onChanged={onChanged}
            />
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          data-testid="dept-strip-add-name"
          aria-label="New department name"
          value={newName}
          maxLength={100}
          placeholder="New department"
          disabled={adding}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleAdd()
          }}
          className="min-h-tap min-w-0 flex-1 rounded-lg border border-ink-300 bg-paper px-3 text-ui text-ink-900"
        />
        <button
          type="button"
          data-testid="dept-strip-add"
          disabled={adding || newName.trim().length === 0}
          onClick={() => void handleAdd()}
          className="min-h-tap shrink-0 rounded-lg bg-ink-900 px-4 text-ui font-medium text-paper disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {addError && (
        <p role="alert" className="mt-2 text-meta text-accent-hazard">
          {addError}
        </p>
      )}
    </div>
  )
}
