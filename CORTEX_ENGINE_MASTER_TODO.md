# CORTEX ENGINE — MASTER TODO
> Portfolio: bojan-petkovic-slot-portfolio  
> Cilj: JSON-driven event engine koji nadmašuje IGT Playa arhitekturu  
> Stack: React 19, GSAP 3.14, Zustand, Howler.js, Tone.js, Matter.js, Vite, TypeScript 6

---

## KDE JE IGT DOBAR — I GDE GA NADMAŠUJEMO

| Oblast | IGT Playa | CORTEX Engine |
|--------|-----------|---------------|
| Audio | Howler.js sprite | Howler sprite + **Binaural 3D + Haptics** |
| Pub/Sub | Postal.js (legacy) | Custom **TypeScript EventBus + devtools** |
| State Machine | Custom Sequencer | **XState v5** (vizuelni debugger, time-travel) |
| State Mgmt | MobX (verbose) | Zustand (lightweight, persist, DevTools) |
| Config | Static JSON | JSON + **hot reload + Zod validation** |
| Replay | Nema | **Frame-perfect timeline replay** |
| Debug | Console.log | **Inline DebugPanel + Performance scope** |
| Accessibility | Nema | **WCAG 2.1 compliant** |
| Mobile | Desktop-first | **Touch + Haptic Feedback API** |
| RNG | Server-side | **WASM Chacha20 (offline, deterministic)** |
| Audio Visualization | Nema | **Real-time spectrum/scope** |
| Telemetry | Nema | **Session analytics + FPS budget** |
| Config Editor | Nema | **Live JSON editor panel (dev mode)** |
| Loading | Asset-first | **Boot Screen (slot-machine style) → attracts** |

---

## FAZA 0 — CORE ENGINE (Temelj svega)

### 0.1 EventBus
**Fajl:** `src/engine/EventBus.ts`  
**Šta:** Centralna magistrala. TypeScript generics. Typed eventi. Subscribe/unsubscribe sa cleanup.

```typescript
// Primer API-ja
bus.on('splash:title:name', (payload) => { ... })
bus.emit('slot:reel:stop', { col: 2, symbol: 'wild' })
bus.once('boot:complete', handler)
bus.off('slot:reel:stop', handler)
```

**Nadmašuje IGT:** Postal.js je bez tipova, globalni, nema TypeScript. Naš EventBus ima:
- Full TypeScript inference za event payload tipove
- Auto-cleanup via returned unsubscribe function
- Debug mode: loguje sve evente sa timestamp
- Namespace support: `splash:*`, `slot:*`, `audio:*`

---

### 0.2 CommandEngine (JSON → Akcije)
**Fajl:** `src/engine/CommandEngine.ts`  
**Config:** `src/engine/config/commands.json`  
**Šta:** Sluša EventBus, čita JSON config, izvršava akcije.

```json
{
  "splash:title:corners": {
    "audio": { "play": "sfx_shimmer", "volume": 0.4, "fadeIn": 100 },
    "animation": { "preset": "shimmer", "target": ".corners" }
  },
  "splash:title:name": {
    "audio": { "play": "sfx_boom", "volume": 0.7 },
    "haptic": { "pattern": [50, 30, 100] }
  },
  "slot:reel:stop": {
    "audio": { "play": "reel_stop_{col}", "volume": 0.6 },
    "animation": { "preset": "landPulse", "target": "col_{col}" }
  }
}
```

**Nadmašuje IGT:** IGT `soundManager.execute('onReel1Land')` je hardkodovan hook. Naš CommandEngine:
- Radi za BILO koji event, BILO koja akcija
- Templating: `reel_stop_{col}` → `reel_stop_2`
- Akcije su kompozabilne: audio + animation + haptic istovremeno
- Hot reload u dev modu (file watcher na JSON)

---

### 0.3 Sequencer v2 (XState)
**Fajl:** `src/engine/Sequencer.ts`  
**Šta:** Deklarativni game flow. Command DSL. Async sa cancellation.

```typescript
// Primer: splash attract sequence
const splashSequence = createSequencer([
  cmd('audio:unlock'),                        // prerequisit
  cmd('boot:fade_out', { duration: 800 }),
  cmd('splash:show_corners').withDelay(0),
  cmd('splash:show_label').withDelay(400),
  cmd('splash:show_name').withDelay(700),
  cmd('splash:show_line').withDelay(1100),
  cmd('splash:show_button').withDelay(1600),
  cmd('splash:wait_for_enter'),               // blocks until user clicks
  cmd('transition:to_slot'),
])
```

