/**
 * CasinoField — orbiting casino symbols behind Lucky 7
 *
 * Replaces the older neutral particle constellation with 14 hand-drawn
 * casino symbols (coins, dice, poker chips, stars) that orbit around
 * the screen center on three concentric rings. Sits at z-index 3 so it
 * passes BEHIND the Lucky 7 stage (z-index 4) — symbols visibly tuck
 * behind the 7 as they sweep around, reinforcing the slot-machine
 * stage feeling.
 *
 * Why not PNG sprites:
 *   • Resolution-independent — sharp at any DPR, any orbit radius
 *   • Zero npm/asset cost, zero HTTP requests
 *   • Each symbol gets per-frame tumble rotation cheaply (canvas
 *     transform stack, ~0.3ms / 14 symbols on iPhone 11)
 *   • Easy to retune palette without re-exporting art
 *
 * Each symbol carries:
 *   • orbit ring (radius + angular speed)
 *   • tumble speed (independent rotation around its own center)
 *   • size category (small / mid / hero)
 *   • kind (coin / die / chip / star) — picks draw routine + colors
 *
 * Inputs:
 *   • parallaxFromRef — element exposing --mx / --my CSS vars (.boot)
 *   • reducedMotion — render single static frame, no RAF
 */

import { useEffect, useRef } from 'react'
import styles from './CasinoField.module.css'

/**
 * Shared parallax state object — written by BootScreen's RAF, read by us.
 * Reading off a ref instead of `getComputedStyle()` avoids forcing style
 * recalc on a tree that has perspective + animated CSS vars + mix-blend
 * children. On iOS Safari that recalc was eating ~6ms / frame and showing
 * up as visible flicker on every layer except .sevenStage (which has
 * will-change: transform, filter pinning it to a stable layer).
 */
export interface ParallaxState {
  x: number
  y: number
  tx: number
  ty: number
}

interface CasinoFieldProps {
  parallaxRef: React.RefObject<ParallaxState>
  reducedMotion?: boolean
}

type SymbolKind = 'coin' | 'die' | 'chip' | 'star'

interface OrbitSymbol {
  // Polar home: radius (vmin fraction), base angle, angular speed
  r0: number
  a0: number
  speed: number
  // Self-tumble rotation
  rot: number
  rotSpeed: number
  // Live position (px) + velocity for spring back
  x: number
  y: number
  vx: number
  vy: number
  // Visual
  size: number
  kind: SymbolKind
  // Per-symbol variation parameters
  variant: number  // 0..N — selects color/pip count
}

const SYMBOL_COUNT = 14

function makeSymbols(): OrbitSymbol[] {
  const out: OrbitSymbol[] = []
  const kinds: SymbolKind[] = ['coin', 'die', 'chip', 'star']
  for (let i = 0; i < SYMBOL_COUNT; i++) {
    const ring = i % 3
    const r0 = ring === 0 ? 0.24 : ring === 1 ? 0.36 : 0.48
    const a0 = (i / SYMBOL_COUNT) * Math.PI * 2 + ring * 0.5
    const speed = (ring === 0 ? 0.10 : ring === 1 ? 0.07 : -0.05) * (1 + (i % 5) * 0.04)
    const sizeBase = ring === 0 ? 22 : ring === 1 ? 17 : 13
    out.push({
      r0, a0, speed,
      rot: Math.random() * Math.PI * 2,
      // Coins/chips spin slower, dice tumble faster, stars idle
      rotSpeed: (Math.random() - 0.5) * 1.4,
      x: 0, y: 0, vx: 0, vy: 0,
      size: sizeBase,
      kind: kinds[i % kinds.length]!,
      variant: Math.floor(Math.random() * 6),
    })
  }
  return out
}

// ── Drawing primitives ─────────────────────────────────────────────

