import { useCortexEvent } from './useCortexEvent'

export function useAudioUnlock(handler: () => void): void {
  useCortexEvent('audio:unlock', handler)
}

export function useAudioPlay(handler: (data: { id: string; volume?: number; pan?: number }) => void): void {
  useCortexEvent('audio:play', handler)
}

export function useAudioStop(handler: (data: { id: string }) => void): void {
  useCortexEvent('audio:stop', handler)
}

export function useAudioAmbientStart(handler: () => void): void {
  useCortexEvent('audio:ambient:start', handler)
}

export function useAudioAmbientStop(handler: () => void): void {
  useCortexEvent('audio:ambient:stop', handler)
}

export function useAudioMute(handler: () => void): void {
  useCortexEvent('audio:mute', handler)
}

export function useAudioUnmute(handler: () => void): void {
  useCortexEvent('audio:unmute', handler)
}
