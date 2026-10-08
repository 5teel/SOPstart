'use client'

/**
 * Phase 57 (D-08, D-22, PLC-05): add, rename, recolour and remove departments
 * from the site editor -- no departments screen. A department is a name and a
 * colour; its zone stays the hull of its machines. Remove is refused by the
 * server while a machine, a SOP visibility rule, a person or a library item
 * still uses it.
 */
import { useState } from 'react'
import { archiveDepartment, createDepartment, updateDepartment } from '@/actions/departments'
import { areaColourVar } from '@/lib/library/areas'
import { DEPT_COLOURS } from '@/lib/site/departments'
import type { SiteDepartment } from '@/lib/validators/site'

interface DepartmentsStripProps {
  departments: SiteDepartment[]
  onChanged(): void
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function DepartmentRow({ dept, areaIndex, onChanged }: { dept: SiteDepartment; areaIndex: number; onChanged(): void }) {
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

  async function pickColour(colour: (typeof DEPT_COLOURS)[number]) {
    if (colour === dept.colour) return
    setPending(true)
    setMessage(null)
    const result = await updateDepartment({ id: dept.id, colour })
    setPending(false)
    if ('error' in result) {
      setMessage("Couldn't change the colour - try again")
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
    <div data-testid="dept-strip-row" data-dept-id={dept.id} className="flex flex-col gap-2 rounded-lg border border-ink-200 p-3">
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
      <div className="flex flex-wrap gap-1.5">
        {DEPT_COLOURS.map((colour) => (
          <button
            key={colour}
            type="button"
            data-testid="dept-strip-colour"
            data-colour={colour}
            aria-label={`Colour ${colour}`}
            aria-pressed={colour === dept.colour}
            disabled={pending}
            onClick={() => void pickColour(colour)}
            className={`h-6 w-6 rounded-full border ${colour === dept.colour ? 'border-ink-900' : 'border-ink-200'}`}
            style={{ backgroundColor: colour }}
          />
        ))}
      </div>
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

export function DepartmentsStrip({ departments, onChanged }: DepartmentsStripProps) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  // Same order the map names its areas in (name order), so a department keeps its map colour.
  const areaOrder = [...departments].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))

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
      <h2 className="text-ui font-medium text-ink-900">Departments</h2>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {areaOrder.map((d, i) => (
          <DepartmentRow key={`${d.id}:${d.name}:${d.colour}`} dept={d} areaIndex={i} onChanged={onChanged} />
        ))}
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
