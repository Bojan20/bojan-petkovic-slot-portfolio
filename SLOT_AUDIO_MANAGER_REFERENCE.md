# Slot Audio Manager — Reference Document

## Overview

SlotAudioManager je desktop Electron aplikacija za upravljanje audio workflow-om u slot igrama.
Lokacija na disku: `/Users/vanvinklstudio/Desktop/Projects/SlotAudioManager`
Git: `https://github.com/igtinteractive/slot-template-audio-howler.git`

Koristi se za:
- Import WAV fajlova za slot igru
- Konfigurisanje audio sprite-ova (tier-ovi po velicini)
- Build M4A sprite-ova sa FFmpeg
- Generisanje sounds.json manifesta
- QA validacija (velicine, reference, orphan detekcija)
- Deploy na game repo

---

## Tech Stack

| Tehnologija | Verzija | Uloga |
|-------------|---------|-------|
| Electron | 28 | Desktop shell, IPC, file ops, git, npm |
| React | 19 | UI renderer |
| Tailwind CSS | v4 | Styling |
| Vite | 8 | Bundler |
| FFmpeg (static) | bundled | Audio encoding |
| node-exiftool | — | Metadata extraction (trajanje zvukova) |
| sox | — | Audio processing |
| audiosprite | — | Sprite kreacija |

**Jezik:** Cist JavaScript (JSX) — nema TypeScript.

---

## Arhitektura

```
main.js              — SVE IPC handlere, file operacije, git, npm, template logika
preload.js           — contextBridge.exposeInMainWorld('api', {...})
src/App.jsx          — Sidebar navigacija (7 stranica), routing, toast sistem
src/pages/           — 7 page komponenti
template/            — Bundled template (scripts, configs) — app je source of truth
```

### Security Model
- `contextIsolation: true` — renderer nema pristup Node-u
- Script names validirani regexom: `/^[a-zA-Z0-9_-]+$/`
- File ops: `path.basename()` + `.wav` check + `startsWith()` zastita
- Git: `execFileSync` sa array args (no shell injection)
- Svi subprocessi imaju `timeout` + `maxBuffer: 5MB`

---

## 7 Stranica (Pages)

### 1. Project Page
**Sta radi:** Prikaz projekta — statistike, settings, sprite tiers, standalone muzika.
**API pozivi:** Nema (read-only display).

### 2. Setup Page
**Sta radi:** Health check, template init, npm install, linkovanje game repo-a.
**API pozivi:**
- `healthCheck` — Validira strukturu (4 JSON konfiga, 12 skripti, 4 deps, direktorijumi)
- `initFromTemplate` — Prepisuje scripts/configs iz bundled template-a
- `npmInstall` — `npm install --legacy-peer-deps` (240s timeout)
- `pickGameRepo` — Directory picker za game repo
- `configureGame` — Linkuje audio repo sa game repo (relativni put)

### 3. Sounds Page
**Sta radi:** Import WAV fajlova, brisanje zvukova.
**API pozivi:**
- `importSounds` — Multi-select WAV dijalog, kopira u `sourceSoundFiles/`
- `deleteSound` — Brise WAV iz `sourceSoundFiles/` (path traversal zastita)

### 4. Sprite Config Page
**Sta radi:** Edit tier definicija — max velicine, prioriteti, raspored zvukova.
**API pozivi:**
- `saveSpriteConfig` — Snima `sprite-config.json`

### 5. Commands Page
**Sta radi:** Pregled/edit sound komandi i sprite lista.
**API pozivi:** Nema (cita iz `project.soundsJson`).

### 6. Build & Deploy Page
**Sta radi:** Pokretanje build/validate skripti, deploy na game repo.
**API pozivi:**
- `runScript` — Izvrsava npm skriptu (300s timeout)
- `runDeploy` — Deploy skripta (120s timeout)

### 7. Git Page
**Sta radi:** Git status, commit, push.
**API pozivi:**
- `gitStatus` — Porcelain status, branch, poslednjih 10 commitova
- `gitCommitPush` — `git add -A` → `commit -m` → `push`

