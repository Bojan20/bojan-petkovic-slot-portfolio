/**
 * CommandPalette — V7.5 Cmd/Ctrl+K fuzzy navigator.
 *
 * Recruiter shortcut for power users: hit ⌘K, type a few letters of
 * a project / skill / section, hit Enter → deep-link navigates the
 * cabinet. Bypasses the spin → land → focus dance entirely.
 *
 * Index source:
 *   • SECTIONS (5 entries: WORK / SKILLS / ABOUT / CAREER / REACH)
 *   • PROJECTS (8 entries: PIGGY PLUNGER, SMASH FACTORY, etc.)
 *   • SKILLS_DATA (skills entries with name)
 *   • EXP_DATA (career roles)
 *   • CONTACT_DATA (contact channels)
 *
 * Each entry resolves to a DeepLinkState (sectionId, itemIdx,
 * wantDetail). Picking it calls applyToStore + closes.
 *
 * Keyboard: ↑↓ navigate · Enter pick · Esc close · ⌘K toggle.
 *
 * Pure CSS-Modules + React — no portal lib, no headless ui dep.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { applyToStore } from '../engine/DeepLink'
import { SECTIONS, PROJECTS, SKILLS_DATA, EXP_DATA, CONTACT_DATA } from '../data'
import type { SectionId } from '../types'
import styles from './CommandPalette.module.css'

interface PaletteEntry {
  id: string
  label: string
  group: 'Section' | 'Project' | 'Skill' | 'Career' | 'Contact'
  sectionId: SectionId
  itemIdx: number
  /** Optional sub-text shown right of label */
  hint?: string
}

function buildIndex(): PaletteEntry[] {
  const out: PaletteEntry[] = []
  // Sections
  for (let i = 0; i < SECTIONS.length; i++) {
    const s = SECTIONS[i]!
    out.push({
      id: `sec-${s.id}`,
      label: s.label,
      group: 'Section',
      sectionId: s.id,
      itemIdx: 0,
      hint: s.id.toUpperCase(),
    })
  }
  // Projects
  PROJECTS.forEach((p, idx) => {
    out.push({
      id: `proj-${idx}`,
      label: p.name,
      group: 'Project',
      sectionId: 'projects',
      itemIdx: idx,
      hint: p.studio,
    })
  })
  // Skills
  SKILLS_DATA.forEach((sk, idx) => {
    const name = (sk as { name?: string }).name ?? `Skill ${idx + 1}`
    out.push({
      id: `skill-${idx}`,
      label: name,
      group: 'Skill',
      sectionId: 'skills',
      itemIdx: idx,
    })
  })
  // Career
  EXP_DATA.forEach((exp, idx) => {
    const company = (exp as { name?: string; company?: string }).name
                  ?? (exp as { company?: string }).company
                  ?? `Role ${idx + 1}`
    out.push({
      id: `exp-${idx}`,
      label: company,
      group: 'Career',
      sectionId: 'career',
      itemIdx: idx,
    })
  })
  // Contact
  CONTACT_DATA.forEach((c, idx) => {
    const name = (c as { name?: string; channel?: string }).name
              ?? (c as { channel?: string }).channel
              ?? `Channel ${idx + 1}`
    out.push({
      id: `cont-${idx}`,
      label: name,
      group: 'Contact',
      sectionId: 'contact',
      itemIdx: idx,
    })
  })
  return out
}

/** Score entry against query — higher is better, 0 means no match */
function score(entry: PaletteEntry, q: string): number {
  if (!q) return 1
  const norm = q.toLowerCase().replace(/\s+/g, '')
  const labelN = entry.label.toLowerCase().replace(/\s+/g, '')
  const groupN = entry.group.toLowerCase()

  // Exact prefix → big bonus
  if (labelN.startsWith(norm)) return 1000 + (norm.length / labelN.length) * 100
  // Substring match in label
  if (labelN.includes(norm)) return 500 - labelN.indexOf(norm)
  // Group match
  if (groupN.startsWith(norm)) return 200
  // Subsequence match — letters appear in order
  let li = 0
  for (const c of norm) {
    li = labelN.indexOf(c, li)
    if (li < 0) return 0
    li++
  }
  return 50
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const index = useMemo(() => buildIndex(), [])

  const results = useMemo(() => {
    if (!query.trim()) return index.slice(0, 12)
    return index
      .map((e) => ({ entry: e, s: score(e, query) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((r) => r.entry)
  }, [index, query])

  // ⌘K / Ctrl+K toggle — global keydown
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (isToggle) {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      if (!open) return
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        const pick = results[activeIdx]
        if (pick) commit(pick)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, activeIdx])

  // Reset query + focus input when opening
  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIdx(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  // Keep active row visible
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const li = list.querySelector<HTMLLIElement>(`[data-idx="${activeIdx}"]`)
    if (li) li.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  function commit(entry: PaletteEntry) {
    applyToStore({
      sectionId: entry.sectionId,
      itemIdx: entry.itemIdx,
      wantDetail: false,
    })
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-label="Command palette"
      aria-modal="true"
      onClick={() => setOpen(false)}
    >
      <div className={styles.shell} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.kbd}>⌘K</span>
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0) }}
            placeholder="Jump to anything — section, project, skill, channel…"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="button"
            className={styles.close}
            aria-label="Close command palette"
            onClick={() => setOpen(false)}
          >ESC</button>
        </div>

        <ul className={styles.list} ref={listRef} role="listbox">
          {results.length === 0 && (
            <li className={styles.empty}>
              No matches for <strong>{query}</strong>. Try a project name (e.g. PIGGY).
            </li>
          )}
          {results.map((r, i) => (
            <li
              key={r.id}
              data-idx={i}
              role="option"
              aria-selected={i === activeIdx}
              data-active={i === activeIdx ? '1' : '0'}
              className={styles.row}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => commit(r)}
            >
              <span className={styles.group}>{r.group}</span>
              <span className={styles.label}>{r.label}</span>
              {r.hint && <span className={styles.hint}>{r.hint}</span>}
            </li>
          ))}
        </ul>

        <footer className={styles.footer}>
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </footer>
      </div>
    </div>
  )
}

export default CommandPalette
