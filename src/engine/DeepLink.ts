/**
 * DeepLink — V7.1 hash-based deep links into the slot machine.
 *
 * Recruiter-shareable URLs land directly on a specific section /
 * card / open detail panel. Format:
 *
 *   #/section/itemIdx[/detail]
 *   #/projects/2          → WORK section, 3rd card centered
 *   #/skills/0/detail     → SKILLS section, hero card with detail open
 *   #/about               → ABOUT section, item 0
 *
 * Two-way:
 *  • parseInitial()       — read window.location.hash on boot
 *  • applyToStore(parsed) — push state into useSlotStore atomically
 *  • startSync()          — subscribe to store; whenever section/item
 *    changes, replaceState the URL (no history spam, no scroll jumps)
 *  • emitDetailRequest()  — signals SlotMachine that user wants the
 *    detail panel open (without simulating clicks). Bus event.
 *  • startHashListener()  — listens to hashchange so back/forward
 *    in browser history navigates the slot.
 *
 * Idempotent + dispose-able to play nice with React StrictMode.
 */

import { bus } from './EventBus'
import { useSlotStore } from '../store/slotStore'
import { SECTIONS } from '../data'
import type { SectionId } from '../types'

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface DeepLinkState {
  sectionId: SectionId
  itemIdx: number
  wantDetail: boolean
}

const VALID_IDS: SectionId[] = SECTIONS.map((s) => s.id)

function isValidSectionId(id: string): id is SectionId {
  return (VALID_IDS as string[]).includes(id)
}

function sectionIdToIdx(id: SectionId): number {
  const i = SECTIONS.findIndex((s) => s.id === id)
  return i < 0 ? 0 : i
}

function sectionIdxToId(idx: number): SectionId {
  return SECTIONS[idx]?.id ?? 'projects'
}

// ─────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────

/**
 * Parse the current `window.location.hash`. Returns null if the hash
 * is empty or doesn't match the deep-link grammar. Defensive — never
 * throws, never mutates URL.
 */
