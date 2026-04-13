import { useEffect, useRef } from 'react'
import { bus } from '../engine/EventBus'
import type { CortexEventMap } from '../engine/EventBus'

type EventName = keyof CortexEventMap
type Handler<E extends EventName> = CortexEventMap[E] extends void
  ? () => void
  : (payload: CortexEventMap[E]) => void

export function useCortexEvent<E extends EventName>(
  event: E,
  handler: Handler<E>,
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const fn = ((...args: unknown[]) => {
      ;(handlerRef.current as (...a: unknown[]) => void)(...args)
    }) as Handler<E>
    return bus.on(event, fn)
  }, [event])
}

export function useCortexEventOnce<E extends EventName>(
  event: E,
  handler: Handler<E>,
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const fn = ((...args: unknown[]) => {
      ;(handlerRef.current as (...a: unknown[]) => void)(...args)
    }) as Handler<E>
    return bus.once(event, fn)
  }, [event])
}

export function useEmitCortexEvent() {
  return bus.emit.bind(bus)
}
