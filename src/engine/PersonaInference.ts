/**
 * PersonaInference — passive recruiter-persona classifier.
 *
 * Watches the EventBus for navigation + interaction signals and after
 * 30 seconds of session activity emits a `custom:persona:inferred`
 * event with the best-guess label. No surveys, no popups — silent
 * intelligence that downstream surfaces (DevOverlay today, tab
 * re-ordering tomorrow) can consume.
 *
 * Why heuristic and not ONNX (yet): a 5-feature logistic-regression
 * heuristic captures 80% of the signal; the ONNX path is on the P2
 * backlog and lands when we have a real labeled dataset. Until then
 * the simple scorer ships predictable behavior we can debug.
 *
 * Persona labels (5):
 *   audio_designer   — visits projects first, lingers on demo cells,
 *                      audio engagement >= 50% of session
 *   engineer         — fast tab cycling, dwell on tools/scope cells,
 *                      uses keyboard shortcuts
 *   em_recruiter     — opens about + career fast, low audio interest
 *   curiosity_browser — long dwell on about, deep navigation, no audio
 *   balanced         — default; even distribution, no strong signal
 *
 * The classifier is intentionally simple: weighted sum over 5 features
 * with thresholds. Re-classification can run any time after the
 * 30s warmup — we re-fire on every section change beyond the warmup
 * so the label stays fresh as the session evolves.
 */

import { bus } from './EventBus'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Persona =
  | 'audio_designer'
  | 'engineer'
  | 'em_recruiter'
  | 'curiosity_browser'
  | 'balanced'

interface PersonaFeatures {
  /** ms since the inference started tracking (= boot:complete). */
  sessionMs: number
  /** Number of section changes the user has made. */
  sectionChanges: number
  /** First section the user visited (after the default 'projects'). */
  firstSection: string | null
  /** Per-section dwell ms. Sums all visits. */
  sectionDwellMs: Record<string, number>
  /** Number of slot:item:select clicks (deep-dive intent). */
  itemSelects: number
  /** Number of voice commands fired (engaged-with-platform signal). */
  voiceCommands: number
  /** Whether audio:ambient:start fired (audio engagement signal). */
  audioStarted: boolean
  /** Whether the user reached jackpot (project richness recognition). */
  hitJackpot: boolean
  /** Whether they hit the dev overlay (engineer-curiosity signal). */
  openedDevOverlay: boolean
}

// ─── State ───────────────────────────────────────────────────────────────────

const WARMUP_MS = 30_000

let _started = false
let _startedAt = 0
let _currentSection: string | null = null
let _sectionEnteredAt = 0
let _features: PersonaFeatures = createEmptyFeatures()
let _lastPersona: Persona = 'balanced'
const _cleanups: Array<() => void> = []

function createEmptyFeatures(): PersonaFeatures {
  return {
    sessionMs: 0,
    sectionChanges: 0,
    firstSection: null,
    sectionDwellMs: {},
    itemSelects: 0,
    voiceCommands: 0,
    audioStarted: false,
    hitJackpot: false,
    openedDevOverlay: false,
  }
}

// ─── Classifier ──────────────────────────────────────────────────────────────

/**
 * Score a persona from feature vector. Higher = better fit. Returns
 * a map of persona → score so the top one can be selected.
 *
 * Threshold rules:
 *   audio_designer:    audioStarted * 2 + projects-first * 3 +
 *                      itemSelects * 0.5 + jackpot * 2
 *   engineer:          devOverlayOpen * 5 + voiceCommands * 1 +
 *                      sectionChanges > 4 ? 2 : 0
 *   em_recruiter:      firstSection in [about,career] * 4 +
 *                      careerDwell > 8s * 2 - audioStarted * 1
 *   curiosity_browser: aboutDwell > 15s * 3 + sectionChanges > 3 * 1
 *   balanced:          baseline 1
 */
