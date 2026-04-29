/**
 * CyberNebula — WebGL fragment shader background for boot
 *
 * A single fullscreen quad rendered with a procedural fragment shader
 * that paints a cyan→violet→gold nebula breathing in 3D space. The
 * nebula reacts to the boot's parallax cursor (--mx / --my CSS vars)
 * so it shifts subtly when the user moves the mouse / tilts the phone.
 *
 * Why custom WebGL instead of CSS gradients:
 *   • CSS can fake "neon mist" but not the volumetric depth + flow
 *   • A 60-line GLSL shader runs at 60fps on a 5-year-old phone GPU
 *   • Zero npm deps — uses raw WebGL1 (universal browser support)
 *
 * Inputs from React:
 *   • mouseRef (mx, my) — parallax target, smoothed by RAF
 *
 * Falls back to a CSS gradient layer (rendered by parent) if WebGL
 * context creation fails (rare but possible on locked-down kiosks).
 */

import { useEffect, useRef } from 'react'
import styles from './CyberNebula.module.css'

interface CyberNebulaProps {
  /** Element whose --mx / --my CSS vars drive parallax (typically .boot root) */
  parallaxFromRef: React.RefObject<HTMLElement | null>
  /** Honor prefers-reduced-motion — pause animation, render single frame */
  reducedMotion?: boolean
}

const VERT_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = (a_pos + 1.0) * 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

// Fragment shader — cyberpunk nebula
//   • 2-octave value noise for the volumetric base
//   • Worley-ish cell field for highlight tendrils
//   • 3-color palette mix cycling slowly via u_time
//   • Parallax offset shifts the whole field by u_par
const FRAG_SRC = `
precision mediump float;
varying vec2 v_uv;
uniform float u_time;
uniform vec2  u_res;
uniform vec2  u_par;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.05;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);

  // Parallax push: when mouse goes right, the nebula drifts left
  p -= u_par * 0.12;

  float t = u_time * 0.025;

  // Two-layer flow — slow drifting fbm over a faster swirl
  vec2 q = p * 1.6 + vec2(t, -t * 0.7);
  float n1 = fbm(q + fbm(q + t));
  float n2 = fbm(p * 3.5 + vec2(-t * 0.6, t * 0.4));

  // Tendril mask — bright filaments where layers align
  float tendril = pow(smoothstep(0.40, 0.95, n1 * 0.7 + n2 * 0.3), 1.4);

  // Distance-from-center radial falloff so the edges stay deep black
  float r = length(p);
  float vignette = smoothstep(1.05, 0.18, r);

  // 3-color palette mix
  vec3 col_cyan   = vec3(0.13, 0.91, 1.00);
  vec3 col_violet = vec3(0.69, 0.30, 1.00);
  vec3 col_gold   = vec3(0.94, 0.85, 0.47);
  vec3 col_deep   = vec3(0.012, 0.014, 0.030);

  // Hue cycle — drift smoothly through cyan → violet → gold
  float hue = sin(u_time * 0.06) * 0.5 + 0.5;
  vec3 mid = mix(col_cyan, col_violet, smoothstep(0.0, 0.55, hue));
  vec3 hot = mix(mid, col_gold, smoothstep(0.55, 1.0, hue));

  vec3 color = col_deep;
  color = mix(color, mid * 0.6, n1 * 0.55 * vignette);
  color = mix(color, hot, tendril * 0.85 * vignette);

  // Faint sparkle from a pure hash — "stars in the void"
  float spark = step(0.997, hash(floor(p * 580.0))) * vignette * 0.7;
  color += spark * vec3(1.0);

  gl_FragColor = vec4(color, 1.0);
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[CyberNebula] shader compile failed:', gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

export function CyberNebula({ parallaxFromRef, reducedMotion = false }: CyberNebulaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const startTimeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    })
    if (!gl) {
      console.info('[CyberNebula] WebGL unavailable — falling back to CSS gradient')
      return
    }

    // ── Compile + link program ──
    const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
    if (!vs || !fs) return
    const prog = gl.createProgram()
    if (!prog) return
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[CyberNebula] program link failed:', gl.getProgramInfoLog(prog))
      return
    }
    gl.useProgram(prog)

    // ── Fullscreen quad ──
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    )
    const aPos = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uPar = gl.getUniformLocation(prog, 'u_par')

    // ── Resize handling — DPR aware, capped at 1.5 for perf on retina ──
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const w = window.innerWidth * dpr
      const h = window.innerHeight * dpr
      canvas.width = w
      canvas.height = h
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      gl.viewport(0, 0, w, h)
      gl.uniform2f(uRes, w, h)
    }
    resize()
    window.addEventListener('resize', resize, { passive: true })

    startTimeRef.current = performance.now()
    let parX = 0
    let parY = 0

    const tick = () => {
      const root = parallaxFromRef.current
      // Read smoothed parallax (already lerped by BootScreen) from CSS vars
      const cs = root ? getComputedStyle(root) : null
      const mx = cs ? parseFloat(cs.getPropertyValue('--mx') || '0.5') : 0.5
      const my = cs ? parseFloat(cs.getPropertyValue('--my') || '0.5') : 0.5
      // Smooth our own copy too — guards against the rare case the boot
      // unmounted the CSS var read mid-frame
      parX += ((mx - 0.5) - parX) * 0.05
      parY += ((my - 0.5) - parY) * 0.05
      gl.uniform2f(uPar, parX, parY)

      const tSec = (performance.now() - startTimeRef.current) / 1000
      gl.uniform1f(uTime, reducedMotion ? 0.5 : tSec)

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      if (!reducedMotion) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    tick()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buf)
    }
  }, [parallaxFromRef, reducedMotion])

  return <canvas ref={canvasRef} className={styles.nebula} aria-hidden="true" />
}

export default CyberNebula
