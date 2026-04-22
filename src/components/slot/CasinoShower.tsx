/**
 * CasinoShower — Matter.js physics + premium WebGL-grade Canvas2D renderer
 *
 * Industry-standard casino particle rain:
 *  - Real 2D rigid-body physics (gravity, bounce, friction, angular velocity)
 *  - Coins: 3D perspective flip via cos(angle) scaleX, metallic radial gradient,
 *           ridged edge, center emboss relief, specular highlight sweep
 *  - Casino chips: 8 alternating color segments, gold edge guards, inner ring, center circle
 *  - Dice: rounded rect, 3D shaded top face, ivory body, embossed pip layout
 *  - Motion blur trails (last 5 positions alpha-blended)
 *  - Per-particle glow (screen composite)
 *  - 90 bodies, 60fps RAF, graceful fade-out
 */

import { memo, useEffect, useRef, useCallback } from 'react'
import Matter from 'matter-js'

// ─── Types ───────────────────────────────────────────────────────────────────

type PType = 'coin' | 'chip' | 'die'

interface Trail { x: number; y: number }

interface ParticleMeta {
  type:      PType
  trail:     Trail[]
  face:      number       // dice face value 1–6
  chipColor: string       // main chip color
  size:      number
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const GOLD_EDGE  = '#8a6000'
const GOLD_DARK  = '#b8860b'
const GOLD_MID   = '#daa520'
const GOLD_LIGHT = '#ffd700'
const GOLD_SPEC  = '#fffbe0'

const CHIP_PALETTES = [
  { main: '#c0392b', contrast: '#ffffff' }, // Vegas red
  { main: '#1a5276', contrast: '#f0d060' }, // Casino navy / gold
  { main: '#1e8449', contrast: '#ffffff' }, // Green
  { main: '#6c3483', contrast: '#f0d060' }, // Purple
  { main: '#212121', contrast: '#ffd700' }, // Black premium
]

const PARTICLE_COUNT = 90
const SPAWN_DURATION = 2800   // ms
const TOTAL_DURATION = 4200   // ms
const FADE_START     = 3400   // ms

// ─── Dice pip layout (normalised –0.4..0.4 on each face) ─────────────────────

const PIPS: [number, number][][] = [
  [],
  [[0, 0]],
  [[-0.35, -0.35], [0.35, 0.35]],
  [[-0.35, -0.35], [0, 0], [0.35, 0.35]],
  [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]],
  [[-0.35, -0.35], [0.35, -0.35], [0, 0], [-0.35, 0.35], [0.35, 0.35]],
  [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0], [0.35, 0], [-0.35, 0.35], [0.35, 0.35]],
]

// ─── Utility ─────────────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ─── Draw: Coin ──────────────────────────────────────────────────────────────

function drawCoin(
  ctx: CanvasRenderingContext2D,
  body: Matter.Body,
  meta: ParticleMeta,
  alpha: number
) {
  const { x, y } = body.position
  const r         = meta.size / 2

  // 3D flip via cos — makes coin appear to spin on Y axis
  const flipX  = Math.cos(body.angle * 2)
  const absFlip = Math.abs(flipX)
  const isFront = flipX >= 0

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate(body.angle)
  ctx.scale(absFlip < 0.06 ? 0.06 : absFlip, 1)

  // Drop shadow
  ctx.shadowColor   = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur    = 12
  ctx.shadowOffsetY = 5

  // Milled rim — 2px wider, darker gold
  ctx.beginPath()
  ctx.arc(0, 0, r + 2, 0, Math.PI * 2)
  ctx.fillStyle = GOLD_EDGE
  ctx.fill()
  ctx.shadowBlur = 0

  // Metallic face gradient
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.04, 0, 0, r)
  if (isFront) {
    grad.addColorStop(0,    GOLD_SPEC)
    grad.addColorStop(0.25, GOLD_LIGHT)
    grad.addColorStop(0.65, GOLD_MID)
    grad.addColorStop(1,    GOLD_DARK)
  } else {
    grad.addColorStop(0,    '#d4c08a')
    grad.addColorStop(0.4,  '#c9a227')
    grad.addColorStop(0.8,  '#a0780e')
    grad.addColorStop(1,    '#7a5500')
  }
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()

  // Notched rim marks
  ctx.strokeStyle = GOLD_EDGE
  ctx.lineWidth   = 1.4
  const notches   = 28
  for (let i = 0; i < notches; i++) {
    const a  = (i / notches) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * (r - 1.5), Math.sin(a) * (r - 1.5))
    ctx.lineTo(Math.cos(a) * (r + 1.5), Math.sin(a) * (r + 1.5))
    ctx.stroke()
  }

  // Center symbol
  if (absFlip > 0.3) {
    ctx.font         = `bold ${Math.round(r * 0.78)}px serif`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = isFront ? GOLD_EDGE : '#7a5500'
    ctx.fillText(isFront ? '$' : '★', 0, 1)
  }

  // Specular arc — premium metallic sheen
  if (absFlip > 0.18) {
    const spec = ctx.createLinearGradient(-r * 0.55, -r * 0.65, r * 0.1, r * 0.15)
    spec.addColorStop(0, `rgba(255,255,240,${0.55})`)
    spec.addColorStop(1, 'rgba(255,255,240,0)')
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 0.62, r * 0.62, -0.5, 0, Math.PI * 2)
    ctx.fillStyle = spec
    ctx.fill()
  }

  ctx.restore()
}

