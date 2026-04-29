/**
 * PlatformChip — top-right corner pills for platform features
 *
 * Two surfaces:
 *  • SHARE chip: tappable, opens native OS share sheet (or copies URL
 *    fallback). Always shown — works on desktop too via clipboard.
 *  • LITE-MODE badge: shown ONLY when adaptive quality has dropped to
 *    'lite' (low battery / slow network / saveData). Read-only badge,
 *    confirms to the user that the visuals are auto-tuning down.
 *
 * Hidden during the boot phase so it doesn't compete with the
 * Lucky 7 hero moment. Fades in from splash onward.
 */

import { useEffect, useState } from 'react'
import styles from './PlatformChip.module.css'
import {
  isWebShareSupported,
  sharePortfolio,
  subscribeQualityMode,
  type QualityMode,
} from '../engine'

interface PlatformChipsProps {
  /** Hide entirely during boot — Lucky 7 hero owns the screen there. */
  visible: boolean
}

const SHARE_OPTS = {
  title: 'Bojan Petković — Sound Designer & Game Audio Engineer',
  text: 'Take a look — slot machine portfolio with reactive audio, voice control, and a casino feel.',
  url: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '',
}

export function PlatformChips({ visible }: PlatformChipsProps) {
  const [mode, setMode] = useState<QualityMode>('full')
  const [toast, setToast] = useState<string | null>(null)
  const [toastKey, setToastKey] = useState(0)

  useEffect(() => {
    const off = subscribeQualityMode((m) => setMode(m))
    return off
  }, [])

  if (!visible) return null

  const onShare = async () => {
    const ok = await sharePortfolio(SHARE_OPTS)
    if (ok) {
      const label = isWebShareSupported() ? 'shared' : 'link copied'
      setToast(label)
      setToastKey((k) => k + 1)
      window.setTimeout(() => setToast(null), 1700)
    }
  }

  return (
    <div className={styles.row} aria-live="polite">
      {mode === 'lite' && (
        <span
          className={styles.chipBadge}
          title="Adaptive quality: low battery / slow network — visuals auto-tuned down"
        >
          <span className={styles.dot} />
          Lite mode
        </span>
      )}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className={styles.chip}
          onClick={onShare}
          aria-label="Share this portfolio"
          title="Share this portfolio"
        >
          ▸ Share
        </button>
        {toast && (
          <span key={toastKey} className={styles.toast}>{toast}</span>
        )}
      </div>
    </div>
  )
}

export default PlatformChips
