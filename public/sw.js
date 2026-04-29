/* eslint-disable no-restricted-globals */
/**
 * Service Worker — offline-ready cache for the portfolio
 *
 * Strategy mix tuned per asset class:
 *   • App shell HTML        → network-first, fall back to cache
 *     (so deploys reach users immediately when online)
 *   • Built /assets/*       → cache-first, with stale-while-revalidate
 *     (vite hashes filenames so cache key churns on each deploy)
 *   • Static images / audio → cache-first (heavy, rarely change)
 *
 * Cache names include a build version so a new deploy invalidates
 * everything cleanly. Stale caches are pruned on activate.
 *
 * Installation: registered from src/sw-register.ts after window.load
 * (so it never competes with the first paint). The first visit is a
 * normal network load; the second visit is essentially instant (and
 * works fully offline if the user revisits without a connection).
 */

const VERSION = 'v1-2026-04-29'
const SHELL_CACHE = `bp-portfolio-shell-${VERSION}`
const ASSET_CACHE = `bp-portfolio-assets-${VERSION}`
const MEDIA_CACHE = `bp-portfolio-media-${VERSION}`

// Files to cache on install (the "app shell" — minimum to render)
const SHELL_URLS = [
  '/',
  '/index.html',
  '/favicon.svg',
]

// ── Install: pre-cache the shell ───────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  )
})

// ── Message: SKIP_WAITING from app (user-accepted update) ──────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ── Activate: prune old caches, claim clients ──────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k.startsWith('bp-portfolio-') &&
                ![SHELL_CACHE, ASSET_CACHE, MEDIA_CACHE].includes(k),
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// ── Helpers ────────────────────────────────────────────────────────
function isMedia(url) {
  return /\.(png|jpg|jpeg|webp|svg|mp3|ogg|wav|m4a|woff2?|ttf)$/i.test(url.pathname)
}
function isHashedAsset(url) {
  // Vite emits /assets/<name>-<hash>.<ext>
  return url.pathname.startsWith('/assets/')
}
function isAppShell(url) {
  return url.pathname === '/' || url.pathname === '/index.html'
}

// ── Fetch: route by asset class ────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request

  // Only handle GET — POST/PUT/etc go straight to network
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Cross-origin: skip entirely (don't break analytics etc.)
  if (url.origin !== self.location.origin) return

  // ─── App shell: network-first, cache fallback ────────────────────
  if (isAppShell(url)) {
    event.respondWith(networkFirst(req, SHELL_CACHE))
    return
  }

  // ─── Hashed JS/CSS bundles: cache-first + revalidate in background
  if (isHashedAsset(url)) {
    event.respondWith(cacheFirstSWR(req, ASSET_CACHE))
    return
  }

  // ─── Static media: cache-first (rarely change) ───────────────────
  if (isMedia(url)) {
    event.respondWith(cacheFirstSWR(req, MEDIA_CACHE))
    return
  }
  // Anything else: pass-through to network
})

async function networkFirst(req, cacheName) {
  try {
    const fresh = await fetch(req)
    if (fresh && fresh.ok) {
      const cache = await caches.open(cacheName)
      cache.put(req, fresh.clone()).catch(() => {})
    }
    return fresh
  } catch {
    const cached = await caches.match(req)
    if (cached) return cached
    // Last-resort offline page: try the cached shell index
    const shell = await caches.match('/index.html')
    if (shell) return shell
    return new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

async function cacheFirstSWR(req, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(req)
  // Background revalidate
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {})
      return res
    })
    .catch(() => null)
  return cached || (await fetchPromise) || new Response('Offline', { status: 503 })
}
