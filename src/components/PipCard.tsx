/**
 * PipCard — content rendered INSIDE the Document Picture-in-Picture
 * window. Stays in sync with the parent's slot store via React portal.
 *
 * Hosted by PlatformChip when the user clicks the "↗ PiP" chip.
 * Contents:
 *   • Section icon + name (large, gold)
 *   • Item index (e.g. "3 / 8") + item name (project / skill / etc.)
 *   • Live "Now showing" cyan ribbon at the top
 *   • Click anywhere → focus parent tab via window.opener.focus()
 */

import { useMemo } from 'react'
import { useSlotStore } from '../store'
import {
  SECTIONS,
  PROJECTS,
  SKILLS_DATA,
  ABOUT_DATA,
  EXP_DATA,
  CONTACT_DATA,
} from '../data'

function getDataForSection(secIdx: number): Array<{ name?: string; label?: string; title?: string }> {
  const id = SECTIONS[secIdx]?.id
  switch (id) {
    case 'projects': return PROJECTS
    case 'skills':   return SKILLS_DATA
    case 'about':    return ABOUT_DATA
    case 'career':   return EXP_DATA
    case 'contact':  return CONTACT_DATA
    default:         return []
  }
}

export function PipCard() {
  const sectionIdx = useSlotStore((s) => s.currentSectionIdx)
  const itemIdx = useSlotStore((s) => s.currentItemIdx)

  const section = SECTIONS[sectionIdx]
  const data = useMemo(() => getDataForSection(sectionIdx), [sectionIdx])
  const item = data[itemIdx]
  const itemName = item?.name ?? item?.label ?? item?.title ?? '—'

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg, rgb(8, 12, 28) 0%, rgb(4, 6, 16) 100%)',
        color: 'rgba(220, 235, 255, 0.95)',
        cursor: 'pointer',
      }}
      onClick={() => {
        try { window.opener?.focus() } catch { /* CORS may block — best-effort */ }
      }}
      title="Click to focus the portfolio tab"
    >
      {/* Top ribbon */}
      <div
        style={{
          padding: '6px 10px',
          background: 'linear-gradient(90deg, rgba(34, 232, 255, 0.18), rgba(177, 76, 255, 0.10))',
          borderBottom: '1px solid rgba(34, 232, 255, 0.35)',
          fontSize: 9,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          color: 'rgb(180, 235, 255)',
          textShadow: '0 0 6px rgba(34, 232, 255, 0.55)',
        }}
      >
        ◉ Now showing — Bojan Petković Portfolio
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 22,
            color: 'rgb(232, 192, 96)',
            textShadow: '0 0 12px rgba(232, 192, 96, 0.55)',
          }}>{section?.icon ?? '◈'}</span>
          <span style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 2.2,
            color: 'rgb(232, 192, 96)',
            textShadow: '0 0 10px rgba(232, 192, 96, 0.45)',
          }}>{section?.label ?? '—'}</span>
        </div>

        <div style={{
          fontSize: 10,
          letterSpacing: 1.2,
          color: 'rgba(150, 200, 240, 0.72)',
        }}>
          item {itemIdx + 1} / {data.length}
        </div>

        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'rgba(255, 255, 255, 0.96)',
          marginTop: 4,
          lineHeight: 1.35,
          letterSpacing: 1.0,
        }}>
          {itemName}
        </div>
      </div>

      {/* Footer hint */}
      <div style={{
        padding: '5px 10px',
        fontSize: 8,
        letterSpacing: 1.4,
        color: 'rgba(180, 200, 230, 0.55)',
        borderTop: '1px solid rgba(120, 200, 240, 0.18)',
        textAlign: 'center',
      }}>
        click → focus portfolio tab
      </div>
    </div>
  )
}

export default PipCard
