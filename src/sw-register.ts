/**
 * Service Worker registration
 *
 * Registers /sw.js after window.load so it never competes with the
 * first paint. Skipped in dev (Vite HMR vs SW caching is a known
 * pain point — only the production build ships the SW).
 *
 * Lifecycle hooks:
 *  • Detects when a NEW worker has installed and is waiting → emits
 *    a `bus.emit('custom:sw_update_available')` event so the app can
 *    surface a "new version — refresh" prompt if it wants to.
 *  • On controllerchange (user accepted the update), reloads the page
 *    so the new bundle takes over cleanly.
 */

import { bus } from './engine'

let updateAvailable = false

export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  // Skip in dev — Vite serves modules over HTTP, SW would aggressively
  // cache them and break HMR. Production builds (import.meta.env.PROD)
  // are the only context we register in.
  if (!import.meta.env.PROD) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // On install of a new worker, set a listener for state change
        if (reg.waiting) {
          updateAvailable = true
          notifyUpdateAvailable()
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              updateAvailable = true
              notifyUpdateAvailable()
            }
          })
        })
      })
      .catch((err) => {
        console.warn('[SW] registration failed:', err)
      })

    // After the user accepts an update (skipWaiting() called via
    // activatePendingUpdate), reload so the new bundle takes over.
    //
    // CRITICAL: skip the FIRST controllerchange — that's the initial
    // install on a fresh visit when no prior controller existed.
    // Reloading there causes the "page loads then reloads itself"
    // antipattern that makes the portfolio feel broken.
    //
    // We only want to reload when a *real* update lands: an existing
    // controller has been replaced by a new one mid-session.
    let wasControlled = !!navigator.serviceWorker.controller
    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!wasControlled) {
        // First-time install — claim() fires controllerchange but the
        // page is already running on the new bundle. No reload needed.
        wasControlled = true
        return
      }
      if (reloaded) return
      reloaded = true
      window.location.reload()
    })
  })
}

function notifyUpdateAvailable(): void {
  bus.emit('custom:sw_update_available' as 'custom:sw_update_available', {})
}

export function isUpdateAvailable(): boolean {
  return updateAvailable
}

/**
 * Tell the waiting worker to skipWaiting → the controllerchange
 * handler in registerServiceWorker() will then reload the page.
 */
export function activatePendingUpdate(): void {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (!reg?.waiting) return
    reg.waiting.postMessage({ type: 'SKIP_WAITING' })
  })
}
