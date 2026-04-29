/**
 * PortfolioReel — getDisplayMedia + MediaRecorder portfolio video reel
 *
 * The pitch: a recruiter walks through the portfolio, presses
 * Ctrl/Cmd+Shift+R, picks the browser tab, and records exactly what
 * they want a colleague to see. Up to 5 minutes of WebM (VP9 + Opus)
 * gets compressed in real time, dumped to disk via the File System
 * Access SaveFilePicker, and they share it on whatever channel —
 * Slack, email, X. No extension, no sign-up, no third-party recorder.
 *
 * Why this matters as a portfolio piece:
 *   • getDisplayMedia — modern Screen Capture API, prompts the user
 *     for tab/window/screen with a native picker (zero phishing risk)
 *   • MediaRecorder — encode VP9/Opus or AV1/Opus on-device, ~2 Mbps
 *     for 1080p which means a 60-second reel weighs ~15 MB
 *   • Stream merging — captureStream from the ambient audio element
 *     gets merged with the display track via new MediaStream(...)
 *     so the recording carries the music, not silent video
 *   • Codec negotiation — try VP9 first (best ratio), fall back to
 *     VP8 (universal), then to default (whatever browser ships)
 *   • Hard cap at 5 minutes so recruiters can't accidentally record
 *     the rest of their day if they forget to press stop
 *
 * Lifecycle:
 *   await startReelCapture(audio)   // user picks tab → MediaRecorder runs
 *   stopReelCapture()                // saves WebM via FS Access / anchor
 *
 * Calling start while already recording is a no-op (returns false).
 * Calling stop while idle is a no-op (returns null).
 *
 * If getDisplayMedia or MediaRecorder is missing, both calls return
 * false/null silently and bus emits custom:reel:unsupported once.
 */

import { bus } from './EventBus'

// ─── Capability detection ────────────────────────────────────────────────────

export function isReelCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== 'undefined'
  )
}

// ─── Codec negotiation ───────────────────────────────────────────────────────

/**
 * Pick the best mimeType the browser actually supports. Order matters:
 *   1. VP9 + Opus  — best ratio, supported on Chromium 80+, FF latest
 *   2. VP8 + Opus  — wider compat, ~30% larger
 *   3. AV1 + Opus  — best ratio of all but encode is slow on integrated GPUs
 *   4. (browser default)
 */
function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=av1,opus',
    'video/webm',
    'video/mp4',
  ]
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}

// ─── State ───────────────────────────────────────────────────────────────────

interface ReelState {
  recorder: MediaRecorder
  chunks: BlobPart[]
  mimeType: string
  startedAt: number
  hardCapTimer: number
  // Tracks we own — must be stopped on dispose so the browser hides
  // the "Stop sharing" tab indicator and the user's mic/screen state
  // returns to idle.
  ownedTracks: MediaStreamTrack[]
}

let _state: ReelState | null = null
const HARD_CAP_MS = 5 * 60 * 1000  // 5 min

// ─── Start ───────────────────────────────────────────────────────────────────

/**
 * Begin capturing. Prompts for tab/window/screen via the native picker.
 * If `audioElement` is provided, its audio track is mixed into the
 * recording via HTMLMediaElement.captureStream() — that way the WebM
 * carries the lounge ambient music, not silence.
 *
 * Resolves true if recording started, false if unsupported / cancelled.
 */
