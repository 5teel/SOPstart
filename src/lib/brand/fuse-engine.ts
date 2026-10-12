/**
 * ADR-0012 -- the start merge, drawn with the Web Animations API, in the SOP's pane.
 *
 * Lazy module: only fuse.ts imports it, and only through import('./fuse-engine'). It draws
 * fixed-position nodes into the root layout's empty #fuse-layer over the pane's box. Every
 * duration and the easing are read from the --dur-fuse-* / --ease-fuse tokens; colours come
 * from the paper and ink tokens. No node takes pointer events.
 *
 * The five stages (ADR-0012 table): lift (the pane goes to paper, the button's ink body fades
 * leaving the word start), gather (SOP and start travel to the pane's centre and grow to hero
 * size), arm (the tape sweeps in), say (full only: one line under it), settle (the wordmark
 * shrinks into the run bar's [data-wm-target] while the veil lifts). Any tap or key skips to the end.
 */
import type { FuseInput } from './fuse'

const ms = (cs: CSSStyleDeclaration, name: string): number => {
  const v = cs.getPropertyValue(name).trim()
  const n = parseFloat(v)
  return Number.isFinite(n) ? (v.endsWith('ms') ? n : n * 1000) : 0
}

const FIXED = 'position:fixed;pointer-events:none;'
/** A real wait (not cut short by a skip): used to poll for the run bar. */
const poll = (t: number) => new Promise<void>((r) => setTimeout(r, t))
export const CAPTION = 'Every tick is saved to your record'

