/**
 * CasinoShower — Canvas2D casino particle rain
 *
 * Coins, dice, chips fall with gravity + rotation during
 * the splash→slot transition. Pure Canvas2D, zero deps, 60fps.
 */

import { memo, useEffect, useRef } from 'react'

// ── Particle types ──────────────────────────────────────────
type PType = 'coin' | 'chip' | 'die'

interface Particle {
  type: PType
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number    // current angle (rad)
  rotSpeed: number    // rad/frame
  flipPhase: number   // for 3D coin flip illusion
  flipSpeed: number
  opacity: number
  hue: number         // gold shift
  sparkle: number     // sparkle timer
}

// ── Colors ──────────────────────────────────────────────────
const GOLD_LIGHT = '#ffe566'
const GOLD_MID   = '#ffd700'
const GOLD_DARK  = '#b8860b'
const CHIP_COLORS = ['#c9222f', '#1a6bc4', '#1f8a4f', '#222']
const DIE_BG     = '#f5f0e8'

const GRAVITY = 0.28
const PARTICLE_COUNT = 70
const DURATION_MS = 2200

function createParticle(w: number, h: number): Particle {
  const type: PType = Math.random() < 0.5 ? 'coin' : Math.random() < 0.6 ? 'chip' : 'die'
  const size = type === 'die'
    ? 14 + Math.random() * 10
    : type === 'coin'
      ? 16 + Math.random() * 14
      : 18 + Math.random() * 12

  return {
    type,
    x: Math.random() * w,
    y: -size - Math.random() * h * 0.6, // spawn above viewport, staggered
    vx: (Math.random() - 0.5) * 3,
    vy: 1.5 + Math.random() * 3,
    size,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.15,
    flipPhase: Math.random() * Math.PI * 2,
    flipSpeed: 0.06 + Math.random() * 0.08,
    opacity: 0.7 + Math.random() * 0.3,
    hue: -10 + Math.random() * 20,
    sparkle: Math.random() * 100,
  }
}

// ── Draw functions ──────────────────────────────────────────

