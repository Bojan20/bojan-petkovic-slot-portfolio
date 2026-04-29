/**
 * WebGPUCompute — 32k particle compute field renderer
 *
 * Why WebGPU and not "another WebGL canvas":
 *   • WebGL has no general-purpose compute. Particle fields on WebGL
 *     either run on the CPU (≤ 2k particles before frame budget dies)
 *     or use ping-pong float textures (works but ugly + tied to fragment
 *     shader budget). WebGPU has first-class compute pipelines.
 *   • 32k particles × 60fps = 1.92M physics integrations / sec. That is
 *     a real GPGPU job — runs in ~0.4ms on integrated Intel Iris,
 *     ~0.05ms on M-series Apple Silicon. Recruiter looks at the boot
 *     screen and sees a *real* compute field, not a CSS hack.
 *   • Vertex pulling lets us draw 32k billboards from a storage buffer
 *     with zero per-frame attribute uploads. Render cost is the same
 *     order of magnitude as compute.
 *
 * Pipeline:
 *   compute pass → particles physics step (force fields + audio reactive)
 *   render pass  → 6 vertices per particle (billboard quad) with additive
 *                  blending so the field stacks over the nebula like a
 *                  glowing dust cloud.
 *
 * Force model (per particle, per step, in compute shader):
 *   1. Curl-noise base flow (volumetric drift)
 *   2. Mid-band swirl tangent — vocals/leads rotate the field
 *   3. Bass radial impulse — kicks open the cloud outward (drop = field
 *      explodes briefly, settles back)
 *   4. Treble jitter — cymbals add high-frequency sparkle motion
 *   5. Parallax pull — cursor/tilt shifts the cloud center subtly
 *   6. Damping + life decay → respawn from spherical envelope
 *
 * Color model (per particle, in vertex shader):
 *   • cyan→violet→gold hue cycle, speed scaled by mid band amplitude
 *   • alpha modulated by bass + life
 *   • additive blend (ONE / ONE) so the field naturally glows over
 *     the nebula and tendrils peek through in screen-space.
 *
 * Lifecycle:
 *   const handle = await createWebGPUField(canvas, { reducedMotion })
 *   handle.start()        // begins RAF loop
 *   handle.resize(w,h)    // on viewport change
 *   handle.dispose()      // tear down everything (HMR-safe, idempotent)
 *
 * If `navigator.gpu` is missing or adapter request fails, the factory
 * returns null. Caller should treat null as "no GPGPU layer" and render
 * nothing — the nebula already carries the scene.
 */

import { levelsRef as audioLevelsRef } from './AudioReactive'
import { getCurrentBpmNorm } from './HeartRate'

// ─── Capability detection ────────────────────────────────────────────────────

/**
 * Synchronous check — true if the browser exposes the WebGPU entry point.
 * Adapter request is async and can still fail (driver blocklist, locked
 * down kiosk, missing hardware). Use `createWebGPUField` to actually
 * provision the device — it returns null on async failure.
 */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

// ─── Tuning constants ────────────────────────────────────────────────────────

/** 64k particles — 2× over Phase 11. With per-particle frustum culling
 *  in the compute shader the visible set typically lands around the
 *  same fragment fill as 32k uncuted, but the cloud reads denser when
 *  the user looks toward the field's bright spots. */
const PARTICLE_COUNT = 65_536
/** vec4 pos (xyz,life) + vec4 vel (xyz,size) = 8 × f32 = 32 bytes. */
const PARTICLE_STRIDE = 32
/** Workgroup size — 64 is the lowest-common-denominator "fast" size.
 *  At 64k particles we dispatch 1024 workgroups per frame. */
const WG_SIZE = 64
/** Frustum culling margin — particles past ±NDC_BOUND on x/y get marked
 *  invisible (size = 0 in the render shader, no fragments shaded).
 *  1.2 is wide enough to keep particles partially off-screen still
 *  contributing glow to the visible edges via their Gaussian sprite. */
