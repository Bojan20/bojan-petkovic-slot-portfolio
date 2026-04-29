/**
 * MediaSession — lock-screen / OS-level media controls
 *
 * The Media Session API surfaces playback controls to the operating
 * system: phone lock screen, Bluetooth headphone media buttons, macOS
 * Now Playing widget, Android notification shade. The recruiter sees
 * the portfolio's ambient music as a real first-class media source —
 * with title, artist, and artwork — instead of a silent <audio> tag
 * that hijacks their ears with no metadata.
 *
 * Wires:
 *   • Title / artist / album / artwork (multiple resolutions)
 *   • play / pause / nexttrack / previoustrack action handlers
 *   • Live position state so the OS scrubber works
 *
 * Browser support: Chrome 73+, Edge 79+, Safari 15+, Samsung Internet
 * 12+. NOT on Firefox. We feature-detect; on unsupported browsers
 * every call is a silent no-op.
 *
 * Lifecycle:
 *   • Initialize once with attachMediaSession(audio, metadata) AFTER
 *     a user gesture (boot:tap is the canonical moment).
 *   • Action handlers map to play()/pause()/skip events on the audio
 *     element + emit bus events so the rest of the app stays in sync.
 *   • Position state ticks on a low-frequency timer (4Hz) — enough for
 *     the OS scrubber, cheap enough to leave running.
 */

import { bus } from './EventBus'

export interface MediaTrackInfo {
  title: string
  artist: string
  album?: string
  /** Artwork URLs at multiple resolutions. OS picks closest match. */
  artwork: Array<{ src: string; sizes: string; type?: string }>
}

let attached = false
let positionTimerId = 0
let attachedAudio: HTMLAudioElement | null = null

interface MediaSessionApi {
  metadata: MediaMetadata | null
  setActionHandler(action: string, cb: ((details?: object) => void) | null): void
  setPositionState?: (state: { duration?: number; position?: number; playbackRate?: number }) => void
  playbackState?: 'none' | 'paused' | 'playing'
}

function getApi(): MediaSessionApi | null {
  if (typeof navigator === 'undefined') return null
  const ms = (navigator as Navigator & { mediaSession?: MediaSessionApi }).mediaSession
  return ms ?? null
}

export function isMediaSessionSupported(): boolean {
  return getApi() !== null && typeof window.MediaMetadata === 'function'
}

/**
 * Wire the audio element to OS media controls + metadata.
 * Idempotent — calling twice with the same audio is a no-op.
 */
export function attachMediaSession(audio: HTMLAudioElement, info: MediaTrackInfo): void {
  const api = getApi()
  if (!api || !isMediaSessionSupported()) return
  if (attached && attachedAudio === audio) {
    // Just refresh metadata in case the caller wants to update title
    api.metadata = new MediaMetadata({
      title: info.title,
      artist: info.artist,
      album: info.album,
      artwork: info.artwork,
    })
    return
  }
  attachedAudio = audio

  api.metadata = new MediaMetadata({
    title: info.title,
    artist: info.artist,
    album: info.album,
    artwork: info.artwork,
  })

  // Action handlers — wired through the audio element so the rest of
  // the app stays in sync (audioStore, AudioReactive, etc. all read
  // from the live audio element state).
  api.setActionHandler('play', () => {
    audio.play().catch(() => { /* user gesture may have lapsed */ })
    syncPlaybackState()
    bus.emit('audio:ambient:start')
  })
  api.setActionHandler('pause', () => {
    audio.pause()
    syncPlaybackState()
    bus.emit('audio:ambient:stop')
  })
  // nexttrack/previoustrack don't navigate music (we have one ambient
  // loop), they navigate the SLOT sections — clever repurposing for a
  // single-track portfolio. Lets headphone media buttons drive nav.
  api.setActionHandler('nexttrack', () => {
    bus.emit('voice:command:next')
  })
  api.setActionHandler('previoustrack', () => {
    bus.emit('voice:command:back')
  })

  // Sync state when audio element fires native events (e.g. user taps
  // play in the dom, OS sees it).
  const onPlay = () => syncPlaybackState()
  const onPause = () => syncPlaybackState()
  audio.addEventListener('play', onPlay)
  audio.addEventListener('pause', onPause)

  // Cheap position ticker — 4Hz is enough for the OS scrubber.
  // Cleared on dispose.
  if (positionTimerId) clearInterval(positionTimerId)
  positionTimerId = window.setInterval(() => {
    if (!api.setPositionState) return
    const dur = isFinite(audio.duration) ? audio.duration : 0
    if (dur > 0) {
      try {
        api.setPositionState({
          duration: dur,
          position: audio.currentTime,
          playbackRate: audio.playbackRate,
        })
      } catch {
        // Some browsers throw if position > duration during a reset
      }
    }
  }, 250)

  attached = true
  syncPlaybackState()
}

function syncPlaybackState(): void {
  const api = getApi()
  if (!api || !attachedAudio) return
  api.playbackState = attachedAudio.paused ? 'paused' : 'playing'
}

/** Tear down — releases action handlers + position timer. */
export function disposeMediaSession(): void {
  const api = getApi()
  if (api) {
    api.metadata = null
    api.setActionHandler('play', null)
    api.setActionHandler('pause', null)
    api.setActionHandler('nexttrack', null)
    api.setActionHandler('previoustrack', null)
  }
  if (positionTimerId) {
    clearInterval(positionTimerId)
    positionTimerId = 0
  }
  attached = false
  attachedAudio = null
}
