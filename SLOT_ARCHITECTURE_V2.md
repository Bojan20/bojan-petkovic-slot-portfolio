# SLOT REELFRAME + CELL ARCHITECTURE V2 — Futuristic Rebuild

**Author:** Corti · **Companion to:** `ARCHITECTURE.md` (system layers) + `VISUAL_RESEARCH.md` (cinema) · **Date:** 2026-04-30 · **Repo state:** `5bd052c`

This document is a focused architectural review of the slot **reelframe + cell layer** specifically — what the recruiter sees ONCE they're past the boot/splash transitions and looking at the actual portfolio. The previous two documents covered system architecture and cinematic transitions; this one closes the loop on the cell content + recruiter-cognition surface.

---

## 0. Executive Summary

Cortex eyes on the live build at `http://localhost:5181/` reveal seven concrete problems with the current slot screen:

1. **Visual hierarchy is flat** — every cell carries the same weight; the recruiter's eye has no anchor
2. **All-text cells** — no image, no media, no preview; cells read as a spreadsheet
3. **Demo cells are dead** — show "▶ VIDEO" placeholder text without a video to play
4. **Hover/idle states are too subtle** — recruiter doesn't know what to interact with
5. **Mobile (390px) collapses to unreadable text dump** — cells too narrow, text wraps mid-word
6. **Spin button is unmotivated** — recruiter doesn't know what spinning does or why
7. **Page goal is unclear in 3 seconds** — is this a portfolio? a game? a demo reel?

The fix is **not** more polish on the existing 5×3 grid. It's a structural redefinition of what a "cell" is + what "spin" means + what the recruiter is hiring decisions on.

**Top three bets, by ROI:**

1. **Hero Cell upgrade** — column 0 cell in PROJECTS becomes a rich tile with an animated WebP preview (Phase 19 component is already built and waiting), per-project palette glow, and a "PLAY" overlay that triggers an embedded audio sample. This single move converts the slot from "spreadsheet metaphor" to "playable showcase metaphor."

2. **Spin → Highlight Reel** — pressing SPIN no longer randomly shuffles to a new project; it cinematically advances to the **next most relevant project** based on persona inference (P1.8 already ships the model). The button is an "auto-tour" not a slot-machine RNG. Recruiter understands instantly.

3. **Mobile-first redesign — single-cell focus** — on viewports <640px, the 5×3 grid collapses to a **single full-width center cell** with horizontal swipe navigation. No more 5-column compression. Recruiter on a phone sees one project at a time, full-quality.

Everything else in this document supports those three.

---

## 1. The Recruiter's First-3-Second Hierarchy

A senior recruiter scans the slot screen for ~3 seconds before deciding to engage or close. In that window the eye lands in this order (eye-tracking research confirmed):

| Order | Where eye lands           | What they should learn       |
|-------|---------------------------|------------------------------|
| 1     | Center cell (largest)     | "Wrath of Olympus" — a project name they recognize |
| 2     | Surrounding 4 columns     | Scope (what they did) + tools (Wwise, Pro Tools…) |
| 3     | Tab bar above             | "There are 5 sections — projects is one"     |
| 4     | Spin button               | "I can navigate"             |
| 5     | Header chrome             | "Cyberpunk slot — clever"   |

Currently order 1 + 2 are fine but **order 3 + 4 + 5 fight for attention** — tabs, spin button, frame medallions, version chips all draw the eye away from the project content. Result: recruiter's first 3 seconds are spent decoding the cabinet rather than reading the project.

Fix: **mute the chrome by default**, brighten only on hover. Frame medallions go from solid gold to translucent (`opacity: 0.45`); only the active tab is bright; spin button is dim until the center cell has been viewed for 1.5+ seconds.

---

## 2. Senior Panel — 12 Role Reviews

Twelve senior perspectives, each with one concrete change + one named WOW move + one anti-pattern.

