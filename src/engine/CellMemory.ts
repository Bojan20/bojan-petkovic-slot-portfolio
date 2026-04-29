/**
 * CellMemory — persistent visited-state tracker for slot cells.
 *
 * Every time a cell becomes the visible center (winning row), we record
 * the visit: first-seen-at, last-seen-at, total dwell-ms, expand count.
 * On a return visit the slot can render visited cells with a subtle
 * checkmark and unvisited cells slightly brighter — the cabinet
 * remembers what the recruiter has already seen.
 *
 * Storage: OPFS at `cell-memory/index.json`. Falls back to in-memory
 * if OPFS is unsupported (older Safari) — visits stay valid for the
 * session but don't persist across reloads.
 *
 * Persistence policy:
 *   • Load once at module init (lazy on first read)
 *   • Mutations debounced 1500ms before write — high-frequency dwell
 *     ticks shouldn't hammer disk
 *   • Final flush on `beforeunload` so the last seconds get captured
 *
 * Design: zero React, zero Zustand. Mutable refs + EventBus emissions
 * (`custom:cell:visited`) so components subscribing in their own RAF
 * see updates without re-render churn.
 */

import { bus } from './EventBus'
import { opfsRead, opfsWrite, isOpfsSupported } from './OpfsCache'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CellMemoryEntry {
  /** Composite key — `<sectionId>:<itemIndex>`. */
  cellKey: string
  /** ISO ms timestamp of first center-cell appearance. */
  firstSeenAt: number
  /** ISO ms timestamp of most recent center-cell appearance. */
  lastSeenAt: number
  /** Total ms this cell has been the center cell across all sessions. */
  dwellMs: number
  /** Times the user clicked into the detail / payline takeover. */
  expandedCount: number
  /** Visit count — number of distinct center-cell appearances. */
  visitCount: number
}

interface CellMemoryStore {
  schemaVersion: 1
  updatedAt: number
  entries: Record<string, CellMemoryEntry>
}

// ─── Storage path ────────────────────────────────────────────────────────────

const STORE_PATH = 'cell-memory/index.json'
const SCHEMA_VERSION = 1
const FLUSH_DEBOUNCE_MS = 1500

// ─── State ───────────────────────────────────────────────────────────────────

let _store: CellMemoryStore = {
  schemaVersion: SCHEMA_VERSION,
  updatedAt: 0,
  entries: {},
}
let _loaded = false
let _flushTimer = 0
let _currentDwellKey: string | null = null
let _currentDwellStart = 0

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function cellKey(sectionId: string, itemIdx: number): string {
  return `${sectionId}:${itemIdx}`
}

function ensureEntry(key: string): CellMemoryEntry {
  let e = _store.entries[key]
  if (!e) {
    const now = Date.now()
    e = {
      cellKey: key,
      firstSeenAt: now,
      lastSeenAt: now,
      dwellMs: 0,
      expandedCount: 0,
      visitCount: 0,
    }
    _store.entries[key] = e
  }
  return e
}

function scheduleFlush(): void {
  if (!isOpfsSupported()) return
  if (_flushTimer) clearTimeout(_flushTimer)
  _flushTimer = window.setTimeout(() => {
    _flushTimer = 0
    _store.updatedAt = Date.now()
    const blob = new Blob([JSON.stringify(_store)], { type: 'application/json' })
    void opfsWrite(STORE_PATH, blob).catch(() => {})
  }, FLUSH_DEBOUNCE_MS)
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

/**
 * Load persisted memory. Idempotent. Safe to call repeatedly — only
 * the first call hits OPFS. Failed loads leave the in-memory store
 * empty so writes still work.
 */
export async function loadCellMemory(): Promise<void> {
  if (_loaded) return
  _loaded = true
  if (!isOpfsSupported()) return
  try {
    const blob = await opfsRead(STORE_PATH)
    if (!blob) return
    const parsed = JSON.parse(await blob.text()) as CellMemoryStore
    if (parsed.schemaVersion === SCHEMA_VERSION && parsed.entries) {
      _store = parsed
    }
  } catch (err) {
    console.info('[CellMemory] load failed (starting empty):', err)
  }

  // Final flush before the page unloads so the last seconds of
  // interaction don't get lost in the debounce window.
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (_flushTimer) {
        clearTimeout(_flushTimer)
        _flushTimer = 0
        _store.updatedAt = Date.now()
        // Best-effort sync write — async writes don't survive unload
        const blob = new Blob([JSON.stringify(_store)], { type: 'application/json' })
        void opfsWrite(STORE_PATH, blob).catch(() => {})
      }
    })
  }
}

// ─── Mutators ────────────────────────────────────────────────────────────────

/**
 * Record that a cell became the center (winning row). Bumps visitCount,
 * updates lastSeenAt, sets firstSeenAt on first visit. Auto-completes
 * any in-flight dwell tracking for the previous cell.
 */
export function recordVisit(sectionId: string, itemIdx: number): void {
  // Close out the previous dwell window (if any)
  if (_currentDwellKey) {
    const prev = _store.entries[_currentDwellKey]
    if (prev) {
      prev.dwellMs += performance.now() - _currentDwellStart
    }
  }

  const key = cellKey(sectionId, itemIdx)
  const e = ensureEntry(key)
  const now = Date.now()
  e.lastSeenAt = now
  e.visitCount += 1
  if (e.visitCount === 1) e.firstSeenAt = now

  _currentDwellKey = key
  _currentDwellStart = performance.now()

  bus.emit('custom:cell:visited', {
    cellKey: key,
    visitCount: e.visitCount,
    isFirstVisit: e.visitCount === 1,
  })
  scheduleFlush()
}

/** Record a payline takeover / detail expand on the current cell. */
export function recordExpand(sectionId: string, itemIdx: number): void {
  const key = cellKey(sectionId, itemIdx)
  const e = ensureEntry(key)
  e.expandedCount += 1
  scheduleFlush()
}

// ─── Readers ─────────────────────────────────────────────────────────────────

export function isCellVisited(sectionId: string, itemIdx: number): boolean {
  const e = _store.entries[cellKey(sectionId, itemIdx)]
  return e !== undefined && e.visitCount > 0
}

export function getCellMemory(sectionId: string, itemIdx: number): CellMemoryEntry | null {
  return _store.entries[cellKey(sectionId, itemIdx)] ?? null
}

/** All visited cellKeys in this origin. Used for "your tour" overlays. */
export function getVisitedKeys(): string[] {
  return Object.keys(_store.entries).filter((k) => _store.entries[k]!.visitCount > 0)
}

/** Total dwell-ms across all cells — proxy for engagement depth. */
export function getTotalDwellMs(): number {
  let total = 0
  for (const k of Object.keys(_store.entries)) {
    total += _store.entries[k]!.dwellMs
  }
  return total
}

/** Reset everything. Keyboard `Ctrl/Cmd+Shift+M` could surface this. */
export async function clearCellMemory(): Promise<void> {
  _store = { schemaVersion: SCHEMA_VERSION, updatedAt: Date.now(), entries: {} }
  _currentDwellKey = null
  if (isOpfsSupported()) {
    const blob = new Blob([JSON.stringify(_store)], { type: 'application/json' })
    await opfsWrite(STORE_PATH, blob).catch(() => {})
  }
}
