/**
 * ParticleField — magnetic orbit constellation around Lucky 7
 *
 * 18 light orbs orbit the screen center with weak radial spring back to
 * their home orbit ring. The user's parallax target (cursor / gyro)
 * applies a soft attractive force, so when the recruiter moves the
 * mouse or tilts the phone, the constellation drifts toward the input
 * and slowly settles back — like a 7 sitting in its own gravity well.
 *
 * Pure JS Verlet-ish integration over canvas2d. No Matter.js, no THREE,
 * no DOM thrash. ~9 KB minified, ~0.4ms / frame on an iPhone 11.
 *
 * Inputs:
 *   • parallaxFromRef — element exposing --mx / --my CSS vars (.boot)
 *   • reducedMotion — if true, render once at rest and stop the loop
 */

import { useEffect, useRef } from 'react'
import styles from './ParticleField.module.css'

interface ParticleFieldProps {
  parallaxFromRef: React.RefObject<HTMLElement | null>
  reducedMotion?: boolean
}

interface Orb {
  // Home orbit (polar): radius r0 in vmin units, base angle a0, angular speed
  r0: number
  a0: number
  speed: number
  // Live state (px)
  x: number
  y: number
  vx: number
  vy: number
  // Visual
  size: number
  hue: 'gold' | 'cyan' | 'violet'
}

const ORB_COUNT = 18

function makeOrbs(): Orb[] {
  const orbs: Orb[] = []
  for (let i = 0; i < ORB_COUNT; i++) {
    // Three orbit rings, scattered angular positions
    const ring = i % 3
    const r0 = ring === 0 ? 0.22 : ring === 1 ? 0.34 : 0.46 // vmin fractions
    const a0 = (i / ORB_COUNT) * Math.PI * 2 + (ring * 0.4)
    const speed = (ring === 0 ? 0.10 : ring === 1 ? 0.07 : -0.05) * (1 + (i % 5) * 0.04)
    const hueIdx = i % 3
    const hue = hueIdx === 0 ? 'gold' : hueIdx === 1 ? 'cyan' : 'violet'
    orbs.push({
      r0, a0, speed,
      x: 0, y: 0, vx: 0, vy: 0,
      size: ring === 0 ? 5 : ring === 1 ? 3 : 2,
      hue,
    })
  }
  return orbs
}

const HUE_COLORS: Record<Orb['hue'], { core: string; glow: string }> = {
  gold:   { core: '#fff8e0', glow: 'rgba(240, 216, 120, 0.85)' },
  cyan:   { core: '#dcfaff', glow: 'rgba(34, 232, 255, 0.85)' },
  violet: { core: '#f0e5ff', glow: 'rgba(177, 76, 255, 0.85)' },
}

export function ParticleField({ parallaxFromRef, reducedMotion = false }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const orbsRef = useRef<Orb[]>(makeOrbs())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let cw = 0
    let ch = 0
    let cx = 0
    let cy = 0
    let vmin = 0

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

    // Seed orbs at their home positions so the first frame isn't a pop
    const orbs = orbsRef.current
    const startTime = performance.now()
    for (const o of orbs) {
      const r = o.r0 * vmin
      o.x = cx + Math.cos(o.a0) * r
      o.y = cy + Math.sin(o.a0) * r
    }

    let last = startTime

    const tick = () => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.05) // cap dt to avoid jumps after tab-switch
      last = now
      const tSec = (now - startTime) / 1000

      // Read parallax target (smoothed by BootScreen → already lerped)
      const root = parallaxFromRef.current
      const cs = root ? getComputedStyle(root) : null
      const mx = cs ? parseFloat(cs.getPropertyValue('--mx') || '0.5') : 0.5
      const my = cs ? parseFloat(cs.getPropertyValue('--my') || '0.5') : 0.5
      // Convert (0..1) target to a small offset of the constellation center
      const offsetX = (mx - 0.5) * vmin * 0.18
      const offsetY = (my - 0.5) * vmin * 0.10

      ctx.clearRect(0, 0, cw, ch)

      for (const o of orbs) {
        // Home position on the orbit ring (rotates over time)
        const a = o.a0 + tSec * o.speed
        const r = o.r0 * vmin
        const homeX = cx + offsetX + Math.cos(a) * r
        const homeY = cy + offsetY + Math.sin(a) * r

        // Spring-back force toward the home orbit point — soft, organic
        const dx = homeX - o.x
        const dy = homeY - o.y
        const k = 4.5  // stiffness
        const damping = 0.86
        o.vx = (o.vx + dx * k * dt) * damping
        o.vy = (o.vy + dy * k * dt) * damping
        o.x += o.vx * dt
        o.y += o.vy * dt

        // ── Render: soft glow ── inner core
        const colors = HUE_COLORS[o.hue]
        const glow = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.size * 6)
        glow.addColorStop(0, colors.core)
        glow.addColorStop(0.4, colors.glow)
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(o.x, o.y, o.size * 6, 0, Math.PI * 2)
        ctx.fill()

        // Inner solid dot
        ctx.fillStyle = colors.core
        ctx.beginPath()
        ctx.arc(o.x, o.y, o.size, 0, Math.PI * 2)
        ctx.fill()
      }

      // Connect close pairs with a fading line — emergent constellation
      ctx.lineWidth = 0.6
      for (let i = 0; i < orbs.length; i++) {
        for (let j = i + 1; j < orbs.length; j++) {
          const a = orbs[i]!
          const b = orbs[j]!
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          const maxLink = vmin * 0.18
          if (dist > maxLink) continue
          const alpha = (1 - dist / maxLink) * 0.18
          ctx.strokeStyle = `rgba(180, 220, 255, ${alpha.toFixed(3)})`
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }

      if (!reducedMotion) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    if (reducedMotion) {
      // Single static frame at rest
      tick()
    } else {
      rafRef.current = requestAnimationFrame(tick)
    }

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [parallaxFromRef, reducedMotion])

  return <canvas ref={canvasRef} className={styles.field} aria-hidden="true" />
}

export default ParticleField
