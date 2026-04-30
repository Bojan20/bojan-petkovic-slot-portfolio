/**
 * HoloCursor — V7.5 holographic pointer ring.
 *
 * Attaches a futuristic ring + dust trail that follows the cursor on
 * desktop. Hidden on (hover: none) and (pointer: coarse) — touch
 * devices don't have a cursor, no need to render anything.
 *
 * Implementation:
 *   • Single <div> for the ring, position: fixed; top/left updated
 *     via transform + translate3d for GPU compositing
 *   • requestAnimationFrame easing — 0.18 lerp factor → cursor leads
 *     ring slightly so it reads as a "halo" not a sticker
 *   • Phantom dust SVG dots are NOT continuously rendered — the ring
 *     itself emits a CSS-only glow, which is enough for the look
 *     without eating frames
 *   • Hover targets (anything with [data-cursor-hot]) → ring grows
 *     and shifts color
 *   • mousedown → quick squash + magenta flash
 *
 * Honors prefers-reduced-motion: the ring becomes a static cursor
 * (no lerp, no easing) so motion-sensitive users get a usable
 * accent without animation.
 */

import { useEffect, useRef } from 'react'
import styles from './HoloCursor.module.css'

export function HoloCursor() {
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ring = ringRef.current
    if (!ring) return

    // Capability check — bail on touch-first devices
    const fineCursor =
      window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    if (!fineCursor) return

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let targetX = window.innerWidth / 2
    let targetY = window.innerHeight / 2
    let curX = targetX
    let curY = targetY
    let raf = 0
    let visible = false

    const lerp = reduced ? 1 : 0.18

    const tick = () => {
      curX += (targetX - curX) * lerp
      curY += (targetY - curY) * lerp
      ring.style.transform = `translate3d(${curX}px, ${curY}px, 0) translate(-50%, -50%)`
      if (!reduced) raf = requestAnimationFrame(tick)
    }

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX
      targetY = e.clientY
      if (!visible) {
        visible = true
        ring.dataset.show = '1'
      }
      // Hot-target detection — element under cursor with data-cursor-hot
      const tgt = e.target as HTMLElement | null
      if (tgt?.closest?.('[data-cursor-hot], button, a, [role="button"]')) {
        ring.dataset.hot = '1'
      } else {
        ring.dataset.hot = '0'
      }
      if (reduced) tick()
    }

    const onLeave = () => {
      visible = false
      ring.dataset.show = '0'
    }

    const onDown = () => { ring.dataset.press = '1' }
    const onUp = () => { ring.dataset.press = '0' }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mousedown', onDown, { passive: true })
    window.addEventListener('mouseup', onUp, { passive: true })
    document.addEventListener('mouseleave', onLeave)

    if (!reduced) raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      document.removeEventListener('mouseleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={ringRef}
      className={styles.ring}
      aria-hidden="true"
      data-show="0"
      data-hot="0"
      data-press="0"
    />
  )
}

export default HoloCursor
