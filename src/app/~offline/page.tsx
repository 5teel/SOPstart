import { PRODUCT_NAME } from '@/lib/constants'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-steel-900 text-steel-100 p-6">
      <div className="text-brand-yellow text-4xl font-bold mb-4">
        {PRODUCT_NAME}
      </div>
      <h1 className="text-xl font-semibold mb-2">You are offline</h1>
      <p className="text-steel-400 text-center max-w-sm">
        This page is not available offline. Your cached SOPs and saved progress are still accessible from the home screen.
      </p>
    </div>
  )
}
