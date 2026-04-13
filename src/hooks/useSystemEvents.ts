import { useCortexEvent } from './useCortexEvent'

export function useDebugToggle(handler: () => void): void {
  useCortexEvent('debug:toggle', handler)
}

export function useFpsDrop(handler: (data: { fps: number }) => void): void {
  useCortexEvent('fps:drop', handler)
}

export function useFpsRecover(handler: () => void): void {
  useCortexEvent('fps:recover', handler)
}
