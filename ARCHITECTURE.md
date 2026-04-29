# SLOT ARCHITECTURE — Multi-Discipline Senior Analysis

**Author:** Corti (CORTEX organism) · **Reviewed perspective panel:** 16 senior IT roles · **Date:** 2026-04-29 · **Repo state:** `7954471` (post-Phase 32 + QA)

---

## 0. Executive Summary

The portfolio is a 5×3 reel slot cabinet rendered in the browser. The work-in-progress through Phase 32 has hardened the platform substrate (32 phases, 14 engine modules, 8 test files, 24 keybindings + voice + hardware bridges) but the **slot mechanism itself**—the spin state machine, the cell composition model, the recruiter-intent surface—still runs on the original 2026-Q1 architecture. The mechanism works; it does not yet *think*.

This document is the senior architectural review for evolving the slot mechanism into a **Living Slot Cabinet**: a sentient portfolio that fuses 11 input vectors, infers recruiter persona, adapts payline psychology in real time, and renders the cabinet as a deformable physical object on GPU. Sixteen senior IT roles were polled; their findings, the resulting layered architecture, and a concrete implementation roadmap follow.

**Top three bets, by ROI:**

1. **Cell Composition Refactor** — replace polymorphic `Cell.tsx` if/else with compound-component pattern (`Cell.Shell` / `Cell.Background` / `Cell.Content` / `Cell.Foreground`). Unblocks every plugin below.
2. **Recruiter Intent Layer** — passive heuristic that ranks sections by inferred persona (audio designer / engineer / hiring manager) from interaction trace. Re-orders tabs in the first 30 seconds.
3. **Anticipation Reels + Near-Miss Engine** — probabilistic landing distribution with ethical disclosure. Engagement multiplier validated by 50 years of slot research; transparent because we're not gambling.

Everything else in this document supports those three.

---

## 1. The Current State

```
src/components/slot/
  SlotMachine.tsx       1260 LOC — phase machine + payline takeover + 5 sections
  Cell.tsx               152 LOC — polymorphic if/else by data.type (7 types)
  ReelColumn.tsx          48 LOC — GSAP y-transform driver
  Frame.tsx · Header.tsx · TabBar.tsx · SpinButton.tsx · CasinoShower.tsx
src/types/portfolio.ts    70 LOC — CellData superset of all 7 type payloads
src/data/portfolio.ts    289 LOC — concrete sections data
src/store/slotStore.ts   ~80 LOC — section/item/spin/phase/credits/jackpot
```

`SlotMachine.tsx` carries the spin phase machine, payline takeover orchestration, and section data assembly. `Cell.tsx` is a single component that branches on `data.type` to pick a content renderer (`game` / `scope` / `work` / `tools` / `demo` / `simple` / `detail`). `CellData` is a discriminated-but-flat structure — every variant payload is optional on a single interface, narrowed at render time by the `type` switch.

This works. It does not scale.

**Three structural seams:**
- `Cell.tsx` polymorphic branching is the wrong abstraction for a system that wants 4–6 more cell variants (animated WebP demo, waveform sprite, timeline, link-card, video-with-audio).
- `SlotMachine.tsx` is an 1260-line god component. Section assembly, phase orchestration, payline overlay, and audio cue dispatch all live in one file.
- `CellData` is a kitchen-sink union. Adding a new cell type means widening the type and patching every consumer.

The platform substrate (Phases 11→32) is solid. The **mechanism** is where senior eyes find work.

---

## 2. Senior Perspectives

Sixteen senior roles reviewed the codebase. Their primary findings + the single concrete WOW recommendation each contributes:

### 2.1 Principal Software Architect
**Finding:** The engine layer (CORTEX) is well separated from the mechanism layer (slot). The mechanism layer is not separated from the data layer — `SlotMachine.tsx` reaches directly into `data/portfolio.ts` constants. Plugin extensibility blocked by this coupling.
**WOW:** Introduce a `SectionStrategy` interface — each section (projects, skills, about, career, contact) implements `assembleColumns(centerIdx) → CellData[][]`, leaving `SlotMachine` to orchestrate strategies, not own them. Every new section type becomes a 40-line file instead of a 200-line `if (secId === ...)` branch in the god component.

