# VISUAL RESEARCH — Slot-Cabinet WOW for Recruiters

**Author:** Corti · **Companion to:** `ARCHITECTURE.md` · **Date:** 2026-04-29 · **Repo state:** `5a0da63` (post-P2)

`ARCHITECTURE.md` is the technical contract — system layers, refactors, test gates. **This document is the visual contract** — what the recruiter SEES in the first three seconds, and how we make those three seconds devastating.

---

## 0. Executive Summary

A senior creative director at any major studio scans 50 portfolios per recruiting cycle. Decision to read further or move on is made in **~3 seconds**. The portfolio that wins isn't the one with the most effects — it's the one whose first three seconds **feel inevitable**. Every motion has a reason; every reason serves a feeling.

Our current visual stack is technically rich (WebGPU 64k particles + LOD cull, audio-reactive FFT, heart-pulse beat envelope, cabinet ripple, cell affinity halos, view transitions, Houdini paint, 3D perspective cells). What it lacks against 2026 SOTA is **cinematic choreography** — camera moves, spatial depth, kinetic typography, narrative wow-moments. We have the engine; we don't yet have the director.

This document inventories the SOTA, identifies the gap, and proposes 12 concrete WOW moves with effort estimates. Top 5 by ROI:

1. **Dolly Zoom on tap-to-unlock** — Vertigo / Hitchcock effect; recruiter feels the cabinet pull them forward
2. **Cinematic boot tagline** — *"Audio is a game of chance. Forty wins. Zero defects."* Three-line reveal
3. **Section-change noise-mask + RGB chromatic aberration** — replace bare view-transitions
4. **Kinetic typography on splash + section labels** — letter-by-letter cinematic reveal
5. **Orbital traffic** — coins/chips orbit on CatmullRomCurve3 paths behind the cabinet (Blade Runner flying-cars analogue)

---

## 1. The Recruiter's 3-Second Window

What 50-portfolio-fatigued senior creatives report:

| Time   | What they see                | What they decide                  |
|--------|------------------------------|-----------------------------------|
| 0–0.5s | First paint / hero element   | Calibrate aesthetic class         |
| 0.5–1.5s | First motion / interaction | Decide if motion is *meaningful* or noise |
| 1.5–3s | First payload of content     | Decide whether to read more       |

The dominant failure mode is **flat first paint + decorative motion**. Cinema solved this 80 years ago: open on a wide shot that *promises* action; cut to subject; let camera move tell the story. Web has all the same tools as cinema and refuses to use most of them.

Our advantage: a slot machine is **inherently a stage**. The metaphor lets us deploy cinematic vocabulary that would feel pretentious on a generic portfolio.

---

## 2. State of the Art — 2026 Benchmarks

Polled from Awwwards Site of the Day winners, FWA, Codrops case studies, GraphicRiver casino UI 2026 catalog, and Behance featured slot art.