export async function startReelCapture(
  audioElement?: HTMLMediaElement | null,
): Promise<boolean> {
  if (_state) return false
  if (!isReelCaptureSupported()) {
    bus.emit('custom:reel:unsupported', null)
    return false
  }

  // 1. Prompt for screen/tab — user picker is mandatory, no way around
  let displayStream: MediaStream
  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 60, max: 60 },
        // Suggest the current tab as the preferred capture surface so
        // the user-picker pre-selects the portfolio. Chromium 105+ only;
        // ignored as a hint elsewhere.
        // @ts-expect-error preferCurrentTab is non-standard but widely shipped
        preferCurrentTab: true,
      },
      audio: true, // capture system audio if user grants it (Chromium tab share)
    })
  } catch (err) {
    if ((err as DOMException)?.name === 'NotAllowedError') {
      // User cancel — silent
      return false
    }
    console.info('[Reel] getDisplayMedia failed:', err)
    return false
  }

  // 2. Try to mix in the ambient music track from the audio element.
  //    Some browsers (Safari) don't expose captureStream on
  //    HTMLMediaElement — skip silently if so. The display capture's
  //    own audio (when user grants tab audio) still carries it.
  const tracks: MediaStreamTrack[] = [...displayStream.getTracks()]
  const ownedTracks: MediaStreamTrack[] = [...displayStream.getTracks()]
  if (audioElement && typeof (audioElement as HTMLMediaElement & {
    captureStream?: () => MediaStream
  }).captureStream === 'function') {
    try {
      const audioStream = (audioElement as HTMLMediaElement & {
        captureStream: () => MediaStream
      }).captureStream()
      // Only add if display capture didn't already provide audio (avoid
      // doubled track which produces echo on some recorders).
      const hasDisplayAudio = displayStream.getAudioTracks().length > 0
      if (!hasDisplayAudio) {
        for (const t of audioStream.getAudioTracks()) {
          tracks.push(t)
          ownedTracks.push(t)
        }
      }
    } catch (err) {
      console.info('[Reel] audio captureStream failed (continuing video-only):', err)
    }
  }

  const merged = new MediaStream(tracks)

  // 3. Spin up MediaRecorder
  const mimeType = pickMimeType()
  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(merged, mimeType ? {
      mimeType,
      // ~2.5 Mbps video, 128 kbps audio. WebM with VP9 hits ~80% of
      // theoretical bitrate efficiency; setting these explicitly stops
      // the browser from over-allocating to ~8 Mbps which produces
      // unwieldy files for what's essentially a UI capture.
      videoBitsPerSecond: 2_500_000,
      audioBitsPerSecond: 128_000,
    } : undefined)
  } catch (err) {
    console.warn('[Reel] MediaRecorder construct failed:', err)
    for (const t of ownedTracks) t.stop()
    return false
  }

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  // If the user clicks "Stop sharing" on the browser's own picker chrome,
  // the video track ends naturally — finalize the recording cleanly.
  for (const t of displayStream.getVideoTracks()) {
    t.addEventListener('ended', () => {
      void stopReelCapture()
    })
  }

  _state = {
    recorder,
    chunks,
    mimeType,
    startedAt: performance.now(),
    hardCapTimer: window.setTimeout(() => {
      console.info('[Reel] hard cap reached (5 min) — finalizing')
      void stopReelCapture()
    }, HARD_CAP_MS),
    ownedTracks,
  }

  // Emit chunks every 1s — that way if the tab crashes mid-record we
  // still have most of the data buffered (the final blob would be
  // empty, but ondataavailable fired multiple times during the run).
  recorder.start(1000)

  bus.emit('custom:reel:start', { mimeType })
  document.body.setAttribute('data-recording', '')
  return true
}

// ─── Stop ────────────────────────────────────────────────────────────────────

/**
 * Stop recording, finalize the blob, hand it to the user via FS Access
 * SaveFilePicker (or anchor download fallback). Resolves with the byte
 * size of the saved file, or null if nothing was recording / user
 * cancelled the save dialog.
 */
export async function stopReelCapture(): Promise<number | null> {
  const s = _state
  if (!s) return null
  _state = null

  clearTimeout(s.hardCapTimer)
  document.body.removeAttribute('data-recording')

  // Wait for the recorder to flush the final dataavailable + stop
  const finishedBlob = await new Promise<Blob>((resolve) => {
    s.recorder.addEventListener('stop', () => {
      const type = s.mimeType || s.recorder.mimeType || 'video/webm'
      resolve(new Blob(s.chunks, { type }))
    }, { once: true })
    if (s.recorder.state !== 'inactive') {
      try { s.recorder.stop() } catch { /* ignore */ }
    } else {
      // Already stopped (track ended path) — synthesize a finalize
      const type = s.mimeType || 'video/webm'
      resolve(new Blob(s.chunks, { type }))
    }
  })

  // Stop owned tracks so the browser hides the recording indicator
  for (const t of s.ownedTracks) {
    try { t.stop() } catch { /* ignore */ }
  }

  if (finishedBlob.size === 0) {
    console.info('[Reel] empty blob — nothing was captured')
    bus.emit('custom:reel:stop', { bytes: 0, durationMs: performance.now() - s.startedAt })
    return null
  }

  const ext = finishedBlob.type.includes('mp4') ? 'mp4' : 'webm'
  const filename = `bojan-portfolio-reel-${Date.now()}.${ext}`
  const bytes = finishedBlob.size

  const fsSupported =
    typeof window !== 'undefined' && 'showSaveFilePicker' in window

  if (fsSupported) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (opts: {
          suggestedName: string
          types: Array<{ description: string; accept: Record<string, string[]> }>
        }) => Promise<FileSystemFileHandle>
      }).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Portfolio Reel Video',
          accept: ext === 'mp4'
            ? { 'video/mp4': ['.mp4'] }
            : { 'video/webm': ['.webm'] },
        }],
      })
      const writable = await handle.createWritable()
      await writable.write(finishedBlob)
      await writable.close()
      bus.emit('custom:reel:saved', { bytes, filename, durationMs: performance.now() - s.startedAt })
      return bytes
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') {
        bus.emit('custom:reel:stop', { bytes: 0, durationMs: performance.now() - s.startedAt })
        return null
      }
      console.info('[Reel] FS Access failed, falling back to anchor:', err)
    }
  }

  // Anchor fallback
  const url = URL.createObjectURL(finishedBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  bus.emit('custom:reel:saved', { bytes, filename, durationMs: performance.now() - s.startedAt })
  return bytes
}

// ─── Introspection ───────────────────────────────────────────────────────────

export function isReelCapturing(): boolean { return _state !== null }
export function getReelDurationMs(): number {
  return _state ? performance.now() - _state.startedAt : 0
}
