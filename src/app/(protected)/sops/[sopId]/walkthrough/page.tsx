import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ sopId: string }>
}

export default async function WalkthroughPage({ params }: Props) {
  const { sopId } = await params
  redirect(`/sops/${sopId}?tab=walkthrough`)
}
