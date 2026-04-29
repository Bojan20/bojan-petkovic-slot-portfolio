/**
 * App — Root component (CORTEX Engine powered)
 *
 * Three-phase flow modeled after real slot cabinets:
 *
 * Phase 1: BOOT (BootScreen)
 *   - Neural-sync loader, CRT scanlines, tap-to-unlock
 *   - Tap = user gesture → AudioContext unlocked forever
 *
 * Phase 2: SPLASH (Attract Mode)
 *   - Lucky 7 cinematic timeline with glitch/implode exit
 *   - Lounge ambient music starts automatically
 *
 * Phase 3: SLOT (Main App)
 *   - Chromatic bleed cross-dissolve + elastic pop-in
 *
 * All audio, animations, and timing driven by engine config.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { BootScreen } from './components/BootScreen'
import { SplashScreen } from './components/slot/SplashScreen'
import { SlotMachine } from './components/slot'
import { CasinoShower } from './components/slot/CasinoShower'
import { PullToRefresh } from './components/PullToRefresh'
import {
  bus,
  initAudioBridge, disposeAudioBridge,
  attachAnalyser, disposeAnalyser,
  listenForKonami,
  startHapticOrchestra, disposeHapticOrchestra,
  enableWakeLock, disableWakeLock,
  startPageVisibilityHandler, stopPageVisibilityHandler,
  registerAudioForVisibilityPause,
  startAdaptiveQuality,
  attachMediaSession, disposeMediaSession,
  startGamepadInput, stopGamepadInput,
  initSpeechAnnouncer, disposeSpeechAnnouncer,
  opfsFetchOrCache,
  loadCellMemory,
  scheduleKeyDetection,
  startPersonaInference, stopPersonaInference,
} from './engine'
import { RecIndicator } from './components/RecIndicator'
import { AriaAnnouncer } from './components/AriaAnnouncer'
import { HardwareToast } from './components/HardwareToast'
import { useInputBridges } from './hooks/useInputBridges'
import { useSensorium } from './hooks/useSensorium'
import { useSessionCapture } from './hooks/useSessionCapture'
// Heavy panels lazy-loaded — they're keyboard-gated (Shift+A, Konami)
// or rare-render (PlatformChips post-boot only). Splitting them off
// drops ~120KB from the main bundle so first paint of the boot screen
// is faster.
const SlotAudioManager = lazy(() =>
  import('./components/SlotAudioManager').then((m) => ({ default: m.SlotAudioManager })),
)
const DevOverlay = lazy(() =>
  import('./components/DevOverlay').then((m) => ({ default: m.DevOverlay })),
)
import { VoiceIndicator } from './components/VoiceIndicator'
import { PlatformChips } from './components/PlatformChip'
import { useAudioStore } from './store'

type AppPhase = 'boot' | 'splash' | 'entering' | 'slot'

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('boot')
  const [showerActive, setShowerActive] = useState(false)
  const [introLocked, setIntroLocked] = useState(true)
  // DevOverlay visibility — toggled by Konami code (↑↑↓↓←→←→BA)
  // OR by ?dev URL flag (lets recruiters open it directly via shared link).
  const [devOverlay, setDevOverlay] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).has('dev')
  })
  const slotWrapRef = useRef<HTMLDivElement>(null)
  const splashRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Sync body[data-phase] for global CSS tint + cursor policy
  useEffect(() => {
    document.body.setAttribute('data-phase', phase)
  }, [phase])

  // Pre-create ambient audio element. On the first visit we hit the
  // network (Service Worker also caches via Cache API as a backup);
  // on every subsequent visit we hand the audio element a blob URL
  // pointing into OPFS, so playback starts as soon as the user taps —
  // no network round-trip, no SW activation race, even fully offline.
  useEffect(() => {
    let revoke: string | null = null
    let cancelled = false

    const loadAmbient = async (): Promise<HTMLAudioElement> => {
      const a = new Audio()
      a.loop = true
      a.volume = 0.35
      a.preload = 'auto'

      const cached = await opfsFetchOrCache('/ambient/lounge.mp3', 'ambient/lounge.mp3').catch(() => null)
      if (cached?.blob) {
        const url = URL.createObjectURL(cached.blob)
        revoke = url
        a.src = url
      } else {
        // OPFS unavailable + fetch failed — fall back to direct URL,
        // which the Service Worker can still satisfy from Cache API.
        a.src = '/ambient/lounge.mp3'
      }
      return a
    }

    void loadAmbient().then((a) => {
      if (cancelled) {
        a.pause()
        a.src = ''
        if (revoke) URL.revokeObjectURL(revoke)
        return
      }
      audioRef.current = a
    })

    return () => {
      cancelled = true
      const a = audioRef.current
      if (a) {
        a.pause()
        a.src = ''
      }
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [])

  // Connect to CORTEX Audio Manager (WebSocket bridge) — idempotent
  useEffect(() => {
    initAudioBridge()
    return () => disposeAudioBridge()
  }, [])

  // Tear down audio analyser + MediaSession on unmount (HMR-safe)
  useEffect(() => {
    return () => {
      disposeAnalyser()
      disposeMediaSession()
    }
  }, [])

  // Konami code listener — ↑↑↓↓←→←→BA toggles the dev overlay.
  // Re-typing the sequence toggles it OFF (also: Esc, X button).
  useEffect(() => {
    const off = listenForKonami(() => setDevOverlay((v) => !v))
    return off
  }, [])

  // Gamepad polling + event subscribers — Xbox/PS/Switch controllers
  // play the slot natively. A=spin, B=mute, D-pad/RB-LB=nav, Start=dev,
  // left stick=parallax cursor (steers Lucky 7 alongside mouse/gyro).
  useEffect(() => {
    startGamepadInput()
    // Custom events emitted by GamepadInput that don't have direct
    // routing yet — translate them here.
    const offMute = bus.on('custom:mute_toggle' as 'custom:mute_toggle', () => {
      const a = audioRef.current
      const next = !useAudioStore.getState().isMuted
      useAudioStore.getState().setMuted(next)
      if (a) a.muted = next
    })
    const offDebug = bus.on('debug:toggle', () => setDevOverlay((v) => !v))
    return () => {
      stopGamepadInput()
      offMute()
      offDebug()
    }
  }, [])

  // Haptic orchestra — translates app events to vibration patterns.
  // Idempotent + HMR-safe; does nothing on devices without vibrate API.
  useEffect(() => {
    startHapticOrchestra()
    return () => disposeHapticOrchestra()
  }, [])

  // ── Platform polish: page visibility, wake lock, adaptive quality ──
  // Single mount-time effect — all four APIs are no-ops on unsupported
  // browsers, never throws, never spams console.
  useEffect(() => {
    startPageVisibilityHandler()
    void startAdaptiveQuality()
    return () => {
      stopPageVisibilityHandler()
      disableWakeLock()
    }
  }, [])

  // Wake lock + ambient audio visibility-pause — both wired the moment
  // the audio element is created. Wake lock is requested on boot:tap
  // (the canonical "user is engaging" gesture).
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const off = registerAudioForVisibilityPause(a)
    return off
  }, [])

  useEffect(() => {
    const off = bus.on('boot:tap', () => enableWakeLock())
    return off
  }, [])

  // Speech announcer — cinematic casino-host voice. Init AFTER boot:tap
  // (the canonical user gesture) so browsers don't drop the first
  // utterance. The announcer subscribes to boot:complete, splash:enter,
  // slot:section:change, slot:item:select, slot:win and voice:jackpot
  // internally; nothing else here. No-op on browsers without
  // window.speechSynthesis (older Samsung, locked-down kiosks).
  useEffect(() => {
    const off = bus.on('boot:tap', () => initSpeechAnnouncer())
    return () => {
      off()
      disposeSpeechAnnouncer()
    }
  }, [])

  // ── Composed lifecycle hooks (P1.13 refactor) ─────────────────────
  // Keyboard bindings + voice commands for snapshot/reel/HID/Serial/HR
  useSessionCapture({ audioRef })
  // WebHID + WebSerial auto-bind to already-authorized devices
  useInputBridges(9600)

  // Cell memory — load persisted visited-state from OPFS so the slot
  // can render returning-visitor cues. One-time load at mount; the
  // module debounces its own writes.
  useEffect(() => {
    void loadCellMemory()
  }, [])

  // Tonal coherence detector (P0.6) — scheduled when ambient music
  // starts. Once detected, fires audio:key event for any future
  // SoundManager retune logic to subscribe to. Idempotent.
  useEffect(() => {
    const off = bus.on('audio:ambient:start', () => scheduleKeyDetection())
    return off
  }, [])

  // Persona inference (P1.8) — start tracking on boot:complete so the
  // 30s warmup begins counting from a meaningful "user is engaged"
  // moment. Emits custom:persona:inferred when the label changes.
  useEffect(() => {
    const off = bus.on('boot:complete', () => startPersonaInference())
    return () => {
      off()
      stopPersonaInference()
    }
  }, [])

  // Sensorium — ambient light + idle detector + presence + XR probe.
  // Idle pauses music; active resumes only past boot phase (AudioContext
  // unlock contract). Replaced 3 effects with one hook (P1.13 refactor).
  useSensorium({
    audioRef,
    shouldResumeAudio: () => phase !== 'boot',
    idleThresholdMs: 30_000,
  })

  // ── Voice commands: session capture is wired in useSessionCapture ──

  // ── Voice command: mute / unmute ────────────────────────────────────
  // SlotMachine handles spin/next/back/jackpot itself (those need its
  // local handlers + state guards). Audio mute is app-level so we
  // subscribe here and call the audioStore directly.
  useEffect(() => {
    const setMuted = useAudioStore.getState().setMuted
    const offMute = bus.on('voice:command:mute', () => {
      setMuted(true)
      const a = audioRef.current
      if (a) a.muted = true
    })
    const offUnmute = bus.on('voice:command:unmute', () => {
      setMuted(false)
      const a = audioRef.current
      if (a) a.muted = false
    })
    return () => { offMute(); offUnmute() }
  }, [])

  // Start ambient music + wire FFT analyser + MediaSession the MOMENT
  // user taps boot. boot:tap is the canonical AudioContext-unlock
  // gesture, so it's the earliest legal point to (a) play() the music,
  // (b) construct the MediaElementSource → AnalyserNode pipeline, and
  // (c) register OS-level media controls. Doing it here (vs.
  // boot:complete) means CyberNebula's shader gets a few seconds of
  // live FFT data while the boot loader finishes — the nebula visibly
  // pulses to the music BEFORE the splash transition.
  useEffect(() => {
    const off = bus.on('boot:tap', () => {
      const audio = audioRef.current
      if (!audio) return
      audio.play().catch(() => {})
      attachAnalyser(audio)
      // Register with the OS media controls — recruiter sees title +
      // artist + artwork on lock screen + headphone buttons + macOS
      // Now Playing widget. nexttrack/previoustrack are repurposed
      // to nav slot sections (clever for a single-track portfolio).
      attachMediaSession(audio, {
        title: 'Lounge Ambient',
        artist: 'Bojan Petković',
        album: 'Slot Machine Portfolio',
        artwork: [
          { src: '/seven-cyber.png', sizes: '512x512', type: 'image/png' },
          { src: '/seven-symbol.png', sizes: '256x256', type: 'image/png' },
          { src: '/favicon.svg', sizes: '96x96', type: 'image/svg+xml' },
        ],
      })
    })
    return off
  }, [])

  // Boot complete → transition to splash
  const handleBootComplete = useCallback(() => {
    setPhase('splash')
    // Belt-and-braces: if the bus listener missed (e.g. handler error),
    // ensure music is playing and analyser is wired here as well.
    // Both calls are idempotent.
    const audio = audioRef.current
    if (audio) {
      audio.play().catch(() => {})
      attachAnalyser(audio)
    }
    bus.emit('splash:start')
  }, [])

  // Splash enter → transition to slot — cyberpunk cinematic cross-dissolve
  const handleEnter = useCallback(() => {
    if (phase !== 'splash') return
    setPhase('entering')
    setShowerActive(true)

    bus.emit('splash:enter')
    // Audio hook — cyberBoot/hyperspaceSnap sequence (mapped in config)
    bus.emit('transition:splash_to_slot')

    const tl = gsap.timeline({
      onComplete: () => setPhase('slot'),
    })

    // ── Splash exit: chromatic implosion ────────────────────────────
    tl.to(splashRef.current, {
      scale: 1.12,
      filter: 'blur(24px) hue-rotate(80deg) saturate(1.6)',
      opacity: 0,
      duration: 0.7,
      ease: 'power3.in',
    }, 0)

    // Chromatic flash overlay — quick burst at the crossover moment
    const burst = document.getElementById('chromatic-burst')
    if (burst) {
      tl.fromTo(burst,
        { opacity: 0, scale: 0.4, filter: 'blur(0px)' },
        { opacity: 1, scale: 1.4, filter: 'blur(40px)', duration: 0.35, ease: 'expo.out' },
        0.1,
      )
      tl.to(burst,
        { opacity: 0, duration: 0.45, ease: 'power2.in' },
        0.55,
      )
    }

    // ── Shockwave ring — concentric expansion at burst crest ───────
    const shockwave = document.getElementById('shockwave-ring')
    if (shockwave) {
      tl.fromTo(shockwave,
        { opacity: 0, scale: 0.05 },
        {
          opacity: 1, scale: 1,
          duration: 0.55,
          ease: 'power3.out',
          onStart: () => bus.emit('transition:shockwave'),
        },
        0.18,
      )
      tl.to(shockwave,
        { opacity: 0, duration: 0.4, ease: 'power2.in' },
        0.65,
      )
    }

    // ── Slot entrance: faster wrapper fade — SlotMachine genesis owns
    //    the per-element staggered entrance. Wrapper just lifts the
    //    overall opacity/blur veil so genesis can play on visible canvas.
    tl.fromTo(slotWrapRef.current,
      { opacity: 0, scale: 0.96, filter: 'blur(18px) brightness(1.25)' },
      {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px) brightness(1)',
        duration: 1.1,
        ease: 'power2.out',
      },
      0.35,
    )

    // Pre-shield fade — quick veil lift while shockwave is mid-expansion
    const shield = document.getElementById('pre-shield')
    if (shield) {
      tl.to(shield, {
        opacity: 0,
        duration: 0.9,
        ease: 'power2.out',
        onComplete: () => { shield.style.display = 'none' },
      }, 0.35)
    }

    // Hold timeline open ~3s so CasinoShower + SlotMachine genesis finish
    tl.to({}, { duration: 1.8 })
  }, [phase])

  const handleShowerDone = useCallback(() => {
    setShowerActive(false)
    setIntroLocked(false)
    bus.emit('transition:complete')
  }, [])

  return (
    <>
      {/* Slot machine — always mounted, hidden until transition */}
      <div
        ref={slotWrapRef}
        style={{
          opacity: phase === 'boot' || phase === 'splash' ? 0 : undefined,
          willChange: phase === 'entering' ? 'opacity, filter, transform' : undefined,
        }}
      >
        <SlotMachine locked={introLocked} entering={phase === 'entering'} />
      </div>

      {/* Casino particle shower — coins, chips, dice rain */}
      <CasinoShower active={showerActive} onComplete={handleShowerDone} />

      {/* Chromatic burst — fullscreen radial flash during entering phase */}
      <div
        id="chromatic-burst"
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2003,
          pointerEvents: 'none',
          opacity: 0,
          background:
            'radial-gradient(circle at 50% 50%, rgba(34,232,255,0.9) 0%, rgba(177,76,255,0.55) 28%, rgba(255,43,214,0.2) 55%, transparent 75%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Shockwave ring — concentric expanding ring at burst crest */}
      <div
        id="shockwave-ring"
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          width: '160vmax',
          height: '160vmax',
          marginLeft: '-80vmax',
          marginTop: '-80vmax',
          zIndex: 2004,
          pointerEvents: 'none',
          opacity: 0,
          borderRadius: '50%',
          border: '2px solid rgba(240, 216, 120, 0.85)',
          boxShadow:
            '0 0 80px 8px rgba(34, 232, 255, 0.6), inset 0 0 60px 6px rgba(177, 76, 255, 0.45), 0 0 220px 30px rgba(240, 216, 120, 0.25)',
          mixBlendMode: 'screen',
          transform: 'scale(0.05)',
          willChange: 'transform, opacity',
        }}
      />

      {/* Splash — attract mode with auto SFX */}
      {(phase === 'splash' || phase === 'entering') && (
        <SplashScreen ref={splashRef} onEnter={handleEnter} />
      )}

      {/* Boot screen — on top of everything, removed after tap */}
      {phase === 'boot' && (
        <BootScreen onComplete={handleBootComplete} />
      )}

      {/* Slot Audio Manager — Shift+A to toggle. Lazy: panel is invisible
          until first toggle so the import only runs on demand. */}
      <Suspense fallback={null}>
        <SlotAudioManager />
      </Suspense>

      {/* Voice control — handsfree commands (mic icon bottom-left, V key) */}
      <VoiceIndicator />

      {/* Konami dev overlay — ↑↑↓↓←→←→BA to toggle, or ?dev URL flag.
          Lazy: only loads after Konami is entered or ?dev URL is set. */}
      {devOverlay && (
        <Suspense fallback={null}>
          <DevOverlay visible={devOverlay} onClose={() => setDevOverlay(false)} phase={phase} />
        </Suspense>
      )}

      {/* Platform chips — Share + Lite-mode badge top-right (post-boot) */}
      <PlatformChips visible={phase !== 'boot'} />

      {/* Pull-to-refresh — active in boot/splash, suppressed during slot
          interaction (slot has its own swipe gestures for section + reel) */}
      <PullToRefresh enabled={phase !== 'slot'} />

      {/* Recording indicator — top-right ● REC chip while a portfolio
          reel is being captured via Ctrl/Cmd+Shift+R. Auto-hides when
          recording stops or saves. */}
      <RecIndicator />

      {/* PresenceChip removed from UI — engine module (Phase 22) stays
          available for future "real" presence with a WebTransport relay,
          but the BroadcastChannel-only LOCAL tier just counts same-origin
          tabs on the visitor's own machine, which has no value for the
          recruiter. Surfacing only on a future relay-backed deployment. */}

      {/* ARIA live region (P0.5) — visually-hidden polite announcer
          that mirrors SpeechAnnouncer events to assistive tech. */}
      <AriaAnnouncer />

      {/* Hardware auto-detect toast (P1.12) — surfaces "new device
          detected, pair now?" when a USB/BLE device appears while
          the tab regains focus. Click triggers the standard
          gesture-required pair picker. */}
      <HardwareToast />
    </>
  )
}