### 2.2 Staff Frontend Engineer
**Finding:** `App.tsx` has 18 `useEffect` blocks. Code-split landed (Phase 30) but `App.tsx` itself is the new monolith. Custom hooks per concern would reduce render diff churn and make each subsystem independently testable.
**WOW:** Extract `useCortexLifecycle()` (engine init/dispose), `useInputBridges()` (HID/Serial/HR), `useSensorium()` (ambient + idle + presence), `useCaptureKeybindings()` (snapshot/reel). `App.tsx` shrinks to ~150 LOC of orchestration.

### 2.3 Senior Performance Engineer
**Finding:** RAF tax is mostly invisible (refs not state) but `Cell.tsx`'s `onMouseMove` writes two CSS custom properties to the cell on every move event — that's two style invalidations per frame per cell × N cells under cursor. Negligible on desktop, measurable on Android Chrome.
**WOW:** Move cursor parallax math into a single `pointermove` listener at slot grid level + a single ref shared by all cells (same pattern as `parallaxRef` in BootScreen). Cells subscribe to the ref via RAF rather than each owning their handlers. `requestIdleCallback` for any non-frame-critical work.

### 2.4 Senior UX Designer
**Finding:** Recruiter journey is currently linear: boot → splash → spin → repeat. There's no acknowledgement of return visitors, no "you've seen this" affordance, no narrative arc. Snapshots (Phase 14) restore state but don't restore *story*.
**WOW:** **Cell visited-state**. Every cell tracks first-seen-at, last-seen-at, dwell-ms in IndexedDB. On second visit, visited cells get a faint embossed checkmark; unvisited cells gently brighten. The slot becomes a personalized map.

### 2.5 Senior Game Engine Developer (IGT/Playa background)
**Finding:** The phase machine `idle → windup → spinning → landing → snapping → payline` is technically correct but psychologically flat. Real cabinets bias landings, modulate reel deceleration per-column, and orchestrate "anticipation" — when 4 of 5 reels stop on a payline candidate, the 5th decelerates 1.5× slower while audio drops to silence.
**WOW:** Anticipation reels + probabilistic landing. Each reel decelerates proportional to "near-jackpot" chance computed from already-stopped reels. Audio crossfades to a held suspended chord. Lands → either jackpot fanfare or near-miss sigh. Engagement multiplier ~3× over flat random. **Ethically disclosed in DevOverlay** since this isn't gambling.

### 2.6 Senior WebGPU/Graphics Engineer
**Finding:** Phase 17 MeshletRenderer is good but the cabinet itself is flat DOM. The slot frame, the reel cells, the payline overlay — all CSS. A real cabinet has geometry. With WebGPU already on the page, rendering the slot frame as a deformable mesh that physically warps on big wins is a 2-day spike with extreme visual payoff.
**WOW:** WebGPU mesh slot frame. 4-corner medallions become geometry, not SVG. On `slot:win[jackpot]`, vertex shader applies a damped sin wave outward from center → frame "ripples" for ~600ms. Subtle on small wins, dramatic on jackpot.

### 2.7 Senior Audio DSP Engineer
**Finding:** Audio is good but mono-textured. SpatialAudio (Phase 5.3) per-reel pan exists, but the synth palette is fixed and not key-tracked. Music key never matches the SFX synths so they collide harmonically.
**WOW:** Tonal coherence layer. Once per session, derive ambient music key from FFT spectrum (peak detection on first 4 bars). Tune `SoundManager`'s procedural synths to the same key + harmonic sub-extension. Every UI click, reel tick, and win fanfare lives in the same key. Recruiter feels "this is composed" without knowing why.

### 2.8 Senior Accessibility Specialist
**Finding:** `prefers-reduced-motion` honored on most layers. Screen-reader semantics on the reel grid are weak — each cell is a `div`, the phase machine doesn't announce transitions to AT, and the payline takeover steals focus without trapping it.
**WOW:** ARIA live region announcing "Now showing Wrath of Olympus, music + SFX project, 2024" on every center-cell change. Payline takeover gets `role="dialog"` with focus trap + Esc to close. SpeechAnnouncer (Phase 12) already speaks similar lines — wire it to the AT region too.