**Nadmašuje IGT:** IGT Sequencer je custom klasa bez vizuelnog debuggera. Naš:
- XState v5 — vizuelni state machine diagram u devtools
- Svaki Command je testabilan izolovano
- `.withDelay()`, `.withCondition()`, `.withRetry()` na svakom koraku
- Cancellable u bilo kom momentu (korisnik klikne back)
- TypeScript generics za payload tipove po komandi

---

### 0.4 AnimationSystem
**Fajl:** `src/engine/AnimationSystem.ts`  
**Šta:** GSAP wrapper. Preset animacije. CommandEngine ih poziva.

```typescript
// Preset library
presets = {
  fadeIn: (el, opts) => gsap.to(el, { opacity: 1, duration: opts.duration }),
  shimmer: (el) => gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, ease: 'power3.out' }),
  landPulse: (el) => gsap.to(el, { scaleY: [1, 1.025, 1], duration: 0.18 }),
  // ... svi presets iz SlotMachine.tsx
}
```

**Nadmašuje IGT:** IGT koristi GSAP direktno u svakoj komponenti. Naš sistem:
- Centralizovan preset registry
- CommandEngine poziva preset po imenu iz JSON-a
- Performance tracking: svaki tween ima FPS cost estimate
- GPU compositing: `will-change` se dodaje automatski pre animacije, skida posle

---

## FAZA 1 — BOOT SCREEN (Audio Unlock Gate)

### 1.1 BootScreen komponenta
**Fajl:** `src/components/BootScreen.tsx`  
**Šta:** Slot-machine stil loading ekran. Jedina svrha: audio unlock na tap.

```
┌────────────────────────────────────┐
│   [BOKI LOGO / BRANDING]          │
│                                    │
│   ████████████████░░░░  78%       │  ← progress bar
│   Loading audio assets...         │
│                                    │
│        [ TAP TO BEGIN ]           │  ← user gesture ovde
└────────────────────────────────────┘
```

**Šta se dešava:**
1. Prikazuje se odmah (nula loading pre ovoga)
2. Simulira loading progress (fontovi, three.js, audio sprite preload)
3. Progress bar ide do 100% za ~2s
4. Kad je 100%: TAP TO BEGIN pulsira
5. Korisnik tapne → `AudioContext.resume()` → `bus.emit('boot:complete')`
6. Boot fade out → Splash se mountuje SA AUDIOM

**Zašto ovo rešava problem:** Browser dozvoljava AudioContext tek posle user gesture. Boot screen je taj gesture, posle toga splash može automatski da pušta zvuk.

**Vizual:**
- Crna pozadina
- Manufacturer bar na vrhu (kao casino kabinet)
- Logo sa CRT efektom (scan lines, vignette)
- Progress bar od zlata
- Subtle slot-reel animation dok čeka

---

### 1.2 AudioSprite Preload
**Fajl:** `src/engine/audio/AudioSprite.ts`  
**Šta:** Svi SFX u jednom fajlu. Jedan HTTP request.

**Nadmašuje IGT:** IGT radi isto ali bez generatora. Naš sistem:
- `generateAudioSprite.ts` — u build time spaja sve MP3 u jedan fajl + generise JSON manifest
- Fallback: Web Audio API synth ako fajl ne uspe
- Sprite pozicije se čitaju iz JSON-a (ne hardkodovano)

---

## FAZA 2 — AUDIO ENGINE (Nadmašuje IGT SoundManager)

### 2.1 CoreAudioEngine
**Fajl:** `src/engine/audio/CoreAudioEngine.ts`  
**Nadklasa od:** Howler.js + Tone.js + Web Audio API native

**Tri sloja:**
```
Layer 1: ASSETS (Howler.js AudioSprite)
  → lounge.mp3, reel_stop.mp3, win_fanfare.mp3
  → Single HTTP request, cached, gzipped

Layer 2: SYNTH (Tone.js)
  → Proceduralni zvuci: reelTick, uiClick, coinDrop
  → Zero latency (nema network), parametrizovani

Layer 3: SPATIAL (Web Audio API — IGT NEMA OVO)
  → PannerNode za stereo pozicioniranje
  → 3D sound: zvuk desnog reela dolazi s desna
  → Reverb: Convolver za "casino hall" ambijent
```