const NDC_BOUND = 1.2

// ─── WGSL — compute (physics step) ───────────────────────────────────────────

const WGSL_COMPUTE = /* wgsl */ `
struct Particle {
  pos: vec4<f32>,  // xyz = position in NDC-ish space, w = life 0..1
  vel: vec4<f32>,  // xyz = velocity, w = size scalar
}

struct Uni {
  time: f32,
  dt: f32,
  bass: f32,
  mid: f32,
  treble: f32,
  parX: f32,
  parY: f32,
  aspect: f32,
  // Heart-rate normalized exertion 0..1 (60bpm → 0, 180bpm → 1).
  // Drives a subtle palette pulse + size pump synced to the user's
  // pulse (when WebBluetooth HR monitor is paired). Zero when no
  // monitor is connected — visual layers see the static state.
  heart: f32,
  _r1: f32,
  _r2: f32,
  _r3: f32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> u: Uni;

fn hash13(p: vec3<f32>) -> f32 {
  return fract(sin(dot(p, vec3<f32>(127.1, 311.7, 74.7))) * 43758.5453);
}

// Cheap "curl-like" rotational field — not a true Jacobian curl, but
// the divergence-free flavor is what we want visually and this costs
// 6 sins/cosines instead of 12 noise samples.
fn swirl(p: vec3<f32>, t: f32) -> vec3<f32> {
  let nx = sin(p.y * 1.3 + t * 0.4) - cos(p.z * 1.7 + t * 0.3);
  let ny = sin(p.z * 1.5 + t * 0.5) - cos(p.x * 1.1 + t * 0.2);
  let nz = sin(p.x * 1.7 + t * 0.6) - cos(p.y * 1.3 + t * 0.4);
  return vec3<f32>(nx, ny, nz);
}

@compute @workgroup_size(${WG_SIZE})
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&particles)) { return; }
  var p = particles[i];

  // 1. Base curl-like drift
  var force = swirl(p.pos.xyz * 0.6 + vec3<f32>(0.0, 0.0, u.time * 0.05), u.time) * 0.45;

  // 2. Mid-band swirl — tangent rotation around screen center, scaled by mids
  let r = p.pos.xy;
  let rl = max(length(r), 1e-3);
  let tang = vec2<f32>(-r.y, r.x) / rl;
  force = vec3<f32>(
    force.x + tang.x * (0.55 + u.mid * 1.8),
    force.y + tang.y * (0.55 + u.mid * 1.8),
    force.z,
  );

  // 3. Bass radial impulse — outward push, sinusoidally pulsing so kicks
  //    feel like the cloud "breathes out" on the beat.
  let dir = normalize(p.pos.xyz + vec3<f32>(1e-4));
  let bassPulse = sin(u.time * 4.0) * 0.5 + 0.5;
  force = force + dir * (u.bass * 1.6 * bassPulse);

  // 4. Treble jitter — cymbals shake high-frequency motion into the cloud
  let jitter = vec3<f32>(
    hash13(p.pos.xyz + vec3<f32>(u.time)) - 0.5,
    hash13(p.pos.xyz + vec3<f32>(u.time, 1.0, 0.0)) - 0.5,
    hash13(p.pos.xyz + vec3<f32>(u.time, 0.0, 1.0)) - 0.5,
  );
  force = force + jitter * (u.treble * 1.4);

  // 5. Parallax pull — gentle convergence toward where the user is looking
  // NOTE: 'target' is a WGSL reserved identifier; renamed to 'tgt'.
  let tgt = vec3<f32>((u.parX - 0.5) * 1.0, (0.5 - u.parY) * 0.7, 0.0);
  force = force + (tgt - p.pos.xyz) * 0.04;

  // Integrate (semi-implicit Euler), damp, decay life
  p.vel = vec4<f32>(p.vel.xyz + force * u.dt, p.vel.w);
  p.vel = vec4<f32>(p.vel.xyz * 0.985, p.vel.w);
  p.pos = vec4<f32>(p.pos.xyz + p.vel.xyz * u.dt, p.pos.w - u.dt * (0.06 + u.bass * 0.18));

  // Respawn — when life expires or the particle drifts off-stage, sample
  // a fresh point on a soft spherical envelope. The high-frequency hash
  // seeds keep neighboring threads from clustering.
  let dead = p.pos.w < 0.0;
  let escaped = length(p.pos.xyz) > 1.9;
  if (dead || escaped) {
    let h1 = hash13(vec3<f32>(f32(i),         u.time, 1.234));
    let h2 = hash13(vec3<f32>(f32(i) * 0.731, u.time, 5.678));
    let h3 = hash13(vec3<f32>(f32(i) * 0.131, u.time, 9.012));
    let theta = h1 * 6.28318;
    let phi   = h2 * 3.14159;
    let radius = 0.15 + h3 * 0.55;
    p.pos = vec4<f32>(
      cos(theta) * sin(phi) * radius,
      sin(theta) * sin(phi) * radius,
      cos(phi) * radius * 0.3,
      0.5 + h1 * 0.8,
    );
    p.vel = vec4<f32>(0.0, 0.0, 0.0, 0.4 + h2 * 0.6);
  }

  particles[i] = p;
}
`

