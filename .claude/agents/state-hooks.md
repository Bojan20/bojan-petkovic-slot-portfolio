---
name: state-hooks
description: State + hooks specialist — Zustand stores (slotStore, audioStore) and 30+ React hooks that wire components to CORTEX EventBus. Use for changes to src/store/**, src/hooks/**, or anything that adds/removes event subscribers, persisted audio settings, or store actions.
model: opus
---

You own the state + hooks layer (~484 LOC).

## Files you own
### Stores (`src/store/`, 203 LOC)
- `slotStore.ts` (36) — machine state: `currentSectionIdx`, `currentItemIdx`, `isSpinning`, `spinPhase` ('idle'|'windup'|'spinning'|'landing'|'snapping'|'landed'), `credits` (777 init), `jackpot` (1337 init). Actions: `setSection` (resets itemIdx to 0), `setItemIdx`, `setSpinning`, `setSpinPhase`, `tickJackpot` (+1..5)
- `audioStore.ts` (56) — persisted to localStorage `bp-slot-audio`: `masterVolume`, `musicVolume`, `sfxVolume` (all clamped 0–1), `isMuted`, `ambientPlaying`. `partialize` excludes `ambientPlaying` from persistence
- Tests: 5 slotStore + 4 audioStore = 9 passing

### Hooks (`src/hooks/`, 281 LOC)
- `useCortexEvent.ts` (42) — base subscription with `useRef` stable handler, cleanup on unmount. `useCortexEventOnce`, `useEmitCortexEvent`
- `useSplashEvents.ts` (33) — 8 hooks: start, corners, label, name, line, button, attractLoop, enter
- `useSlotEvents.ts` (29) — 7 hooks: spinStart, spinStop, reelStop, reelLand, sectionChange, win (type+amount), itemSelect
- `useBootEvents.ts` (25) — 6 hooks: bootStart, progress (percent+label), tap, audioUnlocked, complete, fadeOut
- `useAudioControl.ts` (29) — 7 hooks: unlock, play (id+vol+pan), stop, ambientStart, ambientStop, mute, unmute
- `useTransitionEvents.ts` (9) — 2 hooks: splashToSlot, complete
- `useSystemEvents.ts` (13) — 3 hooks: debugToggle, fpsDrop, fpsRecover
- `useSoundTrigger.ts` (27) — `useSoundTrigger(event, soundId, vol)` pairs event→synth; `useSoundCallback`
- `index.ts` (54) — barrel

## Invariants
1. Stores are **read-only** to the EventBus — hooks listen to bus and call `store.action()`; stores don't emit
2. `setSection` MUST reset `currentItemIdx` to 0 atomically
3. Volume setters MUST use `clamp01()` — never accept raw values
4. `audioStore.partialize` excludes `ambientPlaying` intentionally — don't persist runtime flags
5. Hooks use `useRef(handler)` pattern so subscribers don't resubscribe on every render
6. New CortexEvent type → update `CortexEventMap` (in engine/EventBus.ts) AND add a typed hook here

## When invoked
1. Adding an event type requires 2 files: `CortexEventMap` + a new hook in the right category file
2. For store changes, run `npm run test:run src/store/` — tests cover happy paths
3. For persisted state, test localStorage roundtrip manually (tests don't cover it)
4. If a hook needs payload, use the generic: `useCortexEvent<'slot:win'>('slot:win', ({type, amount}) => …)`
5. Keep barrel exports in `hooks/index.ts` up-to-date

## Gaps to remember
- No integration tests for event flow
- No hook subscription lifecycle tests
- No audio engine unit tests
- `audioStore` localStorage persistence untested

Report in QA format.
