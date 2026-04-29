/**
 * AriaAnnouncer — ARIA live region for screen-reader users.
 *
 * The portfolio drives a lot of state through GSAP animations,
 * GPU shaders, and audio cues — none of which reach assistive
 * tech. This component bridges the gap: subscribes to the same
 * EventBus events the SpeechAnnouncer (Phase 12) does, and
 * mirrors them into a visually-hidden polite live region.
 *
 * Why polite, not assertive: assertive interrupts the user's
 * current screen-reader output. Section change is informational,
 * not an emergency, so polite is correct. Win events are also
 * polite — a celebratory tone shouldn't blast over whatever
 * the user is currently reading.
 *
 * The same SpeechAnnouncer text is reused so AT users get the
 * same casino-host narration sighted users hear, just without
 * the smooth voice rendering.
 */

import { useEffect, useState } from 'react'
import { bus } from '../engine'

const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

export function AriaAnnouncer() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    const offBoot = bus.on('boot:complete', () => {
      setMessage('Portfolio system online. Welcome.')
    })
    const offSplash = bus.on('splash:enter', () => {
      setMessage('Entering portfolio.')
    })
    const offSection = bus.on('slot:section:change', (p) => {
      setMessage(`Now showing section: ${p.name.toLowerCase()}.`)
    })
    const offSelect = bus.on('slot:item:select', () => {
      setMessage('Loading project details.')
    })
    const offWin = bus.on('slot:win', (p) => {
      const phrase =
        p.type === 'jackpot' ? 'Jackpot. Big winner.' :
        p.type === 'big'     ? 'Big win.' :
        p.type === 'medium'  ? 'Win.' :
                               'Small win.'
      setMessage(phrase)
    })
    return () => { offBoot(); offSplash(); offSection(); offSelect(); offWin() }
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={VISUALLY_HIDDEN}
    >
      {message}
    </div>
  )
}

export default AriaAnnouncer
