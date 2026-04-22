import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './MockupV2.module.css'
import {
  PROJECTS,
  SKILLS_DATA,
  ABOUT_DATA,
  EXP_DATA,
  CONTACT_DATA,
  SECTIONS,
} from '../data'
import type { SectionId } from '../types'

type Item = {
  ico: string
  name: string
  sub?: string
  body: string
  pills?: { label: string; on: boolean }[]
  tools?: string[]
  color?: string
  cta?: { label: string; href: string }
}

function projectsAsItems(): Item[] {
  return PROJECTS.map((p) => ({
    ico: p.ico,
    name: p.name,
    sub: p.studio,
    body: p.work,
    pills: [
      { label: 'MUSIC', on: p.scope.music },
      { label: 'SFX', on: p.scope.sfx },
      { label: 'INTEGRATION', on: p.scope.integration },
      { label: 'QA', on: p.scope.qa },
    ],
    tools: p.tools,
    color: p.color,
  }))
}
function skillsAsItems(): Item[] {
  return SKILLS_DATA.map((s) => ({
    ico: s.ico,
    name: s.name,
    sub: `${s.level} · ${s.domain}`,
    body: s.desc,
    tools: s.tools,
    color: s.color,
  }))
}
function aboutAsItems(): Item[] {
  return ABOUT_DATA.map((a) => ({
    ico: a.ico,
    name: a.name,
    sub: a.period,
    body: a.desc,
    tools: a.highlights,
    color: a.color,
  }))
}
function careerAsItems(): Item[] {
  return EXP_DATA.map((e) => ({
    ico: e.ico,
    name: e.name,
    sub: e.period,
    body: e.desc,
    tools: e.highlights,
    color: e.color,
  }))
}
function contactAsItems(): Item[] {
  return CONTACT_DATA.map((c) => ({
    ico: c.ico,
    name: c.name,
    sub: c.period,
    body: c.desc,
    tools: c.highlights,
    color: c.color,
    cta: ctaFor(c.name, c.desc),
  }))
}
function ctaFor(name: string, desc: string): Item['cta'] | undefined {
  const lower = name.toLowerCase()
  if (lower.includes('email')) {
    const email = desc.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]
    if (email) return { label: `Email · ${email}`, href: `mailto:${email}` }
  }
  if (lower.includes('linkedin')) {
    const url = desc.match(/https?:\/\/\S+|linkedin\.com\/\S+/)?.[0]
    if (url) return { label: 'Open LinkedIn', href: url.startsWith('http') ? url : `https://${url}` }
  }
  if (lower.includes('github')) {
    const url = desc.match(/https?:\/\/\S+|github\.com\/\S+/)?.[0]
    if (url) return { label: 'Open GitHub', href: url.startsWith('http') ? url : `https://${url}` }
  }
  return undefined
}

function getItems(id: SectionId): Item[] {
  switch (id) {
    case 'projects': return projectsAsItems()
    case 'skills':   return skillsAsItems()
    case 'about':    return aboutAsItems()
    case 'career':   return careerAsItems()
    case 'contact':  return contactAsItems()
  }
}

