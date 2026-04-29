/**
 * DemoContent — playable demo CTA (▶ VIDEO / ▶ LISTEN) with 7-bar
 * waveform animation. Used by 'demo' cell type.
 *
 * Future plug point: when an animated WebP / video asset lands per
 * project, this is where <AnimatedImage> drops in (Phase 19 wiring).
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

export function DemoContent() {
  const { data } = useCellContext()
  return (
    <div className={styles.demoCell}>
      <div className={styles.demoBtn}>
        <div className={styles.demoTri} />
      </div>
      <div className={styles.demoWave}>
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className={styles.demoBar}
            style={{
              height: `${3 + Math.sin(i * 1.4) * 7}px`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
      <div className={styles.demoLabel}>
        {data.demo === 'video' ? '▶ VIDEO' : '▶ LISTEN'}
      </div>
    </div>
  )
}

export default DemoContent
