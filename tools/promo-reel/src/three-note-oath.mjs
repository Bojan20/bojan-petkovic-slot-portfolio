/**
 * THREE-NOTE OATH — Bojan Petković signature audio logo
 *
 *   G2 (98.0 Hz)  — sub-bass thump, FM-modulated, exponential decay
 *   C3 (130.8 Hz) — mid-body chord pad, FM-modulated
 *   E3 (164.8 Hz) — bright top, slight detune for shimmer
 *   + coin-shimmer tail (white noise → bandpass 4kHz, exp decay)
 *
 *  Total length: 390 ms, 48 kHz, 16-bit stereo PCM WAV.
 *
 * Why hand-rolled WAV synth (not Tone.js): this script must run in
 * pure Node with zero external runtime deps (Tone.js needs Web Audio).
 * 200 lines of math gives us a deterministic, byte-stable signature
 * that we can ship to the brand library and never re-render.
 *
 * The signature is also the audio bed for the cold-open of the promo
 * reel — `cold-open` segment ducks gameplay audio and plays this.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const SAMPLE_RATE = 48000;
const TOTAL_MS = 390;
const TOTAL_SAMPLES = Math.round((TOTAL_MS / 1000) * SAMPLE_RATE);

// Note frequencies (Hz)
const NOTES = {
  G2: 98.00,
  C3: 130.81,
  E3: 164.81,
  G3: 196.00, // shimmer harmonic
};

const TAU = Math.PI * 2;

/** Linear ramp envelope. */
function envLinear(tNorm, attack, release) {
  if (tNorm < attack) return tNorm / attack;
  if (tNorm > 1 - release) return Math.max(0, (1 - tNorm) / release);
  return 1;
}

/** Exponential decay envelope (k = decay constant in 1/sec). */
function envExp(t, k) { return Math.exp(-k * t); }

/** Smoothstep crossfade. */
function smooth(t) { return t * t * (3 - 2 * t); }

/** Soft saturation (tanh) for warmth. */
function sat(x, drive = 1) { return Math.tanh(x * drive) / Math.tanh(drive); }

/**
 * FM voice — single sine carrier modulated by sine modulator.
 *
 * @param {number} t      — time in seconds (within voice's local clock)
 * @param {number} fc     — carrier frequency (Hz)
 * @param {number} fmRatio — modulator-to-carrier ratio
 * @param {number} index  — modulation index (depth)
 */
function fmVoice(t, fc, fmRatio, index) {
  const fm = fc * fmRatio;
  const mod = Math.sin(TAU * fm * t);
  return Math.sin(TAU * fc * t + index * mod);
}

/** Simple LCG for deterministic noise (avoids host-RNG churn). */
function makeRng(seed = 0xC0FFEE) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 0xFFFFFFFF) * 2 - 1;
  };
}

/** Bandpass-ish filter on noise via simple state-variable approximation.  */
function bandpass(prevState, x, fc, q) {
  // One-pole high-pass + one-pole low-pass cascade approximating bandpass.
  const dt = 1 / SAMPLE_RATE;
  const rcL = 1 / (TAU * fc * (1 + 1 / q));
  const rcH = 1 / (TAU * fc / (1 + 1 / q));
  const aL = dt / (rcL + dt);
  const aH = rcH / (rcH + dt);
  const lp = prevState.lp + aL * (x - prevState.lp);
  const hp = aH * (prevState.hp + lp - prevState.lpPrev);
  prevState.lp = lp; prevState.lpPrev = lp; prevState.hp = hp;
  return hp;
}

/**
 * Render the full oath into a Float32 stereo buffer.
 * Returns { left: Float32Array, right: Float32Array }.
 */
