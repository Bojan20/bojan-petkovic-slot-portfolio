/**
 * Capture Stage
 *
 * Strategy (resilient by design):
 *   1. PRIMARY:  open the slotcatalog target in a real Chromium context,
 *               record the page video for `recordSeconds`, dump WebM.
 *   2. FALLBACK: if the page errors / is geo-blocked / paywalled, we
 *               render the local mockup `mockups/promo-reel.html` and
 *               capture *that* — slot animation runs there. Pipeline
 *               keeps shipping no matter the network.
 *
 * Output: captures/raw-gameplay.webm  (always exists after a successful run)
 * Side-effects: NONE (no network beyond Chromium + slotcatalog).
 *
 * Why WebM and not MP4 at this stage: Playwright's BrowserContext
 * `recordVideo` natively writes WebM (VP8/VP9). We let ffmpeg transcode
 * down the line — single re-encode keeps quality high.
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync, readdirSync, renameSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPTURE, BRAND } from './config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const VIDEOS_DIR = resolve(ROOT, 'captures', '_videos');
const FALLBACK_HTML = resolve(ROOT, '..', '..', 'mockups', 'promo-reel.html');

/**
 * Record a page for N seconds. Saves WebM + small JSON sidecar with
 * the exact recorded duration.
 */
async function recordPage(url, { seconds, viewport, mode }) {
  if (existsSync(VIDEOS_DIR)) rmSync(VIDEOS_DIR, { recursive: true });
  mkdirSync(VIDEOS_DIR, { recursive: true });

  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({
    viewport,
    recordVideo: { dir: VIDEOS_DIR, size: viewport },
    locale: 'en-US',
    timezoneId: 'Europe/Belgrade',
  });
  const page = await ctx.newPage();

  const startedAt = Date.now();
  let success = false;
  try {
    if (mode === 'remote') {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
      // Try to dismiss cookie / GDPR if present (best-effort, never throws).
      await page.waitForTimeout(1500);
      const consentSelectors = [
        'button:has-text("Accept")',
        'button:has-text("I Agree")',
        'button:has-text("Got it")',
        '#onetrust-accept-btn-handler',
        '.cmp-button-accept',
      ];
      for (const sel of consentSelectors) {
        const btn = await page.$(sel);
        if (btn) { await btn.click().catch(() => {}); break; }
      }
      // Dismiss any "play demo" overlays (slotcatalog has these on game pages).
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
    } else {
      await page.goto(url, { waitUntil: 'load' });
    }
    // Hold the recording window open.
    await page.waitForTimeout(seconds * 1000);
    success = true;
  } catch (err) {
    console.warn(`  ⚠ Capture from ${url} failed: ${err.message}`);
  } finally {
    await ctx.close();
    await browser.close();
  }

  const elapsedMs = Date.now() - startedAt;
  // Find the produced webm file.
  const files = readdirSync(VIDEOS_DIR).filter((f) => f.endsWith('.webm'));
  if (!files.length) return { success: false, durationMs: elapsedMs };
  const src = join(VIDEOS_DIR, files[0]);
  return {
    success,
    durationMs: elapsedMs,
    path: src,
    sizeBytes: statSync(src).size,
  };
}

/**
 * Move the captured WebM into its canonical place + emit metadata.
 */
function finalize(srcPath, mode, sourceUrl) {
  const dest = resolve(ROOT, CAPTURE.outputPath);
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) rmSync(dest);
  renameSync(srcPath, dest);
  const meta = {
    capturedAt: new Date().toISOString(),
    mode, // 'remote' | 'fallback'
    sourceUrl,
    sizeBytes: statSync(dest).size,
    viewport: CAPTURE.viewport,
  };
  writeFileSync(dest + '.json', JSON.stringify(meta, null, 2));
  return dest;
}

export async function capture() {
  console.log(`▸ Capturing gameplay (target: ${CAPTURE.targetUrl})`);

  // 1. PRIMARY — slotcatalog
  const remote = await recordPage(CAPTURE.targetUrl, {
    seconds: CAPTURE.recordSeconds,
    viewport: CAPTURE.viewport,
    mode: 'remote',
  });

  if (remote.success && remote.path && remote.sizeBytes > 100_000) {
    const dest = finalize(remote.path, 'remote', CAPTURE.targetUrl);
    console.log(`  ✓ Remote capture saved: ${basename(dest)} (${(remote.sizeBytes / 1024 / 1024).toFixed(1)} MB)`);
    return dest;
  }

  // 2. FALLBACK — local mockup
  if (!CAPTURE.fallbackToMockup) {
    throw new Error('Remote capture failed and fallback disabled.');
  }
  if (!existsSync(FALLBACK_HTML)) {
    throw new Error(`Fallback mockup not found at ${FALLBACK_HTML}`);
  }
  console.log(`  ⤺ Falling back to local mockup`);
  const fbUrl = `file://${FALLBACK_HTML}`;
  const local = await recordPage(fbUrl, {
    seconds: CAPTURE.recordSeconds,
    viewport: CAPTURE.viewport,
    mode: 'local',
  });
  if (!local.path) throw new Error('Fallback capture also failed.');
  const dest = finalize(local.path, 'fallback', fbUrl);
  console.log(`  ✓ Fallback capture saved: ${basename(dest)} (${(local.sizeBytes / 1024 / 1024).toFixed(1)} MB)`);
  return dest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  capture().catch((err) => { console.error(err); process.exit(1); });
}
