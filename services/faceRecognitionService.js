import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import * as canvas from 'canvas';

const MODEL_DIR = path.join(process.cwd(), 'public', 'models');
const MODEL_BASE_URL = 'https://cdn.jsdelivr.net/gh/vladmandic/face-api/model';
let modelsLoaded = false;
let faceapi;

const { Canvas, Image, ImageData, loadImage } = canvas;

async function ensureFaceApiLoaded() {
  if (faceapi) return faceapi;
  faceapi = await import('@vladmandic/face-api/dist/face-api.node-wasm.js');
  faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
  return faceapi;
}

async function loadNetFromModelDir(net, modelDir) {
  if (typeof net.loadFromDisk === 'function') {
    await net.loadFromDisk(modelDir);
    return;
  }

  const uri = pathToFileURL(modelDir).href;
  await net.loadFromUri(uri);
}

function validateModelFiles() {
  const requiredManifests = [
    'tiny_face_detector_model-weights_manifest.json',
    'face_landmark_68_model-weights_manifest.json',
    'face_recognition_model-weights_manifest.json',
  ];

  for (const file of requiredManifests) {
    const fullPath = path.join(MODEL_DIR, file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(
        `[FACE-API] Missing model file: ${file}. Place required model files in ${MODEL_DIR}`
      );
    }
  }
}

async function downloadFileIfMissing(relativePath) {
  const localPath = path.join(MODEL_DIR, relativePath);
  if (fs.existsSync(localPath)) return;

  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  const url = `${MODEL_BASE_URL}/${relativePath}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`[FACE-API] Failed to download model file: ${relativePath} (HTTP ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(localPath, Buffer.from(arrayBuffer));
  console.log('[FACE-API] Downloaded model file:', relativePath);
}

async function ensureModelsAvailable() {
  fs.mkdirSync(MODEL_DIR, { recursive: true });

  const manifestFiles = [
    'tiny_face_detector_model-weights_manifest.json',
    'face_landmark_68_model-weights_manifest.json',
    'face_recognition_model-weights_manifest.json',
  ];

  for (const manifestFile of manifestFiles) {
    await downloadFileIfMissing(manifestFile);

    const manifestPath = path.join(MODEL_DIR, manifestFile);
    const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw);

    const shardPaths = Array.isArray(manifest)
      ? manifest.flatMap((entry) => (Array.isArray(entry.paths) ? entry.paths : []))
      : [];

    for (const shardPath of shardPaths) {
      await downloadFileIfMissing(shardPath);
    }
  }
}

export async function loadModels() {
  if (modelsLoaded) return;

  const api = await ensureFaceApiLoaded();
  await ensureModelsAvailable();
  validateModelFiles();

  if (api.tf.getBackend() !== 'wasm') {
    await api.tf.setBackend('wasm');
  }
  await api.tf.ready();

  await Promise.all([
    loadNetFromModelDir(api.nets.tinyFaceDetector, MODEL_DIR),
    loadNetFromModelDir(api.nets.faceLandmark68Net, MODEL_DIR),
    loadNetFromModelDir(api.nets.faceRecognitionNet, MODEL_DIR),
  ]);

  console.log('[FACE-API] Models loaded from:', MODEL_DIR);
  modelsLoaded = true;
}

// inputBuffer: Buffer of an image (PNG/JPEG) from frontend upload/base64
export async function extractEmbeddingFromImageBuffer(inputBuffer) {
  await loadModels();
  const api = await ensureFaceApiLoaded();

  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    throw new Error('[FACE-API] Invalid input image buffer');
  }

  const image = await loadImage(inputBuffer);

  const detection = await api
    .detectSingleFace(image, new api.TinyFaceDetectorOptions({
      inputSize: 512,
      scoreThreshold: 0.45,
    }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection?.descriptor) {
    throw new Error('[FACE-API] No face detected in the provided image');
  }

  const embedding = Array.from(detection.descriptor, (value) => {
    if (!Number.isFinite(value)) return 0;
    return Number(value);
  });

  if (embedding.length !== 128) {
    throw new Error(`[FACE-API] Invalid descriptor length: ${embedding.length}`);
  }

  console.log('[FACE-API] Real embedding generated (length:', embedding.length, ')');
  return embedding;
}