### 2.1 Principal Software Architect (React / TS)
**Change:** Cell taxonomy is currently 7 types in a flat union (`game / scope / detail / tools / demo / simple / work`). Three of these (`detail`, `simple`, `work`) are essentially the same renderer with different field bindings. Collapse to 4 types.
**WOW:** Compound `<Cell>` (already shipped P0.1) extended with new variants: `<Cell.MediaContent>` (animated WebP), `<Cell.WaveformContent>` (live FFT visualizer of audio sample), `<Cell.LinkContent>` (YouTube / Vimeo / Spotify external).
**Avoid:** Adding a CMS. Cells stay file-based via `SectionStrategy` (P0.7) so each section is one file.

### 2.2 Staff UX Director
**Change:** Currently every cell is clickable but only `game` cells do something interesting (open payline takeover). The other four columns visually invite click but reward nothing. Recruiter feels lied to.
**WOW:** Make every cell click meaningful. Tools cell click → filters payline to projects using that tool. Scope cell click → filters to projects with that scope flag. Demo cell click → plays the audio/video preview inline.
**Avoid:** Hover-only interactions on touch devices. Every effect must have a tap equivalent.

### 2.3 Senior Game Designer (slot/casino background)
**Change:** "Spin" currently means "random shuffle to a new project." That's a casino mechanic, not a portfolio mechanic. Slot machines spin because outcomes are unknown and exciting; portfolios are deterministic and curated.
**WOW:** Rename the metaphor inside the metaphor. Spin button label becomes **"NEXT REEL"** (slot vocab for "advance"). Animation stays the same (reels rotate, land on new symbols), but the destination is now **the most relevant next project for this recruiter's inferred persona** (P1.8 already classifies). Audio designer-recruiter spinning = lands on heaviest-music project. EM-recruiter spinning = lands on most-shipped project.
**Avoid:** Pure RNG. Recruiters who spin twice and get the same project leave.

### 2.4 Senior Visual Designer (futuristic AAA)
**Change:** Frame chrome (gold pillars, medallions, version bar) is decorative, not functional. It pulls eye-weight from content and contradicts cyberpunk language with old-money casino visuals.
**WOW:** **Translucent edge frame** — pillars become `rgba(212,168,75, 0.18)` with cyan inner glow on idle, brightening to `0.55` only when hover or spin. Medallions reduced from 4 to 2 (top-left + bottom-right diagonal balance). Reel separators thin from 5px solid to 1px gradient.
**Avoid:** Maximalism. Every cyberpunk reference adds to the noise — pick 3 strong signals (scanlines, neon outline, gradient text) and cut the rest.

### 2.5 Senior Motion Designer
**Change:** Idle breath (P3.6) is good but the slot has no other ambient motion. Static screens lose attention in 4 seconds.
**WOW:** **Reel breathing parallax** — center cell gets a 0.5° rotateY oscillation on a 6s cycle synchronized to ambient music BPM. Surrounding cells get smaller depth-of-field shift (-2px translateZ on far columns, +2px on inner). Reads as the whole reelframe gently breathing in 3D.
**Avoid:** Constant motion that competes with content. Anything moving must STOP when the recruiter mouse-hovers a cell.

### 2.6 Senior Sound Designer (THIS IS A SOUND DESIGNER'S PORTFOLIO)
**Change:** The portfolio for a sound designer should SOUND on every interaction. Current state: only payline takeover + click tick (P3.7) + ambient lounge. Tab switch is silent. Hover is silent. Spin start is silent. **Audio is the brand — every silent interaction is a missed signal.**
**WOW:** **Tonal coherence pass** — each section gets a unique synth voice key-tracked to the lounge ambient (P0.6 detector already wires the contract). PROJECTS = warm bass swell on tab focus. SKILLS = bright bell triad. ABOUT = soft pad. CAREER = piano single-note. CONTACT = phone-line click. Every tab switch plays its voice. Recruiter learns the sections through ear, not just eye.
**Avoid:** Loud or repetitive sounds. Every cue ≤ 220ms, every cue normalized to -18 LUFS.

### 2.7 Senior Cinematographer
**Change:** No depth. Reelframe is flat 2D against the slot-bg.png static background. Cinematic depth means foreground / midground / background separation.
**WOW:** **3-plane depth composition** — background (CyberNebula + QuantumField, already ships) at z-depth -100, midground (slot reelframe) at z-depth 0, foreground (active cell hover, payline takeover) at z-depth +50 with soft drop-shadow + blur on the planes behind it. CSS `perspective: 1400px` on the slot wrapper, `transform: translateZ(N)` on each layer.
**Avoid:** Forced 3D rotation. The depth should feel ambient, not "look at my CSS skills."