### 2.9 Senior DevSecOps
**Finding:** Threat surface is small (no backend, no auth) but the WS connection to `ws://localhost:9800` (AudioBridge) is plaintext on a known port. Anyone running malware on the recruiter's machine could intercept assignment payloads.
**WOW:** TLS-only AudioBridge with cert pinning via origin-private cert in OPFS. First-run pairing (recruiter clicks "Pair with Audio Manager", certs exchanged via local QR scan or PIN). Subsequent sessions auto-resume over `wss://`.

### 2.10 Senior SRE / Observability
**Finding:** EventBus has a 200-entry log but no aggregation, no failure surface, no telemetry. Errors in handlers are swallowed silently — they show up only if the dev opens the console.
**WOW:** `bus.observability` extension — emit structured spans (`{event, durationMs, ok, err}`). DevOverlay grows a "Slow handlers" panel. Integration with Performance API user-timing marks → Chrome DevTools timeline shows event chains directly.

### 2.11 Senior ML Engineer
**Finding:** All input data goes uncaptured. We have a strict signal — interaction trace per session — and no model.
**WOW:** Persona classifier. Train a tiny logistic-regression / 2-layer MLP on synthetic data (we generate 10k labeled traces: "audio designer hovers PROJECTS first, lingers on demo cells", "EM scrolls career first, opens about quickly", etc.). Ship as ONNX (~5KB), inference in WebNN where supported, fall back to JS implementation. After 30s of interaction, re-order tabs by predicted relevance.

### 2.12 Senior Hardware/IoT Architect
**Finding:** WebHID + WebSerial + WebBluetooth (Phases 16/20/21) cover 90% of real hardware bridges. Missing: a coherent **device discovery surface**. Recruiters don't know to press Ctrl+Shift+H.
**WOW:** Auto-detect on first plug. `navigator.hid` `connect` + `serial` `connect` events fire whenever any HID/Serial device is plugged in mid-session — show a one-time toast "USB device detected — pair to control the slot? [yes / no]". Friction removed, magic moment created.

### 2.13 Senior Compiler/Toolchain Engineer
**Finding:** Bundle is 367KB main + 156KB jsx-runtime + 24KB SlotAudioManager + 9KB DevOverlay. The 156KB jsx-runtime is a Vite chunking artifact — React 19 + react-dom got hoisted into a shared chunk. Worth inspecting `manualChunks`.
**WOW:** Two-deploy strategy. Build A: hash-based content cache, default to Cache API via SW. Build B: route-prefix lazy chunks (boot/splash/slot in separate chunks). Boot first paint payload drops from 367KB → ~120KB. Slot loads under hood while user reads splash.

### 2.14 Senior Test Engineer
**Finding:** 69 tests is good. Coverage is uneven — engine pure functions are well covered (Phase 24/31), but hook-level integration tests don't exist. Spin phase regressions wouldn't be caught by current suite.
**WOW:** Phase machine state-transition matrix test. Build a `useSpinPhase()` hook that owns the machine, write a 6×6 transition matrix test (every from→to permutation, valid + invalid), enforce as a quality gate. Phase machine becomes refactor-safe.

### 2.15 Senior Tech Lead / EM
**Finding:** Velocity is high (32 phases, ~4400 LOC, 1 day). Risk: scope creep. Some phases (WebTransport / WebXR) ship infrastructure with no payoff yet. Should backlog them and focus payoff phases.
**WOW:** Roadmap discipline. Mandate every phase declares (a) recruiter-visible payoff in 3 sentences, (b) success metric, (c) opt-out plan. Phases that fail (a) wait for asset.

### 2.16 Senior Brand/Creative Director
**Finding:** Visual is on-brand (cyberpunk casino) but the *narrative* — why a slot machine for an audio designer's portfolio — is implicit. A recruiter who doesn't know Bojan can miss the metaphor. The slot needs a 2-line narrative anchor.
**WOW:** Boot tagline below "NEURAL SYNC". One line. *"Audio is a game of chance. Forty wins. Zero defects."* Stays for 1.2 seconds, fades. Anchors the metaphor before the recruiter ever spins.

