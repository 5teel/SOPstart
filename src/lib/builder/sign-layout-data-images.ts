import type { SupabaseClient } from '@supabase/supabase-js'

const SIGNED_TTL_SEC = 3600

type SrcCarrier = { src?: unknown }
type ItemList = { items?: SrcCarrier[]; photos?: SrcCarrier[]; src?: unknown }

function isRawStoragePath(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0 && !/^https?:/i.test(s) && !s.startsWith('data:') && !s.startsWith('blob:')
}

export async function signLayoutDataImages(
  supabase: SupabaseClient,
  sop: { sop_sections?: Array<{ layout_data?: unknown }> }
): Promise<void> {
  const refs: Array<{ obj: SrcCarrier; path: string }> = []

  for (const section of sop.sop_sections ?? []) {
    const ld = section.layout_data as
      | { content?: Array<{ type?: string; props?: ItemList }> }
      | null
      | undefined
    if (!ld?.content) continue
    for (const block of ld.content) {
      const props = block.props
      if (!props) continue
      if (isRawStoragePath(props.src)) {
        refs.push({ obj: props as SrcCarrier, path: props.src })
      }
      for (const p of props.photos ?? []) {
        if (isRawStoragePath(p.src)) {
          refs.push({ obj: p, path: p.src })
        }
      }
      for (const it of props.items ?? []) {
        if (isRawStoragePath(it.src)) {
          refs.push({ obj: it, path: it.src })
        }
      }
    }
  }
  if (refs.length === 0) return

  const paths = refs.map((r) => r.path)
  const { data } = await supabase.storage.from('sop-images').createSignedUrls(paths, SIGNED_TTL_SEC)
  if (!data) return

  for (let i = 0; i < refs.length; i++) {
    const signed = data[i]?.signedUrl
    if (signed) refs[i].obj.src = signed
  }
}
