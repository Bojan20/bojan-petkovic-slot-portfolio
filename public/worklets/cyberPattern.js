/**
 * cyberPattern — CSS Houdini Paint Worklet
 *
 * Custom procedural background paint that draws a cyberpunk circuit-
 * grid + glitching pixel field. Used for slot frame pillars and
 * accent surfaces. Driven entirely by CSS custom properties so the
 * same worklet can render different aesthetics by changing CSS only.
 *
 * Registered globally via CSS.paintWorklet.addModule('/worklets/cyberPattern.js')
 * Used in CSS: background: paint(cyberPattern);
 *
 * Inputs (CSS custom properties):
 *   --pattern-hue          0..360   base hue
 *   --pattern-density      0..1     line density (0=sparse, 1=dense)
 *   --pattern-glitch       0..1     amount of "glitched" pixel noise
 *   --pattern-alpha        0..1     overall opacity multiplier
 *   --pattern-seed         number   deterministic noise seed
 *
 * Browser support: Chrome 65+, Edge 79+, Opera 52+, Samsung 9+.
 * Safari + Firefox: paint() falls back to whatever lower-priority
 * background value is supplied (we always layer a CSS gradient
 * underneath so the visual gracefully degrades).
 */

/* global registerPaint */
if (typeof registerPaint !== 'undefined') {
  registerPaint('cyberPattern', class {
    static get inputProperties() {
      return [
        '--pattern-hue',
        '--pattern-density',
        '--pattern-glitch',
        '--pattern-alpha',
        '--pattern-seed',
      ]
    }
    static get inputArguments() { return [] }
    static get contextOptions() { return { alpha: true } }

    paint(ctx, geom, props) {
      const w = geom.width
      const h = geom.height
      if (w < 4 || h < 4) return

      const hue   = parseFloat(props.get('--pattern-hue').toString())     || 190
      const density = clamp01(parseFloat(props.get('--pattern-density').toString()) || 0.45)
      const glitch  = clamp01(parseFloat(props.get('--pattern-glitch').toString())  || 0.20)
      const alpha   = clamp01(parseFloat(props.get('--pattern-alpha').toString())   || 0.55)
      const seed    = parseFloat(props.get('--pattern-seed').toString())  || 7.13

      // Base wash — vertical neon gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0,    `hsla(${hue}, 90%, 12%, ${alpha * 0.9})`)
      grad.addColorStop(0.50, `hsla(${(hue + 40) % 360}, 88%, 22%, ${alpha * 0.65})`)
      grad.addColorStop(1,    `hsla(${hue}, 90%, 8%, ${alpha * 0.95})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      // Horizontal circuit lines — density-driven count
      const lineCount = Math.floor(8 + density * 26)
      ctx.lineWidth = 0.5
      for (let i = 0; i < lineCount; i++) {
        const t = (i + 0.5) / lineCount
        const y = Math.floor(t * h) + 0.5
        const a = (alpha * 0.30) * (0.5 + 0.5 * Math.sin(seed + i * 1.7))
        ctx.strokeStyle = `hsla(${(hue + 20) % 360}, 95%, 60%, ${a})`
        ctx.beginPath()
        // Each line has a subtle break (looks like a PCB trace)
        const breakX = Math.floor(rand(seed + i * 2.1) * w)
        const breakLen = 4 + Math.floor(rand(seed + i * 2.7) * 12)
        ctx.moveTo(0, y)
        ctx.lineTo(breakX, y)
        ctx.moveTo(breakX + breakLen, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      // Vertical accents — fewer, brighter
      const vCount = Math.floor(2 + density * 6)
      for (let i = 0; i < vCount; i++) {
        const x = Math.floor((rand(seed + i * 3.13) * w)) + 0.5
        const a = alpha * (0.20 + rand(seed + i * 4.7) * 0.40)
        ctx.strokeStyle = `hsla(${(hue + 80) % 360}, 100%, 70%, ${a})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }

      // Solder-blob "pads" at random intersections
      const blobCount = Math.floor(3 + density * 14)
      for (let i = 0; i < blobCount; i++) {
        const x = Math.floor(rand(seed + i * 5.71) * w)
        const y = Math.floor(rand(seed + i * 7.41) * h)
        const r = 1 + Math.floor(rand(seed + i * 9.13) * 2.4)
        const a = alpha * (0.45 + rand(seed + i * 11.7) * 0.55)
        ctx.fillStyle = `hsla(${(hue + 60) % 360}, 100%, 68%, ${a})`
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Glitch pixel field — scattered single-pixel hot points
      if (glitch > 0.001) {
        const glitchCount = Math.floor(glitch * 80)
        ctx.fillStyle = `hsla(${(hue + 200) % 360}, 100%, 85%, ${alpha * 0.95})`
        for (let i = 0; i < glitchCount; i++) {
          const gx = Math.floor(rand(seed + i * 13.7) * w)
          const gy = Math.floor(rand(seed + i * 17.3) * h)
          ctx.fillRect(gx, gy, 1, 1)
        }
      }
    }
  })
}

// ── Tiny PRNG helpers (no Math.random — paint must be deterministic
// per geometry+props or the browser will trash its repaint cache) ──
function rand(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}
function clamp01(v) {
  if (!isFinite(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}
