// Temporary mock implementation - replace with real face-api once models are downloaded
// TODO: Install Visual Studio Build Tools to use @tensorflow/tfjs-node
//       OR download and configure face-api models properly

import path from 'path';

const MODEL_DIR = path.join(process.cwd(), 'public', 'models');
let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  console.warn('[FACE-API] Using MOCK implementation - real face recognition not active');
  console.warn('[FACE-API] To enable: Download models from https://github.com/vladmandic/face-api/tree/master/model');
  console.warn('[FACE-API] Place them in public/models/ directory');
  modelsLoaded = true;
}

// inputBuffer: Buffer of an image (PNG/JPEG) from frontend upload/base64
export async function extractEmbeddingFromImageBuffer(inputBuffer) {
  await loadModels();
  // Mock: Generate deterministic 128-D embedding based on image hash
  // This ensures same image produces same embedding for testing
  let seed = 0;
  for (let i = 0; i < Math.min(inputBuffer.length, 100); i++) {
    seed += inputBuffer[i];
  }
  
  const mockEmbedding = Array(128).fill(0).map((_, i) => {
    // Deterministic pseudo-random based on seed and index
    const x = Math.sin(seed * (i + 1)) * 10000;
    return x - Math.floor(x);
  });
  
  console.log('[FACE-API] MOCK: Generated deterministic embedding (length:', mockEmbedding.length, 'seed:', seed, ')');
  return mockEmbedding;
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

export default {
  loadModels,
  extractEmbeddingFromImageBuffer,
  compareEmbeddings,
};