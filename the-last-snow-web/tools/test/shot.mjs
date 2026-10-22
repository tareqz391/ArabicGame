// Usage: node tools/test/shot.mjs <url> <out.png> [w] [h]
import { chromium } from 'playwright';
const [url, out, w = '1280', h = '720'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', m => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
await page.goto(url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }).catch(e => logs.push('TIMEOUT ' + e.message));
const info = await page.evaluate(() => window.__info || null);
await page.screenshot({ path: out });
console.log(JSON.stringify(info));
console.log(logs.join('\n'));
await browser.close();