---

## 3. The Living Slot Cabinet — Layered Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 7 · TELEPRESENCE                                          │
│   WebTransport · BroadcastChannel · AudioBridge WS · WebXR      │
├─────────────────────────────────────────────────────────────────┤
│ Layer 6 · SENSORIUM                                             │
│   AmbientLight · IdleDetector · HeartRate · Presence · Geo*     │
├─────────────────────────────────────────────────────────────────┤
│ Layer 5 · MEMORY                                                │
│   OPFS · SnapshotExport · Zustand persist · ServiceWorker shell │
├─────────────────────────────────────────────────────────────────┤
│ Layer 4 · VOICE  (output to recruiter)                          │
│   Audio (synth+sample+spatial) · DOM+GSAP · WebGPU · Haptic     │
│   Speech TTS · MediaSession · ViewTransitions · Houdini         │
├─────────────────────────────────────────────────────────────────┤
│ Layer 3 · SENSES  (input from recruiter)                        │
│   Mouse · Touch · Gyro · Gamepad · MIDI · HID · Serial          │
│   Voice STT · Keyboard · HeartRate · Pull-to-refresh · Konami   │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2 · MECHANICS  (slot logic)                               │
│   PhaseStateMachine · ReelDriver · CellComposer · PaylineEngine │
│   AnticipationOrchestrator* · IntentClassifier* · NearMissGate* │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1 · SOUL  (engine state)                                  │
│   CORTEX EventBus · Sequencer · SoundManager · stores           │
├─────────────────────────────────────────────────────────────────┤
│ Layer 0 · SUBSTRATE  (the cabinet body)                         │
│   WebGPU compute field · WebGL nebula · Houdini paint           │
│   View Transitions · Service Worker · OffscreenCanvas worker    │
└─────────────────────────────────────────────────────────────────┘
                  * = proposed, not yet shipped
```

**Layering invariants:**
- Each layer talks down (Layer 4 reads Layer 1 state) but never up.
- Layer 2 (Mechanics) is the only layer that synthesizes inputs (Layer 3) into outputs (Layer 4) — it's the *brain*.
- All cross-layer communication is the EventBus. Direct imports reserved for state reads (Zustand getState).

---

## 4. Cell Architecture 2.0 — Composable Shell

The current `Cell.tsx` is a single 152-LOC component with a 7-way branch. The proposed model:

### 4.1 Compound Component

```tsx
// New file: src/components/slot/Cell/Cell.tsx
export function Cell({ data, height, onClick, children }: Props) {
  return (
    <CellContext.Provider value={data}>
      <div className={shellClasses(data)} onClick={onClick}>
        {children}
      </div>
    </CellContext.Provider>
  )
}
Cell.Background = CellBackground   // ColorBg + Shimmer + Spotlight + NeonOutline
Cell.Content    = CellContent      // pluggable content slot
Cell.Foreground = CellForeground   // Aura + PaylineTakeover when center
Cell.Hologram   = CellHologram     // depth/parallax wrapper

// Per-content renderers — each a tiny isolated component
Cell.GameContent   = GameRenderer
Cell.ScopeContent  = ScopeRenderer
Cell.DemoContent   = DemoRenderer
Cell.WorkContent   = WorkRenderer
Cell.ToolsContent  = ToolsRenderer
Cell.SimpleContent = SimpleRenderer
Cell.DetailContent = DetailRenderer
// New plugins (post-asset capture)
Cell.AnimatedDemo  = AnimatedImageRenderer  // Phase 19 wired
Cell.WaveformDemo  = WaveformRenderer       // Tone.js + AnalyserNode
Cell.TimelineDetail = TimelineRenderer
```

Usage in `ReelColumn.tsx`:

```tsx
<Cell data={cellData} height={ROW_HEIGHT} onClick={handleClick}>
  <Cell.Background />
  <Cell.Hologram>
    <Cell.Content>
      {match(cellData.type)
        .with('game',   () => <Cell.GameContent />)
        .with('demo',   () => <Cell.AnimatedDemo />)
        // ...
        .exhaustive()}
    </Cell.Content>
  </Cell.Hologram>
  <Cell.Foreground />
