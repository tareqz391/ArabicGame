// Turns dist/index.html into a body-only page for claude.ai Artifact hosting
// (the host adds the <html>/<head> skeleton) and lists the files to publish with it.
import fs from 'fs';
import path from 'path';
import { convert } from './glb_to_gltf.mjs';
const dist = path.resolve('dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const css = html.match(/href="\.\/(assets\/[^"]+\.css)"/)[1];
const js = html.match(/src="\.\/(assets\/[^"]+\.js)"/)[1];
const page = `<title>The Last Snow</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#0c1322">
<link rel="stylesheet" href="./${css}">
<style>:root{color-scheme:dark;background:#0c1322}html,body{height:100%;background:#0c1322;color:#e9eef8}</style>
<div id="app"></div>
<div id="ui"></div>
<script type="module" src="./${js}"></script>
`;
fs.writeFileSync(path.join(dist, 'page.html'), page);
// GLB -> glTF JSON + .webp textures (artifact hosting serves only common web types)
const models = path.join(dist, 'models');
for (const f of fs.readdirSync(models)) {
  if (!f.endsWith('.glb')) continue;
  convert(path.join(models, f), models, f.replace('.glb', ''));
  fs.unlinkSync(path.join(models, f));
}
const files = {};
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else { const rel = path.relative(dist, p); if (!['index.html', 'page.html'].includes(rel)) files[rel] = path.join('dist', rel); } } };
walk(dist);
fs.writeFileSync(path.join(dist, 'files.json'), JSON.stringify(files, null, 1));
console.log(JSON.stringify(files, null, 1));
