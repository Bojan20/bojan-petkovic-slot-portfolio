/**
 * Promo Reel Generator — Configuration
 *
 * Owner: Bojan Petković (VanVinkl Studio)
 * Purpose: Generate cinematic recruiter-targeted promo reel from slot game capture.
 *
 * Brand identity:
 *   - Three-Note Oath: G-C-E sub-bass + coin shimmer (~390ms signature)
 *   - Tagline: "Where The Reels Meet The Score."
 *   - Colors: gold #FFD700 / cyan #00E5FF / magenta #FF00AA / void #060814
 *   - Typography: Rajdhani (titles), Inter (body), JetBrains Mono (tech)
 */

export const BRAND = {
  name: 'Bojan Petković',
  monogram: 'VV',
  tagline: 'Where The Reels Meet The Score.',
  role: 'Senior Audio Director · iGaming',
  metrics: {
    years: '8+',
    titles: '50+',
    sfx: '200+',
    defects: '0',
  },
  contact: {
    email: 'bojan@vanvinkl.com',
    linkedin: 'linkedin.com/in/vanvinkl',
    portfolio: 'bojanpetkovic.audio',
  },
  colors: {
    gold: '#FFD700',
    cyan: '#00E5FF',
    magenta: '#FF00AA',
    void: '#060814',
    voidLight: '#0E1124',
    text: '#F5F5FA',
    textDim: '#9AA0B4',
  },
  fonts: {
    title: 'Rajdhani',
    body: 'Inter',
    mono: 'JetBrains Mono',
  },
};

export const FORMATS = {
  vertical: {
    label: 'LinkedIn / IG Reels',
    width: 1080,
    height: 1920,
    fps: 30,
    bitrate: '6M',
    duration: 30, // seconds
    suffix: 'vertical-30s',
  },
  landscape: {
    label: 'Portfolio / Website',
    width: 1920,
    height: 1080,
    fps: 30,
    bitrate: '8M',
    duration: 60,
    suffix: 'landscape-60s',
  },
};

export const TIMELINE = {
  // Each segment is in seconds. Sum should match FORMAT.duration.
  vertical: [
    { name: 'cold-open',    duration: 1.5, kind: 'oath-hit' },        // black → 3-note + monogram flash
    { name: 'hero-card',    duration: 2.5, kind: 'name-card' },       // BOJAN PETKOVIĆ + tagline
    { name: 'metrics',      duration: 3.0, kind: 'metric-stack' },    // 50+ / 200+ / 0 / 8+
    { name: 'gameplay',     duration: 12,  kind: 'capture-hilights' },// real slot capture, 4 cuts
    { name: 'projects',     duration: 6,   kind: 'project-grid' },    // 8 game tiles cycle
    { name: 'cta',          duration: 5,   kind: 'cta-card' },        // contact + book a call
  ],
  landscape: [
    { name: 'cold-open',    duration: 2,   kind: 'oath-hit' },
    { name: 'hero-card',    duration: 3,   kind: 'name-card' },
    { name: 'metrics',      duration: 4,   kind: 'metric-stack' },
    { name: 'about',        duration: 5,   kind: 'about-strip' },
    { name: 'gameplay-1',   duration: 8,   kind: 'capture-hilights' },
    { name: 'projects',     duration: 10,  kind: 'project-grid' },
    { name: 'gameplay-2',   duration: 8,   kind: 'capture-hilights' },
    { name: 'skills',       duration: 8,   kind: 'skill-stack' },
    { name: 'career',       duration: 6,   kind: 'career-timeline' },
    { name: 'cta',          duration: 6,   kind: 'cta-card' },
  ],
};

export const CAPTURE = {
  // Default target: slotcatalog Cash Eruption Western page
  targetUrl: 'https://slotcatalog.com/en/slots/cash-eruption-the-western',
  alternateUrls: [
    'https://slotcatalog.com/en/slots/cash-eruption',
    'https://slotcatalog.com/en/IGT-slots',
  ],
  recordSeconds: 25,    // raw capture length
  viewport: { width: 1280, height: 720 },
  outputPath: 'captures/raw-gameplay.webm',
  // We accept that slot demos are RNG-driven; we capture conservative window
  // and the compose step will pick highlights via audio peak / motion delta.
  // If capture fails (geo block, paywall) we fall back to portfolio mockups.
  fallbackToMockup: true,
  mockupUrl: null, // set at runtime to local file://...
};

export const PROJECTS = [
  { name: 'PIGGY PLUNGER',     studio: 'Playnetic · 2025', color: '#ff69b4', ico: 'PIG' },
  { name: 'SMASH FACTORY',     studio: 'Playnetic · 2025', color: '#ff8c00', ico: 'SMASH' },
  { name: 'STARLIGHT TRAVELERS', studio: 'Playnetic · 2025', color: '#6a5acd', ico: 'STAR' },
  { name: 'VALKYRIES',         studio: 'Playnetic · 2025', color: '#dc143c', ico: 'V' },
  { name: 'ZHULONGS',          studio: 'IGT · 2023',       color: '#00c853', ico: 'ZHU' },
  { name: 'MIDNIGHT GOLD',     studio: 'VanVinkl · 2024',  color: '#1e90ff', ico: 'MG' },
  { name: "BLAZIN'S HOT",      studio: 'IGT · 2022',       color: '#ff4500', ico: 'BH' },
  { name: 'MUMMY RICHES',      studio: 'Playnetic · 2024', color: '#daa520', ico: 'MR' },
  { name: 'CASH ERUPTION WESTERN', studio: 'IGT · 2023',   color: '#c4a062', ico: 'CE' },
];

export const SKILLS = [
  { name: 'MUSIC PRODUCTION',  level: 'EXPERT',   color: '#ffd700' },
  { name: 'SOUND DESIGN',      level: 'EXPERT',   color: '#00e5ff' },
  { name: 'AUDIO INTEGRATION', level: 'ADVANCED', color: '#00ff88' },
  { name: 'AUDIO DIRECTION',   level: 'ADVANCED', color: '#ff00aa' },
  { name: 'AUDIO QA',          level: 'EXPERT',   color: '#9944ff' },
  { name: 'SLOT SPECIALIZATION', level: 'EXPERT', color: '#ff6600' },
];

export const CAREER = [
  { company: 'VANVINKL',  period: '2024 → Now',  role: 'Founder · Audio Director' },
  { company: 'PLAYNETIC', period: '2024 → 2026', role: 'Audio Producer · Lead Sound' },
  { company: 'IGT',       period: '2020 → 2024', role: 'Senior Sound Designer' },
  { company: 'FREELANCE', period: '2018 → 2020', role: 'Independent Audio Contractor' },
];