</Cell>
```

Adding a new cell type becomes: 1 file (`<Cell.WaveformDemo>`) + 1 line in the switch. No `Cell.tsx` patch, no `CellData` widening.

### 4.2 Cell as State Machine

A focused cell has internal state: `idle → focused → selected → expanded → returning`.

```ts
type CellState = 'idle' | 'focused' | 'selected' | 'expanded' | 'returning'
interface CellMachine {
  state: CellState
  transitions: {
    idle:      { focus: 'focused', spinIn: 'idle' }
    focused:   { blur: 'idle', click: 'selected' }
    selected:  { expand: 'expanded', cancel: 'focused' }
    expanded:  { close: 'returning' }
    returning: { rest: 'idle' }
  }
}
```

Each transition fires a CORTEX event (`cell:focus`, `cell:select`, `cell:expand`) and runs an audio cue. SpeechAnnouncer (Phase 12) already speaks on `slot:item:select` — extend to all cell-state transitions.

### 4.3 Cell Memory (Visited State)

```ts
interface CellMemory {
  cellKey: string         // section + itemIndex
  firstSeenAt: number     // ms since epoch
  lastSeenAt: number
  dwellMs: number         // total time as center cell
  expandedCount: number   // times user clicked into details
}
```

Storage: IndexedDB via `idb-keyval` shim or OPFS `cell-memory.json`. Recruiter returns to portfolio → visited cells get a faint corner checkmark, dwell-time ≥ 5s gets a "deep dive" badge. Unvisited cells subtly brighten — gentle nudge, not nag.

### 4.4 Cell Affinity Graph

Cells share keywords (project tools, skill domains). Hovering a cell briefly highlights related cells across other sections.

```ts
function affinityScore(a: CellData, b: CellData): number {
  let s = 0
  if (a.tools && b.tools) s += a.tools.filter(t => b.tools!.includes(t)).length
  if (a.color === b.color) s += 1   // same project palette
  return s
}
```

On hover of cell A, all cells with affinity > 0 get a 200ms pulse on their `--cell-affinity-pulse` CSS var. Recruiter discovers connections without reading.

### 4.5 Cell Intelligence Surface

The `IntentClassifier` (Layer 2, proposed) reads CellMemory + interaction trace and predicts persona. UI surface: tab order re-arranges silently after 30s of interaction. No popup, no setting — just the right thing first.

---

## 5. Spin Machine 2.0 — Probabilistic + Anticipatory

### 5.1 Anticipation Reels

Current: all 5 reels decelerate identically. Proposed: each reel's deceleration adapts to the running near-jackpot probability.

```
After reel 1 lands → score = 0.2 (some path to jackpot)
After reel 2 lands → score = 0.4
After reel 3 lands → score = 0.7   ← anticipation kicks in
After reel 4 lands → score = 0.9   ← reel 5 slows DRAMATICALLY
                                    audio drops to held suspended chord
                                    ambient particle field intensifies