---

## IPC Kanali (17 handlera)

| Kanal | Smer | Opis |
|-------|------|------|
| `open-project` | renderer→main | Dijalog za folder, vraca projekt data |
| `reload-project` | renderer→main | Reload sa diska |
| `save-sprite-config` | renderer→main | Snima sprite-config.json |
| `save-sounds-json` | renderer→main | Snima sounds.json |
| `save-settings` | renderer→main | Snima settings.json |
| `import-sounds` | renderer→main | Multi-select WAV, kopira u sourceSoundFiles/ |
| `delete-sound` | renderer→main | Brise WAV (path traversal zastita) |
| `run-script` | renderer→main | npm skripta (validirano ime, 300s timeout) |
| `run-deploy` | renderer→main | Deploy skripta (120s timeout) |
| `git-status` | renderer→main | Porcelain status + branch + log |
| `git-commit-push` | renderer→main | add -A → commit → push (execFileSync) |
| `health-check` | renderer→main | Validacija strukture projekta |
| `init-from-template` | renderer→main | Overwrite iz bundled template |
| `npm-install` | renderer→main | npm install (240s timeout) |
| `pick-game-repo` | renderer→main | Directory picker |
| `configure-game` | renderer→main | Link game repo, update pkg name/desc |

---

## JSON Konfiguracije (Audio Projekat)

### settings.json

```json
{
  "gameProjectPath": "../playa-slot-template-standard-game",
  "JSONtemplate": "sounds.json",
  "JSONtarget": "dist/sounds.json",
  "SourceSoundDirectory": "sourceSoundFiles",
  "DestinationSoundDirectory": "dist",
  "DestinationAudioSpriteDirectory": "dist/soundFiles"
}
```

**gameProjectPath** — relativna putanja do game repo-a (ocuvana pri template init)

### sprite-config.json

```json
{
  "spriteGap": 0.05,
  "sprites": {
    "boot": {
      "maxSizeKB": 500,
      "priority": 1,
      "sounds": ["UiSpin", "UiClick", "Payline", "..."],
      "sortOrder": [],
      "description": "Critical UI sounds"
    },
    "reel_win": {
      "maxSizeKB": 1500,
      "priority": 2,
      "sounds": ["SymbolWin1", "RollupLoop", "..."],
      "sortOrder": [],
      "description": "Symbol wins, rollups"
    },
    "bigwin": {
      "maxSizeKB": 1500,
      "priority": 3,
      "sounds": ["BigWin", "Anticipation", "..."],
      "sortOrder": [],
      "description": "Big win / anticipation"
    },
    "bonus": {
      "maxSizeKB": 1500,
      "priority": 4,
      "sounds": ["BonusStart", "BonusPick", "..."],
      "sortOrder": [],
      "description": "Bonus game sounds"
    }
  },
  "standalone": {
    "sounds": ["BaseMusicLoop", "BonusMusicLoop"]
  },
  "encoding": {
    "sfx": { "bitrate": 64, "channels": 1, "samplerate": 44100 },
    "music": { "bitrate": 96, "channels": 2, "samplerate": 44100 }
  }
}
```

### Tier System

| Tier | Max Size | Priority | Sadrzaj |
|------|----------|----------|---------|
| **boot** | 500 KB | 1 (highest) | UI zvukovi — spin, click, payline |
| **reel_win** | 1500 KB | 2 | Symbol wins, rollup loops, preshows |
| **bigwin** | 1500 KB | 3 | Big win, anticipation, scatter |
| **bonus** | 1500 KB | 4 | Bonus game specifican audio |
| **standalone** | unlimited | — | Music loops (ne sprite-uju se) |

**Encoding:**
- SFX: 64 kbps, mono, 44.1 kHz
- Music: 96 kbps, stereo, 44.1 kHz

### sounds.json (Manifest)

