/**
 * AnimatedImage — React component wrapping the AnimatedImage engine
 * handle into a drop-in replacement for <img>.
 *
 * Behavior:
 *   • Tries to decode the source via WebCodecs ImageDecoder
 *   • If decoded, paints frames into a <canvas> via RAF
 *   • If decoding is unsupported / fails, falls back to a plain <img>
 *
 * Usage in slot cells (when animated assets land):
 *   <AnimatedImage
 *     src="/projects/wrath-of-olympus.webp"  // animated WebP
 *     alt="Wrath of Olympus gameplay loop"
 *     width={120}
 *     height={68}
 *   />
 *
 * For static images this renders a regular <img>. For animated, the
 * canvas fills the same box and gets drawn on each RAF tick. Visually
 * identical to <img>, just with frame-perfect playback control.
 */

import { useEffect, useRef, useState } from 'react'
import { loadAnimatedImage, type AnimatedImageHandle } from '../engine/AnimatedImage'

interface AnimatedImageProps {
  src: string
  alt?: string
  width?: number
  height?: number
  className?: string
  /** When true, pause playback (useful for prefers-reduced-motion). */
  paused?: boolean
}

export function AnimatedImage({
  src,
  alt = '',
  width,
  height,
  className,
  paused = false,
}: AnimatedImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<AnimatedImageHandle | null>(null)
  const rafRef = useRef(0)
  const [animated, setAnimated] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const handle = await loadAnimatedImage(src)
      if (cancelled) {
        handle?.dispose()
        return
      }
      if (!handle) {
        setAnimated(false)
        return
      }
      handleRef.current = handle
      setAnimated(handle.animated)

      const canvas = canvasRef.current
      if (!canvas || !handle.animated) {
        // Static: paint once, no RAF loop
        const ctx = canvas?.getContext('2d')
        if (ctx && canvas) {
          canvas.width = width ?? handle.width
          canvas.height = height ?? handle.height
          await handle.drawTo(ctx, 0, 0, canvas.width, canvas.height)
        }
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.width = width ?? handle.width
      canvas.height = height ?? handle.height

      const tick = () => {
        if (paused) {
          rafRef.current = requestAnimationFrame(tick)
          return
        }
        void handle.drawTo(ctx, 0, 0, canvas.width, canvas.height)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    })()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      handleRef.current?.dispose()
      handleRef.current = null
    }
  }, [src, paused, width, height])

  // Decoder fail / unsupported / Firefox: render the source as a plain
  // <img>. The browser will animate WebP/AVIF/GIF natively at the cost
  // of the main thread. Same pixels as the canvas path, just less
  // control — appropriate for the fallback.
  if (animated === false) {
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        decoding="async"
        loading="lazy"
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      aria-label={alt || undefined}
      role={alt ? 'img' : undefined}
    />
  )
}

export default AnimatedImage