/** `onCovered` runs once the pane is paper (stage 1 over); the settle waits for it to resolve. */
export async function run({ chip, label, button, pane, mode, factor }: FuseInput, onCovered: () => Promise<void>): Promise<void> {
  const root = document.documentElement
  const cs = getComputedStyle(root)
  const layer = document.getElementById('fuse-layer') ?? document.body
  const short = mode === 'short'
  const k = factor * (short ? parseFloat(cs.getPropertyValue('--fuse-short-scale')) || 1 : 1)
  const T = {
    fade: ms(cs, '--dur-fuse-fade') * factor,
    gather: ms(cs, '--dur-fuse-gather') * k,
    tape: ms(cs, '--dur-fuse-tape') * k,
    hold: short ? 0 : ms(cs, '--dur-fuse-hold') * factor,
    rise: ms(cs, '--dur-fuse-rise') * k,
  }
  const ease = cs.getPropertyValue('--ease-fuse').trim()
  const paper = cs.getPropertyValue('--paper').trim()
  const ink = cs.getPropertyValue('--wm-ink').trim()
  const heroMax = parseFloat(cs.getPropertyValue('--fuse-hero-max')) || pane.width
  const srcButton = document.querySelector('[data-fuse="button"]')
  const radius = srcButton ? getComputedStyle(srcButton).borderRadius : cs.getPropertyValue('--radius-lg').trim()

  // Skip: any press or key cuts every stage short.
  let skipped = false
  let wake: () => void = () => {}
  const anims: Animation[] = []
  const skip = () => {
    skipped = true
    anims.forEach((a) => a.finish())
    wake()
  }
  const sleep = (t: number) =>
    skipped ? Promise.resolve() : new Promise<void>((r) => {
      const id = setTimeout(r, t)
      wake = () => (clearTimeout(id), r())
    })
  const play = (el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
    const a = el.animate(frames, opts)
    anims.push(a)
    if (skipped) a.finish()
    return a
  }
  window.addEventListener('pointerdown', skip, true)
  window.addEventListener('keydown', skip, true)

  root.dataset.fuse = 'on'
  const box_ = `left:${pane.left}px;top:${pane.top}px;width:${pane.width}px;height:${pane.height}px;`
  const veil = document.createElement('div')
  veil.style.cssText = `${FIXED}${box_}z-index:1;background:${paper};opacity:0;`
  const body = document.createElement('div')
  body.style.cssText = `${FIXED}z-index:2;background:${ink};border-radius:${radius};left:${button.left}px;top:${button.top}px;width:${button.width}px;height:${button.height}px;`
  const box = document.createElement('span')
  box.className = 'wm wm-merge'
  box.style.cssText = `${FIXED}z-index:3;left:0;top:0;transform-origin:0 0;`
  box.innerHTML = '<span class="wm-sop">SOP</span><span class="wm-start">start</span>'
  const caption = document.createElement('p')
  caption.className = 'fuse-caption'
  caption.textContent = CAPTION
  caption.style.cssText = `${FIXED}z-index:3;left:${pane.left}px;width:${pane.width}px;text-align:center;opacity:0;`
  layer.append(veil, body, box)
  if (!short) layer.append(caption)
  const p1 = box.querySelector('.wm-sop') as HTMLElement
  const p2 = box.querySelector('.wm-start') as HTMLElement
  for (const p of [p1, p2]) p.style.transformOrigin = '0 0'
  let target: HTMLElement | null = null
  let covered: Promise<void> = Promise.resolve()

  try {
    // Hero size, centred in the pane (a little above centre when the caption sits under it).
    const r0 = box.getBoundingClientRect()
    const s = Math.min(pane.width * (pane.width < 640 ? 0.7 : 0.6), heroMax) / r0.width
    const left = pane.left + pane.width / 2 - (r0.width * s) / 2
    const top = pane.top + pane.height / 2 - (r0.height * s) / 2 - (short ? 0 : r0.height * s * 0.25)
    box.style.left = `${left}px`
    box.style.top = `${top}px`
    box.style.transform = `scale(${s})`
    caption.style.top = `${top + r0.height * s * 1.35}px`

    // Each piece starts exactly over its source on the page (the chip; the word inside the button).
    const from = (p: HTMLElement, src: DOMRect) => {
      const d = p.getBoundingClientRect()
      return `translate(${(src.left - d.left) / s}px,${(src.top - d.top) / s}px) scale(${src.height / d.height})`
    }
    const a1 = from(p1, chip)
    const a2 = from(p2, label)
    const total = T.fade + T.gather
    const o1 = T.fade / total
    const inkNow = getComputedStyle(p2).color

    covered = new Promise<void>((resolve) => {
      play(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: T.fade, fill: 'forwards' }).finished.then(
        () => onCovered().then(resolve, resolve),
        () => onCovered().then(resolve, resolve),
      )
    })
    play(body, [{ opacity: 1 }, { opacity: 0 }], { duration: T.fade, fill: 'forwards' })
    play(p1, [{ transform: a1, offset: 0 }, { transform: a1, offset: o1, easing: ease }, { transform: 'none', offset: 1 }], { duration: total, fill: 'forwards' })
    play(
      p2,
      [
        { transform: a2, color: paper, offset: 0 },
        { transform: a2, color: inkNow, offset: o1, easing: ease },
        { transform: 'none', color: inkNow, offset: 1 },
      ],
      { duration: total, fill: 'forwards' },
    )
    try {
      play(box, [{ transform: `translateX(${-(left + r0.width * s + 24) / s}px)` }, { transform: 'translateX(0)' }], {
        pseudoElement: '::after',
        duration: T.tape,
        delay: total,
        easing: ease,
        fill: 'both',
      })
    } catch {
      /* older browsers: the tape is simply there */
    }
    if (!short) play(caption, [{ opacity: 0 }, { opacity: 1 }], { duration: T.fade, delay: total + T.tape, fill: 'forwards' })
    await sleep(total + T.tape + T.hold)

    // The run bar appears once the server has opened the run; wait for both (timers, not rAF: hidden tabs).
    await covered
    for (let waited = 0; waited < 1500 && !(target = document.querySelector<HTMLElement>('[data-wm-target]')); waited += 16) await poll(16)
    body.remove()
    if (!target) {
      // Refused: no run bar to settle into, so nothing pretends to be recorded.
      play(box, [{ opacity: 1 }, { opacity: 0 }], { duration: T.fade, fill: 'forwards' })
      await play(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: T.fade, fill: 'forwards' }).finished
      return
    }
    target.style.visibility = 'hidden'
    const cur = box.getBoundingClientRect()
    const tgt = target.getBoundingClientRect()
    play(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: T.rise, fill: 'forwards' })
    play(caption, [{ opacity: 1 }, { opacity: 0 }], { duration: T.fade, fill: 'forwards' })
    await play(
      box,
      [{ transform: `scale(${s})` }, { transform: `translate(${tgt.left - cur.left}px,${tgt.top - cur.top}px) scale(${(s * tgt.height) / cur.height})` }],
      { duration: T.rise, easing: ease, fill: 'forwards' },
    ).finished
  } finally {
    window.removeEventListener('pointerdown', skip, true)
    window.removeEventListener('keydown', skip, true)
    await covered
    if (target) target.style.visibility = ''
    veil.remove()
    body.remove()
    box.remove()
    caption.remove()
    delete root.dataset.fuse
  }
}