/** Rounded rectangle path helper */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** Gold coin with $ stamp + outer rim */
function drawCoin(ctx: CanvasRenderingContext2D, size: number): void {
  // Outer rim (raised, gold)
  const rim = ctx.createRadialGradient(-size * 0.3, -size * 0.3, size * 0.1, 0, 0, size)
  rim.addColorStop(0, '#fff8d0')
  rim.addColorStop(0.45, '#f0d878')
  rim.addColorStop(1, '#8a6010')
  ctx.fillStyle = rim
  ctx.beginPath()
  ctx.arc(0, 0, size, 0, Math.PI * 2)
  ctx.fill()

  // Inner face (sunk, lighter gold)
  const face = ctx.createRadialGradient(-size * 0.2, -size * 0.2, 0, 0, 0, size * 0.7)
  face.addColorStop(0, '#fff8d8')
  face.addColorStop(1, '#d4a843')
  ctx.fillStyle = face
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.72, 0, Math.PI * 2)
  ctx.fill()

  // $ stamp
  ctx.fillStyle = 'rgba(60, 38, 8, 0.85)'
  ctx.font = `900 ${size * 1.0}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('$', 0, size * 0.04)

  // Subtle ring etched between rim and face
  ctx.strokeStyle = 'rgba(140, 90, 20, 0.5)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.78, 0, Math.PI * 2)
  ctx.stroke()
}

/** Single die with N pips drawn */
function drawDie(ctx: CanvasRenderingContext2D, size: number, pips: number): void {
  // Body — white, soft rounded square
  const r = size * 0.22
  const grad = ctx.createLinearGradient(-size, -size, size, size)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(1, '#cfcfd4')
  ctx.fillStyle = grad
  roundRectPath(ctx, -size, -size, size * 2, size * 2, r)
  ctx.fill()

  // Edge stroke for definition
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.lineWidth = 1.4
  ctx.stroke()

  // Pip layout — standard die positions, scaled to die face
  const off = size * 0.5
  const PIP_LAYOUTS: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-off, -off], [off, off]],
    3: [[-off, -off], [0, 0], [off, off]],
    4: [[-off, -off], [off, -off], [-off, off], [off, off]],
    5: [[-off, -off], [off, -off], [0, 0], [-off, off], [off, off]],
    6: [[-off, -off], [off, -off], [-off, 0], [off, 0], [-off, off], [off, off]],
  }
  const pipsToDraw = PIP_LAYOUTS[pips] ?? PIP_LAYOUTS[5]!
  ctx.fillStyle = '#c81810'
  for (const [px, py] of pipsToDraw) {
    ctx.beginPath()
    ctx.arc(px, py, size * 0.16, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Poker chip with 8 perimeter notches + center value */
function drawChip(ctx: CanvasRenderingContext2D, size: number, variant: number): void {
  // Color variants — classic poker chip palette
  const COLORS = [
    { ring: '#22e8ff', text: '100' },  // cyan / mid stake
    { ring: '#b14cff', text: '500' },  // violet / high stake
    { ring: '#dc2626', text: '5'   },  // red / low stake
    { ring: '#16a34a', text: '25'  },  // green
    { ring: '#f0d878', text: '1K'  },  // gold
    { ring: '#08020a', text: '∞'   },  // black / signature
  ]
  const c = COLORS[variant % COLORS.length]!

  // Outer black rim
  ctx.fillStyle = '#08020a'
  ctx.beginPath()
  ctx.arc(0, 0, size, 0, Math.PI * 2)
  ctx.fill()

  // Color disc (slightly inset)
  ctx.fillStyle = c.ring
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.93, 0, Math.PI * 2)
  ctx.fill()

  // 8 white perimeter notches (the classic chip "teeth")
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 8; i++) {
    ctx.save()
    ctx.rotate((i / 8) * Math.PI * 2)
    ctx.fillRect(-size * 0.13, -size * 0.99, size * 0.26, size * 0.18)
    ctx.restore()
  }

  // Inner black ring
  ctx.fillStyle = '#08020a'
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.66, 0, Math.PI * 2)
  ctx.fill()

  // Inner color disc with subtle radial highlight
  const inner = ctx.createRadialGradient(-size * 0.15, -size * 0.15, 0, 0, 0, size * 0.6)
  inner.addColorStop(0, '#ffffff')
  inner.addColorStop(0.4, c.ring)
  inner.addColorStop(1, c.ring)
  ctx.fillStyle = inner
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.58, 0, Math.PI * 2)
  ctx.fill()

  // Center value
  ctx.fillStyle = '#08020a'
  ctx.font = `900 ${size * 0.45}px Inter, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(c.text, 0, size * 0.02)
}

