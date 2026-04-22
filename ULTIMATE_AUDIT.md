# ULTIMATE AUDIT — Bojan Petković Portfolio

Četiri paralelne specijalizovane uloge analizirale kod i UI: **Mobile UX**, **Typography & Brand**, **Slot UX / IA**, **Motion & Performance**. Ovaj dokument je sinteza — šta je loše, zašto, i šta je ultimate rešenje.

Živi mockup: **[?mockup=v2](http://localhost:5180/?mockup=v2)** — paralelna ruta, originalni slot netaknut.

---

## 1. MOBILE UX

### Kritični nalazi
| # | Problem | Fix |
|---|---------|-----|
| 1.1 | `viewport-fit=cover` nedostaje, `env(safe-area-inset-*)` nigde → Dynamic Island seče marquee, Home Indicator seče SPIN na iPhone 14+ | Dodat u [index.html](index.html); `.root` mockupa konzumira insete |
| 1.2 | `100vh` umesto `100dvh` → iOS Safari address-bar jump skriva SPIN na 114px | Mockup koristi `100dvh` + `100svh` fallback |
| 2.1 | Fontovi na 375px ispadaju 6.5–8.5px (`.gameStudio`, `.scopeBadge`, `.workText`, `.toolBadge`, `.demoLabel`) — **nečitljivo** | Mockup: minimumi 11–14px, line-height 1.55 |
| 3.1 | TabBar tap 40px (HIG 44), `.demoBtn` 30px | Mockup: min 48px sve interaktivno |
| 6.3 | Nema `navigator.vibrate` haptika nigde | Mockup: `vibrate(6)` na swipe |
| 7.1 | Landscape layout nikad testiran — ćelije 146×74, prazno | Mockup: `@media (orientation: landscape)` premešta icon + text u row |

### Visoki
- `.swipeHint` (bottom:42–72px) pada preko donjeg reda ćelija → prepiše work text
- `.pillar × 2` zauzima 12% širine ekrana na mobilnom — gušenje
- `7 istovremenih glow izvora` (marquee, tabs, headers, pillars, medallions, cells, SPIN) — oko nema primary target

---

## 2. TYPOGRAPHY & BRAND

### Presudni problemi
1. **Samo 1 type family** radi sav posao — Rajdhani za naslove i za 600-char pasuse (nije joj posao). Nema display/body split.
2. **WCAG AA fails** — `.gameStudio` 4.02:1, `.scopeOff` 3.6:1, `.toolBadge` 3.9:1 (potrebno ≥4.5:1)
3. **Zlatno preterivanje** — pillars, medallions, borders, SPIN, marquee, tabs, payline, COLLECT, takeover pulse — **gold svuda, nigde miran prostor**. Čita se kao _penny slot_, ne _boutique audio studio_.
4. **CRT scanlines + vignette + 4 medallions + fluted pillars** = **7/10 Vegas** umesto ciljanih 2/10.
5. **Splash "AUDIO GAME DESIGN"** je netačan naslov (Bojan je "Audio Director & Sound Designer & Composer"). Profesija je 14–24px, ime je 42–120px glittering — obrnut hierarchy.

### Ultimate fix (primenjen u mockupu)
```
--fd: 'Rajdhani'     (DISPLAY ONLY: h1/h2, tabs, SPIN label)
--fb: 'Inter'        (SVI pasusi, body text)
--fm: 'JetBrains'    (metadata, timestamps, stats)

--paper: #e8e6df     (body text, ~13:1 contrast)
--paper-dim: #9a978d (captions, ~5.5:1 contrast)
--g: #d4a84b         (JEDINI accent, rezervisan za status/CTA)
```
- **1 gold moment** na ekranu (active tab underline) — ne 7
- **Tagline uvek vidljiv**: `iGAMING AUDIO · 8 YEARS · 50+ CERTIFIED TITLES` — 5-sec test prolazi

---

## 3. SLOT UX / INFORMATION ARCHITECTURE

### Kritični nalazi
| # | Problem | Zašto je kritičan |
|---|---------|-------------------|
| 3 | **~3.7s od spin-a do interaktivne kartice** (windup 140 + spin 1140 + snap 480 + finalize 280 + cascade 400 + pulse 1100 + takeover 500+650) | Regruter skenira 40 portfolija/dan — hostile |
| 4 | **Payline deep-dive je samo klon iste ćelije, samo veći** — niti jedna nova informacija | Nema case study, nema demo play, nema external link |
| 5 | `ProjectItem` nema `year, role, heroImg, videoUrl, audioUrl, liveUrl, metrics, collaborators` | Nemoguće verifikovati da je real |
| 6 | **Email, LinkedIn, GitHub su plain string-ovi** — ne klikatabilni | Kontakt je friction HIGH |
| 6 | **Demo dugmad ne puštaju zvuk** — audio designer's portfolio bez audio demo-a | `demo: 'audio'` field je mrtav |
| 8 | 10–15s gating-a pre prvog projekta (boot tap → progress → splash → GSAP 3.8s tranzicija) | Vraća posetioca pre content-a |
| 9 | **Nema URL routing-a** — ne možeš linkovati "Bojan Valkyries audio", nema SEO | Za freelance audio designera, presudno |

### Ultimate fix (mockup demonstrira)
- **Nema spin mehanike za browse** — direktno `‹ ›` navigacija ili swipe na mobile (48px threshold)
- **Strip na dnu** — svih 8 projekata vidljivo kao thumbnails, 1-click skok
- **URL hash sync** — `#/projects`, `#/skills`, `#/contact` → bookmark, share, SEO ready
- **Persistent top bar** sa imenom + ulogom + **Email / Hire** dugmadima
- **Contact kartice imaju CTA button** (`mailto:`, `https://linkedin.com/...`) — 1 klik
- **0s onboarding** — direktno na content na `/`

---

## 4. MOTION & PERFORMANCE

### Kritični nalazi
| # | Problem | Impact |
|---|---------|--------|
| 4 | Matter.js 90 čestica + 5 render pasova + `shadowBlur` + **~5400 gradient objekata/sec** | Guaranteed jank na iPhone SE i mid-Android |
| 5 | **Zero `prefers-reduced-motion` respect** — 11 infinite animacija non-stop | WCAG 2.3.3 fail + battery drain |
| 7 | **`framer-motion` (55KB) uvezen a nigde iskorišćen** | Dead weight |
| 7 | `tone` (110KB) + `howler` (10KB) dupliraju posao `SoundManager.ts` | Suvišno u produkciji |
| 8 | Payline takeover animira `box-shadow` + `backdrop-filter: blur` istovremeno | Frame cliff na Androidu |
| 9 | **Nema motion kill switch UI-a** | Korisnik ne može da smanji intenzitet |

### Metrics
- Ukupan JS bundle višak: **~200KB** gzipped (framer + tone + howler + mrtav Matter)
- Composite layers tokom takeover: **~30** (iOS Safari pada na >25 sa backdrop-filter)
- Animacija od tap-a do klikable: **3.7s** → cilj **2.1s**

### Ultimate fix
```bash
npm uninstall framer-motion tone howler  # -175KB gzipped
```
+ `prefers-reduced-motion` globalno CSS pravilo (primenjeno u mockupu)
+ `Cell.module.css` dead keyframes (`.spinning`, `.snapping`, `.win`) — **~140 linija dead code**
+ PARTICLE_COUNT: 90 desktop / 40 mobile (via `matchMedia('(pointer:coarse)')`)
+ Pre-render coin/chip/dice na OffscreenCanvas jednom, `drawImage` per frame

---

## 5. MOCKUP V2 — ŠTA SAM IMPLEMENTIRAO

**Ruta:** `?mockup=v2` — `src/mockup/MockupV2.tsx` + `.module.css`

### Rešeni problemi (iz gornjih sekcija)
- ✅ 100dvh fullscreen fit, safe-area inset
- ✅ Fluid clamp minimumi ≥11px (body 13–16px)
- ✅ Single-accent gold (nema glow spam)
- ✅ Rajdhani (display) + Inter (body) + JetBrains Mono (meta)
- ✅ Persistent identity: **BOJAN PETKOVIĆ · Audio Director · Sound Designer · Composer**
- ✅ Tagline uvek vidljiv: `iGAMING AUDIO · 8 YEARS · 50+ CERTIFIED TITLES`
- ✅ 5 sekcija × direktna kartica (nema 3.7s gating)
- ✅ URL hash sync (`#/projects`)
- ✅ Email, LinkedIn, GitHub kao pravi linkovi (`mailto:`, `https://`)
- ✅ Top bar **Email** + **Hire** dugmad (uvek 1 klik)
- ✅ Strip thumbnails svih stavki u sekciji (1-click jump)
- ✅ 48px min tap targets svuda, haptic feedback na swipe
- ✅ `prefers-reduced-motion` respect
- ✅ Keyboard: ← → za stavke, ↑ ↓ za sekcije
- ✅ Landscape compact layout
- ✅ Escape iz body flex-center + slot background

### Gde još ima prostora (nije u mockup-u, ali lista za sledeće)
- [ ] Dodati `year` / `role` / `heroImg` / `audioUrl` / `liveUrl` u `ProjectItem`
- [ ] HTML5 `<audio>` inline plejer u kartici
- [ ] OG meta tagovi per-project za LinkedIn/Twitter preview
- [ ] `react-snap` za prerender svakog hash route-a → SEO
- [ ] Ubrzati original slot za one koji žele show (2.1s pipeline umesto 3.7s)
- [ ] Single motion toggle u settings — `localStorage['motion']` persist
- [ ] Ukloniti 175KB dead dependencies

---

## 6. PRIORITETNA ROADMAP

| Prioritet | Task | Effort | Impact |
|-----------|------|--------|--------|
| 🔴 P0 | Deploy `?mockup=v2` kao default + redirect `/` | 10min | Odmah profi UX |
| 🔴 P0 | Dodati `heroImg + audioUrl + liveUrl` u PROJECTS data | 2h | Credibility × 5 |
| 🔴 P0 | HTML5 audio player inline u karticama | 3h | Audio designer bez audio = nula |
| 🟡 P1 | `npm uninstall framer-motion tone howler` | 5min | −175KB bundle |
| 🟡 P1 | `prefers-reduced-motion` + motion toggle UI | 1h | Accessibility |
| 🟡 P1 | OG meta + react-snap per hash route | 4h | SEO |
| 🟢 P2 | Zadržati originalni slot kao `?show=1` easter egg | 30min | Best of both worlds |

---

## Screenshots (mockup)

Svi prikazi u `/tmp/portfolio-mockup/`:

| Device | Viewport | File |
|--------|----------|------|
| iPhone SE | 375×667 | `mobile-iphoneSE-01-projects.png` |
| iPhone 14 | 390×844 | `mobile-iphone14-*.png` |
| Pixel 7 | 412×915 | `mobile-pixel7-*.png` |
| iPad | 810×1080 | `tablet-ipad-*.png` |
| Desktop | 1440×900, 1920×1080 | `desktop-*-*.png` |

Po uređaju 6 prikaza: projects, skills, about, career, contact, projects-nav.