// ─── Draw: Casino Chip ───────────────────────────────────────────────────────

function drawChip(
  ctx: CanvasRenderingContext2D,
  body: Matter.Body,
  meta: ParticleMeta,
  alpha: number
) {
  const { x, y } = body.position
  const r         = meta.size / 2
  const palette   = CHIP_PALETTES.find(p => p.main === meta.chipColor) ?? CHIP_PALETTES[0]!

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate(body.angle)

  // Drop shadow
  ctx.shadowColor   = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur    = 14
  ctx.shadowOffsetY = 6

  // Gold outer rim
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  const rimG = ctx.createLinearGradient(-r, -r, r, r)
  rimG.addColorStop(0,   GOLD_LIGHT)
  rimG.addColorStop(0.5, GOLD_MID)
  rimG.addColorStop(1,   GOLD_DARK)
  ctx.fillStyle = rimG
  ctx.fill()
  ctx.shadowBlur = 0

  // 8 alternating segments
  const segR = r * 0.82
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2 - Math.PI / 2
    const a1 = ((i + 1) / 8) * Math.PI * 2 - Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, segR, a0, a1)
    ctx.closePath()
    ctx.fillStyle = i % 2 === 0 ? palette.main : palette.contrast
    ctx.fill()
  }

  // Inner ring (white with gold border)
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2)
  ctx.fillStyle = '#f8f4ec'
  ctx.fill()
  ctx.strokeStyle = GOLD_MID
  ctx.lineWidth   = 1.8
  ctx.stroke()

  // Center disc
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2)
  ctx.fillStyle = palette.main
  ctx.fill()

  // Center icon
  ctx.font         = `${Math.round(r * 0.4)}px sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle    = palette.contrast
  ctx.fillText('🎰', 0, 1)

  // Specular highlight
  const spec = ctx.createRadialGradient(-r * 0.28, -r * 0.28, 0, 0, 0, r)
  spec.addColorStop(0,   'rgba(255,255,255,0.38)')
  spec.addColorStop(0.5, 'rgba(255,255,255,0.04)')
  spec.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = spec
  ctx.fill()

  ctx.restore()
}

// ─── Draw: Dice ──────────────────────────────────────────────────────────────

function drawDice(
  ctx: CanvasRenderingContext2D,
  body: Matter.Body,
  meta: ParticleMeta,
  alpha: number
) {
  const { x, y } = body.position
  const s         = meta.size
  const h         = s / 2
  const cr        = s * 0.16

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate(body.angle)

  // Drop shadow
  ctx.shadowColor   = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur    = 10
  ctx.shadowOffsetY = 5

  // Body — ivory with 3D shading
  roundRect(ctx, -h, -h, s, s, cr)
  const bodyG = ctx.createLinearGradient(-h, -h, h, h)
  bodyG.addColorStop(0,   '#fffef5')
  bodyG.addColorStop(0.55, '#f5f0e0')
  bodyG.addColorStop(1,    '#d4c990')
  ctx.fillStyle = bodyG
  ctx.fill()
  ctx.shadowBlur = 0

  // Subtle 3D top-left shine
  roundRect(ctx, -h, -h, s, s, cr)
  const faceG = ctx.createLinearGradient(-h, -h, h * 0.4, h * 0.4)
  faceG.addColorStop(0, 'rgba(255,255,255,0.42)')
  faceG.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = faceG
  ctx.fill()

  // Border
  roundRect(ctx, -h, -h, s, s, cr)
  ctx.strokeStyle = '#8a7d50'
  ctx.lineWidth   = 1.5
  ctx.stroke()

  // Pips
  const pipR = s * 0.10
  const pips = PIPS[meta.face] ?? PIPS[1]!
  for (const [px, py] of pips!) {
    const cx = px * s * 0.42
    const cy = py * s * 0.42

    // Emboss shadow
    ctx.beginPath()
    ctx.arc(cx + 1, cy + 1, pipR, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.fill()

    // Pip — red for 1 (classic), black for rest
    ctx.beginPath()
    ctx.arc(cx, cy, pipR, 0, Math.PI * 2)
    ctx.fillStyle = meta.face === 1 ? '#c0392b' : '#1a1a1a'
    ctx.fill()
  }

  ctx.restore()
}

// ─── Component ───────────────────────────────────────────────────────────────

interface CasinoShowerProps {
  active:      boolean
  onComplete?: () => void
}

export const CasinoShower = memo(function CasinoShower({ active, onComplete }: CasinoShowerProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const rafRef     = useRef<number>(0)
  const startRef   = useRef<number>(0)

  const spawnOne = useCallback((engine: Matter.Engine, w: number) => {
    const type: PType = Math.random() < 0.42 ? 'coin' : Math.random() < 0.55 ? 'chip' : 'die'
    const size        = type === 'die'  ? 22 + Math.random() * 14
                      : type === 'coin' ? 24 + Math.random() * 18
                      :                   28 + Math.random() * 16

    const body = type === 'die'
      ? Matter.Bodies.rectangle(
          Math.random() * w, -size - 20,
          size, size,
          { restitution: 0.60, friction: 0.15, frictionAir: 0.008, label: 'die',
            angle: Math.random() * Math.PI * 2 }
        )
      : Matter.Bodies.circle(
          Math.random() * w, -size / 2 - 20,
          size / 2,
          { restitution: 0.72, friction: 0.07, frictionAir: 0.005, label: type }
        )

    Matter.Body.setVelocity(body, {
      x: (Math.random() - 0.5) * 7,
      y: 3.5 + Math.random() * 5,
    })
    Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.35)

    const palette = CHIP_PALETTES[Math.floor(Math.random() * CHIP_PALETTES.length)]!
    const meta: ParticleMeta = {
      type,
      trail:     [],
      face:      Math.floor(Math.random() * 6) + 1,
      chipColor: palette.main,
      size,
    }

    Matter.World.add(engine.world, body)
    return { body, meta }
  }, [])

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx   = canvas.getContext('2d')!
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    const W = canvas.width
    const H = canvas.height

    const engine = Matter.Engine.create({ gravity: { y: 1.4 } })
    const metaMap = new Map<number, ParticleMeta>()

    // Invisible walls
    const wo = { isStatic: true, restitution: 0.5, friction: 0.3 }
    Matter.World.add(engine.world, [
      Matter.Bodies.rectangle(-30,    H / 2, 60,    H * 3, wo),
      Matter.Bodies.rectangle(W + 30, H / 2, 60,    H * 3, wo),
      Matter.Bodies.rectangle(W / 2,  H + 30, W * 2, 60,  wo),
    ])

    startRef.current = performance.now()
    let lastSpawn    = -999
    const spawnGap   = SPAWN_DURATION / PARTICLE_COUNT

    const loop = (now: number) => {
      const elapsed = now - startRef.current

      // Spawn
      if (elapsed < SPAWN_DURATION && elapsed - lastSpawn > spawnGap) {
        const { body, meta } = spawnOne(engine, W)
        metaMap.set(body.id, meta)
        lastSpawn = elapsed
      }

      // Global alpha for fade
      const globalAlpha = elapsed > FADE_START
        ? Math.max(0, 1 - (elapsed - FADE_START) / (TOTAL_DURATION - FADE_START))
        : 1

      if (elapsed >= TOTAL_DURATION) {
        cancelAnimationFrame(rafRef.current)
        Matter.Engine.clear(engine)
        Matter.World.clear(engine.world, false)
        metaMap.clear()
        onComplete?.()
        return
      }

      // Physics step
      Matter.Engine.update(engine, 1000 / 60)

      ctx.clearRect(0, 0, W, H)

      // ── Glow pass (additive blending) ──────────────────────
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = globalAlpha
      for (const body of engine.world.bodies) {
        if (body.isStatic) continue
        const meta = metaMap.get(body.id)
        if (!meta) continue
        const { x, y } = body.position
        const gr = ctx.createRadialGradient(x, y, 0, x, y, meta.size * 0.7)
        gr.addColorStop(0,   'rgba(255,210,50,0.22)')
        gr.addColorStop(1,   'rgba(255,180,0,0)')
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.arc(x, y, meta.size * 0.7, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      // ── Motion trails ──────────────────────────────────────
      ctx.save()
      ctx.globalAlpha = globalAlpha
      for (const body of engine.world.bodies) {
        if (body.isStatic) continue
        const meta = metaMap.get(body.id)
        if (!meta) continue

        meta.trail.push({ x: body.position.x, y: body.position.y })
        if (meta.trail.length > 5) meta.trail.shift()

        for (let t = 0; t < meta.trail.length - 1; t++) {
          const ta = ((t + 1) / meta.trail.length) * 0.22
          ctx.beginPath()
          ctx.moveTo(meta.trail[t]!.x, meta.trail[t]!.y)
          ctx.lineTo(meta.trail[t + 1]!.x, meta.trail[t + 1]!.y)
          ctx.strokeStyle = `rgba(255,215,0,${ta})`
          ctx.lineWidth   = meta.size * 0.28
          ctx.lineCap     = 'round'
          ctx.stroke()
        }
      }
      ctx.restore()

      // ── Particle draw ──────────────────────────────────────
      for (const body of engine.world.bodies) {
        if (body.isStatic) continue
        const meta = metaMap.get(body.id)
        if (!meta) continue
        if      (meta.type === 'coin') drawCoin(ctx, body, meta, globalAlpha)
        else if (meta.type === 'chip') drawChip(ctx, body, meta, globalAlpha)
        else                           drawDice(ctx, body, meta, globalAlpha)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      Matter.Engine.clear(engine)
      Matter.World.clear(engine.world, false)
      metaMap.clear()
    }
  }, [active, spawnOne, onComplete])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'fixed',
        inset:         0,
        zIndex:        2100,
        pointerEvents: 'none',
      }}
    />
  )
})

export default CasinoShower
