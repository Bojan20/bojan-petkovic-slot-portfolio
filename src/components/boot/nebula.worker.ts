/// <reference lib="WebWorker" />
/**
 * nebula.worker.ts — CyberNebula WebGL render loop, off the main thread
 *
 * Receives an OffscreenCanvas via the 'init' message, runs the entire
 * WebGL pipeline (shader compile + program link + uniform updates + RAF
 * draw loop) inside the worker. The main thread just posts cheap
 * messages with audio + parallax updates and the worker drives every
 * frame independently.
 *
 * Why: WebGL fragment shaders for nebula effects are GPU-bound, but the
 * JS that schedules them still runs on the main thread by default —
 * which means a frame stall on main (e.g. React render, GSAP timeline
 * tick) can cause the shader to skip a frame and visibly flicker. With
 * the render loop in a worker, main can stutter and the nebula keeps
 * running at solid 60fps.
 *
 * Browser support: OffscreenCanvas + worker WebGL is available in
 * Chrome 69+, Edge 79+, Safari 16.4+, Samsung 10+. Firefox 105+ has
 * partial support. CyberNebula.tsx feature-detects and falls back to
 * the in-thread render path on unsupported browsers.
 *
 * Message protocol:
 *   IN: { type: 'init', canvas, isMobile, reducedMotion, w, h, dpr }
 *   IN: { type: 'audio', bass, mid, treble }
 *   IN: { type: 'parallax', x, y }       // smoothed 0..1
 *   IN: { type: 'resize', w, h, dpr }
 *   IN: { type: 'dispose' }
 *
 * No outbound messages — the worker is fire-and-forget render.
 */

declare const self: DedicatedWorkerGlobalScope

// ── Shader source (kept in sync with CyberNebula.tsx in-thread path) ─

const VERT_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = (a_pos + 1.0) * 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

function buildFrag(opts: { octaves: number; secondSwirl: boolean }): string {
  const { octaves, secondSwirl } = opts
  return `
precision mediump float;
varying vec2 v_uv;
uniform float u_time;
uniform vec2  u_res;
uniform vec2  u_par;
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
  p -= u_par * 0.12;

  float t = u_time * 0.025;

  vec2 q = p * 1.6 + vec2(t, -t * 0.7);
  float n1 = fbm(q + fbm(q + t));
  ${secondSwirl
    ? 'float n2 = fbm(p * 3.5 + vec2(-t * 0.6, t * 0.4));'
    : 'float n2 = n1 * 0.6;'}

  float bassPump = u_bass * 0.18;
  float tendril = pow(smoothstep(0.40 - bassPump, 0.95 - bassPump * 0.5, n1 * 0.7 + n2 * 0.3), 1.4);
  float tendrilIntensity = 0.85 + u_bass * 0.55;

  float r = length(p);
  float vignette = smoothstep(1.05 + u_bass * 0.10, 0.18, r);

  vec3 col_cyan   = vec3(0.13, 0.91, 1.00);
  vec3 col_violet = vec3(0.69, 0.30, 1.00);
  vec3 col_gold   = vec3(0.94, 0.85, 0.47);
  vec3 col_deep   = vec3(0.012, 0.014, 0.030);

  float hueRate = 0.06 + u_mid * 0.20;
  float hue = sin(u_time * hueRate) * 0.5 + 0.5;
  vec3 mid = mix(col_cyan, col_violet, smoothstep(0.0, 0.55, hue));
  vec3 hot = mix(mid, col_gold, smoothstep(0.55, 1.0, hue));

  vec3 color = col_deep;
  color = mix(color, mid * 0.6, n1 * 0.55 * vignette);
  color = mix(color, hot, tendril * tendrilIntensity * vignette);

  float sparkThresh = 0.997 - u_treble * 0.012;
  float sparkBoost = 0.7 + u_treble * 1.1;
  float spark = step(sparkThresh, hash(floor(p * 580.0))) * vignette * sparkBoost;
  color += spark * vec3(1.0);

  gl_FragColor = vec4(color, 1.0);
}
`
}

// ── State ───────────────────────────────────────────────────────────

let gl: WebGLRenderingContext | null = null
let canvas: OffscreenCanvas | null = null
let prog: WebGLProgram | null = null
let uTime: WebGLUniformLocation | null = null
let uRes: WebGLUniformLocation | null = null
let uPar: WebGLUniformLocation | null = null
let uBass: WebGLUniformLocation | null = null
let uMid: WebGLUniformLocation | null = null
let uTreble: WebGLUniformLocation | null = null
let startMs = 0
let parX = 0
let parY = 0
let targetParX = 0
let targetParY = 0
let bass = 0
let mid = 0
let treble = 0
let reducedMotion = false
let rafId = 0

