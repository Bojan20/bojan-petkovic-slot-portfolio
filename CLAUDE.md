# Bojan Petkovic Slot Portfolio — Master Context

Premium casino-themed React portfolio. Owner: Corti (CORTEX organism).
Boki is the human collaborator. Full autonomy — implement directly, never plan mode.

## Tech stack
React 19.2 · TS 6.0 strict · Vite 8 · Zustand 5 (persist) · Howler 2.2 · Tone 15 · GSAP 3.14 · framer-motion 12 · Matter.js 0.20 · vitest 4 · playwright 1.59

## Scripts
- `npm run dev` — vite dev server
- `npm run test:run` — vitest once
- `npm run verify` — **canonical pre-commit gate**: tsc + vitest + build
- `npm run smoke` — node smoke test

## Architecture at a glance (~6015 LOC, 60 files)

```
App.tsx (phase: boot → splash → entering → slot)
 ├─ BootScreen    — tap-to-unlock, 6 loading steps, emits boot:*
 ├─ SplashScreen  — GSAP 5-step timeline, emits splash:title:*
 ├─ SlotMachine   — 5×3 reel, spin phases, payline takeover
 │   ├─ Frame     — fluted pillars + 4 corner medallions
 │   ├─ ReelColumn × 5 — GSAP-driven y-transform
 │   ├─ Cell      — polymorphic (game/scope/detail/tools/demo/simple)
 │   ├─ Header / TabBar / SpinButton
 │   └─ CasinoShower — Matter.js 90-particle physics
 └─ SlotAudioManager (Shift+A) — standalone audio control panel

CORTEX Engine (pub/sub backbone)
 ├─ EventBus           — typed, 50+ events + wildcards, sync dispatch
 ├─ SoundManager       — Web Audio, 6 procedural synths, 3-tier gain
 ├─ AudioBridge        — ws://localhost:9800, 40 hookId→event mappings
 ├─ AudioReactive      — FFT analyser, levelsRef bass/mid/treble
 ├─ Sequencer          — async step executor, cancellable
 ├─ HapticOrchestra    — navigator.vibrate event-driven patterns
 ├─ PlatformPolish     — wake lock, visibility, share, adaptive quality
 ├─ MediaSession       — OS lock-screen media controls
 ├─ GamepadInput       — Xbox/PS/Switch → slot actions + parallax
 ├─ MidiInput          — Web MIDI keyboard playable slot
 ├─ DocumentPiP        — floating "now showing" card (Phase 8.3)
 ├─ HoudiniPaint       — CSS Paint API procedural substrate
 ├─ WebGPUCompute      — 64k particle GPGPU field + cull + LOD
 ├─ SpeechAnnouncer    — Web Speech TTS casino announcer
 ├─ EnvironmentSensors — AmbientLight + IdleDetector
 ├─ SnapshotExport     — gzip snapshot via Compression Streams + FS Access
 ├─ PortfolioReel      — getDisplayMedia + MediaRecorder screen capture
 ├─ HidInput           — WebHID generic device input + auto-rebind
 ├─ OpfsCache          — Origin Private FS asset cache
 ├─ AnimatedImage      — WebCodecs ImageDecoder wrapper
 ├─ SerialInput        — WebSerial Arduino lever line protocol
 ├─ HeartRate          — WebBluetooth BLE HR Service consumer
 ├─ Presence           — BroadcastChannel + WebTransport tier
 ├─ WebXrMode          — VR/AR capability probe + immersive entry
 └─ portfolioConfig    — master config (boot/audio/sequences/timing)

Features
 ├─ reel/  — pure math: shuffleCells, buildReelStrip (20-cell strip)
 └─ audio/ — Howler cache + Tone synths (UIClick, ReelTick, SpinStart, ReelLand, WinFanfare)

State (Zustand)
 ├─ slotStore  — section/item/spin/phase/credits(777)/jackpot(1337)
 └─ audioStore — persisted: master/music/sfx volumes + mute + ambient

Hooks (30+)  — wire CORTEX events to React components
 └─ 8 splash · 7 slot · 6 boot · 7 audio · 2 transition · 3 system · 2 sound

Data · Types · Styles
```

## Specialized agents (use proactively)

| Agent | Scope | When to invoke |
|-------|-------|----------------|
| **cortex-engine** | `src/engine/**` | EventBus types, synth DSP, AudioBridge, Sequencer, config |
| **slot-ui** | `src/components/slot/**` | Spin phases, payline, GSAP, Matter.js, Cell rendering |
| **audio-manager** | `SlotAudioManager.*` | Panel UI, waveform, solo/mute, sequences, Shift+A |
| **state-hooks** | `src/store/**`, `src/hooks/**` | Zustand actions, event subscribers, 30+ hooks |
| **reel-audio-engine** | `src/features/**` | Reel math, Howler cache, Tone synth tuning |
| **portfolio-content** | `src/data/**`, `src/types/**` | Projects, skills, content edits |
| **app-orchestrator** | `App.tsx`, `BootScreen`, build config | Phase machine, boot unlock, Vite/tsc/vitest |