function l2Norm(vector) {
  let sumSq = 0;
  for (let index = 0; index < vector.length; index++) {
    const value = vector[index];
    sumSq += value * value;
  }
  return Math.sqrt(sumSq);
}

function normalizeEmbedding(vector) {
  const norm = l2Norm(vector);
  if (!Number.isFinite(norm) || norm <= 1e-12) {
    return Array(vector.length).fill(0);
  }
  return vector.map((value) => value / norm);
}

export function compareEmbeddings(embA, embB, threshold = 0.6) {
  if (!Array.isArray(embA) || !Array.isArray(embB)) {
    console.warn('[FACE-API] Invalid embeddings: not arrays');
    return { match: false, distance: Infinity };
  }
  if (embA.length !== embB.length) {
    console.warn('[FACE-API] Embedding length mismatch:', embA.length, 'vs', embB.length);
    return { match: false, distance: Infinity };
  }
  if (embA.length !== 128) {
    console.warn('[FACE-API] Expected 128-D embeddings, got:', embA.length);
  }
  
  // Euclidean distance calculation
  let sumSq = 0;
  for (let i = 0; i < embA.length; i++) {
    const diff = embA[i] - embB[i];
    sumSq += diff * diff;
  }
  const dist = Math.sqrt(sumSq);
  
  console.log('[FACE-API] Distance =', dist.toFixed(4), '| Threshold =', threshold, '| Match =', dist <= threshold);
  return { match: dist <= threshold, distance: dist };
}

export function compareEmbeddingsArcFace(embA, embB, similarityThreshold = 0.5) {
  if (!Array.isArray(embA) || !Array.isArray(embB)) {
    console.warn('[ARCFACE] Invalid embeddings: not arrays');
    return { match: false, similarity: -1, distance: Infinity };
  }
  if (embA.length !== embB.length) {
    console.warn('[ARCFACE] Embedding length mismatch:', embA.length, 'vs', embB.length);
    return { match: false, similarity: -1, distance: Infinity };
  }
  if (embA.length !== 128) {
    console.warn('[ARCFACE] Expected 128-D embeddings, got:', embA.length);
  }

  const normalizedA = normalizeEmbedding(embA);
  const normalizedB = normalizeEmbedding(embB);

  let similarity = 0;
  for (let index = 0; index < normalizedA.length; index++) {
    similarity += normalizedA[index] * normalizedB[index];
  }

  const clampedSimilarity = Math.max(-1, Math.min(1, similarity));
  const cosineDistance = 1 - clampedSimilarity;
  const match = clampedSimilarity >= similarityThreshold;

  console.log(
    '[ARCFACE] Similarity =',
    clampedSimilarity.toFixed(4),
    '| Threshold =',
    similarityThreshold,
    '| Match =',
    match
  );

  return {
    match,
    similarity: clampedSimilarity,
    distance: cosineDistance,
  };
}

export function verifyFace(embA, embB, options = {}) {
  const { method = 'euclidean' } = options;

  if (method === 'arcface') {
    const similarityThreshold = Number.isFinite(options.similarityThreshold)
      ? options.similarityThreshold
      : 0.5;
    return compareEmbeddingsArcFace(embA, embB, similarityThreshold);
  }

  const threshold = Number.isFinite(options.threshold) ? options.threshold : 0.6;
  return compareEmbeddings(embA, embB, threshold);
}

export default {
  loadModels,
  extractEmbeddingFromImageBuffer,
  compareEmbeddings,
  compareEmbeddingsArcFace,
  verifyFace,
};