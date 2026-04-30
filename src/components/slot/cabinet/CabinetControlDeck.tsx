/**
 * CabinetControlDeck — V3.5 controls (AUTO / BET / SPIN / MAX).
 *
 * Wraps the existing SpinButton with the four flanking buttons that
 * make the cabinet feel like a real online slot, not a portfolio:
 *
 *   [AUTO 5] [BET−]  ◉ SPIN ◉  [BET+] [MAX ×10]
 *
 * Buttons are visually live but functionally light — AUTO cycles
 * through [5, 10, 25, 50, 100] and BET +/- bump a local "bet"
 * counter, MAX snaps it to ×10. None of them mutate credits or
 * trigger spins (the SPIN button stays the only interaction that
 * changes slot state). The buttons exist for the *visual hierarchy*
 * a recruiter expects from a real cabinet.
 *
 * Future hook (V3.6+ if signed off): AUTO could chain N spins via
 * the existing handleSpin path; left out for now to avoid surprising
 * behaviour during cinematic review.
 */

import { useState } from 'react'
import { SpinButton } from '../SpinButton'
import styles from './CabinetControlDeck.module.css'

interface CabinetControlDeckProps {
  isSpinning: boolean
  credits: number
  jackpot: number
  onSpin: () => void
}

const AUTO_CYCLE = [5, 10, 25, 50, 100] as const
const BET_MIN = 1
const BET_MAX = 100
const BET_STEP = 5
const BET_DEFAULT = 10

export function CabinetControlDeck(props: CabinetControlDeckProps) {
  const [autoIdx, setAutoIdx] = useState(0)
  const [bet, setBet] = useState(BET_DEFAULT)

  const auto = AUTO_CYCLE[autoIdx] ?? 5
  const cycleAuto = () => setAutoIdx((i) => (i + 1) % AUTO_CYCLE.length)
  const bumpBet = (delta: number) =>
    setBet((b) => Math.min(BET_MAX, Math.max(BET_MIN, b + delta)))
  const maxBet = () => setBet(BET_MAX)

  return (
    <div className={styles.deck}>
      <button
        type="button"
        className={styles.btn}
        onClick={cycleAuto}
        disabled={props.isSpinning}
        aria-label={`Auto-spin ${auto} rounds`}
      >
        <span className={styles.btnLbl}>AUTO</span>
        <span className={styles.btnSub}>{auto}</span>
      </button>

      <button
        type="button"
        className={styles.btn}
        onClick={() => bumpBet(-BET_STEP)}
        disabled={props.isSpinning || bet === BET_MIN}
        aria-label="Decrease bet"
      >
        <span className={styles.btnLbl}>BET</span>
        <span className={styles.btnSub}>−</span>
      </button>

      {/* Existing SpinButton (CREDITS · SPIN · JACKPOT) — unchanged */}
      <SpinButton
        isSpinning={props.isSpinning}
        credits={props.credits}
        jackpot={props.jackpot}
        onClick={props.onSpin}
      />

      <button
        type="button"
        className={styles.btn}
        onClick={() => bumpBet(+BET_STEP)}
        disabled={props.isSpinning || bet === BET_MAX}
        aria-label="Increase bet"
      >
        <span className={styles.btnLbl}>BET</span>
        <span className={styles.btnSub}>+</span>
      </button>

      <button
        type="button"
        className={`${styles.btn} ${styles.btnAccent}`}
        onClick={maxBet}
        disabled={props.isSpinning}
        aria-label="Max bet"
      >
        <span className={styles.btnLbl}>MAX</span>
        <span className={styles.btnSub}>×{bet}</span>
      </button>
    </div>
  )
}

export default CabinetControlDeck
