import { useCortexEvent } from './useCortexEvent'

export function useBootStart(handler: () => void): void {
  useCortexEvent('boot:start', handler)
}

export function useBootProgress(handler: (data: { percent: number; label: string }) => void): void {
  useCortexEvent('boot:progress', handler)
}

export function useBootTap(handler: () => void): void {
  useCortexEvent('boot:tap', handler)
}

export function useBootAudioUnlocked(handler: () => void): void {
  useCortexEvent('boot:audio_unlocked', handler)
}

/**
 * Fires exactly once after the user's tap-to-unlock gesture, meant as
 * a cue for "system online" burst animations (hue-flash, chroma pulse,
 * scanline sweep). Emitted by the app-orchestrator immediately after
 * `boot:audio_unlocked` so that components can subscribe without racing
 * the AudioContext init.
 */
export function useBootUnlockBurst(handler: () => void): void {
  useCortexEvent('boot:unlock:burst', handler)
}

export function useBootComplete(handler: () => void): void {
  useCortexEvent('boot:complete', handler)
}

export function useBootFadeOut(handler: () => void): void {
  useCortexEvent('boot:fade_out', handler)
}