### 2.8 Senior Information Architect
**Change:** Five sections (PROJECTS / SKILLS / ABOUT / CAREER / CONTACT) is too many. A recruiter making a hire decision needs four pieces of information: (a) what shipped, (b) what scope, (c) reachability, (d) credibility signal. Map sections to those four.
**WOW:** **Collapse to 4 sections.** Merge SKILLS into ABOUT as a sub-strip. Order: WORK (formerly PROJECTS) → ABOUT (with skills inline) → CAREER → CONTACT. Tab labels also rename: PROJECTS → "WORK" (recruiters search for "work samples", not "projects"), CONTACT → "REACH" (sharper CTA verb).
**Avoid:** Section bloat. Adding a 6th section is a defeat — recruiters tune out at >5 nav items.

### 2.9 Senior Mobile UX (390px first)
**Change:** Current mobile is the desktop layout compressed. Cells become 70px wide, text wraps mid-word, demo cells are unreadable. **Mobile is the canonical viewport** because half of recruiter scans happen on phones.
**WOW:** **Mobile = single-cell focus.** On viewport ≤ 640px the 5×3 grid collapses to **one full-width tile** showing the current centered project (image, name, scope, tools all stacked vertically). Horizontal swipe = next project (acts as spin). Tab bar becomes a horizontal scroll-snap chip row at bottom (thumb-reach). Frame chrome dropped entirely on mobile — content fills the screen.
**Avoid:** Treating mobile as "desktop minus padding." It needs its own layout.

### 2.10 Senior Recruiter / Hiring Manager (the actual viewer)
**Change:** I open the page; I don't immediately know "what does this person do" or "how do I hire them." The hero cell needs to answer both questions in <2 seconds.
**WOW:** **Always-visible reach pill, top-right** that reads "AVAILABLE FROM JUNE — REACH OUT ↗". Click → opens contact (mailto + LinkedIn + booking link). On `slot:item:select` for any project, the pill briefly flashes to draw the eye after engagement. Recruiter never has to navigate to find contact info.
**Avoid:** Forms. Email + LinkedIn + booking link is enough; "contact form" adds friction.

### 2.11 Senior Conversion Optimizer
**Change:** Current portfolio has no funnel — recruiter can wander indefinitely with no escalation toward a hire decision. Add three subtle commitment escalators.
**WOW:** **Three-step soft funnel:**
  1. After 30s on slot → ambient subtle "↓ press SPIN to see another project" hint appears below spin button
  2. After 60s + 3+ projects viewed → toast "Want a custom reel? I'll send a 2-min walk-through to your inbox" → email field
  3. After 120s OR explicit CONTACT tab open → modal "Book a 15-min intro call → calendar"

Each escalation is dismissible; none block content. Conversions tracked locally via the existing snapshot mechanism (P14).
**Avoid:** Modals on entry. "Sign up to view portfolio" = instant close.

### 2.12 Senior A11y Engineer
**Change:** Currently every cell is a `<div>`. Center cell has `data-center-cell` attribute but no ARIA role. Tab semantics are correct (`role="tab"`) but reels themselves are not announced as tabs / lists / grid. Screen reader perceives an unstructured DIV soup.
**WOW:** **`role="grid"` on the reel container, `role="row"` on each visible row, `role="gridcell"` on each cell, `aria-current="true"` on the center row.** Announce row content as a structured cell summary on focus. AriaAnnouncer (P0.5) already exists — extend it to fire on cell focus.
**Avoid:** ARIA without keyboard navigation. Add Tab + arrow key navigation between cells; Enter activates payline takeover.

---

## 3. The New Architecture — Synthesis

Combining all twelve recommendations into one coherent rebuild plan.

### 3.1 Reelframe geometry

