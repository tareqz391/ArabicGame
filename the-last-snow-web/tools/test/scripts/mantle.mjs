export default async ({ page, shot, log }) => {
  await page.locator('.menu button[data-act="continue"]').count();
  const r = await page.evaluate(() => {
    const g = window.__game, L = g.level;
    for (let i = 0; i < 200 && L.crate.center.x < 26.5; i++) L.crate.tryMove(0.05, g.collision);
    g.player.locked = false; g.player.releaseScripted(); g.input.enabled = true;
    g.player.setPosition(25.2, 0, -1.16, Math.PI / 2);
    const p = g.player;
    const f = p.facingDir();
    const ledge = g.collision.findLedge(p.body, f.x, f.z, 0.55, 1.55);
    return { crate: [L.crate.box.min.x, L.crate.box.max.x, L.crate.box.min.z, L.crate.box.max.z, L.crate.box.max.y], f, ledge: ledge && [ledge.x, ledge.y, ledge.z], scripted: p.scripted, locked: p.locked };
  });
  log(JSON.stringify(r));
  await page.keyboard.down('Space'); await page.waitForTimeout(150); await page.keyboard.up('Space');
  await page.waitForTimeout(4000);
  log('y=' + await page.evaluate(() => window.__game.player.pos.y));
  await shot('mantle');
};
