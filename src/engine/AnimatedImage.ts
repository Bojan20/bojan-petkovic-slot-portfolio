/**
 * AnimatedImage — WebCodecs ImageDecoder wrapper
 *
 * Decodes animated WebP, AVIF, GIF, and PNG using the platform
 * ImageDecoder API and exposes a small handle the React layer can
 * point at a canvas. Unlike `<img>` with an animated src, this gives
 * us:
 *   • Frame-accurate playback control (seek, pause, scrub, loop count)
 *   • Per-frame VideoFrame objects we can composite via canvas2d /
 *     WebGL / WebGPU — useful when we want to overlay shaders on
 *     gameplay loops in slot cells later
 *   • Decoder runs on a worker thread on Chromium, so a 4MB animated
 *     WebP doesn't stall the main thread the way <img> can
 *
 * Why ship this NOW even without animated assets in /public yet:
 *   • Infrastructure is the slow path; once Boki captures a 4-sec
 *     loop per project (animated WebP from his actual gameplay
 *     footage) the React layer is ready
 *   • The module's `<AnimatedImage src="…">` component falls back to
 *     a plain `<img>` for static images, so it can be dropped into
 *     any existing slot cell as a no-risk swap
 *
 * Browser support:
 *   • Chromium 94+ — full ImageDecoder
 *   • Safari 17.0+ — full ImageDecoder
 *   • Firefox — no ImageDecoder yet (2026); falls back to <img>
 *
 * The module is pure; React glue is the AnimatedImage component
 * which lives next to it (component file ships under components/).
 */

// ─── Capability detection ────────────────────────────────────────────────────

/** True if ImageDecoder is exposed by this browser. */
export function isImageDecoderSupported(): boolean {
  return typeof window !== 'undefined' && 'ImageDecoder' in window
}

/**
 * True if the browser claims it can decode the given MIME type. Useful
 * before fetching a large asset only to discover the codec is locked.
 */
export async function isMimeDecodable(mime: string): Promise<boolean> {
  if (!isImageDecoderSupported()) return false
  try {
    const ImageDecoderCtor = (window as unknown as {
      ImageDecoder: { isTypeSupported: (m: string) => Promise<boolean> }
    }).ImageDecoder
    return await ImageDecoderCtor.isTypeSupported(mime)
  } catch {
    return false
  }
}

// ─── Types — minimal shim, ImageDecoder not yet in lib.dom across all TS ─────

interface ImageDecodeResult {
  image: VideoFrame
  complete: boolean
}

interface ImageDecoderInit {
  data: ReadableStream<Uint8Array> | ArrayBuffer | ArrayBufferView
  type: string
}

interface ImageDecoderTrack {
  frameCount: number
  animated: boolean
  repetitionCount: number
}

interface ImageDecoderLike {
  tracks: { selectedTrack: ImageDecoderTrack | null }
  decode: (opts?: { frameIndex?: number }) => Promise<ImageDecodeResult>
  close: () => void
}

interface VideoFrameLike {
  displayWidth: number
  displayHeight: number
  duration: number | null
  close: () => void
}

// ─── Handle ──────────────────────────────────────────────────────────────────

export interface AnimatedImageHandle {
  /** Width of the decoded frames (display pixels, not physical). */
  width: number
  /** Height of the decoded frames. */
  height: number
  /** Total animation frame count (1 for static images). */
  frameCount: number
  /** True if the asset is animated (has > 1 frame). */
  animated: boolean
  /**
   * Draw the current animation frame (computed from elapsed time since
   * the handle was created) onto the given canvas's 2d context. Loops
   * forever. Call inside a RAF or set-interval — does not own its own
   * tick loop, so consumers control framerate.
   */
  drawTo(ctx: CanvasRenderingContext2D, dx: number, dy: number, dw?: number, dh?: number): Promise<void>
  /** Free the underlying decoder + the last-decoded frame. */
  dispose(): void
}

/**
 * Decode an animated image from a URL or a Blob. Returns null on
 * any failure (network, unsupported codec, empty asset).
 */