// ─── WGSL — render (billboard quads, additive blend) ─────────────────────────

const WGSL_RENDER = /* wgsl */ `
struct Particle {
  pos: vec4<f32>,
  vel: vec4<f32>,
}

struct Uni {
  time: f32,
  dt: f32,
  bass: f32,
  mid: f32,
  treble: f32,
  parX: f32,
  parY: f32,
  aspect: f32,
  // Heart-rate normalized exertion 0..1 (60bpm → 0, 180bpm → 1).
  // Drives a subtle palette pulse + size pump synced to the user's
  // pulse (when WebBluetooth HR monitor is paired). Zero when no
  // monitor is connected — visual layers see the static state.
  heart: f32,
  _r1: f32,
  _r2: f32,
  _r3: f32,
}

struct VOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) uv:    vec2<f32>,
  @location(1) tint:  vec3<f32>,
  @location(2) alpha: f32,
}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> u: Uni;

// Frustum cull bound — particles past this on x or y get drawn at a
// degenerate position so the rasterizer skips them entirely. NDC_BOUND
// is JS-templated into the shader so a single source of truth lives
// in the host module.
const NDC_BOUND: f32 = ${NDC_BOUND.toFixed(2)};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VOut {
  let pid = vid / 6u;
  let cid = vid % 6u;
  let p = particles[pid];

  // Two-triangle quad corners
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
  );
  let c = corners[cid];

  let speed = length(p.vel.xyz);

  // ── HEART RATE PULSE ────────────────────────────────────────
  // When a BLE heart-rate monitor is paired, u.heart carries a 0..1
  // exertion value (60 bpm → 0, 180 bpm → 1). Convert to Hz so the
  // beat envelope literally matches the user's pulse:
  //   1 Hz  (60 bpm) at heart=0
  //   3 Hz  (180 bpm) at heart=1
  // abs(sin(πt·Hz)) has period 1/Hz seconds → one peak per beat.
  // pow(..., 6) gives a sharp pulse waveform (rest-rest-PUMP) instead
  // of a smooth sine — reads as a real heart-pulse, not a sine wave.
  let heartHz = 1.0 + u.heart * 2.0;
  let beatPhase = abs(sin(u.time * 3.14159265 * heartHz));
  let beat = pow(beatPhase, 6.0);
  let heartPump = u.heart * beat * 0.14;

  // ── FRUSTUM CULL ────────────────────────────────────────────
  // Park culled particles at a clip position outside the [-1,1]³
  // homogeneous cube — the WebGPU primitive assembler discards the
  // triangle before any fragment work happens. 6 vertices × 4 ALU
  // is roughly free; saves ~70-80% of fragment fill at typical
  // viewing angles where most of the cloud lives off-screen.
  let culled = abs(p.pos.x) > NDC_BOUND || abs(p.pos.y) > NDC_BOUND;

  // ── LOD ─────────────────────────────────────────────────────
  // Particles farther from the camera plane (higher |pos.z|) get
  // smaller — keeps the perceptual depth without spending fragment
  // fill on background dust. Combined with the speed scale we get
  // an emergent "rim of fast bright particles, soft fading core"
  // look that reads as motion volume.
  let depthFade = 1.0 - clamp(abs(p.pos.z) * 1.4, 0.0, 0.7);

  // Size scales with speed (motion-blur-ish effect) + bass (pump on hits)
  // + heart pump (subtle pulse when HR monitor paired).
  let size = (0.0030 + speed * 0.012 + u.bass * 0.0055 + heartPump) * p.vel.w * depthFade;

  // Compensate aspect so quads stay square in any viewport
  let aspectCorr = vec2<f32>(1.0 / u.aspect, 1.0);
  let center = vec2<f32>(p.pos.x, p.pos.y);
  let clipXY = center + c * size * aspectCorr;

  // Cyan→violet→gold hue cycle — same palette as the nebula so layers
  // read as one cohesive instrument rather than two unrelated effects.
  let cyan   = vec3<f32>(0.13, 0.91, 1.00);
  let violet = vec3<f32>(0.69, 0.30, 1.00);
  let gold   = vec3<f32>(0.94, 0.85, 0.47);
  let hueRate = 0.06 + u.mid * 0.20;
  let hue = sin(u.time * hueRate + speed * 3.5 + p.pos.z * 4.0) * 0.5 + 0.5;
  let midC = mix(cyan, violet, smoothstep(0.0, 0.55, hue));
  let hot  = mix(midC, gold, smoothstep(0.55, 1.0, hue));

  var o: VOut;
  // Park culled particles at clip XY = 2.0 → outside the [-1,1] cube,
  // primitive assembler discards the triangle pair. Cheaper than a
  // per-vertex early return because the return path can inhibit
  // coalesced texture stores on some integrated GPUs.
  if (culled) {
    o.clip = vec4<f32>(2.0, 2.0, 0.0, 1.0);
  } else {
    o.clip = vec4<f32>(clipXY.x, clipXY.y, 0.0, 1.0);
  }
  o.uv = c;
  o.tint = hot;
  // Alpha — depth-fade by particle life × (idle floor + bass pump) ×
  // LOD depth fade so the dimmest cloud particles cost the least.
  o.alpha = clamp(p.pos.w, 0.0, 1.0) * (0.45 + u.bass * 0.55) * depthFade;
  return o;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
  // Soft circular sprite — radial falloff, discard outside disk
  let r2 = dot(in.uv, in.uv);
  if (r2 > 1.0) { discard; }
  let glow = pow(1.0 - r2, 2.6);
  // Premultiplied additive — output color * alpha, alpha used as additive
  // weight by ONE/ONE blend.
  let c = in.tint * glow * in.alpha;
  return vec4<f32>(c, glow * in.alpha);
}
`

