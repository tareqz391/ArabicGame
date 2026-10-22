// Converts a .glb into glTF JSON (saved as .json) + external image files.
// Geometry/animation buffers are embedded as a base64 data URI, textures stay as .webp/.png
// files, so every file is a common web type (needed by hosts that refuse .glb/.bin).
// Usage: node tools/glb_to_gltf.mjs in.glb outDir baseName
import fs from 'fs';
import path from 'path';

export function convert(inFile, outDir, base) {
  const buf = fs.readFileSync(inFile);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB: ' + inFile);
  let off = 12, json = null, bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len;
  }
  const imageViews = new Set();
  (json.images || []).forEach((img, i) => {
    if (img.bufferView === undefined) return;
    const bv = json.bufferViews[img.bufferView];
    const bytes = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    const ext = img.mimeType === 'image/webp' ? 'webp' : img.mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const name = `${base}_tex${i}.${ext}`;
    fs.writeFileSync(path.join(outDir, name), bytes);
    imageViews.add(img.bufferView);
    img.uri = name;
    delete img.bufferView;
    delete img.mimeType;
  });
  // rebuild the binary buffer without the image bytes, remapping bufferView indices
  const keep = [], remap = {};
  const parts = [];
  let size = 0;
  json.bufferViews.forEach((bv, i) => {
    if (imageViews.has(i)) return;
    const bytes = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    const pad = (4 - (size % 4)) % 4;
    if (pad) { parts.push(Buffer.alloc(pad)); size += pad; }
    remap[i] = keep.length;
    keep.push(Object.assign({}, bv, { byteOffset: size, buffer: 0 }));
    parts.push(bytes);
    size += bytes.length;
  });
  json.bufferViews = keep;
  for (const a of json.accessors || []) if (a.bufferView !== undefined) a.bufferView = remap[a.bufferView];
  for (const a of json.accessors || []) if (a.sparse) { a.sparse.indices.bufferView = remap[a.sparse.indices.bufferView]; a.sparse.values.bufferView = remap[a.sparse.values.bufferView]; }
  const newBin = Buffer.concat(parts);
  json.buffers = [{ byteLength: newBin.length, uri: 'data:application/octet-stream;base64,' + newBin.toString('base64') }];
  const out = path.join(outDir, base + '.json');
  fs.writeFileSync(out, JSON.stringify(json));
  return out;
}

if (process.argv[2]) {
  const out = convert(process.argv[2], process.argv[3], process.argv[4]);
  console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
}
