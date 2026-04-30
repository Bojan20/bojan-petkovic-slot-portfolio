/**
 * ToolsContent — tool / skill badge grid.
 *
 * Center cell: tools grouped by category (DAW · ENGINE · QA · OTHER)
 *   with a faint label divider — tells the recruiter what category
 *   each tool belongs to at a glance.
 * Off-center: flat badge grid (space-constrained).
 *
 * Category mapping is maintained here — add new tools to the map
 * without touching any other file.
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

type GroupKey = 'DAW' | 'ENGINE' | 'QA' | 'OTHER'

const CATEGORY_MAP: Record<string, GroupKey> = {
  'Logic Pro': 'DAW', 'Reaper': 'DAW', 'Pro Tools': 'DAW',
  'Ableton': 'DAW', 'Cubase': 'DAW', 'Studio One': 'DAW',

  'Phaser 3': 'ENGINE', 'Unity': 'ENGINE', 'PixiJS': 'ENGINE',
  'FMOD': 'ENGINE', 'Wwise': 'ENGINE', 'Howler.js': 'ENGINE',
  'Tone.js': 'ENGINE',

  'iZotope RX': 'QA', 'iZotope': 'QA', 'Krotos': 'QA',
  'TestRail': 'QA', 'JIRA': 'QA', 'Kontakt': 'QA',
  'Spitfire': 'QA',
}

const GROUP_META: Record<GroupKey, { label: string; icon: string }> = {
  DAW:    { label: 'DAW',    icon: '🎛' },
  ENGINE: { label: 'ENGINE', icon: '⚙' },
  QA:     { label: 'QA',     icon: '✓' },
  OTHER:  { label: 'TOOLS',  icon: '◆' },
}

function groupTools(tools: string[]): Array<{ key: GroupKey; label: string; icon: string; items: string[] }> {
  const map = new Map<GroupKey, string[]>()
  for (const t of tools) {
    const cat: GroupKey = CATEGORY_MAP[t] ?? 'OTHER'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(t)
  }
  // Preserve category order: DAW → ENGINE → QA → OTHER
  const order: GroupKey[] = ['DAW', 'ENGINE', 'QA', 'OTHER']
  return order
    .filter((k) => map.has(k))
    .map((k) => ({ key: k, ...GROUP_META[k], items: map.get(k)! }))
}

export function ToolsContent() {
  const { data, isCenter } = useCellContext()
  if (!data.tools) return null

  if (!isCenter) {
    return (
      <div className={styles.toolsGrid}>
        {data.tools.map((t) => (
          <div key={t} className={styles.toolBadge}>{t}</div>
        ))}
      </div>
    )
  }

  const groups = groupTools(data.tools)

  // Single-group or flat fallback (e.g. skills "EXPERT" / "COMPOSITION")
  if (groups.length === 1 && groups[0]!.key === 'OTHER') {
    return (
      <div className={styles.toolsGrid}>
        {data.tools.map((t) => (
          <div key={t} className={styles.toolBadge}>{t}</div>
        ))}
      </div>
    )
  }

  return (
    <div className={styles.toolsGrouped}>
      {groups.map((g) => (
        <div key={g.key} className={styles.toolsGroup}>
          <div className={styles.toolsGroupLabel}>
            <span>{g.icon}</span> {g.label}
          </div>
          <div className={styles.toolsGroupItems}>
            {g.items.map((t) => (
              <div key={t} className={styles.toolBadge}>{t}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default ToolsContent
