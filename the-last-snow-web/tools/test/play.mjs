// Automated smoke test: loads the game in a landscape phone viewport (touch enabled) and runs
// a scripted scenario from tools/test/scripts/<name>.mjs, saving screenshots.
// Usage: node tools/test/play.mjs <url> <outDir> <scenario>
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || '/tmp/shots';
const script = process.argv[4] || 'menu';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() !== 'debug') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
await page.goto(base + (base.includes('?') ? '&' : '?') + 'dtmax=0.25');
try {
  await page.waitForFunction(() => window.__game && window.__game.level, null, { timeout: 180000 });
} catch (e) {
  console.log('LOAD FAILED');
  await page.screenshot({ path: `${out}/load_fail.png` });
  console.log(logs.join('\n'));
  process.exit(1);
}
await page.waitForTimeout(2500);
const shot = async (n) => { await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
const fps = async () => page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
const steps = (await import(`./scripts/${script}.mjs`)).default;
try {
  await steps({ page, shot, fps, log: (s) => console.log(s) });
} catch (e) { console.log('SCENARIO ERROR', e.message); await shot('scenario_error'); }
console.log(logs.filter((l) => !l.includes('[vite]')).join('\n'));
await browser.close();
