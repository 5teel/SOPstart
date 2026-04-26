'use client'
import { useContext, useState } from 'react'
import { z } from 'zod'
import { SopBlockContext } from '@/components/sop/SopBlockContext'
import { useWalkthroughStore } from '@/stores/walkthrough'
import { dispatchEscalationAlert, lockStep, submitEscalationReport } from '@/actions/escalation'
import { EscalationFormModal } from '@/components/sop/EscalationFormModal'

export const EscalateBlockPropsSchema = z.object({
  title: z.string().min(1).max(120).default('Escalate'),
  reason: z.string().max(500).optional(),
  escalationMode: z.enum(['alert', 'lock', 'form']).default('form'),
  recipients: z
    .array(z.enum(['supervisor', 'safety_manager', 'admin']))
    .optional(),
})
export type EscalateBlockProps = z.infer<typeof EscalateBlockPropsSchema>

export function EscalateBlock({
  title = 'Escalate',
  reason,
  escalationMode = 'form',
  recipients,
}: EscalateBlockProps) {
  const ctx = useContext(SopBlockContext)
  const lockStepInStore = useWalkthroughStore((s) => s.lockStep)
  const [modalOpen, setModalOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleClick = async () => {
    if (!ctx) return
    setStatus('sending')
    try {
      if (escalationMode === 'alert') {
        await dispatchEscalationAlert({
          sopId: ctx.sopId,
          sectionId: ctx.sectionId,
          stepId: ctx.stepId,
          completionId: ctx.completionId,
          reason,
          recipients,
        })
        setStatus('sent')
      } else if (escalationMode === 'lock') {
        await lockStep({
          sopId: ctx.sopId,
          sectionId: ctx.sectionId,
          stepId: ctx.stepId,
          completionId: ctx.completionId,
        })
        if (ctx.stepId) lockStepInStore(ctx.stepId)
        setStatus('sent')
      } else {
        // form mode — open modal
        setStatus('idle')
        setModalOpen(true)
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <section
      className="mb-4 border-2 rounded-xl p-5"
      style={{
        borderColor: 'var(--accent-escalate)',
        background: 'color-mix(in srgb, var(--accent-escalate) 8%, white)',
      }}
      data-block="escalate"
      data-escalation-mode={escalationMode}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: 'var(--accent-escalate)' }}
        >
          Escalate · {escalationMode}
        </span>
      </div>
      <strong className="text-base font-semibold">{title}</strong>
      {reason && (
        <p className="text-sm mt-2" style={{ color: 'var(--ink-700, #374151)' }}>
          {reason}
        </p>
      )}
      {recipients && recipients.length > 0 && (
        <p className="text-xs mt-2" style={{ color: 'var(--ink-500, #6b7280)' }}>
          Notifies: {recipients.join(', ')}
        </p>
      )}
      <button
        type="button"
        className="mt-3 px-4 py-2 rounded-lg border text-sm font-medium"
        style={{
          borderColor: 'var(--accent-escalate)',
          color: status === 'sent' ? 'white' : 'var(--accent-escalate)',
          background: status === 'sent' ? 'var(--accent-escalate)' : 'white',
        }}
        data-escalate-trigger
        onClick={handleClick}
        disabled={status === 'sending' || status === 'sent'}
      >
        {status === 'sent'
          ? 'Escalated ✓'
          : status === 'sending'
          ? 'Sending…'
          : status === 'error'
          ? 'Retry escalation'
          : 'Escalate now'}
      </button>
      {status === 'error' && (
        <p className="text-xs mt-2" style={{ color: 'var(--accent-escalate)' }}>
          Failed to escalate. Please try again.
        </p>
      )}
      {!ctx && (
        <p className="text-xs mt-2 opacity-50" style={{ color: 'var(--ink-500)' }}>
          (Escalation requires walkthrough context)
        </p>
      )}
      {modalOpen && ctx && (
        <EscalationFormModal
          onClose={() => setModalOpen(false)}
          onSubmit={async (payload) => {
            await submitEscalationReport({
              sopId: ctx.sopId,
              sectionId: ctx.sectionId,
              stepId: ctx.stepId,
              completionId: ctx.completionId,
              ...payload,
            })
            setModalOpen(false)
            setStatus('sent')
          }}
        />
      )}
    </section>
  )
}