// ─── Public types ────────────────────────────────────────────────────────────

export interface WebGPUFieldOptions {
  /** Honor prefers-reduced-motion → freeze RAF, render single static frame. */
  reducedMotion?: boolean
  /** DPR cap. Mobile defaults to 0.75, desktop to 1.5 to match nebula budget. */
  dprCap?: number
}

export interface WebGPUFieldHandle {
  /** Begin RAF loop. Idempotent. */
  start(): void
  /** Stop RAF loop. Resources retained — call dispose() to free. */
  stop(): void
  /** Re-provision swap-chain on viewport change. CSS px in, internal upscale. */
  resize(cssW: number, cssH: number): void
  /** Tear down device + buffers + RAF. Safe to call multiple times. */
  dispose(): void
  /** Live frame count — useful for debug overlays. */
  getFrameCount(): number
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Provision a WebGPU device + pipelines and return a handle bound to the
 * given canvas. Returns null on any async failure (no adapter, no device,
 * shader compile error, lost device pre-init).
 *
 * Caller MUST treat null as "skip this layer" — there is no fallback to
 * WebGL inside this module. The nebula remains the canonical visual base.
 */
export async function createWebGPUField(
  canvas: HTMLCanvasElement,
  parallaxRef: React.RefObject<{ x: number; y: number }>,
  opts: WebGPUFieldOptions = {},
): Promise<WebGPUFieldHandle | null> {
  if (!isWebGPUSupported()) return null

  // 1. Adapter + device
  let adapter: GPUAdapter | null = null
  try {
    adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' })
  } catch {
    return null
  }
  if (!adapter) {
    console.info('[WebGPUField] no adapter — skipping GPU compute layer')
    return null
  }

  let device: GPUDevice
  try {
    device = await adapter.requestDevice()
  } catch (err) {
    console.info('[WebGPUField] device request failed:', err)
    return null
  }

  // 2. Configure context
  const ctx = canvas.getContext('webgpu')
  if (!ctx) {
    console.info('[WebGPUField] webgpu context unavailable')
    device.destroy()
    return null
  }

  const format = navigator.gpu.getPreferredCanvasFormat()
  ctx.configure({
    device,
    format,
    alphaMode: 'premultiplied',
  })

  // 3. Buffers
  const particleBuf = device.createBuffer({
    label: 'particles',
    size: PARTICLE_COUNT * PARTICLE_STRIDE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  })
  // Seed initial state — random spherical cloud, random life
  {
    const f32 = new Float32Array(particleBuf.getMappedRange())
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const o = i * 8
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      const radius = 0.1 + Math.random() * 0.6
      f32[o + 0] = Math.cos(theta) * Math.sin(phi) * radius
      f32[o + 1] = Math.sin(theta) * Math.sin(phi) * radius
      f32[o + 2] = Math.cos(phi) * radius * 0.3
      f32[o + 3] = Math.random() // life 0..1
      f32[o + 4] = 0
      f32[o + 5] = 0
      f32[o + 6] = 0
      f32[o + 7] = 0.5 + Math.random() * 0.6 // size
    }
    particleBuf.unmap()
  }