```json
{
  "soundManifest": [
    { "id": "spriteFileId", "src": ["soundFiles/sprite.m4a"] }
  ],
  "soundDefinitions": {
    "soundSprites": {
      "s_Name": {
        "soundId": "",
        "spriteId": "",
        "startTime": 0,
        "duration": 0,
        "tags": [],
        "overlap": false
      }
    },
    "commands": {
      "cmdName": [
        { "command": "play", "spriteId": "", "volume": 1.0, "delay": 0 }
      ]
    },
    "spriteList": {
      "listName": ["spriteId1", "spriteId2"]
    }
  }
}
```

**soundManifest** — Lista sprite fajlova za loading
**soundSprites** — Individual zvuci sa start/duration unutar sprite-a
**commands** — Kompozitne komande (play vise zvukova, volume, delay)
**spriteList** — Grupe sprite-ova (za random/sekvencijalno puštanje)

---

## Build Pipeline (12 skripti)

### Glavne skripte

| Skripta | Sta radi |
|---------|----------|
| `buildTiered.js` | **GLAVNI BUILD** — Grupise zvukove po tier-u iz sprite-config, kreira M4A sprite-ove |
| `buildTieredJSON.js` | Generise sounds.json iz sprite metadata (koristi exiftool za durations) |
| `validateBuild.js` | **QA** — Velicine sprite-ova, referentni integritet, orphan detekcija, boot <500KB |
| `customAudioSprite.js` | FFmpeg wrapper za custom encoding/bitrate |
| `copyAudio.js` | **DEPLOY** — Kopira sprite-ove + sounds.json u game repo `sounds/` folder |

### Pomocne skripte

| Skripta | Sta radi |
|---------|----------|
| `convertAudio.js` | Konverzija jednog audio fajla (FFmpeg) |
| `createAudioSprite.js` | Kreacija jednog sprite-a |
| `createAudioSpritesBySize.js` | Grupiranje sprite-ova po velicini |
| `createmultipleAudioSprites.js` | Kreira vise sprite-ova od svih zvukova |
| `makeMyJSON.js` | JSON generacija za jedan sprite |
| `makeMyJSONMultipleSounds.js` | JSON generacija za vise sprite-ova |
| `makeMyJSONSizedSprites.js` | JSON generacija za size-based sprite-ove |

### Build Flow

```
1. Import WAV-ove u sourceSoundFiles/
2. Konfiguriši tier-ove u sprite-config.json
3. RUN: buildTiered.js
   ├── Cita sprite-config.json
   ├── Grupise WAV-ove po tier-u
   ├── Za svaki tier: kreira M4A sprite (FFmpeg)
   └── Output: dist/soundFiles/*.m4a
4. RUN: buildTieredJSON.js
   ├── Cita sprite metadata (exiftool)
   ├── Generise sounds.json sa start/duration za svaki zvuk
   └── Output: dist/sounds.json
5. RUN: validateBuild.js
   ├── Proverava velicine sprite-ova (boot < 500KB, ostali < 1500KB)
   ├── Referentni integritet (svi zvuci u sprite-u postoje)
   ├── Orphan detekcija (WAV-ovi koji nisu ni u jednom tier-u)
   └── PASS/FAIL izvestaj
6. RUN: copyAudio.js (DEPLOY)
   ├── Kopira dist/soundFiles/*.m4a → game-repo/assets/.../sounds/soundFiles/
   └── Kopira dist/sounds.json → game-repo/assets/.../sounds/sounds.json
```

### Deploy Target

```
{gameRepo}/assets/default/default/default/sounds/
├── sounds.json
└── soundFiles/
    ├── boot.m4a
    ├── reel_win.m4a
    ├── bigwin.m4a
    └── bonus.m4a
```

---

## Health Check Validacija

Setup stranica pokece `health-check` koji proverava:

- **4 config fajla:** package.json, settings.json, sounds.json, sprite-config.json
- **scripts/ direktorijum** + 12 core skripti
- **sourceSoundFiles/ direktorijum**
- **node_modules/ direktorijum**
- **3 npm skripte:** build, build-validate, deploy
- **4 dependencies:** node-exiftool, sox, audiosprite, ffmpeg-static