export async function loadAnimatedImage(
  source: string | Blob,
  opts: { mime?: string } = {},
): Promise<AnimatedImageHandle | null> {
  if (!isImageDecoderSupported()) return null

  // Normalize source into a Blob we can stream from
  let blob: Blob
  let mimeHint = opts.mime
  if (typeof source === 'string') {
    try {
      const res = await fetch(source)
      if (!res.ok) return null
      blob = await res.blob()
      if (!mimeHint) mimeHint = res.headers.get('content-type') ?? blob.type
    } catch (err) {
      console.info('[AnimatedImage] fetch failed:', err)
      return null
    }
  } else {
    blob = source
    if (!mimeHint) mimeHint = blob.type
  }

  if (!mimeHint) {
    console.info('[AnimatedImage] could not determine MIME type — abort')
    return null
  }

  if (!(await isMimeDecodable(mimeHint))) {
    console.info('[AnimatedImage] codec not supported by browser:', mimeHint)
    return null
  }

  let decoder: ImageDecoderLike
  try {
    const Ctor = (window as unknown as {
      ImageDecoder: new (init: ImageDecoderInit) => ImageDecoderLike
    }).ImageDecoder
    decoder = new Ctor({
      data: blob.stream() as ReadableStream<Uint8Array>,
      type: mimeHint,
    })
  } catch (err) {
    console.info('[AnimatedImage] ImageDecoder construct failed:', err)
    return null
  }

  // Decode frame 0 to learn dimensions + cache for first paint.
  let firstFrame: ImageDecodeResult
  try {
    firstFrame = await decoder.decode({ frameIndex: 0 })
  } catch (err) {
    console.info('[AnimatedImage] decode 0 failed:', err)
    decoder.close()
    return null
  }
  const track = decoder.tracks.selectedTrack
  const frameCount = track?.frameCount ?? 1
  const animated = (track?.animated ?? false) && frameCount > 1

  // Cache decoded frames lazily so seeking back is cheap
  const cache = new Map<number, VideoFrameLike>()
  cache.set(0, firstFrame.image as unknown as VideoFrameLike)

  // Track total animation duration via cumulative frame durations.
  // ImageDecoder reports per-frame duration in microseconds (or null
  // for static); we sum on first iteration over all frames.
  const frameDurations: number[] = []
  let totalDurationMs = 0

  // Don't pre-decode all frames — lazy decode in drawTo. But we DO
  // need to know each frame's duration to compute elapsed-time index.
  // Lazy approach: as drawTo asks for frame N, decode N if missing
  // and record its duration.

  const start = performance.now()

  const handle: AnimatedImageHandle = {
    width: (firstFrame.image as unknown as VideoFrameLike).displayWidth,
    height: (firstFrame.image as unknown as VideoFrameLike).displayHeight,
    frameCount,
    animated,
    async drawTo(ctx, dx, dy, dw, dh) {
      if (!animated || frameCount === 1) {
        const f = cache.get(0)
        if (!f) return
        ctx.drawImage(
          f as unknown as CanvasImageSource,
          dx, dy,
          dw ?? handle.width, dh ?? handle.height,
        )
        return
      }

      // Determine which frame we should be on right now. We need the
      // total duration to wrap. If we haven't seen it yet, decode all
      // frames once to record durations. (ImageDecoder caches its own
      // bitmap data internally so repeat decodes are cheap.)
      if (frameDurations.length === 0) {
        for (let i = 0; i < frameCount; i++) {
          let f = cache.get(i)
          if (!f) {
            try {
              const r = await decoder.decode({ frameIndex: i })
              f = r.image as unknown as VideoFrameLike
              cache.set(i, f)
            } catch {
              break
            }
          }
          // Default 50ms (~20fps) when duration is null — common for
          // animated PNG without explicit timing
          const durMs = f.duration != null ? f.duration / 1000 : 50
          frameDurations.push(durMs)
          totalDurationMs += durMs
        }
        if (totalDurationMs <= 0) return
      }

      const elapsed = (performance.now() - start) % totalDurationMs
      let idx = 0
      let acc = 0
      for (let i = 0; i < frameDurations.length; i++) {
        acc += frameDurations[i]!
        if (elapsed < acc) { idx = i; break }
      }

      let frame = cache.get(idx)
      if (!frame) {
        try {
          const r = await decoder.decode({ frameIndex: idx })
          frame = r.image as unknown as VideoFrameLike
          cache.set(idx, frame)
        } catch {
          return
        }
      }

      ctx.drawImage(
        frame as unknown as CanvasImageSource,
        dx, dy,
        dw ?? handle.width, dh ?? handle.height,
      )
    },
    dispose() {
      for (const f of cache.values()) {
        try { f.close() } catch { /* ignore */ }
      }
      cache.clear()
      try { decoder.close() } catch { /* ignore */ }
    },
  }
  return handle
}