export function parseHash(hash = typeof window !== 'undefined' ? window.location.hash : ''): DeepLinkState | null {
  if (!hash) return null
  // Strip leading '#' and optional '/' so both '#projects/2' and
  // '#/projects/2' are accepted.
  const stripped = hash.replace(/^#\/?/, '')
  if (!stripped) return null

  const parts = stripped.split('/').filter(Boolean)
  if (parts.length === 0) return null

  const [sec, idxRaw, maybeDetail] = parts
  if (!sec || !isValidSectionId(sec)) return null

  const idx = idxRaw == null ? 0 : Number.parseInt(idxRaw, 10)
  if (!Number.isFinite(idx) || idx < 0 || idx > 999) return null

  const wantDetail = maybeDetail === 'detail'
  return { sectionId: sec, itemIdx: idx, wantDetail }
}

// ─────────────────────────────────────────────────────────────────────
// Writer (URL → store)
// ─────────────────────────────────────────────────────────────────────

/**
 * Build a hash string from the parts. Always normalizes to the
 * canonical `#/section/idx[/detail]` form.
 */
export function buildHash(s: DeepLinkState): string {
  const tail = s.wantDetail ? '/detail' : ''
  return `#/${s.sectionId}/${s.itemIdx}${tail}`
}

/**
 * Apply a parsed deep-link state to the slot store. Section change
 * resets `currentItemIdx` to 0 by design (see slotStore.setSection),
 * so we set the section first then patch the item index back. Atomic
 * enough for our purposes — both happen synchronously before paint.
 */
export function applyToStore(s: DeepLinkState): void {
  const store = useSlotStore.getState()
  const targetSecIdx = sectionIdToIdx(s.sectionId)
  if (store.currentSectionIdx !== targetSecIdx) {
    store.setSection(targetSecIdx)
  }
  // Clamp item index defensively — section content is short.
  const clamped = Math.max(0, Math.min(s.itemIdx, 64))
  if (useSlotStore.getState().currentItemIdx !== clamped) {
    store.setItemIdx(clamped)
  }
  if (s.wantDetail) {
    // Defer one frame so SlotMachine has time to render the new
    // section. The bus event triggers `focusCard(0)` programmatically.
    requestAnimationFrame(() => {
      bus.emit('custom:deeplink:detail_request' as 'custom:deeplink:detail_request', {
        sectionId: s.sectionId,
      })
    })
  }
}

// ─────────────────────────────────────────────────────────────────────
// Live sync (store → URL)
// ─────────────────────────────────────────────────────────────────────

let unsub: (() => void) | null = null
let lastPushed = ''

/**
 * Subscribe to slot store. Whenever section/item changes, mirror the
 * canonical hash back to URL using `replaceState` so we don't spam
 * the browser history with intermediate states.
 *
 * Detail panel state is appended via setDetailOpen() — the caller
 * (SlotMachine) flips that flag when focusCard/stepBack runs.
 */
export function startSync(): () => void {
  if (unsub) return unsub
  if (typeof window === 'undefined') return () => {}

  const writeHash = (sectionIdx: number, itemIdx: number, detail: boolean) => {
    const next = buildHash({
      sectionId: sectionIdxToId(sectionIdx),
      itemIdx,
      wantDetail: detail,
    })
    if (next === lastPushed) return
    lastPushed = next
    try {
      window.history.replaceState(null, '', next)
    } catch {
      // some sandboxed iframes block replaceState — silent fall-through
    }
  }

  // Subscribe to slot store changes; track detail flag separately
  let detailOpen = false
  const off = useSlotStore.subscribe((state, prev) => {
    if (
      state.currentSectionIdx === prev.currentSectionIdx &&
      state.currentItemIdx === prev.currentItemIdx
    ) return
    writeHash(state.currentSectionIdx, state.currentItemIdx, detailOpen)
  })

  // Detail-open events — SlotMachine emits when focusCard mounts
  // the detail panel and again when stepBack tears it down.
  const offOpen = bus.on('custom:deeplink:detail_open' as 'custom:deeplink:detail_open', () => {
    detailOpen = true
    const s = useSlotStore.getState()
    writeHash(s.currentSectionIdx, s.currentItemIdx, true)
  })
  const offClose = bus.on('custom:deeplink:detail_close' as 'custom:deeplink:detail_close', () => {
    detailOpen = false
    const s = useSlotStore.getState()
    writeHash(s.currentSectionIdx, s.currentItemIdx, false)
  })

  unsub = () => {
    off()
    offOpen()
    offClose()
    unsub = null
  }
  return unsub
}

/**
 * hashchange listener — handles browser back/forward + manual edits
 * to URL bar. Re-applies state to the store. Idempotent (won't
 * double-bind on hot-reload).
 */
let hashOff: (() => void) | null = null
export function startHashListener(): () => void {
  if (hashOff) return hashOff
  if (typeof window === 'undefined') return () => {}

  const handler = () => {
    const parsed = parseHash()
    if (parsed) applyToStore(parsed)
  }
  window.addEventListener('hashchange', handler)
  hashOff = () => {
    window.removeEventListener('hashchange', handler)
    hashOff = null
  }
  return hashOff
}

/**
 * Boot helper — call once after mount. Reads URL, applies to store,
 * starts sync + hash listener. Returns a disposer.
 */
export function bootDeepLink(): () => void {
  if (typeof window === 'undefined') return () => {}
  const initial = parseHash()
  if (initial) applyToStore(initial)
  const offSync = startSync()
  const offHash = startHashListener()
  return () => {
    offSync()
    offHash()
  }
}

/**
 * Used by external code (e.g. dossier viewer) to construct a shareable
 * absolute URL pointing at the current state. Falls back to plain
 * pathname when window is missing (SSR / tests).
 */
export function shareableUrl(s: DeepLinkState): string {
  if (typeof window === 'undefined') return buildHash(s)
  const { origin, pathname } = window.location
  return `${origin}${pathname}${buildHash(s)}`
}
