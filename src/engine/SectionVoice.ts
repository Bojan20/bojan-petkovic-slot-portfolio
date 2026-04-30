/**
 * SectionVoice — audio-first signature on tab change (P4.5).
 *
 * Bojan is an audio designer. The portfolio MUST sound as good as it
 * looks. Step P4.5 of SLOT_ARCHITECTURE_V2 commits to: every top-level
 * section has its own sonic identity. Tab switch = ~700ms signature
 * sting. Eyes-closed test: a recruiter listening over headphones can
 * tell which section they're on without seeing the screen.
 *
 * Five voices, registered as synths inside SoundManager:
 *
 *   projects → warm pad swell        (curtain rises, F minor third)
 *   skills   → bright arpeggio       (precision, C maj7 ascend)
 *   about    → breathy choir         (intimacy, A2+E3 + filtered noise)
 *   career   → brass swell           (authority, D3+A3 saw + formant)
 *   contact  → bell ping             (call-to-action, G5+D6 bell)
 *
 * Subscribes to `slot:section:change` and dispatches to the matching
 * `section_voice_<id>` synth. Falls back silently if the section ID
 * isn't mapped (no warn — sections without a voice just stay quiet).
 *
 * The voices respect the standard sfx gain bus + reduce-motion gate
 * via the audioStore master mute flag, so a recruiter who muted the
 * page never hears them.
 */

import { bus } from './EventBus'
import { playSynthById } from './SoundManager'

const SECTION_VOICE_MAP: Record<string, string> = {
  projects: 'section_voice_projects',
  skills:   'section_voice_skills',
  about:    'section_voice_about',
  career:   'section_voice_career',
  contact:  'section_voice_contact',
}

// Volume per voice — slightly different so the mix sits well together.
// Pads are quieter than transient hits because they sustain longer.
const SECTION_VOICE_VOLUME: Record<string, number> = {
  projects: 0.85,
  skills:   1.0,
  about:    0.75,
  career:   0.9,
  contact:  1.0,
}

let _started = false
let _unsubscribe: (() => void) | null = null
let _suppressFirst = true

/**
 * Wire bus listener. Idempotent — calling twice is a no-op. Call from
 * App.tsx after `boot:complete` so the very first section render
 * (which fires synthetically during mount) doesn't auto-play; the
 * signal only sounds on USER-initiated tab changes.
 */
export function startSectionVoice(): void {
  if (_started) return
  _started = true
  _suppressFirst = true

  _unsubscribe = bus.on('slot:section:change', (p) => {
    // Suppress the first emission — App mount fires section:change
    // synthetically when the slot enters; that's not user intent.
    if (_suppressFirst) {
      _suppressFirst = false
      return
    }
    const id = (p?.name ?? '').toString().toLowerCase()
    const synthId = SECTION_VOICE_MAP[id]
    if (!synthId) return
    const vol = SECTION_VOICE_VOLUME[id] ?? 1.0
    try {
      playSynthById(synthId, vol)
    } catch {
      /* synth registration not available (e.g. tests) — silent */
    }
  })
}

export function stopSectionVoice(): void {
  if (!_started) return
  _started = false
  _suppressFirst = true
  _unsubscribe?.()
  _unsubscribe = null
}

/** Manually fire a section voice. Used by SlotAudioManager auditioning. */
export function previewSectionVoice(sectionId: string, volume = 1.0): void {
  const synthId = SECTION_VOICE_MAP[sectionId.toLowerCase()]
  if (!synthId) return
  playSynthById(synthId, volume * (SECTION_VOICE_VOLUME[sectionId.toLowerCase()] ?? 1.0))
}

/** List section IDs that have a registered voice. Useful for debug UI. */
export function listSectionVoiceIds(): string[] {
  return Object.keys(SECTION_VOICE_MAP)
}
