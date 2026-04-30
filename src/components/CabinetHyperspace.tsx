/**
 * CabinetHyperspace — V4.3 hyperspace tunnel layer.
 *
 * Star-Wars-style radial speed lines that rush from the center
 * outward (or inward) — used as the "warp jump" frame between
 * splash and slot, replacing what would otherwise be a flat
 * black hold. Reads as "we just punched through to the next
 * scene" — the perfect match-cut shimmer.
 *
 * Driven by body[data-hyperspace]:
 *   absent    — hidden
 *   "out"     — streaks rush outward (entering new scene)
 *   "in"      — streaks rush inward (collapsing into next scene)
 *
 * 36 streaks pre-baked via CSS conic gradient + radial mask.
 * Each streak has its own --i index for staggered animation.
 */

import styles from './CabinetHyperspace.module.css'

export function CabinetHyperspace() {
  return (
    <div className={styles.tunnel} aria-hidden="true">
      {Array.from({ length: 36 }).map((_, i) => (
        <span
          key={i}
          className={styles.streak}
          style={{
            ['--i' as string]: i,
            ['--angle' as string]: `${i * 10}deg`,
          } as React.CSSProperties}
        />
      ))}
      <div className={styles.coreFlash} />
    </div>
  )
}

export default CabinetHyperspace
