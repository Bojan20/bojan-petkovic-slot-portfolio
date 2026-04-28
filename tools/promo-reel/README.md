# Promo Reel Generator

> Auto-generates Bojan Petković cinematic promo reels for LinkedIn / IG /
> portfolio embeds. Single-command pipeline — capture → compose → MP4.

## What it produces

| Format | Size | Length | Use |
|---|---|---|---|
| `promo-vertical-30s.mp4` | 1080 × 1920 | 30 s | LinkedIn, IG Reels, TikTok, Shorts |
| `promo-landscape-60s.mp4` | 1920 × 1080 | 60 s | Portfolio hero, YouTube, email pitch |

Both are cut from the **same** source: a captured slot game session
(default: *Cash Eruption: The Western*, IGT 2023 — Bojan's own title)
plus 8 procedurally-rendered brand cards, sealed with a 390 ms
**Three-Note Oath** signature stinger and a royalty-free ambient bed.

## One command

```bash
cd tools/promo-reel
npm install        # installs Playwright (~ 200 MB once)
npx playwright install chromium  # one-time browser download
npm run make       # generates BOTH formats
```

That's it. `output/promo-vertical-30s.mp4` and `output/promo-landscape-60s.mp4`
appear when it's done.

## Faster runs

Once you've captured & rendered cards once, every subsequent run is ~30 s
because everything is cached:

```bash
npm run make -- --skip-capture          # reuse captures/raw-gameplay.webm
npm run make -- --format=vertical       # only re-render the vertical reel
npm run make -- --force                 # nuke caches, regenerate everything
```

## Pipeline architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  [1] THREE-NOTE OATH       three-note-oath.mjs                       │
│      390 ms FM-synth WAV   ── G2 + C3 + E3 + coin shimmer            │
│      assets/audio/three-note-oath.wav                                │
│                                                                      │
│  [2] BRAND CARDS           brand-assets.mjs                          │
│      9 HTML→PNG cards      cold-open · name-card · metric-stack ·    │
│      per format            project-grid · skill-stack · career ·     │
│                            about · cta-card · lower-third            │
│      assets/cards/<format>/*.png                                     │
│                                                                      │
│  [3] CAPTURE                capture.mjs                              │
│      Playwright headless   → slotcatalog.com (Cash Eruption)         │
│      WebM record (25 s)    → fallback: local mockups/promo-reel.html │
│      captures/raw-gameplay.webm                                      │
│                                                                      │
│  [4] COMPOSE                compose.mjs                              │
│      ffmpeg filter_complex                                           │
│      ├─ render each segment (Ken-Burns on cards, scale+overlay on    │
│      │   gameplay)                                                   │
│      ├─ xfade 0.6 s between every adjacent segment                   │
│      ├─ generate procedural ambient pad bed                          │
│      └─ mux: video + oath (cold-open) + bed (full duration)          │
│                                                                      │
│  ▶ output/promo-{vertical-30s,landscape-60s}.mp4                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Timeline (vertical 30 s)

| t         | segment      | what                                              |
|-----------|--------------|---------------------------------------------------|
| 0.0 – 1.5 | cold-open    | VV monogram + 3 ringPulse + Three-Note Oath hit   |
| 1.5 – 4.0 | hero-card    | BOJAN PETKOVIĆ + tagline                          |
| 4.0 – 7.0 | metric-stack | 50+ titles · 200+ SFX · 0 defects · 8+ years      |
| 7.0 – 19.0| gameplay     | live slot capture w/ animated lower-third         |
| 19.0 – 25 | project-grid | 8 game tiles, glassmorphism, branded color stripe |
| 25 – 30   | cta-card     | LET'S BUILD SOUND TOGETHER + email + ▶ BOOK A CALL|

The landscape 60 s adds: about-strip, a 2nd gameplay block, skill-stack,
and career-timeline.

## Customising

Edit `src/config.mjs`:

- `BRAND.name`, `metrics`, `tagline`, `colors`, `fonts` — global identity
- `PROJECTS`, `SKILLS`, `CAREER` — content arrays (already populated from
  the live portfolio data)
- `FORMATS.{vertical,landscape}` — width/height/fps/duration/bitrate
- `TIMELINE.{vertical,landscape}` — segment list (rearrange / drop / add)
- `CAPTURE.targetUrl` — change to any slot game on slotcatalog or any URL

To add a new card kind, write a renderer in `brand-assets.mjs` and put
its key into `RENDERERS`. Reference it from `TIMELINE` by `kind`.

## Why this stack

| Choice | Why |
|---|---|
| Pure Node + ffmpeg | zero Python, zero render farm; runs on Bojan's laptop |
| HTML→PNG cards | brand parity with React portfolio (same fonts, colors) |
| Playwright capture | works on slotcatalog without API access |
| Hand-rolled WAV synth | deterministic signature, byte-stable across machines |
| ffmpeg `xfade` | recruiter-friendly transitions, no flashy gimmick |
| Ambient bed via `lavfi` | royalty-free, LinkedIn-safe, no copyright strikes |

## Troubleshooting

- **`npx playwright install chromium` failed** → `sudo` it once on macOS,
  the cache lives at `~/Library/Caches/ms-playwright/`
- **Capture comes back empty** → slotcatalog may have geo-blocked you.
  The pipeline auto-falls back to the local `mockups/promo-reel.html`.
- **Output is silent** → check `assets/audio/three-note-oath.wav` exists
  and `bed-{format}.wav` was generated. Re-run with `--force`.
- **Want a different game?** → set `CAPTURE.targetUrl` in `config.mjs`,
  re-run `npm run make -- --force`.

## File map

```
tools/promo-reel/
├── README.md                  ← you are here
├── package.json
├── .gitignore
├── src/
│   ├── config.mjs             ← brand + format + timeline knobs
│   ├── three-note-oath.mjs    ← FM synth signature WAV
│   ├── brand-assets.mjs       ← HTML→PNG card renderer
│   ├── capture.mjs            ← Playwright slot capture + fallback
│   ├── compose.mjs            ← ffmpeg cuts + transitions + audio mux
│   └── make-reel.mjs          ← orchestrator (THE entry point)
├── assets/                    ← generated, in .gitignore
│   ├── audio/
│   │   ├── three-note-oath.wav
│   │   └── bed-{format}.wav
│   └── cards/
│       └── {vertical,landscape}/*.png
├── captures/                  ← generated, in .gitignore
│   └── raw-gameplay.webm
└── output/                    ← generated, in .gitignore
    ├── promo-vertical-30s.mp4
    ├── promo-landscape-60s.mp4
    └── _intermediate/
```
