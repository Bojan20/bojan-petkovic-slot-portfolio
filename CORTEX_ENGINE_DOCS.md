# CORTEX Engine v1.0 — Technical Documentation

## Overview

CORTEX Engine je event-driven sistem koji pokrece ceo portfolio sajt.
Inspirisan IGT Playa platformom, ali ga nadmasuje u svakoj dimenziji:

| IGT Playa | CORTEX Engine |
|-----------|---------------|
| Postal.js (bez tipova) | **TypeScript EventBus** sa full inference |
| Custom Sequencer (callback hell) | **Async/Await Sequencer** (cancellable) |
| Hardcoded SFX | **JSON-driven SoundManager** + Web Audio synth |
| Zero type safety | **Zero `any`, zero `unknown`** |
| Manual wiring | **Auto event-to-sound mapping** |

---

## Architecture

```
src/engine/
├── EventBus.ts              # Typed pub/sub magistrala
├── Sequencer.ts             # Declarative command executor
├── SoundManager.ts          # Event-driven audio system
├── index.ts                 # Public API (single import point)
└── config/
    ├── configTypes.ts        # TypeScript type definitions
    └── portfolioConfig.ts    # Master configuration object
```

### Data Flow

```
┌─────────────────────┐
│  portfolioConfig     │  JSON-like config objekat
│  (boot, audio,       │  Source of truth za ceo sistem
│   sequences, timing) │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────────────┐
│          CORTEX Engine               │
│                                      │
│  EventBus ◄──── emit ──── React     │
│     │                   Components   │
│     │ listeners                      │
│     ▼                                │
│  SoundManager ──► Web Audio API      │
│     │              (synth SFX)       │
│     └──► Haptic Feedback             │
│                                      │
│  Sequencer ──► EventBus              │
│     (timed event sequences)          │
└──────────────────────────────────────┘
```

### Event Flow (Boot → Splash → Slot)

```
BOOT PHASE:
  BootScreen mounts
  → bus.emit('boot:start')
  → Progress simulation (2400ms)
  → User tap (gesture required!)
  → unlockAudioContext()          ← AudioContext unlock
  → initSoundManager(config)     ← Wire event→sound mappings
  → bus.emit('boot:tap')         ← SoundManager plays sfx_boot_hum
  → bus.emit('boot:complete')    ← SoundManager plays sfx_boot_ready

SPLASH PHASE:
  SplashScreen mounts
  → bus.emit('splash:start')
  → GSAP timeline starts
  → Each animation step emits event:
      bus.emit('splash:title:corners')  → sfx_shimmer + haptic
      bus.emit('splash:title:label')    → sfx_whoosh + haptic
      bus.emit('splash:title:name')     → sfx_boom + haptic
      bus.emit('splash:title:line')     → sfx_sweep + haptic
      bus.emit('splash:title:button')   → sfx_ding + haptic

TRANSITION:
  User clicks "PRESS TO ENTER"
  → bus.emit('splash:enter')
  → GSAP: splash fades out, slot fades in
  → CasinoShower particles
  → bus.emit('transition:complete')
```

---

## Module Reference

### 1. EventBus

**File:** `src/engine/EventBus.ts` (210 lines)
**Import:** `import { bus } from './engine'`

Centralna komunikaciona magistrala. Svi sistemi komuniciraju kroz nju.

#### CortexEventMap — Svi eventi

```typescript
interface CortexEventMap {
  // Boot lifecycle
  'boot:start': void
  'boot:progress': { percent: number; label: string }
  'boot:tap': void
  'boot:audio_unlocked': void
  'boot:complete': void
  'boot:fade_out': void

  // Splash screen
  'splash:start': void
  'splash:title:corners': void
  'splash:title:label': void
  'splash:title:name': void
  'splash:title:line': void
  'splash:title:button': void
  'splash:attract_loop': void
  'splash:enter': void

  // Scene transitions
  'transition:splash_to_slot': void
  'transition:complete': void

  // Slot machine
  'slot:spin:start': void
  'slot:spin:stop': void
  'slot:reel:stop': { col: number; symbol?: string }
  'slot:reel:land': { col: number }
  'slot:section:change': { idx: number; name: string }
  'slot:win': { type: 'small' | 'medium' | 'big' | 'jackpot'; amount: number }
  'slot:item:select': { col: number; row: number }

  // Audio control
  'audio:unlock': void
  'audio:play': { id: string; volume?: number; pan?: number }
  'audio:stop': { id: string }
  'audio:ambient:start': void
  'audio:ambient:stop': void
  'audio:mute': void
  'audio:unmute': void

  // System diagnostics
  'debug:toggle': void
  'fps:drop': { fps: number }
  'fps:recover': void

  // Custom (dynamic)
  [key: `custom:${string}`]: unknown
}
```

