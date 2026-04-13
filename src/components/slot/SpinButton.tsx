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
          <span className={styles.label}>
            {isSpinning ? '· · ·' : (
              <svg viewBox="0 0 24 24" width="3.4em" height="3.4em" fill="none" overflow="visible">
                <defs>
                  <linearGradient id="spinGrad" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="22" y2="22">
                    <stop offset="0%" stopColor="#FFF8DC" />
                    <stop offset="35%" stopColor="#FFD700" />
                    <stop offset="70%" stopColor="#DAA520" />
                    <stop offset="100%" stopColor="#B8860B" />
                  </linearGradient>
                </defs>
                {/* Heroicons arrow-path — industry standard spin/refresh icon */}
                <path
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.649l3.181 3.181m0-4.991v4.99"
                  stroke="url(#spinGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
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