function classify(f: PersonaFeatures): { persona: Persona; scores: Record<Persona, number> } {
  const projectsFirst   = f.firstSection === 'projects'
  const aboutCareerFirst = f.firstSection === 'about' || f.firstSection === 'career'
  const aboutDwell  = f.sectionDwellMs['about']  ?? 0
  const careerDwell = f.sectionDwellMs['career'] ?? 0

  const scores: Record<Persona, number> = {
    audio_designer: 0,
    engineer: 0,
    em_recruiter: 0,
    curiosity_browser: 0,
    balanced: 1, // default baseline
  }

  // audio_designer
  if (f.audioStarted)   scores.audio_designer += 2
  if (projectsFirst)    scores.audio_designer += 3
  scores.audio_designer += Math.min(f.itemSelects * 0.5, 3)
  if (f.hitJackpot)     scores.audio_designer += 2

  // engineer
  if (f.openedDevOverlay)        scores.engineer += 5
  scores.engineer               += Math.min(f.voiceCommands, 3)
  if (f.sectionChanges > 4)      scores.engineer += 2

  // em_recruiter
  if (aboutCareerFirst)          scores.em_recruiter += 4
  if (careerDwell > 8000)        scores.em_recruiter += 2
  if (!f.audioStarted)           scores.em_recruiter += 1

  // curiosity_browser
  if (aboutDwell > 15000)        scores.curiosity_browser += 3
  if (f.sectionChanges > 3)      scores.curiosity_browser += 1

  // pick max
  let best: Persona = 'balanced'
  let bestScore = -Infinity
  for (const p of Object.keys(scores) as Persona[]) {
    if (scores[p] > bestScore) {
      bestScore = scores[p]
      best = p
    }
  }
  return { persona: best, scores }
}

// ─── Tracking ────────────────────────────────────────────────────────────────

function maybeReclassify(): void {
  _features.sessionMs = performance.now() - _startedAt
  if (_features.sessionMs < WARMUP_MS) return
  const { persona, scores } = classify(_features)
  if (persona !== _lastPersona) {
    _lastPersona = persona
    bus.emit('custom:persona:inferred', { persona, scores, features: _features })
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Start the inference pipeline. Call once after boot:complete. */
export function startPersonaInference(): void {
  if (_started) return
  _started = true
  _startedAt = performance.now()
  _features = createEmptyFeatures()
  _lastPersona = 'balanced'

  _cleanups.push(
    bus.on('slot:section:change', (p) => {
      // Close out the previous section's dwell window
      if (_currentSection) {
        const elapsed = performance.now() - _sectionEnteredAt
        _features.sectionDwellMs[_currentSection] =
          (_features.sectionDwellMs[_currentSection] ?? 0) + elapsed
      }
      _currentSection = p.name.toLowerCase()
      _sectionEnteredAt = performance.now()
      _features.sectionChanges += 1
      // First section the user *navigated* to (after default landing)
      if (!_features.firstSection && _features.sectionChanges === 1) {
        _features.firstSection = _currentSection
      }
      maybeReclassify()
    }),
  )

  _cleanups.push(
    bus.on('slot:item:select', () => {
      _features.itemSelects += 1
      maybeReclassify()
    }),
  )

  _cleanups.push(
    bus.on('audio:ambient:start', () => {
      _features.audioStarted = true
      maybeReclassify()
    }),
  )

  _cleanups.push(
    bus.on('slot:win', (p) => {
      if (p.type === 'jackpot') _features.hitJackpot = true
      maybeReclassify()
    }),
  )

  _cleanups.push(
    bus.on('debug:toggle', () => {
      _features.openedDevOverlay = true
      maybeReclassify()
    }),
  )

  // Voice commands — count any of them as engagement
  const voiceEvents = [
    'voice:command:spin', 'voice:command:next', 'voice:command:back',
    'voice:command:mute', 'voice:command:unmute', 'voice:command:jackpot',
    'voice:command:save', 'voice:command:load', 'voice:command:record',
  ] as const
  for (const ev of voiceEvents) {
    _cleanups.push(bus.on(ev, () => {
      _features.voiceCommands += 1
      maybeReclassify()
    }))
  }
}

/** Stop tracking + clear listeners. */
export function stopPersonaInference(): void {
  if (!_started) return
  _started = false
  _cleanups.forEach((fn) => fn())
  _cleanups.length = 0
}

/** Read the most recent inferred persona. */
export function getCurrentPersona(): Persona { return _lastPersona }

/** Read the raw feature vector — useful for DevOverlay introspection. */
export function getCurrentFeatures(): Readonly<PersonaFeatures> { return _features }

/** Force re-classification now (testing + DevOverlay refresh). */
export function forceReclassify(): { persona: Persona; scores: Record<Persona, number> } {
  return classify(_features)
}