#### API

```typescript
// Subscribe — returns unsubscribe function
const unsub = bus.on('splash:title:name', () => { ... })
unsub() // cleanup

// Subscribe once — auto-removes after first fire
bus.once('boot:complete', () => startSplash())

// Unsubscribe specific handler
bus.off('boot:tap', myHandler)

// Emit event (full type safety on payload)
bus.emit('boot:start')
bus.emit('slot:win', { type: 'big', amount: 500 })

// Wildcard subscribe
bus.on('splash:*', () => { /* fires for ALL splash: events */ })

// Debug utilities
bus.setDebug(true)            // console logs every event
bus.getLog()                  // last 200 events with timestamps
bus.listenerCount('boot:tap') // number of subscribers
bus.clear()                   // remove all subscriptions
```

#### Key Features

- **Wildcard patterns:** `splash:*` matches `splash:title:name`, `splash:enter`, etc.
- **Auto-cleanup:** `on()` returns unsubscribe function
- **Error isolation:** handler errors are caught, don't break other handlers
- **Debug mode:** auto-enabled in DEV, global `__cortex_bus` for console inspection
- **Event log:** rolling buffer of last 200 events with `performance.now()` timestamps

---

### 2. Sequencer

**File:** `src/engine/Sequencer.ts` (107 lines)
**Import:** `import { sequencer } from './engine'`

Deklarativni executor za timed event sequences. Cita SequenceConfig, izvrsava korake redom.

#### API

```typescript
// Run a sequence (async — resolves when done)
await sequencer.run({
  name: 'splash_attract',
  steps: [
    { event: 'splash:title:corners', delay: 200, duration: 800 },
    { event: 'splash:title:label',   delay: 400, duration: 700 },
    { event: 'splash:title:name',    delay: 300, duration: 1000 },
  ]
})

// Cancel mid-execution
sequencer.cancel()

// State getters
sequencer.isRunning   // boolean
sequencer.currentStep // index (-1 if not running)

// Dispose (cancel + cleanup)
sequencer.dispose()
```

#### Step Execution Flow

Za svaki step u nizu:
1. Ceka `delay` ms (ako postoji)
2. Emituje `event` na EventBus
3. Ceka `duration` ms (ako postoji, da se animacija zavrsi)
4. Prelazi na sledeci step

Cancelovanje je instant — brise sve tajmere.

---

### 3. SoundManager

**File:** `src/engine/SoundManager.ts` (371 lines)
**Import:** `import { initSoundManager, playSynthById, ... } from './engine'`

Event-driven audio sistem. Slusa EventBus, pusta synth SFX i haptic feedback.

#### Audio Routing

```
                    ┌──────────────┐
Synth SFX ─────►   │   SFX Gain   │──┐
                    └──────────────┘  │   ┌──────────────┐   ┌─────────────┐
                                      ├──►│ Master Gain  │──►│ destination │
                    ┌──────────────┐  │   └──────────────┘   └─────────────┘
Music/Ambient ──►   │  Music Gain  │──┘
                    └──────────────┘
```

Tri gain noda: **master** (0.8), **sfx** (0.6), **music** (0.7) — default iz konfiga.

#### API

```typescript
// MUST be called from user gesture (tap/click handler)
await unlockAudioContext()

// Check unlock state
isAudioUnlocked() // boolean

// Initialize with config — wires EventBus listeners
initSoundManager(portfolioConfig.audio)

// Direct sound playback (bypass EventBus)
playSynthById('sfx_boom', 0.7)

// Volume control
setVolume('master', 0.8)
setVolume('sfx', 0.6)
setVolume('music', 0.7)

// Access gain nodes (for external routing)
getSfxGain()    // GainNode
getMusicGain()  // GainNode
getMasterGain() // GainNode

// Debug
getSoundConfig() // current SoundManagerConfig | null

// Cleanup
disposeSoundManager()
```

#### Synth SFX Library

Svi zvukovi su proceduralno generisani — **zero network overhead**.

| ID | Opis | Trajanje | Tehnika |
|----|------|----------|---------|
| `sfx_shimmer` | Shimmer efekat | 0.7s | Detuned oscillators + highpass noise |
| `sfx_whoosh` | Sweep/whoosh | 0.5s | Bandpass noise sweep (200→4000→800 Hz) |
| `sfx_boom` | Duboki boom | 1.0s | Sub sine (80→35 Hz) + harmonics + impact noise |
| `sfx_sweep` | Sawtooth sweep | 0.55s | Sawtooth osc + tracking bandpass (Q=8) |
| `sfx_ding` | Chime | 0.9s | 3-note chord (C6 + C7 + G6) |
| `sfx_boot_hum` | Power-on hum | 1.1s | 60→120 Hz sine + digital chirp (square) |
| `sfx_boot_ready` | Boot complete | ~0.7s | Ascending chord (C5 E5 G5 C6) |

