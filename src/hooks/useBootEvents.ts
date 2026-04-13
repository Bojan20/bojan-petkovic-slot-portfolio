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

export function useBootComplete(handler: () => void): void {
  useCortexEvent('boot:complete', handler)
}

export function useBootFadeOut(handler: () => void): void {
  useCortexEvent('boot:fade_out', handler)
}
