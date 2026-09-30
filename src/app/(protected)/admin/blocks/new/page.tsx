import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getSessionContext } from '@/lib/auth/session-context'
import { listBlockCategories } from '@/actions/blocks'
import { NewBlockForm } from './NewBlockForm'

export const metadata: Metadata = {
  title: 'New content',
}

export default async function NewBlockPage() {
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  const categories = await listBlockCategories()

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10 bg-[var(--paper)] min-h-screen">
      <div className="mb-4">
        <Link
          href="/admin/blocks"
          className="inline-flex items-center gap-1 text-sm text-[var(--ink-500)] hover:text-[var(--ink-900)]"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Content Library
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-[var(--ink-900)] mb-6">New content</h1>
      <NewBlockForm categories={categories} />
    </div>
  )
}
