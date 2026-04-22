import { chromium, devices } from 'playwright';
import fs from 'fs';

const OUT = '/tmp/portfolio-mockup';
fs.mkdirSync(OUT, { recursive: true });

const URL = 'http://localhost:5180/?mockup=v2';

const shots = [
  { name: 'mobile-iphone14', device: devices['iPhone 14'] },
  { name: 'mobile-iphoneSE', viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true },
  { name: 'mobile-pixel7',   device: devices['Pixel 7'] },
  { name: 'tablet-ipad',     device: devices['iPad (gen 7)'] },
  { name: 'desktop-1440',    viewport: { width: 1440, height: 900 } },
  { name: 'desktop-1920',    viewport: { width: 1920, height: 1080 } },
];

const browser = await chromium.launch();

for (const s of shots) {
  const ctx = s.device
    ? await browser.newContext({ ...s.device })
    : await browser.newContext({ viewport: s.viewport, isMobile: s.isMobile, hasTouch: s.hasTouch });
  const page = await ctx.newPage();
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForSelector('article', { timeout: 5000 });
    await page.waitForTimeout(300);

    // PROJECTS default
    await page.screenshot({ path: `${OUT}/${s.name}-01-projects.png` });

    // SKILLS tab
    await page.click('[role="tab"]:nth-of-type(2)').catch(()=>{});
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${s.name}-02-skills.png` });

    // ABOUT tab
    await page.click('[role="tab"]:nth-of-type(3)').catch(()=>{});
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${s.name}-03-about.png` });

    // CAREER
    await page.click('[role="tab"]:nth-of-type(4)').catch(()=>{});
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${s.name}-04-career.png` });

    // CONTACT
    await page.click('[role="tab"]:nth-of-type(5)').catch(()=>{});
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${s.name}-05-contact.png` });

    // back to projects, navigate next item
    await page.click('[role="tab"]:nth-of-type(1)').catch(()=>{});
    await page.waitForTimeout(250);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/${s.name}-06-projects-nav.png` });

    console.log(`[${s.name}] OK`);
  } catch (e) {
    console.log(`[${s.name}] FAIL: ${e.message}`);
  }
  await ctx.close();
}
await browser.close();
console.log('DONE:', OUT);