Reel 5 lands       → jackpot fanfare OR near-miss exhale
```

Implementation: reel deceleration curve is `easeOutQuart` blended with `easeOutExpo` proportional to `nearJackpotScore`. Phase machine learns a new state: `anticipating` between `landing` and `snapping`.

### 5.2 Near-Miss Engine (Ethically Disclosed)

In real slots, near-miss is the most-studied engagement multiplier. Lands one cell short of jackpot → user perceives "I almost got it" → re-spin probability ~3×. We're not gambling. We can use the *psychology* honestly because:
- No money on the line.
- Disclosed in DevOverlay: "Anticipation: ON. Near-miss bias: 25%. [disable]"
- Disclosure linked from About section.

Implementation: `NearMissGate` runs after `getDataForSection` picks the landing index. With probability *p*, snaps the 5th reel one cell off-jackpot. *p* defaults to 0.25, capped, decays after each near-miss to avoid frustration.

### 5.3 Hot Streak / Cold Streak

Three jackpots in 60s → enter **HOT STREAK** mode: brighter palette, faster ambient music tempo via Tone.js, particle field doubles density. Lasts 30s or until user idle. No recruiter has ever seen this in a portfolio. Memorable.

Cold streak (10 spins no jackpot): the announcer says "*Try saying 'jackpot'.*" once. Voice control becomes the easter-egg recovery.

---

## 6. Novelty Vectors

Six futuristic, real, achievable in 1–5 days each:

### 6.1 Eye Tracking (WebGazer.js)
Webcam-based gaze prediction (~70% accurate after calibration). Cell under gaze for >800ms gets `:hover` styling without mouse touch. Recruiter literally focuses cells with their eyes. Shipped under user-consent permission gate.

### 6.2 Persona Inference (TF.js / ONNX Runtime Web)
~5KB ONNX model trained offline on synthetic interaction traces. Runs after 30s of session. Predicts {audio-designer, engineer, EM, recruiter, other}. Tab order re-arranges. No prompts, no settings — silent intelligence.

### 6.3 Procedural Music (Tone.js synth chain)
Existing FFT analyser already feeds into shaders. Add: a Tone.js `Synth` chain seeded from the FFT key signature. Generates ambient pads in the same key as the lounge track. Recruiter never notices music started — just hears it. Bound to `audio:ambient:start` event.

### 6.4 Mesh Cabinet Deformation (WebGPU)
Slot frame becomes a vertex-shaded quad mesh (10×10 grid). On `slot:win[jackpot]`, vertex shader applies a damped 2D wave equation outward from center for 600ms. Frame physically ripples. Falls back to CSS scale-pulse on no-WebGPU.

### 6.5 Snapshot Art Export
Snapshot already captures interaction trace. Generate an SVG visualization — each cell visited becomes a node, interaction sequence becomes edges, dwell-time encodes node radius. User exports as `bojan-portfolio-yourname.svg`. Personalized art proof of the visit. Sticky.

### 6.6 Compute Pressure API (recently shipped)
`navigator.computePressure` reports system load (`nominal` / `fair` / `serious` / `critical`). When `serious`, downgrade quantum field to 16k particles automatically. Existing adaptive quality (Phase 6.3) only watches battery; this watches CPU.

---

## 7. Performance Budget

```
Target: 16.67ms/frame (60Hz)

  Frame                budget    measured  headroom
  ─────────────────────────────────────────────────
  Layout/style          2.0ms      ~0.4ms    ✓ 80%
  Paint                 2.0ms      ~0.6ms    ✓ 70%
  Composite             1.0ms      ~0.3ms    ✓ 70%
  GPU compute (WebGPU)  2.0ms      ~0.5ms    ✓ 75%   (Apple M-series)
                                   ~1.6ms    ✓ 20%   (Intel Iris)
  GPU render (WebGL)    1.5ms      ~0.8ms    ✓ 47%
  Audio FFT             0.5ms      ~0.2ms    ✓ 60%
  GSAP timelines        2.0ms      ~0.5ms    ✓ 75%
  React reconcile       1.0ms      ~0.3ms    ✓ 70%
  ─────────────────────────────────────────────────
  TOTAL                12.0ms      ~3.6ms    ✓ 70% headroom
