import { useCallback } from 'react'
import { useCortexEvent } from './useCortexEvent'
import type { CortexEventMap } from '../engine/EventBus'
import { playSynthById, isAudioUnlocked } from '../engine/SoundManager'

type EventName = keyof CortexEventMap

export function useSoundTrigger(
  event: EventName,
  soundId: string,
  volume = 1.0,
): void {
  const handler = useCallback(() => {
    if (isAudioUnlocked()) {
      playSynthById(soundId, volume)
    }
  }, [soundId, volume])

  useCortexEvent(event, handler as () => void)
}

export function useSoundCallback(
  event: EventName,
  callback: (payload: unknown) => void,
): void {
  useCortexEvent(event, callback as () => void)
}