---

## Key Workflows

### 1. Init from Template
1. Overwrite scripts iz `template/scripts/` → `project/scripts/`
2. Overwrite sprite-config.json, sounds.json iz template
3. Merge package.json: overwrite scripts + deps
4. Update settings.json: defaults, **SACUVAJ gameProjectPath**
5. Kreiraj `sourceSoundFiles/` ako ne postoji

### 2. Configure Game Repo
1. Derive audio slug iz folder naziva audio repo-a
2. `settings.json → gameProjectPath` = relativna putanja
3. `package.json → name` = audioSlug, `description` = "Audio for {gameRepoName}"
4. Verifikuj da game repo ima `assets/` folder

### 3. Full Build + Deploy
1. `npm run build` → buildTiered.js (kreira sprite-ove)
2. `npm run build` → buildTieredJSON.js (generise manifest)
3. `npm run build-validate` → validateBuild.js (QA provera)
4. `npm run deploy` → copyAudio.js (kopira u game repo)

---

## Dev Commands

```bash
# Development
npm run dev              # Vite dev server + Electron (concurrent)
npm run build-renderer   # Vite production build → dist-renderer/

# Cross-platform builds
npm run build-mac        # macOS DMG
npm run build-win        # Windows NSIS installer
npm run build-all        # Oba
```

Output: `release/` direktorijum.

---

## Veza sa CORTEX Engine

SlotAudioManager kreira audio asset-e (sprite-ove + sounds.json) koji se **deployuju u slot igru**.

CORTEX Engine u portfolio sajtu trenutno koristi **synth-first pristup** (Web Audio API, zero network).
Za produkcione slot igre, CORTEX Engine bi koristio sounds.json manifest koji SlotAudioManager generise.

```
SlotAudioManager                    CORTEX Engine
┌──────────────┐                   ┌──────────────────┐
│ WAV import    │                   │ SoundManager      │
│ Tier config   │ ──► sounds.json ──►│  - loads manifest │
│ Build sprites │ ──► M4A files   ──►│  - plays sprites  │
│ Validate      │                   │  - volume buses   │
│ Deploy        │                   │  - haptic         │
└──────────────┘                   └──────────────────┘
```

### sounds.json Format → CORTEX Integration

sounds.json koji SlotAudioManager generise moze direktno da se cita u CORTEX SoundManager:

```typescript
// Primer buduceg loadera:
const manifest = await fetch('/sounds/sounds.json').then(r => r.json())

// soundManifest → load M4A sprite-ove
for (const entry of manifest.soundManifest) {
  await loadAudioSprite(entry.id, entry.src[0])
}

// soundSprites → registruj zvukove sa start/duration
for (const [name, sprite] of Object.entries(manifest.soundDefinitions.soundSprites)) {
  registerSprite(name, sprite.spriteId, sprite.startTime, sprite.duration)
}

// commands → registruj kompozitne komande
for (const [cmd, actions] of Object.entries(manifest.soundDefinitions.commands)) {
  registerCommand(cmd, actions)
}
```

---

## CSS Theme (za referencu pri UI rebuildu)

- **Primary BG:** `#08080d`
- **Accent:** `#7c6aef` (purple)
- **Color tokens:** cyan, purple, green, orange + dim variants (rgba 15%)
- **Components:** `.card`, `.card-glow`, `.badge`, `.input-base`, `.btn-primary`, `.btn-ghost`
- **Animations:** `.anim-fade-up`, `.anim-fade-in`, `.anim-pulse-dot`

---

## State Management Pravila

- `structuredClone()` za deep state updates (NE `{...spread}`)
- Svaka stranica resetuje state na `project?.path` change
- Svaka stranica ima `if (!project)` early return guard
- Svi async handleri u try-catch sa toast error feedback
- Boolean flags (`running`, `pushing`, `installing`) sprečavaju concurrent ops
- `useRef` za toast timer cleanup
