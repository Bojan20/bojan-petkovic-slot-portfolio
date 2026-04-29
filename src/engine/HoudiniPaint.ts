/**
 * HoudiniPaint — register CSS Paint API worklets
 *
 * Loads /worklets/cyberPattern.js so CSS rules can use
 * `background: paint(cyberPattern)` to render a custom procedural
 * cyberpunk circuit-grid pattern with live CSS-driven parameters.
 *
 * Browser support: Chrome 65+, Edge 79+, Opera 52+, Samsung 9+.
 * Safari + Firefox: registration is a no-op (CSS.paintWorklet
 * undefined). Consumers always layer a CSS gradient fallback so
 * the visual gracefully degrades on those browsers.
 *
 * Idempotent — calling register twice is harmless (Paint Worklet
 * registry rejects duplicates internally with a warning).
 */

interface CssWithPaintWorklet extends Omit<typeof CSS, 'paintWorklet'> {
  paintWorklet?: { addModule(url: string): Promise<void> }
}

let registered = false

export function isHoudiniPaintSupported(): boolean {
  if (typeof CSS === 'undefined') return false
  return !!(CSS as CssWithPaintWorklet).paintWorklet
}

/**
 * Register all paint worklets the app uses. Resolves when loaded
 * (or immediately on unsupported browsers).
 *
 * Also registers the worklet's CSS custom properties via
 * CSS.registerProperty so they're typed (numbers, not strings) and
 * animatable via @keyframes / transition. Non-fatal if registration
 * fails — the worklet still parses values, just won't animate
 * smoothly.
 */
export async function registerPaintWorklets(): Promise<void> {
  if (registered) return
  registered = true

  // Register typed custom props FIRST so they're recognized when CSS
  // first parses the rules that consume them.
  const cssGlobal = CSS as typeof CSS & {
    registerProperty?: (def: {
      name: string; syntax: string; inherits: boolean; initialValue: string
    }) => void
  }
  if (typeof cssGlobal.registerProperty === 'function') {
    const props: Array<{ name: string; syntax: string; init: string }> = [
      { name: '--pattern-hue',     syntax: '<number>', init: '190' },
      { name: '--pattern-density', syntax: '<number>', init: '0.45' },
      { name: '--pattern-glitch',  syntax: '<number>', init: '0.20' },
      { name: '--pattern-alpha',   syntax: '<number>', init: '0.55' },
      { name: '--pattern-seed',    syntax: '<number>', init: '7.13' },
    ]
    for (const p of props) {
      try {
        cssGlobal.registerProperty({
          name: p.name,
          syntax: p.syntax,
          inherits: false,
          initialValue: p.init,
        })
      } catch {
        // Already registered (HMR re-mount) — ignore
      }
    }
  }

  const css = CSS as CssWithPaintWorklet
  if (!css.paintWorklet) return

  try {
    await css.paintWorklet.addModule('/worklets/cyberPattern.js')
  } catch (err) {
    console.info('[HoudiniPaint] worklet registration failed:', err)
  }
}
