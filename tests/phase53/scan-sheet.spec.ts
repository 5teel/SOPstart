/**
 * Phase 53 -- PHN-03. Source-contract tests for the scan sheet: back
 * camera, BarcodeDetector then jsqr fallback, origin check before
 * navigation, track teardown, code-entry fallback, dynamic-only loading.
 * Plus a behavioural decode round trip for the jsqr path (RESEARCH
 * Pitfall 4 -- the path every iPhone takes must be proven, not assumed).
 *
 * Registration: playwright.config.ts `phase53` project
 *   testDir: '.', testMatch: /tests\/phase53\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase53`
 *
 * Static @/ imports only -- CLAUDE.md 2026-06-24.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import jsQR from 'jsqr'
import QRCode from 'qrcode'
import { extractMachineCode } from '@/lib/site/qr-decode'

const ROOT = path.resolve(__dirname, '..', '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

function functionBody(src: string, name: string): string {
  const sigIdx = src.indexOf(`function ${name}(`)
  if (sigIdx === -1) return ''
  const braceStart = src.indexOf('{', sigIdx)
  if (braceStart === -1) return ''
  let depth = 0
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++
    if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(braceStart, i + 1)
    }
  }
  return src.slice(braceStart)
}

function listFiles(dir: string, out: string[] = []): string[] {
  const full = path.join(ROOT, dir)
  if (!fs.existsSync(full)) return out
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      listFiles(entryPath, out)
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      out.push(entryPath)
    }
  }
  return out
}

test.describe('ScanSheet', () => {
  const raw = read('src/components/sop/plant/ScanSheet.tsx')
  const code = stripComments(raw)

  test('getUserMedia requests facingMode: "environment", video only, no audio', () => {
    expect(code).toContain("facingMode: 'environment'")
    expect(code).toContain('audio: false')
    expect(code).not.toContain('audio: true')
  })

  test('BarcodeDetector is tried first when available in window, jsqr only as a fallback', () => {
    const detectorIdx = code.indexOf('BarcodeDetector')
    const jsqrIdx = code.indexOf("import('jsqr')")
    expect(detectorIdx).toBeGreaterThan(-1)
    expect(jsqrIdx).toBeGreaterThan(-1)
    expect(detectorIdx).toBeLessThan(jsqrIdx)
  })

  test('jsqr is loaded only via a dynamic import() inside ScanSheet, never a static import', () => {
    expect(code).toContain("await import('jsqr')")
    expect(code).not.toMatch(/^import .*from ['"]jsqr['"]/m)
    const hits: string[] = []
    for (const f of listFiles('src')) {
      if (path.resolve(f) === path.resolve('src/components/sop/plant/ScanSheet.tsx')) continue
      const text = read(f)
      if (text.includes('jsqr')) hits.push(f)
    }
    expect(hits).toEqual([])
  })

  test('a decoded value is validated with extractMachineCode(text, window.location.origin) before any navigation', () => {
    expect(code).toContain('extractMachineCode(text, window.location.origin)')
    const pushMatches = code.match(/router\.push\(/g) ?? []
    expect(pushMatches.length).toBe(1)
    expect(code).toContain('router.push(`/m/${code}`)')
    expect(code).toMatch(/const go = useCallback\(\s*\(code: string\) => \{[\s\S]*?router\.push\(`\/m\/\$\{code\}`\)/)
  })

  test('normaliseMachineCode feeds go() on the typed path', () => {
    expect(code).toMatch(/const code = normaliseMachineCode\(typed\)/)
    expect(code).toMatch(/normaliseMachineCode\(typed\)[\s\S]{0,40}if \(code\) \{\s*go\(code\)/)
  })

  test('stopCamera stops every track and is called from the mount cleanup, go, closeSheet and typeInstead', () => {
    expect(code).toContain('getTracks()')
    expect(code).toContain('.stop()')
    // called sites
    const stopCameraCallSites = code.match(/stopCamera\(\)/g) ?? []
    // definition itself does not call stopCamera(), so every match here is a call site
    expect(stopCameraCallSites.length).toBeGreaterThanOrEqual(4)
    expect(code).toMatch(/cancelled = true\s*\n\s*stopCamera\(\)/)
    const goBody = code.slice(code.indexOf('const go = useCallback'), code.indexOf('const go = useCallback') + 300)
    expect(goBody).toContain('stopCamera()')
    const closeSheetBody = functionBody(code, 'closeSheet')
    expect(closeSheetBody).toContain('stopCamera()')
    const typeInsteadBody = functionBody(code, 'typeInstead')
    expect(typeInsteadBody).toContain('stopCamera()')
  })

  test('NotAllowedError leads to typing mode; the 200ms scan throttle is present with its clear', () => {
    expect(code).toMatch(/NotAllowedError[\s\S]{0,400}setMode\('typing'\)/)
    expect(code).toContain('window.setTimeout(tick, 200)')
    expect(code).toContain('window.clearTimeout')
  })

  test('scan-type-instead is rendered outside the typing branch; the code-entry controls and close button are present; the foreign-plate message appears once', () => {
    expect(code).toContain('data-testid="scan-type-instead"')
    expect(code).toContain('data-testid="scan-code-entry"')
    expect(code).toContain('data-testid="scan-code-go"')
    expect(code).toContain('data-testid="scan-close"')
    const plateMsgMatches = code.match(/That's not a SOPstart plate/g) ?? []
    expect(plateMsgMatches.length).toBe(1)
  })

  test('no frame ever leaves the phone -- no fetch, no image export, no upload; video is inline and muted', () => {
    expect(code).not.toContain('fetch(')
    expect(code).not.toContain('toDataURL')
    expect(code).not.toContain('toBlob')
    expect(code).not.toContain('upload')
    expect(code).toContain('playsInline')
    expect(code).toContain('muted')
  })

  test('no Set/Map mutation or storage API (plant-dir discipline, phase52 D-05/D-06)', () => {
    expect(code).not.toMatch(/\.add\(|\.delete\(|\.put\(|\.bulkPut\(|localStorage|sessionStorage/)
  })

  test('decodes a QR built from a real plate URL with jsqr and round-trips through extractMachineCode', async () => {
    const origin = 'https://sopstart.com'
    const plateUrl = `${origin}/m/7K2M9Q`
    const qr = QRCode.create(plateUrl, { errorCorrectionLevel: 'M' })
    const modules = qr.modules
    const scale = 4
    const margin = 4
    const size = (modules.size + margin * 2) * scale
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255)
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (!modules.get(row, col)) continue
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = (col + margin) * scale + dx
            const py = (row + margin) * scale + dy
            const idx = (py * size + px) * 4
            pixels[idx] = 0
            pixels[idx + 1] = 0
            pixels[idx + 2] = 0
            pixels[idx + 3] = 255
          }
        }
      }
    }
    const decoded = jsQR(pixels, size, size, { inversionAttempts: 'dontInvert' })
    expect(decoded).not.toBeNull()
    expect(decoded?.data).toBe(plateUrl)
    const code = extractMachineCode(decoded!.data, origin)
    expect(code).toBe('7K2M9Q')
  })

  test('a foreign-origin plate QR decodes but does not validate as ours', async () => {
    const foreignUrl = 'https://evil.example.com/m/7K2M9Q'
    const qr = QRCode.create(foreignUrl, { errorCorrectionLevel: 'M' })
    const modules = qr.modules
    const scale = 4
    const margin = 4
    const size = (modules.size + margin * 2) * scale
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255)
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (!modules.get(row, col)) continue
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = (col + margin) * scale + dx
            const py = (row + margin) * scale + dy
            const idx = (py * size + px) * 4
            pixels[idx] = 0
            pixels[idx + 1] = 0
            pixels[idx + 2] = 0
            pixels[idx + 3] = 255
          }
        }
      }
    }
    const decoded = jsQR(pixels, size, size, { inversionAttempts: 'dontInvert' })
    expect(decoded).not.toBeNull()
    const code = extractMachineCode(decoded!.data, 'https://sopstart.com')
    expect(code).toBeNull()
  })
})

// PhoneHome wiring (Scan button, dynamic-only loading, bundle marker) --
// activates 53-05 Task 2.
test.describe('PhoneHome — scan sheet wiring', () => {
  test.fixme('activates 53-05 Task 2: ScanSheet is referenced only via next/dynamic with ssr: false', () => {})
  test.fixme('activates 53-05 Task 2: phone-scan button opens the sheet; ScanSheet is mounted only while open', () => {})
  test.fixme('activates 53-05 Task 2: JSX order is phone-thumb, then phone-scan, then "Everything else"', () => {})
  test.fixme('activates 53-05 Task 2: no other file in src references ScanSheet, and neither ScanSheet nor jsqr appear in /sops/page.tsx', () => {})
  test.fixme('activates 53-05 Task 2: scripts/check-bundle-size.ts carries the scan sheet marker group on both gated routes', () => {})
})
