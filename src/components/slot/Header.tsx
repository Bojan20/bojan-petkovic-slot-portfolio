import styles from './Header.module.css'

const LED_COLORS = ['#ffd700', '#00ffcc', '#ff00aa', '#9944ff']

export function Header() {
  return (
    <div className={styles.header}>
      {/* Name marquee box */}
      <div className={styles.marqueeBox}>
        <div className={styles.title}>BOJAN PETKOVIC</div>
        <div className={styles.subtitle}>
          AUDIO PRODUCER &nbsp;·&nbsp; SOUND DESIGNER &nbsp;·&nbsp; COMPOSER
        </div>
      </div>

      {/* LED strip */}
      <div className={styles.ledStrip}>
        {Array.from({ length: 30 }, (_, i) => {
          const color = LED_COLORS[i % 4]!
          return (
            <div
              key={i}
              className={styles.led}
              style={{
                background: color,
                boxShadow: `0 0 5px ${color}`,
                animationDelay: `${i * 0.04}s`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

export default Header
