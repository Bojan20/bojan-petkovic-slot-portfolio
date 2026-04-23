/**
 * Portfolio Config — Master JSON configuration
 *
 * Centralni konfig za sve: boot, audio, sekvence, animacije, timing.
 * Umesto JSON fajla koristimo TypeScript objekat za type safety + tree shaking.
 * U produkciji se može lako prebaciti na JSON + Zod validaciju.
 */

import type { PortfolioConfig } from './configTypes'

export const portfolioConfig: PortfolioConfig = {
  version: '1.1.0',

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
      // ─── Splash SFX (retuned to cyberpunk) ──────────────────────────────
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

      // ─── Boot SFX ───────────────────────────────────────────────────────
      'boot:tap': {
        audio: { play: 'sfx_boot_hum', volume: 0.5 },
      },
      'boot:complete': {
        audio: { play: 'sfx_boot_ready', volume: 0.6 },
      },

      // ─── Slot SFX (cyberpunk synths) ────────────────────────────────────
      'slot:spin:start': {
        audio: { play: 'sfx_warp_ignite', volume: 0.55 },
        haptic: 'medium',
      },
      'slot:reel:stop': {
        audio: { play: 'sfx_rail_tick', volume: 0.45 },
        haptic: 'light',
      },
      'slot:reel:land': {
        audio: { play: 'sfx_plasma_impact', volume: 0.6 },
        haptic: 'reel_stop',
      },
      'slot:win': {
        audio: { play: 'sfx_digital_ascension', volume: 0.7 },
        haptic: 'big_win',
      },

      // ─── Transition SFX ─────────────────────────────────────────────────
      'transition:splash_to_slot': {
        audio: { play: 'sfx_chromatic_burst', volume: 0.5 },
        haptic: 'light',
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

    // ─── cyberBoot: warp ignition + rising pad + crystalline arp ───────────
    // Used for boot→splash→slot transition when a full cinematic is desired.
    // Total ≈ 2100ms. Steps rely on sound-only bindings via custom:* if
    // needed, but we reuse existing semantic events so all listeners react.
    cyberBoot: {
      name: 'cyberBoot',
      steps: [
        // 0ms: power-on hum + sub drone
        { event: 'boot:tap', delay: 0, duration: 650 },
        // 650ms: warp drive ignition (whoosh → warp)
        { event: 'splash:title:label', delay: 0, duration: 550 },
        // 1200ms: plasma impact (confirms "online")
        { event: 'splash:title:name', delay: 0, duration: 450 },
        // 1650ms: crystalline arp tail
        { event: 'splash:title:corners', delay: 0, duration: 450 },
      ],
    },

    // ─── hyperspaceSnap: 200ms chromatic burst for landing phase ────────────
    // Short stinger — play right before takeover or on payline reveal.
    hyperspaceSnap: {
      name: 'hyperspaceSnap',
      steps: [
        { event: 'transition:splash_to_slot', delay: 0, duration: 200 },
        { event: 'splash:title:line', delay: 0, duration: 120 },
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