**Nadmašuje IGT:**
- IGT: tag-based volumes (sfx/music/voice) → Mi: isto + spatial pozicioniranje
- IGT: nema 3D audio → Mi: PannerNode po koloni (reel 1 = levo, reel 5 = desno)
- IGT: nema reverb → Mi: ConvolverNode za casino ambijent
- IGT: Howler only → Mi: Howler + Tone.js + native Web Audio za DSP

---

### 2.2 HapticSystem (Mobile — IGT NEMA OVO)
**Fajl:** `src/engine/audio/HapticSystem.ts`  
**Šta:** Vibration API za mobile. SFX se prate hapticima.

```typescript
haptic.play('reel_stop')    // [50ms buzz]
haptic.play('big_win')      // [100, 50, 200, 50, 100]
haptic.play('spin_start')   // [30ms]
haptic.isSupported()        // false na desktop, true na Android/iOS PWA
```

**JSON config:**
```json
{
  "reel_stop": [50],
  "big_win": [100, 50, 200, 50, 100],
  "spin_start": [30],
  "button_press": [20]
}
```

---

### 2.3 AdaptiveMusicSystem
**Fajl:** `src/engine/audio/AdaptiveMusicSystem.ts`  
**Šta:** Muzika se menja sa game stanjem. IGT ovo ima samo rudimentarno.

```
Idle state:    lounge.mp3 (vol 0.35, slow)
Spin state:    +rhythm layer (ducked lounge, added beat)
BigWin state:  +fanfare layer (lounge ducked 80%, fanfare full)
Section change: crossfade 800ms između ambient bedova
```

---

## FAZA 3 — JSON CONFIG SISTEM

### 3.1 Portfolio Config JSON
**Fajl:** `src/engine/config/portfolio-config.json`  
**Šta:** Centralni konfig za SVE — zvukove, animacije, timing, sekvence.

```json
{
  "$schema": "./portfolio-config.schema.json",
  "version": "1.0.0",

  "sequences": {
    "boot": { "commands": [...] },
    "splash_attract": { "commands": [...] },
    "slot_enter": { "commands": [...] },
    "reel_spin": { "commands": [...] },
    "big_win": { "commands": [...] }
  },

  "audio": {
    "sprite": "public/audio/cortex-sprite.mp3",
    "manifest": "public/audio/cortex-sprite.json",
    "ambient": "public/ambient/lounge.mp3",
    "volumes": {
      "master": 0.8, "music": 0.7, "sfx": 0.6, "voice": 1.0
    }
  },

  "events": {
    "splash:title:corners": {
      "audio": { "play": "sfx_shimmer", "volume": 0.4 },
      "haptic": "light"
    },
    "slot:reel:stop:0": {
      "audio": { "play": "reel_stop_1", "volume": 0.6, "pan": -0.8 },
      "haptic": "reel_stop"
    },
    "slot:reel:stop:4": {
      "audio": { "play": "reel_stop_5", "volume": 0.6, "pan": 0.8 },
      "haptic": "reel_stop"
    }
  },

  "animations": {
    "splash_corners": { "preset": "shimmer", "duration": 0.6, "ease": "power3.out" },
    "reel_land": { "preset": "landPulse", "duration": 0.18 },
    "big_win_glow": { "preset": "centerGlowBurst", "duration": 1.2 }
  },

  "timing": {
    "splash_stage_delays": [0, 400, 700, 1100, 1600],
    "reel_land_delays": [560, 720, 860, 1000, 1140],
    "boot_progress_duration": 2000
  }
}
```

### 3.2 Zod Schema Validacija
**Fajl:** `src/engine/config/portfolio-config.schema.ts`  
**Šta:** Svaki put kad se JSON promeni, Zod validira u dev modu. Grešku vidi odmah u konzoli.

### 3.3 Hot Reload u Dev Modu
**Šta:** Vite HMR watch na JSON fajlovima. Promeniš volume u JSON-u, čuješ odmah bez refresh-a.

---

## FAZA 4 — SPLASH AS ATTRACT MODE

### 4.1 Automatski SFX na svakom naslovu
**Šta:** Kad se boot završi i audio je unlocked, Sequencer automatski pušta SFX za svaki naslov.