#### Envelope Generator

Svaki synth koristi ADSR envelope:

```typescript
function env(ac: AudioContext, attack: number, sustain: number, release: number, peak = 0.3): GainNode
```

- **attack:** ramp od 0 do peak (linearan)
- **sustain:** drzi peak nivo
- **release:** eksponencijalan pad do 0.001

#### Haptic Patterns

```typescript
const patterns = {
  light:     [15],                        // kratka vibracija
  medium:    [40],                        // srednja
  heavy:     [80],                        // jaka
  reel_stop: [50],                        // reel landing
  big_win:   [100, 50, 200, 50, 100],    // pattern za big win
  button:    [20],                        // UI tap
}
```

#### Auto Event→Sound Wiring

Kada se pozove `initSoundManager(config)`, za svaki entry u `config.events`:

```
config.events = {
  'splash:title:name': {
    audio: { play: 'sfx_boom', volume: 0.7 },
    haptic: 'medium'
  }
}
```

SoundManager automatski radi:
```typescript
bus.on('splash:title:name', () => {
  playSynthById('sfx_boom', 0.7)
  navigator.vibrate([40])  // 'medium' pattern
})
```

Nema manuelnog wiring-a u komponentama.

---

### 4. Config System

**Types:** `src/engine/config/configTypes.ts` (95 lines)
**Values:** `src/engine/config/portfolioConfig.ts` (99 lines)

#### Master Config Structure

```typescript
interface PortfolioConfig {
  version: string                              // '1.0.0'

  boot: {
    progressDuration: number                   // 2400 (ms)
    loadingSteps: string[]                     // 6 koraka
    minDisplayTime: number                     // 2000 (ms)
  }

  audio: {
    volumes: { master: number; music: number; sfx: number }
    events: Record<string, {
      audio?: { play: string; volume?: number; pan?: number; fadeIn?: number }
      haptic?: string | number[]
    }>
  }

  sequences: Record<string, {
    name: string
    steps: { event: string; delay?: number; duration?: number }[]
  }>

  animations: Record<string, {
    preset: string; duration?: number; ease?: string; delay?: number
  }>

  timing: {
    splashStageDelays: number[]                // [200, 400, 300, 400, 100]
    reelLandDelays: number[]                   // [560, 720, 860, 1000, 1140]
    bootProgressDuration: number               // 2400
  }
}
```

#### Current Event→Sound Mappings

| Event | Sound | Volume | Haptic |
|-------|-------|--------|--------|
| `splash:title:corners` | sfx_shimmer | 0.4 | light |
| `splash:title:label` | sfx_whoosh | 0.5 | light |
| `splash:title:name` | sfx_boom | 0.7 | medium |
| `splash:title:line` | sfx_sweep | 0.5 | light |
| `splash:title:button` | sfx_ding | 0.5 | button |
| `boot:tap` | sfx_boot_hum | 0.5 | — |
| `boot:complete` | sfx_boot_ready | 0.6 | — |

---

## Integration Points

### Where Engine is Used in React Components

| Component | Import | Usage |
|-----------|--------|-------|
| `App.tsx` | `bus` | `bus.emit('splash:start')`, `bus.emit('splash:enter')`, `bus.emit('transition:complete')` |
| `BootScreen.tsx` | `bus, unlockAudioContext, initSoundManager, portfolioConfig` | Audio unlock, init, boot events |
| `SplashScreen.tsx` | `bus` | Emits splash events from GSAP timeline callbacks |
| `AudioVolumeSync.tsx` | `unifiedAudio` (separate) | Volume sync between Zustand store and audio buses |
| `AudioSettings.tsx` | `uaVolume` (separate) | User-facing volume controls |

### AudioContext Unlock Pattern

Browser autoplay politika zahteva da se AudioContext pokrene iz user gesture-a:

```typescript
// BootScreen.tsx — handleTap (called from onClick/onTouchStart)
const handleTap = useCallback(async () => {
  await unlockAudioContext()        // Resume AudioContext + play silent buffer
  initSoundManager(audio)           // Wire up event→sound mappings
  bus.emit('boot:tap')              // Trigger boot SFX
}, [])
```

iOS/Safari zahteva silent buffer trik — SoundManager to radi automatski.

---

## Public API (Single Import)