## Spin phase state machine (load-bearing)
`idle → windup (140ms stagger) → spinning (GSAP repeat + blur) → landing (1.025 bounce) → snapping (8-keyframe) → payline takeover (z-index 10000+, fullscreen)`

`takeoverCleanupRef.current()` MUST call `setSpinning(false)` or user is locked out.

## Keybindings (post-boot, all platforms)

| Combo                    | Action                                              |
|--------------------------|-----------------------------------------------------|
| ↑↑↓↓←→←→BA               | Toggle dev overlay (Konami)                         |
| Shift+A                  | Toggle SlotAudioManager panel                       |
| Esc / X                  | Close dev overlay                                   |
| V                        | Toggle voice control                                |
| Ctrl/Cmd+Shift+S         | Save portfolio snapshot (.json.gz)                  |
| Ctrl/Cmd+Shift+L         | Load portfolio snapshot                             |
| Ctrl/Cmd+Shift+R         | Toggle screen-recording reel (WebM, 5min cap)       |
| Ctrl/Cmd+Shift+H         | Pair HID device (Stream Deck, X-keys, Arduino HID)  |
| Ctrl/Cmd+Shift+Y         | Pair USB-Serial device (Arduino lever, RP2040)      |
| Ctrl/Cmd+Shift+B         | Pair BLE heart-rate monitor                         |

## Capability matrix (graceful no-op on missing platforms)

| API                  | Chromium | Safari    | Firefox | Notes                              |
|----------------------|----------|-----------|---------|------------------------------------|
| WebGPU               | 113+     | 17+       | flag    | quantum field; nebula falls back   |
| ImageDecoder         | 94+      | 17+       | no      | <AnimatedImage> falls back to <img>|
| OPFS                 | 86+      | 17+       | 111+    | falls back to network              |
| AmbientLightSensor   | 109+     | no        | no      | --ambient-lux defaults to 0.5      |
| getDisplayMedia      | 72+      | 13+       | 66+     | reel capture                       |
| WebHID               | 89+      | no        | no      | round-robin action mapping         |
| WebSerial            | 89+      | no        | no      | line-protocol firmware             |
| WebBluetooth         | 56+      | no        | no      | HTTPS / localhost only             |
| WebTransport         | 113+     | TP        | flag    | optional tier; BC fallback         |
| WebXR                | 79+      | VisionOS  | flag    | probe + enterImmersive             |
| Speech Synthesis     | yes      | yes       | yes     | Daniel/Alex/Arthur preferred       |
| Compression Stream   | 80+      | 16.4+     | 113+    | snapshot gzip                      |

DevOverlay (↑↑↓↓←→←→BA) shows live capability pills + connect buttons
for HID/Serial/HR so a dev can sanity-check support without a console.

## EventBus (50+ events)
Boot(6) · Splash(8) · Transition(2) · Slot(7) · Audio(8) · Voice(6) · System(3) ·
Env(3: env:lux, user:idle, user:active) · Custom(snapshot/reel/hid/serial/heart/
presence/xr — opt-in via `custom:` prefix). Dispatch is **synchronous**. Handler
errors are swallowed (check `bus.getLog()` or DEV console).

## Core invariants
1. AudioContext unlock requires user gesture — `boot:tap` is the canonical moment
2. StrictMode double-mounts — all engine init must be idempotent (`dispose` + `init`)
3. Stores don't emit events — hooks listen to bus and call `store.action()`
4. `setSection` resets `currentItemIdx` to 0 atomically
5. Volume setters clamp 0–1 via `clamp01()`
6. Reel constants (`REEL_COLS=5`, `CELLS_PER_STRIP=20`) cascade — don't change casually
7. `npm run verify` is the pre-commit gate — never bypass

## QA workflow (from root CLAUDE.md)
A. CONTEXT → B. CURRENT BEHAVIOR → C. ISSUE → D. ROOT CAUSE → E. SAFE FIX → F. IMPACT → G. CODE → H. POST-FIX VALIDATION

## Known gaps
- No integration tests for event flow
- No audio engine unit tests
- No hook subscription lifecycle tests
- `audioStore` localStorage persistence untested
- AudioBridge reconnect is silent (no UI surface)

## Dev server
`npm run dev` → `http://localhost:5180/` (current running instance: bg ID `b611g38qa`)