function compile(g: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = g.createShader(type)
  if (!sh) return null
  g.shaderSource(sh, src)
  g.compileShader(sh)
  if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn('[nebula.worker] shader compile failed:', g.getShaderInfoLog(sh))
    g.deleteShader(sh)
    return null
  }
  return sh
}

interface InitMsg {
  type: 'init'
  canvas: OffscreenCanvas
  isMobile: boolean
  reducedMotion: boolean
  w: number
  h: number
  dpr: number
}
interface AudioMsg { type: 'audio'; bass: number; mid: number; treble: number }
interface ParallaxMsg { type: 'parallax'; x: number; y: number }
interface ResizeMsg { type: 'resize'; w: number; h: number; dpr: number }
interface DisposeMsg { type: 'dispose' }
type Msg = InitMsg | AudioMsg | ParallaxMsg | ResizeMsg | DisposeMsg

function init(msg: InitMsg): void {
  canvas = msg.canvas
  reducedMotion = msg.reducedMotion

  // OffscreenCanvas WebGL context — same API as in-thread, returns
  // WebGLRenderingContext just like normal canvas.
  gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: msg.isMobile,
    powerPreference: 'low-power',
  }) as WebGLRenderingContext | null
  if (!gl) {
    console.warn('[nebula.worker] WebGL unavailable in worker')
    return
  }

  const fragSrc = msg.isMobile
    ? buildFrag({ octaves: 2, secondSwirl: false })
    : buildFrag({ octaves: 4, secondSwirl: true })

  const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc)
  if (!vs || !fs) return
  prog = gl.createProgram()
  if (!prog) return
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[nebula.worker] program link failed:', gl.getProgramInfoLog(prog))
    return
  }
  gl.useProgram(prog)

  // Fullscreen quad buffer
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

  uTime = gl.getUniformLocation(prog, 'u_time')
  uRes = gl.getUniformLocation(prog, 'u_res')
  uPar = gl.getUniformLocation(prog, 'u_par')
  uBass = gl.getUniformLocation(prog, 'u_bass')
  uMid = gl.getUniformLocation(prog, 'u_mid')
  uTreble = gl.getUniformLocation(prog, 'u_treble')

  resizeNow(msg.w, msg.h, msg.dpr)
  startMs = performance.now()
  scheduleTick()
}

function resizeNow(w: number, h: number, dpr: number): void {
  if (!gl || !canvas) return
  const pxW = Math.round(w * dpr)
  const pxH = Math.round(h * dpr)
  canvas.width = pxW
  canvas.height = pxH
  gl.viewport(0, 0, pxW, pxH)
  if (uRes) gl.uniform2f(uRes, pxW, pxH)
}

function scheduleTick(): void {
  if (rafId) return
  rafId = (self as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number })
    .requestAnimationFrame(tick)
}

function tick(): void {
  rafId = 0
  if (!gl) return

  // Smooth parallax (lerp toward latest target — main thread sends raw
  // smoothed values, but doing a second EMA here gives the worker
  // independence from main's frame timing).
  parX += (targetParX - parX) * 0.05
  parY += (targetParY - parY) * 0.05
  if (uPar) gl.uniform2f(uPar, parX, parY)

  const tSec = (performance.now() - startMs) / 1000
  if (uTime) gl.uniform1f(uTime, reducedMotion ? 0.5 : tSec)

  if (reducedMotion) {
    if (uBass)   gl.uniform1f(uBass, 0)
    if (uMid)    gl.uniform1f(uMid, 0)
    if (uTreble) gl.uniform1f(uTreble, 0)
  } else {
    if (uBass)   gl.uniform1f(uBass, bass)
    if (uMid)    gl.uniform1f(uMid, mid)
    if (uTreble) gl.uniform1f(uTreble, treble)
  }

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

  if (!reducedMotion) scheduleTick()
}

function dispose(): void {
  if (rafId) {
    (self as unknown as { cancelAnimationFrame: (id: number) => void })
      .cancelAnimationFrame(rafId)
    rafId = 0
  }
  if (gl) {
    if (prog) gl.deleteProgram(prog)
    prog = null
  }
  gl = null
  canvas = null
}

// ── Message dispatch ────────────────────────────────────────────────
self.onmessage = (e: MessageEvent<Msg>) => {
  const msg = e.data
  switch (msg.type) {
    case 'init':     init(msg);                                   break
    case 'audio':    bass = msg.bass; mid = msg.mid; treble = msg.treble; break
    case 'parallax': targetParX = msg.x - 0.5; targetParY = msg.y - 0.5; break
    case 'resize':   resizeNow(msg.w, msg.h, msg.dpr);            break
    case 'dispose':  dispose();                                   break
  }
}