```typescript
import {
  // EventBus
  bus,                    // singleton EventBus instance
  type CortexEventMap,    // event name → payload type map

  // Sequencer
  Sequencer,              // class (if you need multiple instances)
  sequencer,              // singleton instance

  // SoundManager
  unlockAudioContext,     // async — call from user gesture
  isAudioUnlocked,       // boolean check
  initSoundManager,      // wire config → EventBus listeners
  disposeSoundManager,   // cleanup
  playSynthById,         // direct playback
  setVolume,             // bus volume control
  getSfxGain,            // raw GainNode access
  getMusicGain,          // raw GainNode access
  getMasterGain,         // raw GainNode access
  getSoundConfig,        // current config

  // Config
  portfolioConfig,       // master config object
  type PortfolioConfig,
  type SoundManagerConfig,
  type SoundEventConfig,
  type SequenceConfig,
  type SequenceStep,
  type BootConfig,
  type AnimationPreset,
} from './engine'
```

---

## Adding New Sounds

### 1. Add Synth SFX

U `SoundManager.ts`, dodaj u `synthLibrary`:

```typescript
sfx_reel_land: (vol) => {
  if (!_unlocked) return
  const ac = getCtx()
  const now = ac.currentTime
  // Impact thud
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(200, now)
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.15)
  const g = env(ac, 0.002, 0.03, 0.12, 0.2 * vol)
  osc.connect(g).connect(_sfxGain!)
  osc.start(now)
  osc.stop(now + 0.2)
},
```

### 2. Map Event to Sound

U `portfolioConfig.ts`, dodaj u `audio.events`:

```typescript
'slot:reel:land': {
  audio: { play: 'sfx_reel_land', volume: 0.6 },
  haptic: 'reel_stop',
},
```

### 3. Emit Event

U komponenti:

```typescript
bus.emit('slot:reel:land', { col: 2 })
```

Zvuk ce se automatski pustiti jer je SoundManager vec wired.

---

## Adding New Events

### 1. Define in EventMap

U `EventBus.ts`:

```typescript
'slot:bonus:start': { gameType: string }
```

### 2. Add Config Mapping (optional)

U `portfolioConfig.ts` → `audio.events`:

```typescript
'slot:bonus:start': {
  audio: { play: 'sfx_boom', volume: 0.8 },
  haptic: 'heavy',
}
```

### 3. Subscribe/Emit

```typescript
bus.on('slot:bonus:start', ({ gameType }) => {
  console.log(`Bonus started: ${gameType}`)
})

bus.emit('slot:bonus:start', { gameType: 'free_spins' })
```

---

## Debug Tools

### Console Access (DEV mode)

```javascript
// Global bus access
__cortex_bus.getLog()           // poslednih 200 evenata
__cortex_bus.listenerCount('boot:tap')
__cortex_bus.setDebug(true)     // loguje svaki event u console

// Direct sound test
import { playSynthById } from './engine'
playSynthById('sfx_boom', 0.5)
```

### Event Log Format

```typescript
{
  event: 'splash:title:name',
  payload: undefined,           // void events imaju undefined
  timestamp: 1234.567           // performance.now()
}
```

---

## Design Decisions

1. **Synth-first audio** — Nema eksternih fajlova za splash SFX. Sve generisano Web Audio API-jem. Zero latency, zero network.

2. **Config-driven** — Sve event→sound mapiranja u jednom mestu (`portfolioConfig`). Menjaj JSON, menjaj ponasanje.

3. **Zero dependencies** — EventBus i Sequencer su custom. Ni PostalJS, ni XState, ni RxJS.

4. **Gesture unlock** — iOS/Safari zahtevaju user gesture za AudioContext. Boot screen tap to resava jednom zauvek.

5. **Reactive event flow** — Komponente emituju, SoundManager slusa. Nema manuelnog `playSound()` u komponentama.

6. **TypeScript-first** — Full inference na event payloads. Kompajler ti kaze ako emitujes pogresan tip.

---

## Existing Audio Infrastructure (Non-Engine)

Portfolio vec ima `src/audio/` direktorijum sa:
- `UnifiedAudioSystem` — Zustand-connected audio bus (music/sfx/ui)
- `AudioVolumeSync` — React component that syncs store → audio system
- `AudioSettings` — User-facing volume UI (A key toggle)
- `AudioOnlyPlayer` — Full-screen per-track audio player
- `AudioErrorBoundary` — Silent fail wrapper

CORTEX Engine SoundManager radi **paralelno** sa ovim sistemom. SoundManager je za engine events (boot, splash, slot SFX), a UnifiedAudioSystem za media playback (portfolio tracks, ambient music).
