import { chromium, devices } from 'playwright';
import fs from 'fs';

const OUT = '/tmp/portfolio-audit';
fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: 'mobile-iphone14', device: devices['iPhone 14'] },
  { name: 'mobile-pixel7',   device: devices['Pixel 7'] },
  { name: 'tablet-ipad',     device: devices['iPad (gen 7)'] },
  { name: 'desktop-1440',    viewport: { width: 1440, height: 900 }, userAgent: undefined },
  { name: 'desktop-1920',    viewport: { width: 1920, height: 1080 }, userAgent: undefined },
];

const browser = await chromium.launch();

for (const v of viewports) {
  const ctx = v.device
    ? await browser.newContext({ ...v.device })
    : await browser.newContext({ viewport: v.viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  try {
    await page.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('load').catch(() => {});
  } catch (e) {
    console.log(`[${v.name}] goto failed: ${e.message}`);
    await ctx.close();
    continue;
  }

  // 1) boot screen
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${v.name}-01-boot.png`, fullPage: false });

  // 2) wait for loadingDone (progress finishes ~2400ms), then tap to unlock
  await page.waitForTimeout(3000);
  const tap = await page.$('button').catch(() => null);
  if (tap) await tap.click().catch(() => {});
  await page.waitForTimeout(1200); // boot exit anim
  await page.waitForTimeout(3200); // splash GSAP 5-step timeline

  // 3) splash
  await page.screenshot({ path: `${OUT}/${v.name}-02-splash.png`, fullPage: false });

  // 4) enter slot
  const enter = await page.$('button');
  if (enter) await enter.click().catch(() => {});
  await page.waitForTimeout(2500); // transition

  // 5) slot idle
  await page.screenshot({ path: `${OUT}/${v.name}-03-slot-idle.png`, fullPage: false });

  // 6) spin by pressing Space
  await page.keyboard.press('Space').catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${v.name}-04-slot-spinning.png`, fullPage: false });

  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${v.name}-05-slot-landed.png`, fullPage: false });

  // 7) section change
  await page.keyboard.press('ArrowRight').catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${v.name}-06-section-2.png`, fullPage: false });

  await page.keyboard.press('ArrowRight').catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${v.name}-07-section-3.png`, fullPage: false });

  // 8) Audio Manager Shift+A
  await page.keyboard.press('Shift+A').catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${v.name}-08-audio-mgr.png`, fullPage: false });

  // dump dimensions + key metrics
  const metrics = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { w: r.width, h: r.height, x: r.x, y: r.y, fontSize: cs.fontSize, fontFamily: cs.fontFamily };
    };
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      dpr: window.devicePixelRatio,
      body: pick('body'),
      machine: pick('[class*="machine"]'),
      header: pick('[class*="header"]'),
      spinBtn: pick('[class*="btn"][class*="SpinButton"], [class*="spin"]'),
      reel: pick('[class*="reelsZone"]'),
      tabBar: pick('[class*="tabBar"]'),
      cellCount: document.querySelectorAll('[class*="Cell_cell"], [class*="cell"]').length,
    };
  });
  fs.writeFileSync(`${OUT}/${v.name}-metrics.json`, JSON.stringify(metrics, null, 2));

  if (errors.length) fs.writeFileSync(`${OUT}/${v.name}-errors.txt`, errors.join('\n'));

  console.log(`[${v.name}] done — vw=${metrics.vw} vh=${metrics.vh} cells=${metrics.cellCount} errors=${errors.length}`);
  await ctx.close();
}

await browser.close();
console.log('ALL DONE:', OUT);
