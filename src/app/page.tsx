import { PRODUCT_NAME, PRODUCT_DESCRIPTION } from '@/lib/constants'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-steel-900 p-8">
      <h1 className="text-4xl font-bold text-brand-yellow mb-4">{PRODUCT_NAME}</h1>
      <p className="text-steel-400 text-lg">{PRODUCT_DESCRIPTION}</p>
    </main>
  )
}