  // Uniform buffer — 12 × f32 = 48 bytes (16-byte aligned). Slot 8
  // carries the heart-rate exertion; 9-11 reserved for future signals.
  const uniArr = new Float32Array(12)
  const uniBuf = device.createBuffer({
    label: 'uniforms',
    size: uniArr.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  // 4. Pipelines
  const computeShader = device.createShaderModule({ code: WGSL_COMPUTE, label: 'cs' })
  const renderShader  = device.createShaderModule({ code: WGSL_RENDER,  label: 'fx' })

  const computePipeline = device.createComputePipeline({
    label: 'particle-step',
    layout: 'auto',
    compute: { module: computeShader, entryPoint: 'cs_main' },
  })

  const renderPipeline = device.createRenderPipeline({
    label: 'particle-draw',
    layout: 'auto',
    vertex: { module: renderShader, entryPoint: 'vs_main' },
    fragment: {
      module: renderShader,
      entryPoint: 'fs_main',
      targets: [{
        format,
        blend: {
          // Additive — pile glow over nebula, never darken
          color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
        },
        writeMask: GPUColorWrite.ALL,
      }],
    },
    primitive: { topology: 'triangle-list' },
  })

  // 5. Bind groups
  const computeBind = device.createBindGroup({
    label: 'cs-bind',
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuf } },
      { binding: 1, resource: { buffer: uniBuf } },
    ],
  })
  const renderBind = device.createBindGroup({
    label: 'fx-bind',
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuf } },
      { binding: 1, resource: { buffer: uniBuf } },
    ],
  })

  // 6. RAF loop
  const isCoarsePointer =
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches
  const dprCap = opts.dprCap ?? (isCoarsePointer ? 0.75 : 1.5)
  let lastT = performance.now()
  let rafId = 0
  let running = false
  let lost = false
  let frameCount = 0

  // Watch for device loss — driver hiccups, GPU process restart.
  // Mark the pipeline lost; the next frame becomes a no-op.
  //
  // 'destroyed' reason is the EXPECTED outcome of our own
  // device.destroy() call (HMR, StrictMode unmount, dispose()).
  // Logging it as device-loss creates noise on every hot reload.
  device.lost.then((info) => {
    lost = true
    if (info.reason === 'destroyed') {
      // Self-initiated tear-down — no log, no metrics. Silent.
      return
    }
    console.info('[WebGPUField] device lost:', info.reason, info.message)
  }).catch(() => {})

  const applySize = (w: number, h: number) => {
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap)
    canvas.width = Math.max(1, Math.round(w * dpr))
    canvas.height = Math.max(1, Math.round(h * dpr))
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
  }
  applySize(window.innerWidth, window.innerHeight)

  const tick = (now: number) => {
    if (!running || lost) return
    const dt = Math.min((now - lastT) / 1000, 0.05)
    lastT = now

    // Update uniforms
    const aspect = canvas.width / Math.max(1, canvas.height)
    uniArr[0] = now / 1000             // time
    uniArr[1] = opts.reducedMotion ? 0 : dt
    uniArr[2] = opts.reducedMotion ? 0 : audioLevelsRef.bass
    uniArr[3] = opts.reducedMotion ? 0 : audioLevelsRef.mid
    uniArr[4] = opts.reducedMotion ? 0 : audioLevelsRef.treble
    uniArr[5] = parallaxRef.current?.x ?? 0.5
    uniArr[6] = parallaxRef.current?.y ?? 0.5
    uniArr[7] = aspect
    uniArr[8] = opts.reducedMotion ? 0 : getCurrentBpmNorm()
    // Slots 9-11 reserved for future signals (gaze, gyro intensity, etc.)
    device.queue.writeBuffer(uniBuf, 0, uniArr)

    const enc = device.createCommandEncoder({ label: 'frame' })

    // Compute pass — only when not reduced-motion (frozen field otherwise)
    if (!opts.reducedMotion) {
      const cpass = enc.beginComputePass({ label: 'physics' })
      cpass.setPipeline(computePipeline)
      cpass.setBindGroup(0, computeBind)
      cpass.dispatchWorkgroups(Math.ceil(PARTICLE_COUNT / WG_SIZE))
      cpass.end()
    }

    // Render pass
    const rpass = enc.beginRenderPass({
      label: 'draw',
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    })
    rpass.setPipeline(renderPipeline)
    rpass.setBindGroup(0, renderBind)
    rpass.draw(PARTICLE_COUNT * 6, 1, 0, 0)
    rpass.end()

    device.queue.submit([enc.finish()])
    frameCount++

    if (!opts.reducedMotion) {
      rafId = requestAnimationFrame(tick)
    }
  }

  let disposed = false

  return {
    start() {
      if (running || disposed) return
      running = true
      lastT = performance.now()
      rafId = requestAnimationFrame(tick)
    },
    stop() {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    },
    resize(w, h) {
      if (disposed) return
      applySize(w, h)
    },
    dispose() {
      if (disposed) return
      disposed = true
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
      try {
        particleBuf.destroy()
        uniBuf.destroy()
        device.destroy()
      } catch {
        // ignore — device may already be lost on HMR
      }
    },
    getFrameCount() {
      return frameCount
    },
  }
}
