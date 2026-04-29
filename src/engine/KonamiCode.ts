/**
 * KonamiCode — keyboard sequence detector
 *
 * Listens for the canonical ↑↑↓↓←→←→BA sequence with a 2.5s rolling
 * window. Pressing keys outside the window resets the buffer; pressing
 * the wrong key partway through resets to whatever prefix matches.
 *
 * On full match, fires the callback exactly once per match (it does NOT
 * latch — fire it again, get another callback, lets users toggle dev
 * mode by re-typing the sequence).
 *
 * Mobile: there's no physical keyboard, but Bluetooth keyboards on
 * iPad/Android also dispatch arrow + letter keys, so the same code
 * works without modification.
 */

const SEQUENCE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA',
] as const

const RESET_AFTER_MS = 2500

export function listenForKonami(onMatch: () => void): () => void {
  let buffer: string[] = []
  let lastInputAt = 0

  const handler = (e: KeyboardEvent) => {
    // Don't intercept while typing in inputs
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

    const now = performance.now()
    if (now - lastInputAt > RESET_AFTER_MS) buffer = []
    lastInputAt = now

    buffer.push(e.code)
    // Keep buffer bounded — slide it forward when it grows past sequence
    if (buffer.length > SEQUENCE.length) buffer = buffer.slice(-SEQUENCE.length)

    // Match check: tail of buffer === SEQUENCE
    if (buffer.length === SEQUENCE.length) {
      let ok = true
      for (let i = 0; i < SEQUENCE.length; i++) {
        if (buffer[i] !== SEQUENCE[i]) { ok = false; break }
      }
      if (ok) {
        buffer = []
        onMatch()
      }
    }
  }

  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}
