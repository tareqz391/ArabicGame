import { Assets } from './engine/Assets.js';
import { Game } from './game/Game.js';
import { StationLevel } from './levels/Station.js';
import { UI } from './ui/UI.js';
import { Flags, Save, Settings } from './game/State.js';
import { setLang, getLang, t } from './game/i18n.js';
import { sound } from './game/Sound.js';
import * as THREE from 'three';

const QUALITIES = ['auto', 'low', 'medium', 'high'];

async function boot() {
  setLang(Settings.get().lang);
  const ui = new UI(document.getElementById('ui'));
  const assets = new Assets();
  await document.fonts.load('40px Amiri').catch(() => {});
  await assets.loadAll(['station', 'nature', 'train_car', 'adam'], (p) => ui.setProgress(p));

  const bootMode = sessionStorage.getItem('tls.boot');
  sessionStorage.removeItem('tls.boot');
  const save = Save.read();
  if (bootMode === 'continue' && save) Flags.load(save.flags);
  else Flags.reset();

  const game = new Game(ui, assets, document.getElementById('app'));
  const level = new StationLevel(game);
  window.__game = game; // debugging / automated tests
  window.__flags = Flags;
  game.start(level);
  ui.hideLoading();

  const enterFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
    }
  };

  const spawnAt = (cp) => {
    const s = level.spawnFor(cp);
    game.player.setPosition(s.x, s.y, s.z, s.yaw);
    game.lastCheckpoint = cp;
    game.cameraRig.snap();
  };

  const resumeAmbience = () => {
    sound.loop('wind', Flags.has('left.train') ? 0.42 : 0.25, 2, { buffer: 'wind' });
  };

  const startPlaying = () => {
    ui.show(ui.menu, false);
    game.input.enabled = true;
    game.player.locked = false;
    game.player.releaseScripted();
    game.cameraRig.clearShot(0);
    game.cameraRig.snap();
    level.trainMoving = false;
    ui.fadeTo(1, 0);
    ui.fadeTo(0, 1.4);
    const obj = !Flags.has('left.train') ? 'obj.leave' : Flags.has('power.on') ? 'obj.exit' : Flags.has('gen.on') ? 'obj.panel' : Flags.has('battery.taken') ? 'obj.generator' : 'obj.exit';
    ui.setObjective(obj);
  };

  if (bootMode === 'continue' && save) {
    // respawn after being caught / freezing: wait for a tap so audio may start
    level._restoreFromFlags();
    spawnAt(save.checkpoint);
    game.input.enabled = false;
    ui.fadeTo(1, 0);
    const tap = document.createElement('div');
    tap.className = 'tap-continue';
    tap.textContent = t('menu.tap');
    document.getElementById('ui').appendChild(tap);
    tap.addEventListener('pointerdown', () => { tap.remove(); sound.init(); resumeAmbience(); startPlaying(); }, { once: true });
  } else {
    // main menu over a slow shot of the night train
    level.trainMoving = true;
    game.player.locked = true;
    game.input.enabled = false;
    game.player.setPosition(0.62, 0.14, -4.86, Math.PI / 2);
    game.player.playScripted('SitSleep', { loop: true, fade: 0 });
    game.cameraRig.setShot({ pos: new THREE.Vector3(-2.2, 2.4, 8.5), look: new THREE.Vector3(1.5, 1.4, -4), fov: 42, drift: 0.8 }, 0);
    ui.show(ui.hud, false);
    ui.show(ui.menu, true);
  }

  const mb = ui.menuButtons;
  mb.continue.style.display = save ? '' : 'none';
  const qLabel = () => { mb.quality.textContent = `${t('menu.quality')}: ${t('q.' + Settings.get().quality)}`; };
  qLabel();
  mb.new.onclick = () => {
    sound.init();
    enterFullscreen();
    Save.wipe();
    Flags.reset();
    ui.show(ui.menu, false);
    ui.show(ui.hud, true);
    level.intro();
  };
  mb.continue.onclick = () => {
    const s = Save.read();
    if (!s) return;
    sound.init();
    enterFullscreen();
    Flags.load(s.flags);
    level._restoreFromFlags();
    spawnAt(s.checkpoint);
    ui.show(ui.hud, true);
    resumeAmbience();
    startPlaying();
  };
  mb.lang.onclick = () => { setLang(getLang() === 'ar' ? 'en' : 'ar'); qLabel(); fpsLabel(); };
  mb.quality.onclick = () => {
    const q = QUALITIES[(QUALITIES.indexOf(Settings.get().quality) + 1) % QUALITIES.length];
    Settings.set('quality', q);
    game.renderer.applyQuality(q);
    qLabel();
  };
  const pbtn = ui.pauseButtons;
  const fpsLabel = () => { pbtn.fps.textContent = `${t('pause.fps')}: ${Settings.get().fps60 ? 60 : 30} FPS`; };
  fpsLabel();
  pbtn.resume.onclick = () => game.setPaused(false);
  pbtn.fps.onclick = () => { Settings.set('fps60', !Settings.get().fps60); fpsLabel(); };
  pbtn.lang.onclick = () => { setLang(getLang() === 'ar' ? 'en' : 'ar'); qLabel(); fpsLabel(); };
  pbtn.menu.onclick = () => location.reload();
  ui.endButton.onclick = () => location.reload();
  document.addEventListener('visibilitychange', () => { if (document.hidden && ui.menu.classList.contains('hidden')) game.setPaused(true); });
}

boot().catch((e) => {
  console.error(e);
  const d = document.createElement('pre');
  d.style.cssText = 'position:fixed;inset:0;color:#fff;background:#200;padding:20px;white-space:pre-wrap;z-index:99';
  d.textContent = 'Error: ' + (e && e.stack || e);
  document.body.appendChild(d);
});
