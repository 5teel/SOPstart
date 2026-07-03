import type { SupabaseClient } from '@supabase/supabase-js'

const SIGNED_TTL_SEC = 3600

type SrcCarrier = { src?: unknown; bakedSrc?: unknown }
type ItemList = { items?: SrcCarrier[]; photos?: SrcCarrier[]; src?: unknown }

function isRawStoragePath(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0 && !/^https?:/i.test(s) && !s.startsWith('data:') && !s.startsWith('blob:')
}

export async function signLayoutDataImages(
  supabase: SupabaseClient,
  sop: { sop_sections?: Array<{ layout_data?: unknown }> }
): Promise<void> {
  // `key` lets one carrier hold two signable refs (a diagram item signs both its
  // raw `src` AND its baked PNG `bakedSrc` — 26-13). Assignment writes back the
  // signed URL to that exact key.
  const refs: Array<{ obj: SrcCarrier; key: 'src' | 'bakedSrc'; path: string }> = []

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
        refs.push({ obj: props as SrcCarrier, key: 'src', path: props.src })
      }
      for (const p of props.photos ?? []) {
        if (isRawStoragePath(p.src)) {
          refs.push({ obj: p, key: 'src', path: p.src })
        }
      }
      for (const it of props.items ?? []) {
        if (isRawStoragePath(it.src)) {
          refs.push({ obj: it, key: 'src', path: it.src })
        }
        // 26-13: the baked diagram PNG is a private sop-images path too — sign it
        // so the worker's baked <img> resolves (D-03/R8 Konva-free read path).
        if (isRawStoragePath(it.bakedSrc)) {
          refs.push({ obj: it, key: 'bakedSrc', path: it.bakedSrc })
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
    if (signed) refs[i].obj[refs[i].key] = signed
  }
}
