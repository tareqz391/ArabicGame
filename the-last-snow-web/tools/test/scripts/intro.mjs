// New game -> intro cutscene -> photo -> arrival
export default async ({ page, shot, log }) => {
  await page.locator('.menu button[data-act="new"]').click();
  const marks = [[3, '01_title'], [9, '02_asleep'], [16, '03_wake'], [24, '04_empty']];
  let t = 0;
  for (const [at, name] of marks) { await page.waitForTimeout((at - t) * 1000); t = at; await shot(name); }
  // wait for the photo, flip it, close it
  await page.waitForSelector('.photo:not(.hidden)', { timeout: 60000 });
  await page.waitForTimeout(1200); await shot('05_photo');
  await page.locator('.photo').click(); await page.waitForTimeout(1500); await shot('06_photo_back');
  await page.locator('.photo').click();
  await page.waitForFunction(() => window.__game && !window.__game.cutscene, null, { timeout: 90000 });
  await page.waitForTimeout(800);
  await shot('07_door_open');
  const st = await page.evaluate(() => ({ p: window.__game.player.pos.toArray().map((v) => +v.toFixed(2)), flags: [...window.__game.level ? [] : []] }));
  log(JSON.stringify(st));
};