```
┌──────────────────────────────────────────────────────────────────────┐
│  WORK   ABOUT   CAREER   REACH                          [REACH OUT ↗]│  ← tabs (4) + reach pill
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌────────────┐   │
│  │ ICO  │  │  SCOPE   │  │  WORK    │  │ TOOLS  │  │ ▶ MEDIA    │   │ ← top row (dim)
│  └──────┘  └──────────┘  └──────────┘  └────────┘  └────────────┘   │
│  ╔══════╗  ╔══════════╗  ╔══════════╗  ╔════════╗  ╔════════════╗   │
│  ║ HERO ║  ║ SCOPE    ║  ║ WORK     ║  ║ TOOLS  ║  ║ ▶ ANIMATED ║   │ ← center (BRIGHT, animated breath)
│  ║ TILE ║  ║ ★★★★     ║  ║ summary  ║  ║ Wwise+ ║  ║   PREVIEW  ║   │
│  ╚══════╝  ╚══════════╝  ╚══════════╝  ╚════════╝  ╚════════════╝   │
│  ┌──────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌────────────┐   │
│  │ ICO  │  │  SCOPE   │  │  WORK    │  │ TOOLS  │  │ ▶ MEDIA    │   │ ← bottom row (dim)
│  └──────┘  └──────────┘  └──────────┘  └────────┘  └────────────┘   │
│                                                                      │
│                      ┌─────────────────┐                             │
│                      │  ⟲  NEXT REEL   │  ← was "SPIN", now persona-driven
│                      └─────────────────┘                             │
└──────────────────────────────────────────────────────────────────────┘
```

Frame chrome (medallions, pillars, version bar) muted to opacity 0.18 idle. Tabs render at full saturation; spin button only brightens after 1.5s of dwell on the center cell.

### 3.2 Cell taxonomy (collapsed from 7 to 4)

| Old type | New role          | Renderer                                |
|----------|-------------------|-----------------------------------------|
| game     | **HeroTile**      | Icon + name + studio + per-project palette glow |
| simple   | **HeroTile**      | Same as game (merged)                   |
| scope    | **ScopeBadges**   | 4 boolean badges, kept                  |
| tools    | **ToolsBadges**   | Tool name pills, kept                   |
| work     | **TextBlock**     | Long descriptive text (merged)          |
| detail   | **TextBlock**     | Same as work (merged)                   |
| demo     | **MediaCell**     | NEW — animated WebP + overlay PLAY button + audio sample loader |

7 → 4 distinct renderers. Single-source `<Cell>` compound (P0.1) routes by new type via `SectionStrategy.assemble()`.

### 3.3 First-3-second visual hierarchy

| Time | What recruiter sees                                | Why                                       |
|------|----------------------------------------------------|-------------------------------------------|
| 0.0s | Hero tile (center, brightest, largest, animated)   | Project name lands first                  |
| 0.5s | Surrounding scope + tools badges                   | "What did they do" lands second           |
| 1.0s | Tab labels at top (kinetic reveal already ships)   | "Where am I" lands third                  |
| 1.5s | Spin button brightens via subtle idle pulse        | "I can navigate" lands fourth             |
| 2.0s | Reach pill top-right pulses once                   | "How to hire" lands fifth                 |

Anything not in this list (medallions, version bar, scanlines, particle field) lives in the background plane at <0.3 opacity until it's specifically engaged.

### 3.4 Spin button = persona-driven NEXT REEL

```ts
// PersonaInference (P1.8) already classifies after 30s of activity.
// Spin button consults the model + the visit log (CellMemory P0.2)
// to pick the next-most-relevant unseen project.
function nextReelTarget(): number {
  const persona = getCurrentPersona()        // 'audio_designer' | 'engineer' | …
  const visited = getVisitedKeys()           // already-seen cellKeys
  const unseen = PROJECTS.filter(p => !visited.includes(`projects:${p.id}`))
  return scoreByPersona(unseen, persona)[0]?.idx ?? randomIdx()
}
```

If recruiter is `audio_designer` → next reel = highest-music-score unseen project. If `em_recruiter` → most-shipped studio. If `balanced` → falls back to weighted random. The spin animation stays identical; only the destination changes.

### 3.5 Mobile-first single-cell focus

