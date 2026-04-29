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
import type { ParallaxState } from './CasinoField'
import { audioLevelsRef, getQualityMode } from '../../engine'

interface CyberNebulaProps {
  /** Shared parallax state — read directly, no getComputedStyle on hot path */
  parallaxRef: React.RefObject<ParallaxState>
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
//   • value noise for the volumetric base (octaves driven by macro)
//   • 3-color palette mix cycling slowly via u_time
//   • Parallax offset shifts the whole field by u_par
//
// Two compile paths:
//   FRAG_SRC      — desktop: 4-octave fbm + secondary noise swirl
//   FRAG_SRC_LITE — mobile:  2-octave fbm + no second swirl
//                   (mobile GPU drops frames on the full path → flicker)
function buildFrag(opts: { octaves: number; secondSwirl: boolean }): string {
  const { octaves, secondSwirl } = opts
  return `
precision mediump float;
varying vec2 v_uv;
uniform float u_time;
uniform vec2  u_res;
uniform vec2  u_par;
// Audio reactive uniforms — FFT band amplitudes 0..1, smoothed by
// AudioReactive.ts EMA. Drive nebula breathing + hue cycle + sparkle:
//   u_bass   → tendril intensity pulses on the kick (drop = scene opens)
//   u_mid    → palette hue sweep speed scales with mids (vocal energy)
//   u_treble → star sparkle density scales with cymbals
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;

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
  for (int i = 0; i < ${octaves}; i++) {
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

  // Primary flow — drifting fbm
  vec2 q = p * 1.6 + vec2(t, -t * 0.7);
  float n1 = fbm(q + fbm(q + t));
  ${secondSwirl
    ? 'float n2 = fbm(p * 3.5 + vec2(-t * 0.6, t * 0.4));'
    : 'float n2 = n1 * 0.6;'}

  // Tendril mask — bright filaments where layers align.
  // Bass amplitude pumps the smoothstep edge inward → on a kick the
  // bright filaments swell and "open up" toward the camera. Subtle on
  // the lo edge (-0.08) so the visual remains tasteful, not seizure-y.
  float bassPump = u_bass * 0.18;
  float tendril = pow(smoothstep(0.40 - bassPump, 0.95 - bassPump * 0.5, n1 * 0.7 + n2 * 0.3), 1.4);
  // Tendril intensity is also bass-modulated so the brightest filaments
  // glow harder on heavy hits (capped to keep highlights from clipping).
  float tendrilIntensity = 0.85 + u_bass * 0.55;

  // Distance-from-center radial falloff so the edges stay deep black.
  // Bass also subtly extends the "lit" radius — feels like the music
  // is filling the volume of the scene.
  float r = length(p);
  float vignette = smoothstep(1.05 + u_bass * 0.10, 0.18, r);

  // 3-color palette mix
  vec3 col_cyan   = vec3(0.13, 0.91, 1.00);
  vec3 col_violet = vec3(0.69, 0.30, 1.00);
  vec3 col_gold   = vec3(0.94, 0.85, 0.47);
  vec3 col_deep   = vec3(0.012, 0.014, 0.030);

  // Hue cycle — base drift through cyan → violet → gold, with mid-band
  // amplitude SPEEDING up the cycle so vocals/leads push the palette.
  float hueRate = 0.06 + u_mid * 0.20;
  float hue = sin(u_time * hueRate) * 0.5 + 0.5;
  vec3 mid = mix(col_cyan, col_violet, smoothstep(0.0, 0.55, hue));
  vec3 hot = mix(mid, col_gold, smoothstep(0.55, 1.0, hue));

  vec3 color = col_deep;
  color = mix(color, mid * 0.6, n1 * 0.55 * vignette);
  color = mix(color, hot, tendril * tendrilIntensity * vignette);

  // Faint sparkle from a pure hash — "stars in the void".
  // Treble band amplitude (cymbals/hats) lowers the threshold AND boosts
  // brightness → percussion literally lights the stars.
  float sparkThresh = 0.997 - u_treble * 0.012;
  float sparkBoost = 0.7 + u_treble * 1.1;
  float spark = step(sparkThresh, hash(floor(p * 580.0))) * vignette * sparkBoost;
  color += spark * vec3(1.0);

  gl_FragColor = vec4(color, 1.0);
}
`
}

const FRAG_SRC      = buildFrag({ octaves: 4, secondSwirl: true })
const FRAG_SRC_LITE = buildFrag({ octaves: 2, secondSwirl: false })

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

export function CyberNebula({ parallaxRef, reducedMotion = false }: CyberNebulaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const startTimeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Samsung Internet + Mali GPU: when preserveDrawingBuffer is false, the
    // driver reallocates the back buffer between frames, and on certain
    // Adreno/Mali revisions the realloc races with the compositor → visible
    // flicker on the WebGL surface (chromium #828363, pixijs #5121).
    // preserveDrawingBuffer:true forces the driver to keep a single buffer,
    // which costs a tiny bit of memory but eliminates the flicker race.
    // Desktop is unaffected — keep false for slightly lower memory there.
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: isCoarsePointer,
      powerPreference: 'low-power',
    })
    if (!gl) {
      console.info('[CyberNebula] WebGL unavailable — falling back to CSS gradient')
      return
    }

    // ── Compile + link program ──
    // Mobile gets the lite shader (2-octave fbm, no second swirl). The
    // full shader drops frames on iPhone 11-class GPUs which manifests
    // as visible flicker rather than smooth slowdown.
    // Adaptive quality (low battery / slow network / saveData) ALSO
    // forces the lite shader on desktop so the user's machine doesn't
    // burn cycles when battery is critical.
    const liteMode = getQualityMode() === 'lite'
    const isMobile = isCoarsePointer || liteMode
    const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC)
    const fs = compile(gl, gl.FRAGMENT_SHADER, isMobile ? FRAG_SRC_LITE : FRAG_SRC)
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
    const uBass = gl.getUniformLocation(prog, 'u_bass')
    const uMid = gl.getUniformLocation(prog, 'u_mid')
    const uTreble = gl.getUniformLocation(prog, 'u_treble')

    // ── Resize handling — DPR aware, capped at 1.5 desktop / 0.75 mobile ──
    // On phones the GPU memory bandwidth + fragment shader complexity
    // makes any DPR ≥ 1.0 drop frames intermittently — visible as flicker.
    // 0.75 DPR roughly quarters the pixel count of 1.5x and keeps a
    // steady 60fps on iPhone 11+. The nebula is a low-frequency
    // background; downsampling has near-zero perceptual cost.
    const dprCap = isMobile ? 0.75 : 1.5
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap)
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
      // Read smoothed parallax (already lerped by BootScreen) directly
      // from the shared ref — NO getComputedStyle in RAF (forces full
      // style recalc on a perspective-rooted tree, was the main cause
      // of mobile flicker on every layer except .sevenStage).
      const par = parallaxRef.current
      const mx = par?.x ?? 0.5
      const my = par?.y ?? 0.5
      parX += ((mx - 0.5) - parX) * 0.05
      parY += ((my - 0.5) - parY) * 0.05
      gl.uniform2f(uPar, parX, parY)

      const tSec = (performance.now() - startTimeRef.current) / 1000
      gl.uniform1f(uTime, reducedMotion ? 0.5 : tSec)

      // Audio reactive — read live FFT band levels (0..1, smoothed by
      // AudioReactive.ts EMA). When the analyser hasn't been attached
      // yet (pre-tap, or on browsers that block WebAudio), levelsRef
      // stays at zeros → shader renders the static neutral state.
      // Reduced-motion users get zeros too — no audio-driven motion.
      if (reducedMotion) {
        gl.uniform1f(uBass, 0)
        gl.uniform1f(uMid, 0)
        gl.uniform1f(uTreble, 0)
      } else {
        gl.uniform1f(uBass, audioLevelsRef.bass)
        gl.uniform1f(uMid, audioLevelsRef.mid)
        gl.uniform1f(uTreble, audioLevelsRef.treble)
      }

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
  }, [parallaxRef, reducedMotion])

  return <canvas ref={canvasRef} className={styles.nebula} aria-hidden="true" />
}

export default CyberNebula