export function MockupV2() {
  const [sectionIdx, setSectionIdx] = useState(0)
  const [itemIdx, setItemIdx] = useState(0)

  const section = SECTIONS[sectionIdx] ?? SECTIONS[0]!
  const items = useMemo(() => getItems(section.id), [section.id])
  const item = (items[itemIdx] ?? items[0])!

  const goSection = useCallback((i: number) => {
    const target = SECTIONS[i]
    if (!target) return
    setSectionIdx(i)
    setItemIdx(0)
    if (window.location.hash !== `#/${target.id}`) {
      history.replaceState(null, '', `#/${target.id}`)
    }
  }, [])

  const goItem = useCallback((i: number) => {
    const n = items.length
    const nx = ((i % n) + n) % n
    setItemIdx(nx)
  }, [items.length])

  // URL hash sync
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace(/^#\/?/, '')
      const idx = SECTIONS.findIndex((s) => s.id === h)
      if (idx >= 0) setSectionIdx(idx)
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [])

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goItem(itemIdx + 1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goItem(itemIdx - 1) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); goSection((sectionIdx - 1 + SECTIONS.length) % SECTIONS.length) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); goSection((sectionIdx + 1) % SECTIONS.length) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [itemIdx, sectionIdx, goItem, goSection])

  // Touch swipe
  useEffect(() => {
    let sx = 0, sy = 0
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]; if (!t) return
      sx = t.clientX; sy = t.clientY
    }
    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]; if (!t) return
      const dx = t.clientX - sx
      const dy = t.clientY - sy
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        if (dx < 0) goItem(itemIdx + 1); else goItem(itemIdx - 1)
        navigator.vibrate?.(6)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [itemIdx, goItem])

  const ambient = item?.color ? hexToRgba(item.color, 0.12) : 'rgba(212,168,75,0.08)'

  return (
    <div className={styles.root}>
      {/* ─── Top bar ─── */}
      <div className={styles.topBar}>
        <div className={styles.brand}>
          <span className={styles.brandName}>BOJAN PETKOVIĆ</span>
          <span className={styles.brandRole}>· Audio Director · Sound Designer · Composer</span>
        </div>
        <div className={styles.topActions}>
          <a className={styles.iconBtn} href="mailto:bojan@vanvinkl.com">Email</a>
          <a
            className={`${styles.iconBtn} ${styles.primary}`}
            href="mailto:bojan@vanvinkl.com?subject=Audio%20engagement"
          >Hire</a>
        </div>
      </div>

      {/* ─── Tagline ─── */}
      <div className={styles.tagline}>
        <div className={styles.taglineLine}>
          <span className={styles.taglineAccent}>iGAMING AUDIO</span> · 8 YEARS · 50+ CERTIFIED TITLES
        </div>
      </div>

      {/* ─── Section tabs ─── */}
      <div className={styles.tabs} role="tablist">
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === sectionIdx}
            className={`${styles.tab} ${i === sectionIdx ? styles.active : ''}`}
            onClick={() => goSection(i)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ─── Reel / card ─── */}
      <div className={styles.reelWrap}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionLabel}>{section.label}</span>
          <span className={styles.sectionCount}>{itemIdx + 1} / {items.length}</span>
        </div>
        <div className={styles.reel}>
          <div className={styles.reelTrack}>
            <article
              className={styles.card}
              style={{ ['--cardAmbient' as string]: ambient }}
              aria-live="polite"
            >
              <header className={styles.cardHead}>
                <div className={styles.cardIcon}>{item?.ico}</div>
                <div style={{ minWidth: 0 }}>
                  <h2 className={styles.cardTitle}>{item?.name}</h2>
                  {item?.sub && <div className={styles.cardStudio}>{item.sub}</div>}
                </div>
              </header>

              {item?.pills && item.pills.length > 0 && (
                <div className={styles.cardMeta}>
                  {item.pills.map((p) => (
                    <span key={p.label} className={`${styles.pill} ${p.on ? styles.on : ''}`}>
                      {p.on ? '●' : '○'} {p.label}
                    </span>
                  ))}
                </div>
              )}

              <p className={styles.cardBody}>{item?.body}</p>

              <footer className={styles.cardFoot}>
                {item?.tools?.map((t) => (
                  <span key={t} className={styles.toolChip}>{t}</span>
                ))}
                {item?.cta && (
                  <a
                    href={item.cta.href}
                    className={`${styles.iconBtn} ${styles.primary}`}
                    style={{ marginLeft: 'auto' }}
                    target={item.cta.href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                  >{item.cta.label}</a>
                )}
              </footer>
            </article>
          </div>
        </div>

        {/* ─── Strip: all items in section ─── */}
        <div className={styles.strip} aria-label="Items in section">
          {items.map((it, i) => (
            <button
              key={it.name}
              className={`${styles.stripItem} ${i === itemIdx ? styles.active : ''}`}
              onClick={() => goItem(i)}
            >
              <span className={styles.stripIco}>{it.ico}</span>
              <span>{it.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Controls ─── */}
      <div className={styles.controls}>
        <button className={styles.navBtn} onClick={() => goItem(itemIdx - 1)} aria-label="Previous item">‹</button>
        <div className={styles.counter}>
          <span className={styles.counterCurrent}>{item?.name}</span> — {section.label}
        </div>
        <button className={styles.navBtn} onClick={() => goItem(itemIdx + 1)} aria-label="Next item">›</button>
      </div>
    </div>
  )
}

function hexToRgba(hex: string, a: number): string {
  const m = hex.replace('#', '')
  const bi = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16)
  const r = (bi >> 16) & 255
  const g = (bi >> 8) & 255
  const b = bi & 255
  return `rgba(${r},${g},${b},${a})`
}