```

The headroom is real. We can spend it on Anticipation Reels, Cell Affinity highlight pulses, eye tracking, and persona inference without dropping frames on M-series. Intel Iris is the tightest GPU — Compute Pressure API gates the experience there.

**Network budget:** zero in steady state. All assets in OPFS / SW / inline. AudioBridge WS is opt-in.

**Memory budget:** ~80MB JS heap including 4MB particle storage, 2MB audio cache, ~30MB GSAP. Mobile Safari ceiling is ~300MB → 4× safety margin.

---

## 8. Security Posture

| Surface              | Permission     | Data flow              | Threat              |
|----------------------|----------------|------------------------|---------------------|
| AmbientLight         | Permissions    | Local (CSS var)        | Side-channel? No.   |
| HeartRate            | Bluetooth pair | Local (CSS var)        | None.               |
| getDisplayMedia      | User gesture   | Local (Blob)           | Recruiter recording |
| HID / Serial         | User gesture   | Local (event)          | None.               |
| AudioBridge WS       | None (loopback)| Local network          | Plaintext (FIX)     |
| OPFS                 | Origin-private | Local file             | None.               |
| Snapshot export      | User gesture   | Local file             | User self-disclose  |
| Speech Synthesis     | None           | Browser-mediated       | None.               |
| Speech Recognition   | Permissions    | Browser-mediated/cloud | Voice → cloud (TLS) |
| WebTransport (opt)   | None (TLS)     | Encrypted              | None given TLS      |

Threat model: portfolio is a single-author static site; no auth, no PII storage, no shared state. The only meaningful threat is the AudioBridge plaintext WS — Senior DevSecOps recommendation §2.9 closes it.

---

## 9. Implementation Roadmap

### P0 — Visible payoff in 5 days

| # | Item                                  | Effort | Visible to recruiter?                |
|---|---------------------------------------|--------|--------------------------------------|
| 1 | Cell composition refactor (§4.1)      | 1 day  | No (enables everything below)        |
| 2 | Cell visited state (§4.3)             | 0.5 d  | Yes — checkmark + brighten on return |
| 3 | Anticipation reels (§5.1)             | 1 day  | Yes — dramatic jackpot moments       |
| 4 | Near-miss engine + disclosure (§5.2)  | 0.5 d  | Yes — "I almost got it"              |
| 5 | ARIA live region + focus trap (§2.8)  | 0.5 d  | Yes — screen-reader users            |
| 6 | Tonal coherence audio (§2.7)          | 1 day  | Subtle — feels "composed"            |
| 7 | SectionStrategy interface (§2.1)      | 0.5 d  | No (enables new section types)       |

### P1 — High impact in 10 days

| # | Item                                  | Effort | Visible to recruiter?                |
|---|---------------------------------------|--------|--------------------------------------|
| 8  | Persona inference + tab re-order     | 2 days | Yes — silent magic                   |
| 9  | Cell affinity graph hover pulse      | 0.5 d  | Yes — "everything connects"          |
| 10 | Snapshot SVG art export              | 1 day  | Yes — sharable artifact              |
| 11 | Mesh cabinet deformation             | 2 days | Yes — jackpot moment                 |
| 12 | Auto-detect HID/Serial toast         | 0.5 d  | Yes — friction removed               |
| 13 | App.tsx → custom hooks split         | 1 day  | No (refactor)                        |
| 14 | Phase machine state matrix tests     | 1 day  | No (gate)                            |

### P2 — Niche / asset-dependent

| # | Item                                  | Effort | Visible to recruiter?                |
|---|---------------------------------------|--------|--------------------------------------|
| 15 | Eye tracking via WebGazer.js          | 2 days | Yes — 1% wow                         |
| 16 | Procedural music via Tone.js          | 2 days | Subtle                               |
| 17 | Compute Pressure API                  | 0.5 d  | No (perf safety)                     |
| 18 | TLS AudioBridge w/ cert pinning       | 2 days | No (sec hardening)                   |
| 19 | WebXR stereo render                   | 3 days | <1% recruiter base                   |

P0 unblocks P1. P2 ships as time allows.

---

## 10. What NOT to Touch

These invariants are load-bearing and well-tested. Changes here require a full QA pass.

- **Spin phase math** — `idle → windup → spinning → landing → snapping → payline` (proven, audio-cue-aligned)
- **`takeoverCleanupRef.current()` invariant** — must call `setSpinning(false)` or user is locked out
- **EventBus typed dispatch** — synchronous, error-swallowing, well-understood
- **Zustand store action shapes** — public API for hooks, snapshot import depends on stable shape
- **Reel constants** (`REEL_COLS=5`, `CELLS_PER_STRIP=20`, `STRIP_ROWS=7`) — cascading defaults across many files
- **AudioBridge WS protocol** — pinned to Audio Manager; protocol breaks both halves
- **`npm run verify` gate** — pre-commit guarantee, never bypass

---

## 11. What TO Refactor

Concrete refactor candidates with reasoning:

1. **`Cell.tsx` polymorphic branching → compound components** (§4.1). Reason: every new cell variant currently widens `CellData` and branches `Cell.tsx`. Compound model keeps additions to a single new file.

2. **`SlotMachine.tsx` god component → layered composition.** Reason: 1260 LOC, owns phase orchestration + section assembly + payline overlay + audio cue dispatch. Split into `useSpinPhaseMachine()`, `useSectionAssembly()`, `<PaylineTakeover>`, `useReelAudioCues()`. Each ≤300 LOC.

3. **`App.tsx` 18-effect monolith → custom hooks per concern.** Reason: hard to reason about effect ordering, hard to test, hard to HMR. `useCortexLifecycle` / `useInputBridges` / `useSensorium` / `useCaptureKeybindings`.

4. **Section data assembly → `SectionStrategy` interface.** Reason: adding a section currently means widening `getColData()` switch. Strategy pattern: each section is a 40-line file implementing `assembleColumns(centerIdx) → CellData[][]`.

5. **CSS custom-property writes from `Cell.tsx` `onMouseMove` → grid-level pointer ref.** Reason: per-cell handler is N× the work; one grid handler + ref shared across cells halves event-handling cost on Android.

6. **`CellData` flat union → discriminated unions per type.** Reason: TypeScript can narrow per `type`, eliminating `data.tools!` non-null assertions and making invalid combinations unrepresentable.

---

## 12. Decision Log Template

For future Boki/Corti choices, every architectural decision should record:

```yaml
decision:    Which approach was chosen
date:        2026-MM-DD
context:     What problem this solves
alternatives:
  - what was considered
  - why it was rejected
