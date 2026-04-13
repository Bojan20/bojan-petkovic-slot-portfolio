import { useCortexEvent } from './useCortexEvent'

export function useSlotSpinStart(handler: () => void): void {
  useCortexEvent('slot:spin:start', handler)
}

export function useSlotSpinStop(handler: () => void): void {
  useCortexEvent('slot:spin:stop', handler)
}

export function useSlotReelStop(handler: (data: { col: number; symbol?: string }) => void): void {
  useCortexEvent('slot:reel:stop', handler)
}

export function useSlotReelLand(handler: (data: { col: number }) => void): void {
  useCortexEvent('slot:reel:land', handler)
}

export function useSlotSectionChange(handler: (data: { idx: number; name: string }) => void): void {
  useCortexEvent('slot:section:change', handler)
}

export function useSlotWin(handler: (data: { type: 'small' | 'medium' | 'big' | 'jackpot'; amount: number }) => void): void {
  useCortexEvent('slot:win', handler)
}

export function useSlotItemSelect(handler: (data: { col: number; row: number }) => void): void {
  useCortexEvent('slot:item:select', handler)
}