function drawCoin(ctx: CanvasRenderingContext2D, p: Particle) {
  const { x, y, size, rotation, flipPhase } = p
  const scaleX = Math.cos(flipPhase) // 3D flip illusion
  const absScale = Math.abs(scaleX)

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.scale(scaleX, 1)
  ctx.globalAlpha = p.opacity

  // Main coin body
  const grad = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, size * 0.5)
  grad.addColorStop(0, GOLD_LIGHT)
  grad.addColorStop(0.5, GOLD_MID)
  grad.addColorStop(1, GOLD_DARK)

  ctx.beginPath()
  ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()

  // Inner ring
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,248,200,0.5)'
  ctx.lineWidth = 1.2
  ctx.stroke()

  // $ symbol (only when face is visible enough)
  if (absScale > 0.3) {
    ctx.fillStyle = 'rgba(140,110,30,0.7)'
    ctx.font = `bold ${Math.round(size * 0.38)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('$', 0, 1)
  }

  // Edge highlight (3D depth)
  if (scaleX < 0.2 && scaleX > -0.2) {
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2)
    ctx.strokeStyle = GOLD_DARK
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // Sparkle
  if (Math.sin(p.sparkle) > 0.85) {
    ctx.beginPath()
    ctx.arc(size * 0.15, -size * 0.15, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.globalAlpha = 0.9
    ctx.fill()
  }

  ctx.restore()
}

function drawChip(ctx: CanvasRenderingContext2D, p: Particle) {
  const { x, y, size, rotation } = p
  const color = CHIP_COLORS[Math.floor(p.hue + 15) % CHIP_COLORS.length]!

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha = p.opacity

  // Chip body
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  // Outer ring
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Edge dashes (casino chip pattern)
  const dashCount = 8
  for (let i = 0; i < dashCount; i++) {
    const angle = (i / dashCount) * Math.PI * 2
    const inner = size * 0.38
    const outer = size * 0.5
    ctx.beginPath()
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 2.5
    ctx.stroke()
  }

  // Inner circle
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.restore()
}

function drawDie(ctx: CanvasRenderingContext2D, p: Particle) {
  const { x, y, size, rotation } = p
  const half = size * 0.42
  const r = size * 0.08

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha = p.opacity

  // Rounded rect body
  ctx.beginPath()
  ctx.moveTo(-half + r, -half)
  ctx.lineTo(half - r, -half)
  ctx.quadraticCurveTo(half, -half, half, -half + r)
  ctx.lineTo(half, half - r)
  ctx.quadraticCurveTo(half, half, half - r, half)
  ctx.lineTo(-half + r, half)
  ctx.quadraticCurveTo(-half, half, -half, half - r)
  ctx.lineTo(-half, -half + r)
  ctx.quadraticCurveTo(-half, -half, -half + r, -half)
  ctx.closePath()
  ctx.fillStyle = DIE_BG
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Shadow/depth
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 2
  ctx.fill()
  ctx.shadowColor = 'transparent'

  // Dots (show face based on rotation)
  const face = (Math.floor(Math.abs(p.rotation * 3)) % 6) + 1
  const dotR = size * 0.06
  ctx.fillStyle = '#1a1a1a'
  const dotPositions: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-half * 0.45, -half * 0.45], [half * 0.45, half * 0.45]],
    3: [[-half * 0.45, -half * 0.45], [0, 0], [half * 0.45, half * 0.45]],
    4: [[-half * 0.45, -half * 0.45], [half * 0.45, -half * 0.45], [-half * 0.45, half * 0.45], [half * 0.45, half * 0.45]],
    5: [[-half * 0.45, -half * 0.45], [half * 0.45, -half * 0.45], [0, 0], [-half * 0.45, half * 0.45], [half * 0.45, half * 0.45]],
    6: [[-half * 0.45, -half * 0.45], [half * 0.45, -half * 0.45], [-half * 0.45, 0], [half * 0.45, 0], [-half * 0.45, half * 0.45], [half * 0.45, half * 0.45]],
  }
  for (const [dx, dy] of dotPositions[face]!) {
    ctx.beginPath()
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

// ── Component ───────────────────────────────────────────────

interface CasinoShowerProps {
  active: boolean
  onComplete?: () => void
}

export const CasinoShower = memo(function CasinoShower({ active, onComplete }: CasinoShowerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const startTime = useRef(0)
  const rafId = useRef(0)
  const completedRef = useRef(false)

  useEffect(() => {
    if (!active) {
      completedRef.current = false
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    // Create particles
    particles.current = Array.from({ length: PARTICLE_COUNT }, () => createParticle(w, h))
    startTime.current = performance.now()

    function animate() {
      const elapsed = performance.now() - startTime.current
      const progress = Math.min(elapsed / DURATION_MS, 1)

      ctx.clearRect(0, 0, w, h)

      // Global fade: ramp up quickly, fade out at end
      const globalAlpha = progress < 0.15
        ? progress / 0.15
        : progress > 0.75
          ? 1 - (progress - 0.75) / 0.25
          : 1

      ctx.globalAlpha = globalAlpha

      for (const p of particles.current) {
        // Physics
        p.vy += GRAVITY
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.rotSpeed
        p.flipPhase += p.flipSpeed
        p.sparkle += 0.12

        // Slight air resistance
        p.vx *= 0.998
        p.vy *= 0.998

        // Draw based on type
        switch (p.type) {
          case 'coin': drawCoin(ctx, p); break
          case 'chip': drawChip(ctx, p); break
          case 'die':  drawDie(ctx, p); break
        }
      }

      ctx.globalAlpha = 1

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate)
      } else if (!completedRef.current) {
        completedRef.current = true
        onComplete?.()
      }
    }

    rafId.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId.current)
  }, [active, onComplete])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500, // above splash (1000) but pointer-events none
        pointerEvents: 'none',
      }}
    />
  )
})