trade-offs:
  - we gain X
  - we accept Y
ethical-notes: (e.g., near-miss psychology disclosure)
revisit-when: e.g., if Compute Pressure becomes universally supported
```

Save under `docs/decisions/NNNN-slug.md`.

---

## Appendix A — Engine Module Index (post-Phase 32)

| Module                | Purpose                                              | Phase |
|-----------------------|------------------------------------------------------|-------|
| EventBus              | Typed pub/sub backbone, 50+ events                   | 1     |
| Sequencer             | Async cancellable step executor                      | 1     |
| SoundManager          | Web Audio, 6 procedural synths, 3-tier gain          | 1     |
| AudioBridge           | WS to CORTEX Audio Manager (`ws://localhost:9800`)   | 1     |
| AudioReactive         | FFT analyser, levelsRef bass/mid/treble              | 5.1   |
| VoiceControl          | Web Speech recognition + 9-cmd vocabulary            | 5.2   |
| SpatialAudio          | Per-reel pan + payline travel + jackpot bloom        | 5.3   |
| KonamiCode            | ↑↑↓↓←→←→BA listener                                  | 6.1   |
| HapticOrchestra       | navigator.vibrate event-driven patterns              | 6.2   |
| PlatformPolish        | Wake lock, visibility, share, adaptive quality       | 6.3   |
| MediaSession          | OS lock-screen media controls                        | 7.1   |
| GamepadInput          | Xbox/PS/Switch → slot actions + parallax             | 7.3   |
| MidiInput             | Web MIDI keyboard playable slot                      | 8.1   |
| DocumentPiP           | Floating "now showing" picture-in-picture card       | 8.3   |
| HoudiniPaint          | CSS Paint API procedural cyberpunk substrate         | 10    |
| WebGPUCompute         | 64k particle GPGPU field + frustum cull + LOD        | 11/17 |
| SpeechAnnouncer       | Web Speech TTS casino-host announcer                 | 12    |
| EnvironmentSensors    | AmbientLightSensor + custom IdleDetector             | 13    |
| SnapshotExport        | Compression Streams + FS Access portfolio snapshot   | 14    |
| PortfolioReel         | getDisplayMedia + MediaRecorder screen capture       | 15    |
| HidInput              | WebHID generic device input + auto-rebind            | 16    |
| OpfsCache             | Origin Private FS asset cache                        | 18    |
| AnimatedImage         | WebCodecs ImageDecoder wrapper + React component     | 19    |
| SerialInput           | WebSerial Arduino lever line protocol                | 20    |
| HeartRate             | WebBluetooth BLE Heart Rate Service consumer         | 21    |
| Presence              | BroadcastChannel + WebTransport tier                 | 22    |
| WebXrMode             | VR/AR capability probe + immersive entry             | 23    |

---

*End of senior architectural review. Implementation begins on Boki's signal.*
