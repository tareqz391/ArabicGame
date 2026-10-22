// Station puzzle walkthrough from the "platform" checkpoint, using keyboard input + teleports
// (software rendering in CI is too slow to walk the whole platform in real time).
export default async ({ page, shot, log }) => {
  await page.evaluate(() => {
    localStorage.setItem('tls.save.v1', JSON.stringify({ v: 1, checkpoint: 'platform', flags: ['intro.done', 'train.arrived', 'left.train'], at: 'test' }));
    sessionStorage.setItem('tls.boot', 'continue');
    location.reload();
  });
  await page.waitForFunction(() => window.__game && window.__game.level, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.locator('.tap-continue').click();
  await page.waitForTimeout(2500);
  await shot('10_platform');
  const tp = (x, y, z, yaw) => page.evaluate(([x, y, z, yaw]) => { window.__game.player.setPosition(x, y, z, yaw); window.__game.cameraRig.snap(); }, [x, y, z, yaw]);
  const key = async (k, ms = 120) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); await page.waitForTimeout(400); };
  const flags = () => page.evaluate(() => window.__flags.all());
  const focus = () => page.evaluate(() => { const f = window.__game.interaction.focus; return f ? f.prompt() : null; });

  // the stopped clock
  await tp(10.6, 0, 2.0, Math.PI); await page.waitForTimeout(1500);
  log('clock focus: ' + await focus()); await key('KeyE'); await page.waitForTimeout(1500); await shot('11_clock');
  // flashlight reveals the chalk arrow
  await tp(-5.6, 0, 0.6, -Math.PI / 2); await key('KeyF'); await page.waitForTimeout(2500); await shot('12_chalk');
  // luggage cart: lift tarp, take battery
  await tp(-12.3, 0, 0.6, Math.PI); await page.waitForTimeout(1200);
  log('cart focus: ' + await focus()); await key('KeyE'); await page.waitForTimeout(1500);
  log('cart focus 2: ' + await focus()); await key('KeyE'); await page.waitForTimeout(2500);
  await shot('13_battery');
  log('flags: ' + (await flags()).join(','));
  // generator: insert + start
  await tp(30.4, 0, 1.0, Math.PI); await page.waitForTimeout(1500);
  log('gen focus: ' + await focus()); await key('KeyE'); await page.waitForTimeout(2500);
  log('gen focus 2: ' + await focus()); await key('KeyE'); await page.waitForTimeout(4000);
  await shot('14_generator');
  log('flags: ' + (await flags()).join(','));
  // crate: grab and push a little with the keyboard, then slide it the rest of the way
  await tp(18.85, 0, -0.08, Math.PI / 2); await page.waitForTimeout(1200);
  log('crate focus: ' + await focus()); await key('KeyE');
  const x0 = await page.evaluate(() => window.__game.level.crate.center.x);
  await key('KeyD', 4000);
  const x1 = await page.evaluate(() => window.__game.level.crate.center.x);
  log(`push moved crate ${x0.toFixed(2)} -> ${x1.toFixed(2)}; grabbing=${await page.evaluate(() => !!window.__game.player.grab)}`);
  await shot('15_push');
  await key('KeyE');
  await page.evaluate(() => { const L = window.__game.level; for (let i = 0; i < 200 && L.crate.center.x < 26.5; i++) L.crate.tryMove(0.05, window.__game.collision); });
  log('crate at ' + (await page.evaluate(() => window.__game.level.crate.center.x)).toFixed(2));
  // climb: stand next to the crate and jump (mantle)
  await tp(25.6, 0, -0.08, Math.PI / 2); await page.waitForTimeout(1000);
  await key('Space'); await page.waitForTimeout(5000);
  log('after mantle y=' + (await page.evaluate(() => window.__game.player.pos.y)).toFixed(2));
  await shot('16_on_crate');
  log('panel focus: ' + await focus()); await key('KeyE');
  await page.waitForTimeout(4000); await shot('17_power');
  await page.waitForFunction(() => !window.__game.cutscene, null, { timeout: 120000 });
  log('flags: ' + (await flags()).join(','));
  await shot('18_gate_open');
  // through the gate
  await tp(37.4, 0, -6, Math.PI); await page.waitForTimeout(4000); await shot('19_road');
  await tp(37.4, 0, -15, Math.PI); await page.waitForTimeout(6000); await shot('20_end');
  log('flags: ' + (await flags()).join(','));
};
