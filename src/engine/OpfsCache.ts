/**
 * OpfsCache — Origin Private File System persistent asset store
 *
 * The pitch: Service Worker Cache (Phase 6.4) covers the static app
 * shell perfectly, but it's read-mostly and bound to the SW lifecycle.
 * OPFS gives us a private, persistent, write-friendly filesystem
 * inside the same origin — perfect for media that changes per session
 * (AudioBridge assignment audio, recruiter-uploaded snapshots) and
 * for guaranteed-fast offline replay of the lounge ambient.
 *
 * Why this matters as a portfolio piece:
 *   • OPFS is a 2024+ baseline web platform feature most devs don't
 *     reach for because IndexedDB feels good enough — but OPFS is
 *     a *real filesystem*, with sync access handles, no quota
 *     surprises, and ~3-5× faster reads for binary blobs vs IDB.
 *   • Demonstrates dual-cache thinking: SW Cache for shell, OPFS for
 *     hot session-specific assets. This is how production media apps
 *     (Figma, Photopea, Excalidraw) actually structure offline.
 *   • Pairs cleanly with the existing service worker — they don't
 *     compete because OPFS is private to the origin / scope and
 *     never serves to network requests; we explicitly read it.
 *
 * Integration in this commit:
 *   • Module is general-purpose (write/read/delete/list/size) so any
 *     subsequent phase can persist content
 *   • App.tsx pre-caches /ambient/lounge.mp3 into OPFS the first time
 *     it's fetched, then prefers OPFS on subsequent visits — first
 *     paint of the splash → instant audio start, even offline
 *
 * Falls back silently to a no-op layer on browsers without
 * navigator.storage.getDirectory (older Safari < 17).
 */

// ─── Capability detection ────────────────────────────────────────────────────

export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage?.getDirectory === 'function'
  )
}

// ─── Root handle (cached) ────────────────────────────────────────────────────

let _root: FileSystemDirectoryHandle | null = null

async function getRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (!isOpfsSupported()) return null
  if (_root) return _root
  try {
    _root = await navigator.storage.getDirectory()
    return _root
  } catch (err) {
    console.info('[OpfsCache] getDirectory failed:', err)
    return null
  }
}

// ─── Path traversal helper ───────────────────────────────────────────────────

/**
 * Walk a slash-separated path and return the leaf directory + the file
 * name. Creates intermediate directories on write paths.
 *
 * "snapshots/2026/april.json.gz" →
 *   { dir: <handle to /snapshots/2026>, name: "april.json.gz" }
 */
