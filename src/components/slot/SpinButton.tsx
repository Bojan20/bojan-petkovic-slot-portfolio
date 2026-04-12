import styles from './SpinButton.module.css'

interface SpinButtonProps {
  isSpinning: boolean
  credits: number
  jackpot: number
  onClick: () => void
}

export function SpinButton({ isSpinning, credits, jackpot, onClick }: SpinButtonProps) {
  return (
    <>
      {/* CREDITS stat box */}
      <div className={styles.statBox}>
        <div className={styles.statLbl}>CREDITS</div>
        <div className={styles.statValRed}>{credits}</div>
      </div>

      {/* Circular SPIN button */}
      <div className={styles.spinWrap}>
        <button
          className={`${styles.btn} ${!isSpinning ? styles.isIdle : ''}`}
          onClick={onClick}
          disabled={isSpinning}
          aria-label={isSpinning ? 'Spinning…' : 'Spin the reels'}
        >
          <div className={styles.ring} />
          <span className={styles.label}>{isSpinning ? '· · ·' : 'SPIN'}</span>
        </button>
      </div>

      {/* JACKPOT stat box */}
      <div className={styles.statBox}>
        <div className={styles.statLbl}>JACKPOT</div>
        <div className={styles.statValGold}>${jackpot.toLocaleString()}</div>
      </div>
    </>
  )
}

export default SpinButton
