import { useCortexEvent } from './useCortexEvent'

export function useSplashStart(handler: () => void): void {
  useCortexEvent('splash:start', handler)
}

export function useSplashCorners(handler: () => void): void {
  useCortexEvent('splash:title:corners', handler)
}

export function useSplashLabel(handler: () => void): void {
  useCortexEvent('splash:title:label', handler)
}

export function useSplashName(handler: () => void): void {
  useCortexEvent('splash:title:name', handler)
}

export function useSplashLine(handler: () => void): void {
  useCortexEvent('splash:title:line', handler)
}

export function useSplashButton(handler: () => void): void {
  useCortexEvent('splash:title:button', handler)
}

export function useSplashAttractLoop(handler: () => void): void {
  useCortexEvent('splash:attract_loop', handler)
}

export function useSplashEnter(handler: () => void): void {
  useCortexEvent('splash:enter', handler)
}