async function resolveDir(
  path: string,
  options: { create: boolean },
): Promise<{ dir: FileSystemDirectoryHandle; name: string } | null> {
  const root = await getRoot()
  if (!root) return null
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return null
  const name = parts.pop()
  if (!name) return null

  let dir: FileSystemDirectoryHandle = root
  for (const segment of parts) {
    try {
      dir = await dir.getDirectoryHandle(segment, { create: options.create })
    } catch (err) {
      if (!options.create) return null
      console.info('[OpfsCache] dir handle failed:', segment, err)
      return null
    }
  }
  return { dir, name }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Write a blob to OPFS. Overwrites if the file exists. Returns bytes written. */
export async function opfsWrite(path: string, blob: Blob): Promise<number> {
  const r = await resolveDir(path, { create: true })
  if (!r) return 0
  try {
    const fileHandle = await r.dir.getFileHandle(r.name, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
    return blob.size
  } catch (err) {
    console.info('[OpfsCache] write failed:', path, err)
    return 0
  }
}

/** Read a file as Blob. Returns null if missing or on error. */
export async function opfsRead(path: string): Promise<Blob | null> {
  const r = await resolveDir(path, { create: false })
  if (!r) return null
  try {
    const fileHandle = await r.dir.getFileHandle(r.name, { create: false })
    return await fileHandle.getFile()
  } catch (err) {
    // NotFoundError is the common "missing file" path — silent
    if ((err as DOMException)?.name !== 'NotFoundError') {
      console.info('[OpfsCache] read failed:', path, err)
    }
    return null
  }
}

/** Read a file as ArrayBuffer (for direct binary consumers). */
export async function opfsReadBuffer(path: string): Promise<ArrayBuffer | null> {
  const blob = await opfsRead(path)
  if (!blob) return null
  return await blob.arrayBuffer()
}

/** Delete a file. Returns true on success, false if missing or error. */
export async function opfsDelete(path: string): Promise<boolean> {
  const r = await resolveDir(path, { create: false })
  if (!r) return false
  try {
    await r.dir.removeEntry(r.name)
    return true
  } catch {
    return false
  }
}

/** True if a file exists at path. */
export async function opfsExists(path: string): Promise<boolean> {
  const r = await resolveDir(path, { create: false })
  if (!r) return false
  try {
    await r.dir.getFileHandle(r.name, { create: false })
    return true
  } catch {
    return false
  }
}

/**
 * List all entries (file + directory names) in a directory path.
 * Returns empty array if missing or unsupported.
 */
export async function opfsList(dirPath = ''): Promise<string[]> {
  const root = await getRoot()
  if (!root) return []

  let dir: FileSystemDirectoryHandle = root
  if (dirPath) {
    const parts = dirPath.split('/').filter(Boolean)
    for (const segment of parts) {
      try {
        dir = await dir.getDirectoryHandle(segment, { create: false })
      } catch {
        return []
      }
    }
  }

  const out: string[] = []
  try {
    // FileSystemDirectoryHandle has an async iterator over [name, handle]
    // entries. Cast to access — lib.dom uses different signatures in
    // different TS versions.
    const iter = (dir as unknown as {
      entries: () => AsyncIterableIterator<[string, FileSystemHandle]>
    }).entries()
    for await (const [name] of iter) {
      out.push(name)
    }
  } catch (err) {
    console.info('[OpfsCache] list failed:', dirPath, err)
  }
  return out
}

/**
 * Total bytes used by OPFS for this origin. Best-effort — reads via
 * StorageManager.estimate() since OPFS doesn't expose its own quota.
 * Returns null if unsupported.
 */
export async function opfsUsageBytes(): Promise<number | null> {
  if (!isOpfsSupported()) return null
  if (!navigator.storage?.estimate) return null
  try {
    const est = await navigator.storage.estimate()
    return est.usage ?? null
  } catch {
    return null
  }
}

// ─── Convenience: cached fetch ───────────────────────────────────────────────

/**
 * Fetch-or-OPFS — try OPFS first, fall back to network and write through.
 * The first call costs a network round-trip + an OPFS write; every
 * subsequent call short-circuits to a single OPFS read (~5-15ms for
 * typical media on integrated SSD).
 *
 * Returns the Blob and a flag indicating whether the data came from
 * cache (`fromCache: true`) or the network (`fromCache: false`).
 *
 * Useful for media assets like the lounge ambient track — the SW
 * already covers it, but OPFS gives us guaranteed-zero-network on a
 * second visit even if the SW hasn't activated yet (race during
 * boot first paint).
 */
export async function opfsFetchOrCache(
  url: string,
  cachePath: string,
): Promise<{ blob: Blob; fromCache: boolean } | null> {
  if (isOpfsSupported()) {
    const cached = await opfsRead(cachePath)
    if (cached) return { blob: cached, fromCache: true }
  }
  try {
    const res = await fetch(url, { cache: 'force-cache' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (isOpfsSupported()) {
      // Fire-and-forget cache write — don't block the consumer on it
      void opfsWrite(cachePath, blob).catch(() => {})
    }
    return { blob, fromCache: false }
  } catch (err) {
    console.info('[OpfsCache] fetch fallback failed:', url, err)
    return null
  }
}