### 2.1 Samsy Ninja
**[samsy.ninja](https://samsy.ninja)** · Paris-based creative technologist · 50+ international awards including Cannes Lions and Awwwards.

WebGPU at 120 FPS. Cyberpunk 3D world inspired by Blade Runner / The Witness / Cyberpunk 2077. Key moves:
- Camera choreography: every hero element is approached by a virtual camera, never static
- Sound design: ambient drone with subtle impacts on interaction
- 3D type embedded in scene, not overlaid

### 2.2 Bruno Simon
**[bruno-simon.com](https://bruno-simon.com)** · Awwwards Site of the Month November · 3D game project navigation.

The recruiter literally drives a car through the portfolio. Project tiles are physical objects in a 3D world. Genre-defining proof that game vocabulary works for portfolio.

### 2.3 Toshihito Endo
**[toshihito-endo.com](https://toshihito-endo.com)** · Awwwards Honorable Mention.

First-person interactive 3D world with spatial design + 3D viz + animations. React + Three.js. The portfolio is a place you walk through.

### 2.4 "They Call Me Giulio" — Codrops case study
**[codrops case study](https://tympanus.net/codrops/2026/04/14/they-call-me-giulio-the-making-of-a-cinematic-cyberpunk-portfolio/)**

Most relevant to us. Cinematic cyberpunk with Blade Runner mood. Documented techniques:

- **Dolly Zoom (Vertigo effect)**: camera moves toward subject while FOV widens. Background "breathes" while subject stays prominent. Used on portfolio entry.
- **Perlin noise-based irregular masks** moving bottom-to-top during section transitions
- **UV distortion (lens-like)** near transition edges
- **RGB chromatic aberration** near transition centers
- **Mouse-history accumulator** stored in low-res texture (ping/pong) influencing both environment and typography
- **Embedded 3D text** with subtle noise overlay rather than DOM-overlaid type
- **Baked noise textures** (Perlin, FBM, random) instead of runtime computation
- **Avatar rigging** with bone armature responding to hover (head turns toward "About" button)
- **InstancedMesh flying cars** (100 instances) along `CatmullRomCurve3` parametric paths
- **Bokeh DOF** on background InstancedMesh, justifying geometric simplicity
- **Narrative wow-moments**: rooftop scene quoting "Tears in Rain"; Saiyan transformation on Works section; Matrix room of weapons reinterpreted; DeLorean descent on Contact

### 2.5 Modern Slot UI Trends (planet7 / SDLC / GraphicRiver / Behance survey)

Animation as **narrative**, not just state feedback:
- Symbols move independently to create depth + realism
- Backgrounds shift subtly with weather / time-of-day / progression
- Reward feedback uses **coin bursts, glowing borders, confetti cascades** — feel the win through motion, not text

Color psychology:
- **Warm tones (gold, red, orange)** for excitement + urgency
- **Cool tones (green, blue)** for longer gameplay sessions to avoid fatigue
- **Dark base + neon highlights** for sleek sophistication

Anticipation language:
- Reels decelerate progressively; final reel slows dramatically on near-jackpot (we ship this in P0.3 ✓)
- Audio drops to held suspended chord during anticipation
- Particle field intensifies as score climbs

Accessibility direction: adjustable text + contrast + audio cues; AR/VR explored.

---

## 3. What We Have — Current Visual Stack

Inventory of our existing visual capital, ordered by recruiter impact.

### Background substrate
- **CyberNebula** WebGL volumetric fragment shader (cyan/violet/gold flow, 4-octave fbm)
- **WebGPU QuantumField** 64k particles, frustum-cull, LOD, additive blend over nebula (P0.7)
- **Houdini Paint** procedural cyberpunk substrate (Phase 10)
- Audio-reactive 3-band FFT driving shader uniforms (bass swell, mid hue speed, treble sparkle)
- Heart-pulse beat envelope on quantum field size + alpha (P0.6 + P0.7 fix)

### Foreground / cabinet
- 5×3 reel grid, GSAP-driven y-transforms
- Casino symbols (coins, dice, chips, stars) on 3 concentric orbital rings behind Lucky 7
- 3D perspective tilt on cells (per-cell rotateX/rotateY from cursor position)
- Holographic shimmer + cursor spotlight + neon outline (compound cell components, P0.1)
- Cabinet ripple deformation on jackpot/big wins (P1.11)
- Cell affinity halo on hover-graph match (P1.9)
- Visited-state golden checkmark badge (P0.2)

### Type / chrome
- IGT-style version bar, manufacturer gold bar, mfg chrome strips
- Holographic name reveal at 55% boot progress
- HUD typewriter loading steps
- Glassmorphic chips: ● REC, ● VIEWING, ● HARDWARE TOAST

### Transitions
- View Transitions API on section change (Phase 8.2) — cross-fade + saturate + chromatic kick
- GSAP genesis timeline on slot reveal — tab → headers → cells column-by-column → controls

### Audio-visual coherence
- Spatial audio per-reel pan (Phase 5.3)
- Speech announcer casino-host narration (Phase 12)
- ARIA live region mirror (P0.5)

This is a **lot**. Most portfolios stop at half this.

---

## 4. The Gap — What SOTA Has, We Don't

Honest accounting against the benchmark set above.

| SOTA technique | Source | Status here | Gap effort |
|----------------|--------|-------------|------------|
| Dolly zoom on entry | Giulio | None | Low (1 day) |
| Cinematic camera choreography | Samsy | None (static viewpoint everywhere) | Med (3 days) |
| 3D type embedded in scene | Giulio | None (DOM type) | Med (2 days) |
| InstancedMesh orbital traffic | Giulio | Partial (CasinoField has DOM-rendered orbiters) | Low (1 day) |
| Bokeh / DOF post-processing | Giulio | None | Med (2 days) |
| Color grading LUT pipeline | most | None | Med (2 days) |
| Noise-mask section transitions | Giulio | None (basic CSS view-transitions) | Low (1 day) |
| Kinetic typography (letter-by-letter) | many | None (HUD typewriter is single-line static) | Low (1 day) |
| Vertigo / dolly camera moves | Giulio | None | Low (1 day) |
| Avatar / hero responsiveness | Giulio | None (Lucky 7 is static image) | Med (2 days) |
| Narrative wow-moments at sections | Giulio | None | High per moment |
| Cinematic finale on contact | Giulio (DeLorean) | None | Med (2 days) |
| First-person 3D navigation | Bruno Simon / Endo | Out of scope (different metaphor) | — |
| Game-physics navigation | Bruno Simon | Out of scope | — |

We're not chasing first-person 3D — that contradicts the slot-cabinet metaphor. Everything else is in scope.

---

## 5. WOW Move Catalog — 12 Concrete Adds

Each item: name · what it does · why it works · effort · concrete impl notes.

### 5.1 Dolly Zoom on Tap-to-Unlock
**What:** When the recruiter taps the boot screen, the camera pushes toward Lucky 7 while the FOV widens. Lucky 7 stays the same size on screen; everything around it expands outward. ~600ms.
**Why:** The Vertigo effect is the most-recognized cinema move outside cinema. It promises consequence. Recruiter who sees it knows they're being shown something *staged*.
**Effort:** 1 day
**Impl:** GSAP timeline animating CSS `perspective` + child `translateZ` simultaneously. CyberNebula `--par-zoom` uniform pushed from 1.0 → 1.4. Works on existing DOM tree, no 3D rewrite.

### 5.2 Cinematic Boot Tagline
**What:** Below "NEURAL SYNC" loading bar, three lines reveal letter-by-letter:
```
Audio is a game of chance.
Forty wins.
Zero defects.
```
Stays for 1.4 seconds total, fades. Anchors the metaphor before recruiter ever sees the slot.
**Why:** Without the tagline, the slot metaphor is decorative. With it, the metaphor is the thesis statement.
**Effort:** 0.5 days
**Impl:** GSAP TextPlugin or custom char-by-char reveal at 22ms/char. Three sequential lines, each starting after previous is half-revealed.

### 5.3 Section Transition — Noise Mask + RGB Aberration
**What:** Replace the current CSS view-transition cross-fade with:
- Perlin-noise mask sweeping bottom-to-top
- RGB chromatic split near mask edge (red shifts left, blue shifts right)
- Held 280ms, total duration 480ms
**Why:** Makes section change feel like a CRT cut, not a fade. Distinct visual signature recruiter will remember.
**Effort:** 1 day
**Impl:** WebGL post-process pass on a full-screen quad rendered above DOM during transition. Or pure CSS variant with SVG mask + filter chain (lower fidelity but no GPU dependency).

### 5.4 Kinetic Typography on Section Labels
**What:** Section name reveal in tab bar uses character-by-character cascade with subtle Y-translate + opacity. Each letter arrives 18ms after the previous.
**Why:** Static section labels are wasted real estate. Kinetic labels make every section change a micro-event.
**Effort:** 0.5 days
**Impl:** Wrap section label characters in `<span>`; CSS animation with `--i` index custom prop driving `animation-delay`. No JS RAF needed.

### 5.5 Orbital Traffic — Coins/Chips on CatmullRomCurve3
**What:** Replace the current DOM-rendered orbiting symbols (CasinoField) with WebGPU/Canvas-instanced sprites following 3D parametric paths. 60-100 instances on 3 concentric curves at varying depths, with bokeh blur on the back curve.
**Why:** DOM orbiters cost reflows; instanced curves don't. Visual depth jumps from 2D parallax to actual 3D.
**Effort:** 2 days
**Impl:** Either upgrade existing `CasinoField` canvas with 3D path math + DOF blur, or new WebGPU layer with SDF-rendered chip sprites. Reuse existing PNG sprite assets.

### 5.6 Bokeh DOF on Quantum Field
**What:** Apply a small-radius gaussian blur to far-z particles in the quantum field, ramping linearly with `|pos.z|`. Near particles sharp, far particles soft.
**Why:** Implies real depth where currently the field reads flat. ~6× perceived depth gain at near-zero cost (clamp shader path).
**Effort:** 1 day
**Impl:** Modify `WebGPUCompute.ts` render shader — instead of simple disk sprite, sample at multiple offsets weighted by gaussian, scaled by |pos.z| LOD term we already compute. Clamp loop count for perf.

### 5.7 Color Grading LUT Pipeline
**What:** Apply a 3D color LUT to the entire canvas stack as a final composite pass — Blade Runner orange-teal grade, Wong Kar-wai-style highlight tinting. ~30KB texture.
**Why:** Every cinematic visual we admire is graded. Our raw shader output isn't.
**Effort:** 2 days
**Impl:** New WebGL/WebGPU full-screen pass reading the existing canvas as input, sampling a 32×32×32 LUT texture. LUT designed in DaVinci Resolve or hand-coded Python LUT generator. Compute Pressure (P2) gates this off when CPU under load.

### 5.8 Vertigo Cabinet Push on Jackpot
**What:** Augment the existing P1.11 cabinet ripple with a 200ms camera dolly toward the cabinet starting at the jackpot moment. Frame appears to grow; HUD pulls back; particles streak inward.
**Why:** Cabinet ripple alone is a **bell-strike**. Combined with camera push it becomes a **moment**.
**Effort:** 0.5 days
**Impl:** GSAP timeline triggered alongside the existing ripple class — `body { transform: scale(1.04) }` + decay. Negligible GPU cost.

### 5.9 Welcome Voice-Over on First Tap
**What:** SpeechAnnouncer (Phase 12) already speaks "Welcome. System online." on `boot:complete`. Upgrade: pre-record the line through a real cinematic voice (50-cent budget on ElevenLabs or self-record), ship as `/welcome.opus`. Browser TTS becomes fallback.
**Why:** Browser TTS is functional but not cinematic. A real voice changes the brand class instantly.
**Effort:** 0.5 days (recording) + 0.5 days (loader)
**Impl:** Drop file in `public/welcome.opus`; SpeechAnnouncer extended with `playSampleOrTts(audioUrl, fallbackText)`.

### 5.10 Cinematic Camera Push on Payline Takeover
**What:** When a project's payline takeover opens, the camera "zooms in" toward the center cell with a 320ms easeInOut transform. Project detail cards arrive on a perspective tilt.
**Why:** The takeover is the most important moment — recruiter chose THIS project. Currently it's a fade. With the push, it's a reveal.
**Effort:** 1 day
**Impl:** Extend the existing payline takeover GSAP timeline. Test for jank against the existing in-flight animations.

### 5.11 Mouse-History Accumulator (Giulio technique)
**What:** Record mouse position history into a low-resolution accumulator texture each frame (ping-pong). Existing parallax in BootScreen reads only current position; with the accumulator, motion *trails* (subtle echo). Drives both background and certain text effects.
**Why:** Subliminal — recruiter feels the portfolio "remembers" their motion without knowing why.
**Effort:** 1.5 days
**Impl:** New `MouseAccumulator.ts` engine module with a 64×64 RGBA texture. Updated each RAF; consumed by CyberNebula + casino field shaders.

### 5.12 Cinematic Finale — Contact Section Zoom-Out
**What:** When the recruiter lands on the Contact section (last logical step), trigger a slow camera pull-back — the entire cabinet shrinks into a 3D world, ambient glow swells, contact details arrive on the right. Lasts ~2.5s.
**Why:** Bookends the experience. Boot was zoom-IN; contact is zoom-OUT. Cinematic structure complete.
**Effort:** 1.5 days
**Impl:** GSAP timeline on `slot:section:change → idx 4 (contact)`. Pure transform + scale on `<body>`; existing nebula handles the world expansion via the existing parallax targets.

---

## 6. Sound-Visual Coherence

The visual moves above must respect existing audio. Three coherence rules:

1. **Dolly zoom** triggers a 200ms reverse-swept synth pad (already in SoundManager as `cyberWind`).
2. **Section transition** noise mask is timed to the existing `whoosh` sample so the visual reads as caused by the audio.
3. **Cabinet jackpot push** synchronizes with the `playJackpotBloom` spatial audio call — push completes on the spatial audio's apex (~120ms in).

Tonal coherence pipeline (P0.6 → audio:key event) lets future SoundManager work re-tune procedural synths to the ambient track. When that lands, the visual moments will inherit pitch consistency for free.

---

## 7. Performance Budget — Where the WOW Moves Land

| Move | Frame cost | Concurrent? | Compute Pressure gate |
|------|------------|-------------|------------------------|
| Dolly zoom | <0.5ms (GSAP transform) | with all | always on |
| Tagline | 0 (CSS animation) | with all | always on |
| Noise mask transition | ~1ms during 480ms only | once at a time | skip on serious+ |
| Kinetic type | 0 (CSS) | with all | always on |
| Orbital traffic (instanced) | ~0.6ms | with all | reduce instances on serious |
| Bokeh DOF | ~0.8ms (5-tap) | with all | reduce taps on serious |
| Color LUT | ~0.4ms | with all | skip on critical |
| Cabinet push | 0 (one transform) | once | always on |
| Voice-over | network only | first tap | always on |
| Payline push | <0.5ms | once | always on |
| Mouse accumulator | ~0.2ms | with all | skip on critical |
| Contact zoom-out | <0.5ms | once | always on |

Total worst case if everything runs simultaneously: ~3.5ms — within the 16.67ms frame budget with 13ms headroom for the existing render stack.

`P2 ComputePressure` already wired (5a0da63). On `serious`/`critical` levels the heavier passes (LUT, bokeh, accumulator) auto-degrade.

---

## 8. Implementation Roadmap

### P3 — Visual Foundations (5 days, ROI/effort sweet spot)
1. Dolly zoom on tap-to-unlock (5.1)
2. Cinematic tagline (5.2)
3. Kinetic type on section labels (5.4)
4. Section noise-mask transitions (5.3)
5. Cabinet vertigo push on jackpot (5.8)
6. Welcome voice-over (5.9)
7. Cinematic camera push on payline (5.10)
8. Contact zoom-out finale (5.12)

### P4 — Cinematic Atmosphere (5 days)
9. Orbital traffic upgrade (5.5)
10. Bokeh DOF on quantum field (5.6)
11. Mouse-history accumulator (5.11)
12. Color grading LUT pipeline (5.7)

### P5 — Reach (out of scope unless asset budget grows)
- Custom Lucky 7 avatar with bone rigging that responds to hover (Giulio-style)
- Narrative wow-moments per section (Saiyan / Matrix / DeLorean equivalents in our metaphor)
- Real ElevenLabs voice replacing all SpeechAnnouncer phrases
- WebGPU 3D type embedded in scene (replacing DOM type for hero elements)

---

## 9. Anti-Patterns — What to AVOID

These ruin portfolios more than they help:

- **Effect overload** — every shader trick at once = Las Vegas slot floor, not portfolio. Pick 5, do them perfectly. The catalog above is **a menu**, not a checklist.
- **Animation for animation's sake** — every motion must carry meaning (state change, narrative beat, anticipation). Decorative motion is jank.
- **Loading screens > 1 second on first visit** — recruiter has 50 portfolios to see today. Beautiful boot screen at 1.4s is fine. At 4s it's a closed tab.
- **3D where 2D would do** — first-person 3D nav (Bruno Simon style) is wonderful but contradicts the slot-cabinet metaphor. Don't borrow vocabulary from another grammar.
- **Sound that surprises** — autoplay audio is the most-hated portfolio behavior. Our boot:tap unlock contract solves it; never break that contract.
- **Cabinet branding mismatch** — current palette is cyan/violet/gold. Adding hot pink because it looks cool kills the brand. Every new color must thread the existing tokens.

---

## 10. Decision Anchors

For future Boki/Corti choices on visual direction:

| Question | Default answer |
|----------|----------------|
| Add this effect? | Only if it serves the slot-cabinet metaphor |
| Dolly / push / zoom? | Yes, when it reveals consequence |
| New color? | No — re-tint via existing tokens |
| New sound? | Only if existing palette can't carry it |
| 3D / first-person? | No — different grammar |
| Add a loading screen? | Only if it earns the time with motion |
| Add a "skip intro"? | No — boot is 1.4s, recruiter who can't wait that long isn't ours |

---

## Appendix — Sources

- [They Call Me Giulio: Making of a Cinematic Cyberpunk Portfolio](https://tympanus.net/codrops/2026/04/14/they-call-me-giulio-the-making-of-a-cinematic-cyberpunk-portfolio/) — Codrops case study, primary reference for cinematic techniques
- [Best WebGL Websites — Awwwards](https://www.awwwards.com/websites/webgl/) — current Site of the Day catalog
- [Best 3D Websites — Awwwards](https://www.awwwards.com/websites/3d/)
- [Awwwards — Bruno Simon Portfolio Wins Site of the Month](https://www.awwwards.com/bruno-simon-portfolio-wins-site-of-the-month-november.html)
- [Awwwards — Toshihito Endo Portfolio (game-like, first-person)](https://www.awwwards.com/sites/toshihito-endos-portfolio)
- [Dev From 2047: WebGPU Portfolio (Vue + TSL)](https://www.webgpu.com/showcase/dev-from-2047-webgpu-portfolio/)
- [WebGPU & Future of Graphics 2026](https://blog.weskill.org/2026/04/webgpu-future-of-graphics-building-2026.html)
- [SDLC Corp — Slot Game Graphics Trends](https://sdlccorp.com/post/trends-in-slot-game-graphics-and-visual-design/)
- [Gaming-and-Media — Slot UI Evolution](https://g-mnews.com/en/the-evolution-of-user-interface-how-player-demands-are-transforming-slot-machines/)
- [Swoon Talent — Visual Rhythm in Online Casino](https://swoontalent.com/2026/04/how-visual-rhythm-and-layout-craft-the-online-casino-experience-a-journey-beyond-instant-luck/)
- [Muzli — 100 Best Designer Portfolio Websites of 2026](https://muz.li/blog/top-100-most-creative-and-unique-portfolio-websites-of-2025/)
- [Sitebuilderreport — Motion Design Portfolios 2026](https://www.sitebuilderreport.com/inspiration/motion-design-portfolios)
- [DesignRush — Best Motion Effects Website Designs 2026](https://www.designrush.com/best-designs/websites/motion-effects)

---

*End of visual research. Implementation begins on signal.*
