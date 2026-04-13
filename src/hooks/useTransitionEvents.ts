import { useCortexEvent } from './useCortexEvent'

export function useTransitionSplashToSlot(handler: () => void): void {
  useCortexEvent('transition:splash_to_slot', handler)
}

export function useTransitionComplete(handler: () => void): void {
  useCortexEvent('transition:complete', handler)
}