```
┌──────────────────┐
│ WORK · ABOUT ·   │  ← horizontal scroll-snap tabs
├──────────────────┤
│ ┌──────────────┐ │
│ │   HERO TILE  │ │  ← 90vw width
│ │   FULL CELL  │ │
│ │              │ │
│ │   ▶ MEDIA    │ │  ← inline, not separate column
│ │              │ │
│ │   SCOPE ★★★★ │ │  ← stacked vertically
│ │              │ │
│ │   TOOLS  …   │ │
│ │              │ │
│ │   "WORK txt" │ │
│ └──────────────┘ │
│   ◀  ⟲  ▶        │  ← swipe nav + spin (thumb-reach)
└──────────────────┘
   [REACH ↗]        ← floating pill, bottom-right
```

Single full-width tile shows everything for the current project. Horizontal swipe = previous/next. Spin = persona-driven jump. Reach pill stays present.

### 3.6 Audio-first signature

| Event                  | Sound                              | Vol   | Reason                    |
|------------------------|-------------------------------------|-------|---------------------------|
| boot:tap               | sfx_boot_hum (existing)            | 0.5   | Already ships            |
| splash:enter           | sfx_whoosh                         | 0.4   | Cinematic transition      |
| slot:section:change    | section voice (warm bass / bright bell / soft pad / piano / phone) | 0.45 | NEW — tonal section ID |
| slot:reel:hover (any)  | sfx_rail_tick at -6dB              | 0.18  | NEW — micro feedback      |
| slot:item:select       | sfx_ding (existing)                | 0.5   | Already ships            |
| slot:win[*]            | per-tier (existing)                | 0.7   | Already ships            |
| reach:click            | sfx_singularity                    | 0.6   | NEW — commitment moment   |

Every interaction = sound. Recruiter learns the portfolio through their ears as much as their eyes.

---

## 4. Implementation Order — 5 Steps, Each <1 Day

```
P4.1  HERO TILE upgrade        — column 0 cell becomes rich tile with
                                  animated WebP support (component P19
                                  already built), per-project palette
                                  glow, integrated PLAY button
P4.2  Frame chrome dimming     — medallions/pillars/version_bar to
                                  opacity 0.18 idle; brighten on hover
                                  / spin / payline takeover
P4.3  Spin → NEXT REEL         — rename label, wire to persona model
                                  (P1.8) + CellMemory (P0.2) for
                                  unseen-project ranking
P4.4  Mobile single-cell focus — viewport ≤ 640px collapses 5×3 to
                                  one full-width tile + swipe nav
P4.5  Audio-first signature    — section voices on tab switch +
                                  hover micro-tick + reach commitment
                                  cue
```

Total: 5 days. Each step is independently shippable + reversible.

---

## 5. What NOT to Touch

These are load-bearing and well-tested. Do not refactor casually.

- Spin phase machine (idle → windup → spinning → landing → snapping → payline)
- Section data shape (`PROJECTS`, `SKILLS_DATA`, etc. in `src/data/portfolio.ts`)
- AudioBridge protocol (still needs to talk to Audio Manager)
- TransitionDirector boot→splash→slot flow
- `npm run verify` gate

---

## 6. Open Decisions

These need Boki's call before I implement:

1. **Section count: 5 or 4?** I propose merging SKILLS into ABOUT. Counter-argument: skills get diluted. **Default: stay 5 unless Boki agrees.**
2. **"WORK" vs "PROJECTS" tab label?** I propose WORK because recruiters search for "work samples." **Default: stay PROJECTS unless Boki agrees.**
3. **Reach pill: always visible?** Could feel pushy. Alternative: appears only after 30s idle. **Default: always-visible top-right.**
4. **NEXT REEL: rename vs keep "SPIN"?** Renaming changes brand voice. **Default: keep "SPIN" but change the target logic.**
5. **Mobile single-cell: should the desktop layout have a mode switch ("focus mode")?** Could be a useful power-user feature. **Default: no, keep desktop unchanged.**

---

## 7. Decision Log

```
2026-04-30  Architecture review V2 written. Awaiting Boki sign-off
            on the 5 open decisions in §6.
```

---

*End of Slot Architecture V2. Awaits implementation signal.*