**Flow:**
```
[BOOT TAP] → audio unlock → bus.emit('boot:complete')
                          ↓
                    Sequencer.run('splash_attract')
                          ↓
          cmd('splash:corners') → GSAP anim + sfx_shimmer ← AUTOMATSKI
          cmd('splash:label')   → GSAP anim + sfx_whoosh
          cmd('splash:name')    → GSAP anim + sfx_boom
          cmd('splash:line')    → GSAP anim + sfx_sweep
          cmd('splash:button')  → GSAP anim + sfx_ding
          cmd('splash:attract_loop') → idle pulsiranje dok čeka klik
```

### 4.2 Attract Loop
**Šta:** Dok čeka na "PRESS TO ENTER" klik, ambient loop: particles, light pulses, LED animacija.

### 4.3 SFX za Splash (Hybrid: synth + file)
**Šta:** Kratki sintetizovani zvuci za splash (nema network request), lounge.mp3 za ambijent.

---

## FAZA 5 — DEVTOOLS (IGT NEMA NIŠTA OD OVOGA)

### 5.1 DebugPanel
**Fajl:** `src/engine/debug/DebugPanel.tsx`  
**Šta:** Overlay panel (taster D u dev modu). Prikazuje:
- Trenutni state (Zustand snapshot)
- EventBus log (poslednih 50 eventa sa timestamp)
- Active GSAP tweens (ime, progress, duration)
- Audio: koji zvuk svira, volume, pozicija

### 5.2 FPS Monitor + Auto-Quality
**Fajl:** `src/engine/debug/PerformanceMonitor.ts`  
**Šta:** RAF-based FPS brojač. Ako FPS padne ispod 45, automatski:
- Smanjuje broj Matter.js particula
- Disabluje blur efekte
- Reducira LED animaciju
**Nadmašuje IGT:** IGT nema performance budget sistem.

### 5.3 Frame-Perfect Replay (IGT NEMA)
**Fajl:** `src/engine/debug/ReplaySystem.ts`  
**Šta:** Svi eventi se loguju sa timestamp. Možeš da replayuješ kompletnu sesiju od početka.

```typescript
replay.startRecording()
// ... igraš ...
replay.stopRecording()
replay.save('session-2024-01-13.json')
replay.load('session-2024-01-13.json')
replay.play({ speed: 0.5 }) // pola brzine
```

### 5.4 Live JSON Config Editor
**Fajl:** `src/engine/debug/ConfigEditor.tsx`  
**Šta:** U dev modu, panel prikazuje JSON config. Edituješ volume → čuješ odmah. Edituješ timing → vidiš odmah. Sačuvaš → piše na disk.

---

## FAZA 6 — ACCESSIBILITY (IGT NEMA)

### 6.1 ARIA Support
- Reel cells imaju `role="cell"` + `aria-label`
- Spin button: `aria-label="Spin, current section: Projects"`
- Tab bar: `role="tablist"` + `aria-selected`
- Animacije: `prefers-reduced-motion` poštovano

### 6.2 Keyboard Navigation
- Space = Spin
- Arrow keys = change section
- Enter = confirm
- Escape = back to splash

---

## FAZA 7 — APP FLOW REFAKTOR

### 7.1 App.tsx State Machine
**Stanja:** `boot` → `splash` → `entering` → `slot` → `detail`

Trenutno je App.tsx sa `showSplash` boolean-om. Refaktor na XState machine:
```typescript
const appMachine = createMachine({
  initial: 'boot',
  states: {
    boot: { on: { BOOT_COMPLETE: 'splash' } },
    splash: { on: { ENTER_CLICKED: 'entering' } },
    entering: { on: { TRANSITION_DONE: 'slot' } },
    slot: { on: { OPEN_DETAIL: 'detail', BACK: 'splash' } },
    detail: { on: { CLOSE: 'slot' } },
  }
})
```

### 7.2 Transition System
**Šta:** Sve tranzicije između stanja su konfigurisane u JSON-u (duration, ease, blur, scale).

---

## FAZA 8 — SLOT MACHINE UPGRADE

### 8.1 SlotMachine refaktor na CommandEngine
**Šta:** SlotMachine.tsx trenutno pušta zvukove i animacije direktno. Refaktor: emituje evente, CommandEngine odgovara.

