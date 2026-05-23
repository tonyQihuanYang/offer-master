// Automated demo recording (Playwright).
//
// Drives the running demo through the DEMO-SCRIPT.md flow and records a video.
//
// Prereqs (run once):
//   cd demo
//   npm i -D playwright
//   npx playwright install chromium
//
// Then, with the dev server running (`npm run dev`):
//   node scripts/record-demo.mjs
//   # → demo/recordings/demo.webm
//
// Options (env vars):
//   BASE_URL=http://localhost:5173   # Vite URL (use 5174 if that's what Vite picked)
//   HEADLESS=true                    # record without opening a visible window
//   SLOWMO=350                       # ms between actions (higher = calmer video)

import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const HEADLESS = process.env.HEADLESS === 'true';
const SLOWMO = Number(process.env.SLOWMO || 350);
const OUT = 'recordings';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Fail early with a friendly message if the dev server isn't up.
try {
  const res = await fetch(`${BASE}/api/tenants`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
} catch (e) {
  console.error(`\n✗ Can't reach the demo at ${BASE} (${e.message}).`);
  console.error('  Start it first:  cd demo && npm run dev');
  console.error('  Or point BASE_URL at the right port (Vite may use 5174).\n');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: HEADLESS, slowMo: SLOWMO });
const context = await browser.newContext({
  viewport: { width: 1280, height: 820 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 820 } },
  deviceScaleFactor: 2, // crisper video
});
const page = await context.newPage();
const video = page.video();

// Wait until the "⚡ Dispatch offer" button is enabled (SSE stream connected).
async function waitDispatchReady() {
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Dispatch offer/i.test(x.textContent || ''));
    return b && !b.disabled;
  }, null, { timeout: 10000 });
}

try {
  // ───────────── Segment 1: Admin — server-driven layout + save toast ─────────────
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await pause(1200);

  // tenant = CA (the select that lists country options)
  const tenantSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'CH' }) }).first();
  await tenantSelect.selectOption('CA');
  await pause(900);

  // edit the treatment variant
  await page.getByRole('button', { name: /treatment/i }).first().click();
  await pause(900);

  // change earnings model -> surge (the select that lists earnings models)
  const modelSelect = page
    .locator('select')
    .filter({ has: page.locator('option', { hasText: 'tips_prediction' }) })
    .first();
  await modelSelect.selectOption('surge');
  await pause(1400); // let the live preview redraw

  // save -> success toast
  await page.getByRole('button', { name: 'Save config' }).click();
  await page.getByText(/Config saved/i).waitFor({ timeout: 5000 });
  await pause(2000);

  // ───────────── Segment 2: Client — sticky A/B + SSE push ─────────────
  await page.goto(`${BASE}/client`, { waitUntil: 'domcontentloaded' });
  await pause(1000);

  const courier = page.locator('input[type="text"]').first();
  const dispatchBtn = page.getByRole('button', { name: /Dispatch offer/i });

  // courier c123 -> dispatch -> control
  await courier.fill('c123');
  await pause(800);
  await waitDispatchReady();
  await dispatchBtn.click();
  await page.locator('.phone-screen .offer').waitFor({ timeout: 5000 });
  await pause(2200);

  // courier c999 -> dispatch -> treatment (now rendered as surge)
  await courier.fill('c999');
  await page.locator('.phone-screen .waiting').waitFor({ timeout: 5000 }); // payload resets on courier change
  await pause(900);
  await waitDispatchReady();
  await dispatchBtn.click();
  await page.locator('.phone-screen .offer').waitFor({ timeout: 5000 });
  await pause(2600);
} finally {
  await context.close(); // finalizes the video file
  const src = await video.path();
  const dest = `${OUT}/demo.webm`;
  try {
    renameSync(src, dest);
    console.log(`\n✓ Saved video to demo/${dest}`);
    console.log('  Convert to mp4 if needed:  ffmpeg -i demo/recordings/demo.webm demo/recordings/demo.mp4\n');
  } catch {
    console.log(`\n✓ Saved video to demo/${src}\n`);
  }
  await browser.close();
}
