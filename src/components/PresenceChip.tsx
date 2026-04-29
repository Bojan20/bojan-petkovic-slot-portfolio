/**
 * PresenceChip — surface for Phase 22's Presence module.
 *
 * Subscribes to custom:presence:count and renders a glassmorphic
 * "● N viewing" pill in the top-right when N > 1. Stays hidden in
 * the common single-tab case so it never adds visual noise.
 *
 * The tier label ("LOCAL" / "HTTP3") hints at which transport is
 * carrying the count — useful as a tiny demo of WebTransport when a
 * relay is configured.
 */

import { useEffect, useState } from 'react'
import styles from './PresenceChip.module.css'
import { bus } from '../engine'

export function PresenceChip() {
  const [count, setCount] = useState(1)
  const [tier, setTier] = useState<'webtransport' | 'broadcast' | 'none'>('none')

  useEffect(() => {
    const off = bus.on('custom:presence:count', (p) => {
      const payload = p as { count: number; tier: 'webtransport' | 'broadcast' | 'none' }
      setCount(payload.count)
      setTier(payload.tier)
    })
    return off
  }, [])

  if (count <= 1) return null

  const tierLabel = tier === 'webtransport' ? 'HTTP3' : 'LOCAL'

  return (
    <div className={styles.chip} role="status" aria-live="polite">
      <span className={styles.dot} aria-hidden="true" />
      <span>{count} VIEWING</span>
      <span className={styles.tier}>{tierLabel}</span>
    </div>
  )
}

export default PresenceChip
