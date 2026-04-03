'use client'

import { useState, useRef } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { SopTable, containsMarkdownTable } from '@/components/sop/SopTable'
import type { SopSection, SopStep, SopImage } from '@/types/sop'

interface SectionEditorProps {
  section: SopSection & { sop_steps: SopStep[]; sop_images: SopImage[] }
  sopId: string
  onApprovalChange: () => void
}

export default function SectionEditor({
  section,
  sopId,
  onApprovalChange,
}: SectionEditorProps) {
  const [mode, setMode] = useState<'read' | 'edit'>('read')
  const [approved, setApproved] = useState(section.approved)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [approving, setApproving] = useState(false)
  const [editContent, setEditContent] = useState(section.content ?? '')
  const [editSteps, setEditSteps] = useState<{ id: string; text: string }[]>(
    section.sop_steps.map((s) => ({ id: s.id, text: s.text }))
  )
  const firstTextareaRef = useRef<HTMLTextAreaElement>(null)

  const isStepsSection = section.section_type === 'steps'

  const enterEdit = () => {
    setEditContent(section.content ?? '')
    setEditSteps(section.sop_steps.map((s) => ({ id: s.id, text: s.text })))
    setMode('edit')
    // autoFocus is handled by the ref on mount below
    setTimeout(() => firstTextareaRef.current?.focus(), 0)
  }

  const cancelEdit = () => {
    setMode('read')
  }

  const saveChanges = async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (isStepsSection) {
        body.steps = editSteps
      } else {
        body.content = editContent
      }

      const res = await fetch(`/api/sops/${sopId}/sections/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        // Content edit resets approval
        setApproved(false)
        onApprovalChange()
        setMode('read')
        // Flash "Saved" for 2s
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  const approveSection = async () => {
    if (mode === 'edit') return // guard handled by unsaved-edits message
    setApproving(true)
    try {
      const res = await fetch(`/api/sops/${sopId}/sections/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      })
      if (res.ok) {
        setApproved(true)
        onApprovalChange()
      }
    } finally {
      setApproving(false)
    }
  }

  const undoApproval = async () => {
    const res = await fetch(`/api/sops/${sopId}/sections/${section.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: false }),
    })
    if (res.ok) {
      setApproved(false)
      onApprovalChange()
    }
  }

  const addStep = () => {
    setEditSteps((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, text: '' },
    ])
  }

  const removeStep = (idx: number) => {
    setEditSteps((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateStepText = (idx: number, text: string) => {
    setEditSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, text } : s))
    )
  }

  return (
    <div
      className={[
        'bg-steel-800 rounded-lg border-l-4 mb-4 overflow-hidden transition-colors',
        approved ? 'border-green-500' : 'border-steel-700',
      ].join(' ')}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-steel-700">
        <span className="text-sm font-semibold text-steel-100 uppercase tracking-wide">
          {section.title || section.section_type}
        </span>
        <div className="flex items-center gap-2">
          {savedFlash && (
            <span className="text-xs text-green-400 font-medium">Saved ✓</span>
          )}
          {approved && (
            <CheckCircle2 className="text-green-400" size={18} />
          )}
        </div>
      </div>

      {/* Card body */}
      {mode === 'read' ? (
        <div className="px-4 py-4 hover:bg-steel-700/20 cursor-text transition-colors">
          {isStepsSection ? (
            <ol className="list-decimal list-inside space-y-3">
              {section.sop_steps.map((step) => (
                <li key={step.id} className="text-base text-steel-100">
                  {step.text}
                  {step.warning && (
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-brand-orange/20 text-brand-orange text-xs font-semibold rounded uppercase">
                      WARNING: {step.warning}
                    </span>
                  )}
                  {step.caution && (
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-brand-orange/20 text-brand-orange text-xs font-semibold rounded uppercase">
                      CAUTION: {step.caution}
                    </span>
                  )}
                </li>
              ))}
              {section.sop_steps.length === 0 && (
                <p className="text-sm text-steel-400 italic">No steps parsed yet.</p>
              )}
            </ol>
          ) : (
            section.content ? (
              containsMarkdownTable(section.content)
                ? <SopTable markdown={section.content} />
                : <p className="text-base text-steel-100 leading-relaxed whitespace-pre-wrap">{section.content}</p>
            ) : (
              <p className="text-sm text-steel-400 italic">No content parsed.</p>
            )
          )}

          {/* Inline images */}
          {section.sop_images && section.sop_images.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {section.sop_images.map((img) => (
                <img
                  key={img.id}
                  src={img.storage_path}
                  alt={img.alt_text ?? 'SOP figure'}
                  className="rounded-md max-w-full object-contain max-h-48 my-2 border border-steel-700"
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Edit mode body */
        <div className="px-4 py-4">
          {isStepsSection ? (
            <div className="space-y-3">
              {editSteps.map((step, idx) => (
                <div key={step.id} className="flex items-start gap-2">
                  <span className="text-sm font-mono text-steel-400 w-6 flex-shrink-0 mt-3">
                    {idx + 1}.
                  </span>
                  <textarea
                    ref={idx === 0 ? firstTextareaRef : undefined}
                    value={step.text}
                    onChange={(e) => updateStepText(idx, e.target.value)}
                    className="flex-1 bg-steel-900 border border-brand-yellow/50 rounded-lg text-base text-steel-100 leading-relaxed p-3 resize-y focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 min-h-[72px]"
                  />
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    className="text-steel-400 hover:text-red-400 mt-3 text-lg leading-none"
                    aria-label="Remove step"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addStep}
                className="text-brand-yellow text-sm hover:text-amber-400 mt-2"
              >
                + Add step
              </button>
            </div>
          ) : (
            <>
              <textarea
                ref={firstTextareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-steel-900 border border-brand-yellow/50 rounded-lg text-base text-steel-100 leading-relaxed p-3 resize-y focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 min-h-[120px]"
              />
              {containsMarkdownTable(editContent) && (
                <p className="text-xs text-steel-400 mt-1">
                  Edit as markdown table (| Col1 | Col2 |). The table will render with formatting when you save.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Card footer */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-steel-700 bg-steel-900/50">
        {mode === 'read' ? (
          approved ? (
            <>
              <span className="text-green-400 text-sm font-semibold flex items-center gap-1">
                <CheckCircle2 size={16} /> Approved ✓
              </span>
              <button
                type="button"
                onClick={undoApproval}
                className="text-xs text-steel-400 hover:text-steel-100 underline ml-auto"
              >
                Undo approval
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={enterEdit}
                className="h-[72px] px-5 bg-steel-700 text-steel-100 font-semibold rounded-lg hover:bg-steel-600 text-sm"
              >
                Edit section
              </button>
              <button
                type="button"
                onClick={approveSection}
                disabled={approving}
                className="h-[72px] px-5 bg-brand-yellow text-steel-900 font-bold rounded-lg hover:bg-amber-400 text-sm disabled:opacity-60"
              >
                {approving ? 'Approving…' : 'Approve section'}
              </button>
            </>
          )
        ) : (
          <>
            <button
              type="button"
              onClick={saveChanges}
              disabled={saving}
              className="h-[72px] px-5 bg-brand-yellow text-steel-900 font-bold rounded-lg hover:bg-amber-400 text-sm disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="h-[72px] px-5 bg-steel-700 text-steel-100 font-semibold rounded-lg hover:bg-steel-600 text-sm"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
