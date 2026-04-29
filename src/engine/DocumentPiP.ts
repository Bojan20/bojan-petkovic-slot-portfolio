/**
 * DocumentPiP — Document Picture-in-Picture API
 *
 * Pops the portfolio's "now showing" badge into a floating, always-on-
 * top OS window. The recruiter alt-tabs to LinkedIn / Slack / mail and
 * a tiny chrome-less window stays on top with the section + item the
 * portfolio is currently showing. They click the badge → focus jumps
 * back to the portfolio tab.
 *
 * Why Document PiP instead of classic <video> PiP: there's no video
 * stream here. Document PiP (Chromium 116+) lets any DOM tree go
 * into a PiP window, which is a perfect fit for a tiny info card.
 *
 * Browser support:
 *   • Chrome 116+, Edge 116+, Opera 102+ (Document PiP)
 *   • Safari + Firefox = NOT supported
 *
 * On unsupported browsers, openPipWindow returns null and the chip
 * is hidden. No errors thrown.
 *
 * Lifecycle: only ONE PiP window can be open per origin at a time;
 * subsequent open calls focus the existing window. Closing is either
 * via the OS chrome (X), the close-button inside, or programmatically.
 */

interface DocumentPiPApi {
  requestWindow(opts: { width: number; height: number }): Promise<Window>
  window: Window | null
}
interface WindowWithDocPip extends Window {
  documentPictureInPicture?: DocumentPiPApi
}

let pipWindow: Window | null = null
const closeListeners = new Set<() => void>()

export function isDocumentPipSupported(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as WindowWithDocPip).documentPictureInPicture
}

export function isPipWindowOpen(): boolean {
  return pipWindow !== null && !pipWindow.closed
}

export function onPipWindowClosed(fn: () => void): () => void {
  closeListeners.add(fn)
  return () => closeListeners.delete(fn)
}

/**
 * Open the PiP window. Returns the window object if successful or
 * null if the API is unavailable / the user denied.
 *
 * MUST be called from a user gesture (browsers block automatic PiP
 * activation).
 */
export async function openPipWindow(opts: { width?: number; height?: number } = {}): Promise<Window | null> {
  const api = (window as WindowWithDocPip).documentPictureInPicture
  if (!api) return null

  // If one is already open, just return it (browsers cap at one).
  if (pipWindow && !pipWindow.closed) return pipWindow

  try {
    pipWindow = await api.requestWindow({
      width: opts.width ?? 280,
      height: opts.height ?? 180,
    })
  } catch {
    return null
  }

  // Inherit the parent doc's stylesheets so our existing CSS works
  // inside the PiP window (otherwise it's a blank stage).
  for (const style of Array.from(document.styleSheets)) {
    try {
      if (style.href) {
        // External stylesheet — re-link
        const link = pipWindow.document.createElement('link')
        link.rel = 'stylesheet'
        link.href = style.href
        pipWindow.document.head.appendChild(link)
      } else if (style.cssRules) {
        // Inline stylesheet — copy rules
        const sheet = pipWindow.document.createElement('style')
        sheet.textContent = Array.from(style.cssRules)
          .map((r) => r.cssText)
          .join('\n')
        pipWindow.document.head.appendChild(sheet)
      }
    } catch {
      // Ignore CORS-protected sheets — they won't expose cssRules
    }
  }

  // Light dark-mode body to match portfolio aesthetic
  pipWindow.document.body.style.cssText = `
    margin: 0;
    background: rgb(6, 8, 18);
    color: rgba(220, 235, 255, 0.95);
    font-family: monospace;
    overflow: hidden;
  `

  // Listen for close → fire registered callbacks (UI can flip toggle)
  pipWindow.addEventListener('pagehide', () => {
    pipWindow = null
    closeListeners.forEach((fn) => { try { fn() } catch { /* ignore */ } })
  })

  return pipWindow
}

export function closePipWindow(): void {
  if (pipWindow && !pipWindow.closed) {
    pipWindow.close()
  }
  pipWindow = null
}

export function getPipWindow(): Window | null {
  return pipWindow && !pipWindow.closed ? pipWindow : null
}

/**
 * Helper: bring the parent (portfolio) tab back into focus when the
 * user clicks something in the PiP window. Workaround for PiP windows
 * not being able to programmatically focus the parent (security).
 * We use postMessage instead — parent listens and calls window.focus().
 */
export function focusParentFromPip(): void {
  // No-op stub — included for symmetry; the actual focus jump is done
  // in the PiP click handler that calls window.opener?.focus(). Most
  // OS prevent forced focus though, so the badge mostly serves as a
  // visual that the parent tab still exists.
  void focusParentFromPip
}

// Type guard helper for components
export function pictureInPictureElement(): Element | null {
  return document.pictureInPictureElement ?? null
}