/** 5-pointed star — gold with inner highlight */
function drawStar(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 === 0 ? size : size * 0.42
    const px = Math.cos(angle) * r
    const py = Math.sin(angle) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()

  const grad = ctx.createRadialGradient(-size * 0.2, -size * 0.2, 0, 0, 0, size)
  grad.addColorStop(0, '#fff8e0')
  grad.addColorStop(0.55, '#f0d878')
  grad.addColorStop(1, '#a06808')
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = 'rgba(80, 40, 0, 0.55)'
  ctx.lineWidth = 1
  ctx.stroke()
}

/** Soft glow halo behind a symbol — color tinted by kind */
function drawHalo(
  ctx: CanvasRenderingContext2D,
  size: number, kind: SymbolKind, variant: number,
): void {
  let glow = 'rgba(240, 216, 120, 0.55)'
  if (kind === 'die') glow = 'rgba(255, 80, 60, 0.55)'
  else if (kind === 'chip') {
    const variantGlow = [
      'rgba(34, 232, 255, 0.55)',
      'rgba(177, 76, 255, 0.55)',
      'rgba(220, 38, 38, 0.55)',
      'rgba(22, 163, 74, 0.55)',
      'rgba(240, 216, 120, 0.55)',
      'rgba(120, 120, 120, 0.40)',
    ]
    glow = variantGlow[variant % variantGlow.length]!
  } else if (kind === 'star') glow = 'rgba(255, 248, 200, 0.65)'

  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.2)
  halo.addColorStop(0, glow)
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(0, 0, size * 2.2, 0, Math.PI * 2)
  ctx.fill()
}

// ── Component ──────────────────────────────────────────────────────

export function CasinoField({ parallaxRef, reducedMotion = false }: CasinoFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const symbolsRef = useRef<OrbitSymbol[]>(makeSymbols())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let cw = 0, ch = 0, cx = 0, cy = 0, vmin = 0

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      cw = window.innerWidth
      ch = window.innerHeight
      canvas.width = cw * dpr
      canvas.height = ch * dpr
      canvas.style.width = `${cw}px`
      canvas.style.height = `${ch}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx = cw / 2
      cy = ch / 2
      vmin = Math.min(cw, ch)
    }
    resize()
    window.addEventListener('resize', resize, { passive: true })

    // Seed positions on home orbit
    const symbols = symbolsRef.current
    const startTime = performance.now()
    for (const s of symbols) {
      const r = s.r0 * vmin
      s.x = cx + Math.cos(s.a0) * r
      s.y = cy + Math.sin(s.a0) * r
    }

    let last = startTime

    const tick = () => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const tSec = (now - startTime) / 1000

      // Read parallax target (already lerped by BootScreen) directly off
      // the shared ref — NO getComputedStyle in RAF (forces style recalc).
      const par = parallaxRef.current
      const mx = par?.x ?? 0.5
      const my = par?.y ?? 0.5
      const offsetX = (mx - 0.5) * vmin * 0.16
      const offsetY = (my - 0.5) * vmin * 0.10

      ctx.clearRect(0, 0, cw, ch)

      for (const s of symbols) {
        // Home position on rotating ring + parallax offset
        const a = s.a0 + tSec * s.speed
        const r = s.r0 * vmin
        const homeX = cx + offsetX + Math.cos(a) * r
        const homeY = cy + offsetY + Math.sin(a) * r

        // Spring back integration
        const dx = homeX - s.x
        const dy = homeY - s.y
        const k = 4.5
        const damping = 0.86
        s.vx = (s.vx + dx * k * dt) * damping
        s.vy = (s.vy + dy * k * dt) * damping
        s.x += s.vx * dt
        s.y += s.vy * dt

        // Self-rotation
        s.rot += s.rotSpeed * dt

        // Render: halo, then transform-rotated symbol
        ctx.save()
        ctx.translate(s.x, s.y)
        drawHalo(ctx, s.size, s.kind, s.variant)
        ctx.rotate(s.rot)
        switch (s.kind) {
          case 'coin': drawCoin(ctx, s.size); break
          case 'die':  drawDie(ctx, s.size, (s.variant % 6) + 1); break
          case 'chip': drawChip(ctx, s.size, s.variant); break
          case 'star': drawStar(ctx, s.size); break
        }
        ctx.restore()
      }

      if (!reducedMotion) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    if (reducedMotion) {
      tick()
    } else {
      rafRef.current = requestAnimationFrame(tick)
    }

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [parallaxRef, reducedMotion])

  return <canvas ref={canvasRef} className={styles.field} aria-hidden="true" />
}

export default CasinoField
