/**
 * Phase 63 (FUSE-01) -- the Start merge, drawn with the Web Animations API (sketch 010, play()).
 *
 * Lazy module: only fuse.ts imports it, and only through import('./fuse-engine'). It draws
 * fixed-position nodes into the root layout's empty #fuse-layer, so the merge keeps playing
 * while the route changes underneath it. Every duration and the easing are read from the
 * --dur-fuse-* / --ease-fuse tokens; colours come from the paper and ink tokens. No node
 * takes pointer events, so the focus screen is usable the moment it appears.
 *
 * The five stages: the button's ink body fades leaving the word start (white to ink) while
 * the screen goes to paper; the SOP chip drops into line; the two slide together; the tape
 * slides in from the left; the finished wordmark rises into the focus top bar.
 */
import type { FuseInput } from './fuse'

const ms = (cs: CSSStyleDeclaration, name: string): number => {
  const v = cs.getPropertyValue(name).trim()
  const n = parseFloat(v)
  return Number.isFinite(n) ? (v.endsWith('ms') ? n : n * 1000) : 0
}
const sleep = (t: number) => new Promise<void>((r) => setTimeout(r, t))

const FIXED = 'position:fixed;pointer-events:none;'

/** `onCovered` fires once the screen has faded to paper (stage 1 over): the moment to navigate. */
export async function run({ chip, label, button, mode, factor }: FuseInput, onCovered: () => void): Promise<void> {
  const root = document.documentElement
  const cs = getComputedStyle(root)
  const layer = document.getElementById('fuse-layer') ?? document.body
  const k = factor * (mode === 'short' ? parseFloat(cs.getPropertyValue('--fuse-short-scale')) || 1 : 1)
  const T = {
    fade: ms(cs, '--dur-fuse-fade') * k,
    drop: ms(cs, '--dur-fuse-drop') * k,
    shift: ms(cs, '--dur-fuse-shift') * k,
    tape: ms(cs, '--dur-fuse-tape') * k,
    hold: ms(cs, '--dur-fuse-hold') * k,
    rise: ms(cs, '--dur-fuse-rise') * k,
  }
  const ease = cs.getPropertyValue('--ease-fuse').trim()
  const paper = cs.getPropertyValue('--paper').trim()
  const ink = cs.getPropertyValue('--wm-ink').trim()
  const srcButton = document.querySelector('[data-fuse="button"]')
  const radius = srcButton ? getComputedStyle(srcButton).borderRadius : cs.getPropertyValue('--radius-lg').trim()

  root.dataset.fuse = 'on'
  const veil = document.createElement('div')
  veil.style.cssText = `${FIXED}inset:0;z-index:1;background:${paper};opacity:0;`
  const body = document.createElement('div')
  body.style.cssText = `${FIXED}z-index:2;background:${ink};border-radius:${radius};left:${button.left}px;top:${button.top}px;width:${button.width}px;height:${button.height}px;`
  const box = document.createElement('span')
  box.className = 'wm wm-merge'
  box.style.cssText = `${FIXED}z-index:3;left:0;top:0;transform-origin:0 0;`
  box.innerHTML = '<span class="wm-sop">SOP</span><span class="wm-start">start</span>'
  layer.append(veil, body, box)
  const p1 = box.querySelector('.wm-sop') as HTMLElement
  const p2 = box.querySelector('.wm-start') as HTMLElement
  let target: HTMLElement | null = null

  try {
    // The finished wordmark sits on the label's row, centred between where the two pieces began.
    const r0 = box.getBoundingClientRect()
    const q2 = p2.getBoundingClientRect()
    box.style.left = `${(chip.left + label.left + label.width) / 2 - r0.width / 2}px`
    box.style.top = `${label.top - (q2.top - r0.top)}px`
    const d1 = p1.getBoundingClientRect()
    const d2 = p2.getBoundingClientRect()
    const w = box.getBoundingClientRect()
    const ax = chip.left - d1.left
    const ay = chip.top - d1.top
    const bx = label.left - d2.left
    const by = label.top - d2.top
    const total = T.fade + T.drop + T.shift
    const o1 = T.fade / total
    const o2 = (T.fade + T.drop) / total
    const inkNow = getComputedStyle(p2).color

    veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.fade, fill: 'forwards' }).finished.then(onCovered, onCovered)
    body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T.fade, fill: 'forwards' })
    p1.animate(
      [
        { transform: `translate(${ax}px,${ay}px)`, offset: 0 },
        { transform: `translate(${ax}px,${ay}px)`, offset: o1, easing: ease },
        { transform: `translate(${ax}px,0px)`, offset: o2, easing: ease },
        { transform: 'none', offset: 1 },
      ],
      { duration: total, fill: 'forwards' },
    )
    p2.animate(
      [
        { transform: `translate(${bx}px,${by}px)`, color: paper, offset: 0 },
        { transform: `translate(${bx}px,${by}px)`, color: inkNow, offset: o1 },
        { transform: `translate(${bx}px,${by}px)`, color: inkNow, offset: o2, easing: ease },
        { transform: 'none', color: inkNow, offset: 1 },
      ],
      { duration: total, fill: 'forwards' },
    )
    try {
      box.animate([{ transform: `translateX(${-(w.left + w.width + 24)}px)` }, { transform: 'translateX(0)' }], {
        pseudoElement: '::after',
        duration: T.tape,
        delay: total,
        easing: ease,
        fill: 'both',
      })
    } catch {
      /* older browsers: the tape is simply there */
    }
    await sleep(total + T.tape + T.hold)

    // The focus screen mounts its wordmark slot while this plays; wait for it (timers, not rAF: hidden tabs).
    for (let waited = 0; waited < 2500 && !(target = document.querySelector<HTMLElement>('[data-wm-target]')); waited += 16) await sleep(16)
    body.remove()
    if (!target) {
      console.warn('[fuse] target not found')
      await veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T.rise, fill: 'forwards' }).finished
      return
    }
    target.style.visibility = 'hidden'
    const cur = box.getBoundingClientRect()
    const tgt = target.getBoundingClientRect()
    veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T.rise, fill: 'forwards' })
    await box.animate(
      [{ transform: 'none' }, { transform: `translate(${tgt.left - cur.left}px,${tgt.top - cur.top}px) scale(${tgt.height / cur.height})` }],
      { duration: T.rise, easing: ease, fill: 'forwards' },
    ).finished
  } finally {
    if (target) target.style.visibility = ''
    veil.remove()
    body.remove()
    box.remove()
    delete root.dataset.fuse
  }
}
