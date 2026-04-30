/**
 * ReachPill — always-visible top-right contact CTA
 *
 * §2.10 Senior Recruiter: "The hero cell needs to answer who they are
 * and how to hire them in <2 seconds."
 *
 * This pill stays fixed top-right throughout the slot phase. It flashes
 * briefly when the recruiter selects a project (bus event: slot:item:select
 * or slot:section:change) — drawing the eye to the contact action at the
 * moment of peak engagement.
 *
 * Click → opens REACH tab (section 4) directly.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { bus } from '../engine'
import styles from './ReachPill.module.css'

interface ReachPillProps {
  visible: boolean
}

export function ReachPill({ visible }: ReachPillProps) {
  const [flash, setFlash] = useState(false)
  const [mounted, setMounted] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stagger mount so pill slides in after slot machine appears
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setMounted(true), 1800)
    return () => clearTimeout(t)
  }, [visible])

  // Flash on project engagement
  useEffect(() => {
    const off1 = bus.on('slot:item:select', () => triggerFlash())
    const off2 = bus.on('slot:section:change', () => triggerFlash())
    return () => { off1(); off2() }
  }, [])

  const triggerFlash = useCallback(() => {
    setFlash(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFlash(false), 1200)
  }, [])

  if (!visible) return null

  return (
    <button
      className={[
        styles.pill,
        mounted ? styles.pillVisible : '',
        flash ? styles.pillFlash : '',
      ].filter(Boolean).join(' ')}
      onClick={() => bus.emit('custom:go_to_reach' as 'custom:go_to_reach', null as unknown)}
      type="button"
      aria-label="Available for work — go to contact section"
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>AVAILABLE</span>
      <span className={styles.divider} aria-hidden="true">·</span>
      <span className={styles.cta}>REACH OUT</span>
      <span className={styles.arrow} aria-hidden="true">↗</span>
    </button>
  )
}

export default ReachPill
