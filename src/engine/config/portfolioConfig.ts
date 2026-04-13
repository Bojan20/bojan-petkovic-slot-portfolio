/**
 * Portfolio Config — Master JSON configuration
 *
 * Centralni konfig za sve: boot, audio, sekvence, animacije, timing.
 * Umesto JSON fajla koristimo TypeScript objekat za type safety + tree shaking.
 * U produkciji se može lako prebaciti na JSON + Zod validaciju.
 */

import type { PortfolioConfig } from './configTypes'

export const portfolioConfig: PortfolioConfig = {
  version: '1.0.0',

  // ─── Boot Screen Config ──────────────────────────────────────────────────
  boot: {
    progressDuration: 2400,
    minDisplayTime: 2000,
    loadingSteps: [
      'Initializing audio engine...',
      'Loading visual assets...',
      'Preparing slot reels...',
      'Calibrating sound design...',
      'Building portfolio grid...',
      'System ready',
    ],
  },

  // ─── Audio Config ────────────────────────────────────────────────────────
  audio: {
    volumes: {
      master: 0.8,
      music: 0.7,
      sfx: 0.6,
    },
    events: {
      // Splash SFX — auto-triggered after boot
      'splash:title:corners': {
        audio: { play: 'sfx_shimmer', volume: 0.4 },
        haptic: 'light',
      },
      'splash:title:label': {
        audio: { play: 'sfx_whoosh', volume: 0.5 },
        haptic: 'light',
      },
      'splash:title:name': {
        audio: { play: 'sfx_boom', volume: 0.7 },
        haptic: 'medium',
      },
      'splash:title:line': {
        audio: { play: 'sfx_sweep', volume: 0.5 },
        haptic: 'light',
      },
      'splash:title:button': {
        audio: { play: 'sfx_ding', volume: 0.5 },
        haptic: 'button',
      },

      // Boot SFX
      'boot:tap': {
        audio: { play: 'sfx_boot_hum', volume: 0.5 },
      },
      'boot:complete': {
        audio: { play: 'sfx_boot_ready', volume: 0.6 },
      },
    },
  },

  // ─── Sequences ───────────────────────────────────────────────────────────
  sequences: {
    splash_attract: {
      name: 'splash_attract',
      steps: [
        { event: 'splash:title:corners', delay: 200, duration: 800 },
        { event: 'splash:title:label', delay: 400, duration: 700 },
        { event: 'splash:title:name', delay: 300, duration: 1000 },
        { event: 'splash:title:line', delay: 400, duration: 600 },
        { event: 'splash:title:button', delay: 100, duration: 500 },
      ],
    },
  },

  // ─── Animation Presets ───────────────────────────────────────────────────
  animations: {
    shimmer: { preset: 'shimmer', duration: 0.8, ease: 'power2.out' },
    slideIn: { preset: 'slideIn', duration: 0.7, ease: 'power3.out' },
    reveal: { preset: 'reveal', duration: 1.0, ease: 'expo.out' },
    drawLine: { preset: 'drawLine', duration: 0.6, ease: 'power2.inOut' },
    fadeUp: { preset: 'fadeUp', duration: 0.5, ease: 'power2.out' },
    landPulse: { preset: 'landPulse', duration: 0.18 },
  },

  // ─── Timing ──────────────────────────────────────────────────────────────
  timing: {
    splashStageDelays: [200, 400, 300, 400, 100],
    reelLandDelays: [560, 720, 860, 1000, 1140],
    bootProgressDuration: 2400,
  },
}