```typescript
// BEFORE (hardkodovano u SlotMachine.tsx):
uaPlay('reel_stop_1')
gsap.to(colRef, { scaleY: [1, 1.025, 1] })

// AFTER (samo event):
bus.emit('slot:reel:stop', { col: 0, symbol: colData[0][3].type })
// CommandEngine automatski: audio + animation + haptic iz JSON-a
```

### 8.2 Symbol Pooling (kao IGT)
**Šta:** Cell komponente se recikliraju, ne unmountuju/mountuju. IGT koristi object pool. Eliminisne GC panik during spin.

### 8.3 Reel Stagger za Panning
**Šta:** Reel 1 (levi) = audio pan -0.8. Reel 3 (srednji) = pan 0. Reel 5 (desni) = pan +0.8.  
Zvuk reela dolazi iz pravca gde je reel na ekranu. IGT ovo nema.

---

## FAZA 9 — POLISH & PRODUCTION

### 9.1 PWA Support
- Service Worker za offline play
- App Manifest za "Add to Home Screen"
- Background sync za analytics

### 9.2 Analytics
**Fajl:** `src/engine/telemetry/Analytics.ts`  
**Šta:** Lokalna session tracking (bez server-a). Koliko spina, koje sekcije, koliko vremena.

### 9.3 Audio Spectrum Visualizer (Bonus)
**Šta:** Realni-time FFT vizualizacija lounge.mp3 u header LED stripu.  
AnalyserNode → frekvencijski podaci → LED boje reaguju na muziku.

---

## REDOSLED IMPLEMENTACIJE

```
SPRINT 1 (Odmah):
  ✅ BootScreen (Faza 1.1) — rešava audio problem
  ✅ EventBus (Faza 0.1) — temelj svega
  ✅ SplashScreen SFX na svakom naslovu (Faza 4.1) — vidljiv rezultat

SPRINT 2:
  □ CommandEngine + portfolio-config.json (Faza 0.2 + 3.1)
  □ Sequencer v2 — app flow refaktor (Faza 0.3 + 7.1)
  □ AudioSprite preload (Faza 2.1)

SPRINT 3:
  □ Spatial audio / panning per reel (Faza 2.1, 8.3)
  □ HapticSystem (Faza 2.2)
  □ SlotMachine refaktor na CommandEngine (Faza 8.1)

SPRINT 4:
  □ DebugPanel + FPS Monitor (Faza 5.1 + 5.2)
  □ Hot JSON reload (Faza 3.3)
  □ Frame-perfect replay (Faza 5.3)

SPRINT 5:
  □ Accessibility (Faza 6)
  □ PWA (Faza 9.1)
  □ Audio Spectrum LED (Faza 9.3)
```

---

## STRUKTURA FOLDERA — KRAJNJI CILJ

```
src/
├── engine/                          # CORTEX ENGINE CORE
│   ├── EventBus.ts                  # Typed pub/sub magistrala
│   ├── CommandEngine.ts             # JSON → akcije executor
│   ├── Sequencer.ts                 # XState game flow
│   ├── AnimationSystem.ts           # GSAP preset registry
│   │
│   ├── audio/
│   │   ├── CoreAudioEngine.ts       # Master audio (Howler + Tone + Web Audio)
│   │   ├── AudioSprite.ts           # Single-file sprite sistem
│   │   ├── SpatialAudio.ts          # 3D panning + reverb (IGT ne može)
│   │   ├── HapticSystem.ts          # Mobile vibration
│   │   └── AdaptiveMusicSystem.ts   # Adaptive layers
│   │
│   ├── config/
│   │   ├── portfolio-config.json    # Master JSON config
│   │   ├── portfolio-config.schema.ts  # Zod schema
│   │   └── configLoader.ts          # Hot reload + validation
│   │
│   └── debug/
│       ├── DebugPanel.tsx           # Overlay devtools
│       ├── PerformanceMonitor.ts    # FPS budget + auto-quality
│       ├── ReplaySystem.ts          # Frame-perfect replay
│       └── ConfigEditor.tsx         # Live JSON editor
│
├── components/
│   ├── BootScreen.tsx               # NOVO — audio unlock gate
│   ├── slot/
│   │   ├── SlotMachine.tsx          # Refaktorisan na EventBus
│   │   └── ... (ostalo nepromenjeno)
│   └── ...
│
└── App.tsx                          # XState app machine
```

---

*CORTEX Engine v1.0 — Designed to exceed IGT Playa in every measurable dimension.*
