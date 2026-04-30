/**
 * DemoContent — audio/video demo CTA.
 *
 * Center: 12-bar animated equalizer spectrum + type-differentiated
 *   colors (magenta = VIDEO, cyan = AUDIO) + bold CTA label +
 *   demo type badge. Bar heights seeded from a sine curve so each
 *   bar has a unique staggered bounce cycle.
 * Off-center: minimal 7-bar waveform + label (original layout).
 *
 * Future: replace spectrum with a real WebCodecs AnimatedImage frame
 * when per-project WebP assets are available (Phase 19 plug point).
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

// 12 bars with deterministic heights + stagger delays from sine curve
const BARS = Array.from({ length: 12 }, (_, i) => ({
  h: 20 + Math.abs(Math.sin(i * 0.7 + 0.4) * 26),
  dur: 0.55 + (i % 5) * 0.12,
  delay: i * 0.072,
}))

// 7 bars for off-center compact waveform
const MINI_BARS = Array.from({ length: 7 }, (_, i) => ({
  h: 3 + Math.sin(i * 1.4) * 7,
  delay: i * 0.1,
}))

export function DemoContent() {
  const { data, isCenter } = useCellContext()
  const isVideo = data.demo === 'video'

  if (!isCenter) {
    return (
      <div className={styles.demoCell}>
        <div className={styles.demoBtn}>
          <div className={styles.demoTri} />
        </div>
        <div className={styles.demoWave}>
          {MINI_BARS.map(({ h, delay }, i) => (
            <div
              key={i}
              className={styles.demoBar}
              style={{ height: `${h}px`, animationDelay: `${delay}s` }}
            />
          ))}
        </div>
        <div className={styles.demoLabel}>
          {isVideo ? '▶ VIDEO' : '▶ LISTEN'}
        </div>
      </div>
    )
  }

  /* Center — full spectrum CTA */
  return (
    <div className={styles.demoCell}>
      {/* 12-bar animated equalizer */}
      <div className={`${styles.demoSpectrum} ${isVideo ? styles.demoSpectrumVideo : styles.demoSpectrumAudio}`}>
        {BARS.map(({ h, dur, delay }, i) => (
          <div
            key={i}
            className={styles.demoSpecBar}
            style={{
              ['--bar-h' as string]: `${h}px`,
              ['--bar-dur' as string]: `${dur}s`,
              ['--bar-delay' as string]: `${delay}s`,
            }}
          />
        ))}
      </div>

      {/* Play button */}
      <div className={styles.demoBtn}>
        <div className={styles.demoTri} />
      </div>

      {/* Bold CTA label */}
      <div className={styles.demoCenterLabel}>
        <span className={styles.demoTypeIcon}>{isVideo ? '▶' : '♫'}</span>
        {isVideo ? 'WATCH DEMO' : 'LISTEN NOW'}
      </div>

      {/* Type badge */}
      <div className={`${styles.demoBadge} ${isVideo ? styles.demoBadgeVideo : styles.demoBadgeAudio}`}>
        {isVideo ? 'VIDEO DEMO' : 'AUDIO DEMO'}
      </div>
    </div>
  )
}

export default DemoContent
