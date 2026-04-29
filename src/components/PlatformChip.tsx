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
import { activatePendingUpdate, isUpdateAvailable } from '../sw-register'
import { bus } from '../engine'

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
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [updateReady, setUpdateReady] = useState(() => isUpdateAvailable())

  useEffect(() => {
    const off = subscribeQualityMode((m) => setMode(m))
    return off
  }, [])

  // Online/offline tracking — surfaces a chip when the user is offline
  // (typically because they're on the train and the SW is serving the
  // app from cache). Reassures them that the page is intentionally
  // running offline, not broken.
  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // SW update available — show a clickable "Update ready" chip
  useEffect(() => {
    const off = bus.on('custom:sw_update_available' as 'custom:sw_update_available', () => {
      setUpdateReady(true)
    })
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
      {!online && (
        <span className={styles.chipBadge} title="Offline — running from cache">
          <span className={styles.dot} />
          Offline ⚡
        </span>
      )}
      {mode === 'lite' && (
        <span
          className={styles.chipBadge}
          title="Adaptive quality: low battery / slow network — visuals auto-tuned down"
        >
          <span className={styles.dot} />
          Lite mode
        </span>
      )}
      {updateReady && (
        <button
          type="button"
          className={styles.chip}
          onClick={() => activatePendingUpdate()}
          title="A new version is ready — click to refresh"
          aria-label="Activate the pending update and refresh"
        >
          ⟳ Update ready
        </button>
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