export function renderOath() {
  const left  = new Float32Array(TOTAL_SAMPLES);
  const right = new Float32Array(TOTAL_SAMPLES);

  // Voice schedule: each note is a separate voice with its own envelope.
  // Onsets in ms. Note 1 starts at 0; classic ascending arpeggio.
  const voices = [
    { freq: NOTES.G2, onsetMs:   0, lenMs: 240, gain: 0.90, fmRatio: 0.5,  index: 2.4, decayK: 6,  pan: 0.0 },
    { freq: NOTES.C3, onsetMs:  90, lenMs: 240, gain: 0.78, fmRatio: 1.0,  index: 1.6, decayK: 6,  pan: -0.20 },
    { freq: NOTES.E3, onsetMs: 180, lenMs: 220, gain: 0.74, fmRatio: 2.0,  index: 1.2, decayK: 7,  pan: 0.20 },
    { freq: NOTES.E3 * 1.005, onsetMs: 184, lenMs: 220, gain: 0.42, fmRatio: 2.0, index: 1.4, decayK: 7, pan: -0.10 }, // detune shimmer
    { freq: NOTES.G3, onsetMs: 220, lenMs: 160, gain: 0.30, fmRatio: 4.0,  index: 0.8, decayK: 9,  pan: 0.10 },
  ];

  for (const v of voices) {
    const onset = Math.round((v.onsetMs / 1000) * SAMPLE_RATE);
    const len   = Math.round((v.lenMs   / 1000) * SAMPLE_RATE);
    for (let n = 0; n < len; n++) {
      const i = onset + n;
      if (i >= TOTAL_SAMPLES) break;
      const t = n / SAMPLE_RATE;
      const tNorm = n / len;
      const env = envLinear(tNorm, 0.012, 0.65) * envExp(t, v.decayK);
      let s = fmVoice(t, v.freq, v.fmRatio, v.index) * env * v.gain;
      // Sub bass gets a touch of saturation.
      if (v.freq < 110) s = sat(s, 1.5);
      // Pan: equal-power.
      const lp = Math.cos((v.pan + 1) * Math.PI / 4);
      const rp = Math.sin((v.pan + 1) * Math.PI / 4);
      left[i]  += s * lp;
      right[i] += s * rp;
    }
  }

  // ── COIN SHIMMER TAIL ────────────────────────────────────────────────
  // Bandpassed white noise around 4 kHz, fast attack, exp decay.
  const shimmerStart = Math.round((180 / 1000) * SAMPLE_RATE);
  const shimmerLen   = TOTAL_SAMPLES - shimmerStart;
  const rng = makeRng(0xC0FFEED);
  const stateL = { lp: 0, lpPrev: 0, hp: 0 };
  const stateR = { lp: 0, lpPrev: 0, hp: 0 };
  for (let n = 0; n < shimmerLen; n++) {
    const i = shimmerStart + n;
    const t = n / SAMPLE_RATE;
    const env = envLinear(n / shimmerLen, 0.05, 0.55) * envExp(t, 9);
    const noiseL = rng();
    const noiseR = rng();
    // Drift the bandpass center a bit for sparkle motion.
    const fc = 4200 + Math.sin(TAU * 7 * t) * 700;
    const sL = bandpass(stateL, noiseL, fc, 4) * env * 0.34;
    const sR = bandpass(stateR, noiseR, fc, 4) * env * 0.34;
    left[i]  += sL;
    right[i] += sR;
  }

  // ── MASTER CHAIN ─────────────────────────────────────────────────────
  // Soft master limiter: tanh + makeup so peak ≤ ~0.95.
  let peak = 0;
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const drive = peak > 0.85 ? 1.4 : 1.1;
  const makeup = 0.92 / Math.tanh(drive);
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    left[i]  = sat(left[i],  drive) * makeup;
    right[i] = sat(right[i], drive) * makeup;
  }
  // Final fade-out (last 30ms) to avoid click.
  const fadeSamples = Math.round((30 / 1000) * SAMPLE_RATE);
  for (let n = 0; n < fadeSamples; n++) {
    const i = TOTAL_SAMPLES - fadeSamples + n;
    const f = 1 - n / fadeSamples;
    left[i]  *= f;
    right[i] *= f;
  }

  return { left, right };
}

// ─────────────────────────────────────────────────────────────────────
// WAV ENCODING — 16-bit PCM stereo
// ─────────────────────────────────────────────────────────────────────

function encodeWav({ left, right }) {
  const numFrames = left.length;
  const numChannels = 2;
  const bytesPerSample = 2;
  const dataSize = numFrames * numChannels * bytesPerSample;
  const headerSize = 44;
  const buf = Buffer.alloc(headerSize + dataSize);
  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  // fmt chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);                  // PCM chunk size
  buf.writeUInt16LE(1, 20);                   // PCM format
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * numChannels * bytesPerSample, 28); // byte rate
  buf.writeUInt16LE(numChannels * bytesPerSample, 32);               // block align
  buf.writeUInt16LE(8 * bytesPerSample, 34);                         // bits/sample
  // data chunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  // PCM samples (interleaved L/R, 16-bit signed)
  let p = headerSize;
  for (let i = 0; i < numFrames; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    buf.writeInt16LE(Math.round(l * 32767), p); p += 2;
    buf.writeInt16LE(Math.round(r * 32767), p); p += 2;
  }
  return buf;
}

export function writeOathWav(outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  const { left, right } = renderOath();
  writeFileSync(outPath, encodeWav({ left, right }));
  return outPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outPath = resolve(ROOT, 'assets', 'audio', 'three-note-oath.wav');
  writeOathWav(outPath);
  console.log(`✓ ${outPath} (${TOTAL_MS}ms, ${SAMPLE_RATE}Hz, stereo)`);
}
