import * as THREE from 'three';

/** Canvas-generated textures (no downloads): snow ground detail, Arabic signage, chalk marks. */
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function snowGroundTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#c9d3e3';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = Math.random() * 2.2;
    const v = 200 + Math.random() * 55;
    g.fillStyle = `rgba(${v - 12},${v - 5},${v},${0.25 + Math.random() * 0.3})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // soft wind ripples
  g.globalAlpha = 0.06;
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = i % 2 ? '#8e9bb3' : '#ffffff';
    g.lineWidth = 6 + Math.random() * 10;
    g.beginPath();
    const y = Math.random() * 512;
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 12);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function textTexture(text, { w = 1024, h = 192, font = 'Amiri', size = 120, color = '#f1e7cf', bg = null, dir = 'rtl' } = {}) {
  const [c, g] = canvas(w, h);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.direction = dir;
  g.font = `${size}px ${font}, serif`;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + size * 0.08);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Chalk arrow + scribbles; only visible in the flashlight beam (see HiddenClue). */
export function chalkTexture() {
  const [c, g] = canvas(512, 256);
  g.strokeStyle = 'rgba(235,240,255,0.95)';
  g.lineCap = 'round';
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(440, 130); g.lineTo(110, 130);
  g.moveTo(170, 70); g.lineTo(100, 130); g.lineTo(170, 190);
  g.stroke();
  g.lineWidth = 5;
  g.font = 'bold 54px Amiri, serif';
  g.fillStyle = 'rgba(235,240,255,0.9)';
  g.fillText('E.', 420, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function footprintTexture() {
  const [c, g] = canvas(64, 128);
  const grd = g.createRadialGradient(32, 40, 2, 32, 40, 26);
  grd.addColorStop(0, 'rgba(60,75,105,0.75)');
  grd.addColorStop(1, 'rgba(60,75,105,0)');
  g.fillStyle = grd;
  g.beginPath(); g.ellipse(32, 42, 18, 30, 0, 0, Math.PI * 2); g.fill();
  const grd2 = g.createRadialGradient(32, 98, 2, 32, 98, 18);
  grd2.addColorStop(0, 'rgba(60,75,105,0.7)');
  grd2.addColorStop(1, 'rgba(60,75,105,0)');
  g.fillStyle = grd2;
  g.beginPath(); g.ellipse(32, 98, 14, 20, 0, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function glowTexture() {
  const [c, g] = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
