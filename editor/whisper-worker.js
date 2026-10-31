/* عامل التعرف على الكلام — يشغّل نموذج Whisper داخل المتصفح (WebGPU أو WASM) */
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';

env.allowLocalModels = false;

// لكل مستوى دقة: نجرب أولاً النسخة التي تدعم توقيت كل كلمة، ثم النسخة العادية
const MODELS = {
  turbo: {
    ids: ['onnx-community/whisper-large-v3-turbo_timestamped', 'onnx-community/whisper-large-v3-turbo'],
    gpu: { encoder_model: 'fp16', decoder_model_merged: 'q4' },
    cpu: { encoder_model: 'q8', decoder_model_merged: 'q8' },
  },
  small: {
    ids: ['onnx-community/whisper-small_timestamped', 'onnx-community/whisper-small'],
    gpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
    cpu: { encoder_model: 'q8', decoder_model_merged: 'q8' },
  },
  base: {
    ids: ['onnx-community/whisper-base_timestamped', 'onnx-community/whisper-base'],
    gpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
    cpu: { encoder_model: 'q8', decoder_model_merged: 'q8' },
  },
};

let asr = null;
let wordLevel = false;

async function detectGPU() {
  try {
    if (!self.navigator || !navigator.gpu) return { gpu: false, f16: false };
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { gpu: false, f16: false };
    return { gpu: true, f16: adapter.features.has('shader-f16') };
  } catch (e) {
    return { gpu: false, f16: false };
  }
}

async function load(modelKey) {
  const spec = MODELS[modelKey] || MODELS.turbo;
  const { gpu, f16 } = await detectGPU();
  const files = new Map();
  const progress_callback = (p) => {
    if (p.status === 'progress' && p.file) {
      files.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 });
      let loaded = 0, total = 0;
      for (const f of files.values()) { loaded += f.loaded; total += f.total; }
      self.postMessage({ type: 'progress', loaded, total });
    }
  };
  // ترتيب المحاولات: أفضل جهاز/دقة أولاً ثم بدائل أبسط
  const attempts = [];
  for (let i = 0; i < spec.ids.length; i++) {
    const id = spec.ids[i];
    const words = i === 0;
    if (gpu) {
      const gpuDtype = modelKey === 'turbo' && !f16 ? null : spec.gpu;
      if (gpuDtype) attempts.push({ id, words, device: 'webgpu', dtype: gpuDtype });
    }
    attempts.push({ id, words, device: 'wasm', dtype: spec.cpu });
    attempts.push({ id, words, device: 'wasm', dtype: 'q8' });
  }
  let lastErr = null;
  for (const a of attempts) {
    try {
      asr = await pipeline('automatic-speech-recognition', a.id, { device: a.device, dtype: a.dtype, progress_callback });
      wordLevel = a.words;
      self.postMessage({ type: 'ready', device: a.device, model: a.id, wordLevel });
      return;
    } catch (e) {
      lastErr = e;
      asr = null;
    }
  }
  throw lastErr || new Error('تعذر تحميل النموذج');
}

async function transcribe(audio, language) {
  const opts = { task: 'transcribe', return_timestamps: wordLevel ? 'word' : true };
  if (language) opts.language = language;
  let out;
  try {
    out = await asr(audio, opts);
  } catch (e) {
    if (!wordLevel) throw e;
    // إذا فشل توقيت الكلمات نرجع لتوقيت الجمل
    out = await asr(audio, { ...opts, return_timestamps: true });
    out.__segments = true;
  }
  const segments = !wordLevel || out.__segments;
  const chunks = (out.chunks || []).map((c) => ({
    text: c.text,
    start: c.timestamp ? c.timestamp[0] : null,
    end: c.timestamp ? c.timestamp[1] : null,
  }));
  return { text: out.text || '', chunks, segments };
}

self.onmessage = async (e) => {
  const d = e.data;
  try {
    if (d.type === 'load') {
      await load(d.model);
    } else if (d.type === 'transcribe') {
      if (!asr) throw new Error('النموذج غير محمّل');
      const r = await transcribe(d.audio, d.language);
      self.postMessage({ type: 'result', id: d.id, ...r });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: d.id, message: (err && err.message) || String(err) });
  }
};
