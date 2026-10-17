/**
 * NEURO-DIGIT • MNIST Neural Network Engine & Preprocessor
 * Implements 784 -> 128 (ReLU) -> 64 (ReLU) -> 10 (Softmax)
 * Includes standard MNIST Center-of-Mass + 20x20 bounding box normalization.
 */

class MNISTEngine {
  constructor() {
    this.weights = null;
    this.ready = false;
  }

  async init() {
    if (window.MNIST_WEIGHTS) {
      this.weights = window.MNIST_WEIGHTS;
      this.ready = true;
      return true;
    }

    try {
      const resp = await fetch('mnist_weights.json');
      this.weights = await resp.json();
      this.ready = true;
      return true;
    } catch (e) {
      console.error("Failed to load mnist_weights.json:", e);
      return false;
    }
  }

  /**
   * Preprocess high-res canvas (e.g. 280x280) to canonical MNIST 28x28 format.
   * Steps:
   * 1. Extract grayscale stroke intensity [0, 1]
   * 2. Find tight bounding box of stroke
   * 3. Rescale bounding box to fit inside a 20x20 region (preserving aspect ratio)
   * 4. Place inside 28x28 canvas
   * 5. Calculate Center of Mass and translate so CoM is centered at (14, 14)
   *
   * @param {HTMLCanvasElement} canvas
   * @returns {{ raw28: Float32Array, isEmpty: boolean }}
   */
  preprocessCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasStrokes = false;

    // First pass: find bounding box and detect if empty
    // Canvas is dark background with bright strokes (or transparent)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3] / 255.0;
        // Stroke luminance (max of channels or average)
        const lum = Math.max(r, g, b) / 255.0 * a;

        if (lum > 0.08) {
          hasStrokes = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasStrokes || minX > maxX || minY > maxY) {
      return { raw28: new Float32Array(784), isEmpty: true };
    }

    // Add slight padding to bounding box
    const pad = 4;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width - 1, maxX + pad);
    maxY = Math.min(height - 1, maxY + pad);

    const bbW = maxX - minX + 1;
    const bbH = maxY - minY + 1;

    // Scale so largest dimension is 20 pixels
    const maxDim = Math.max(bbW, bbH);
    const scale = 20.0 / maxDim;
    const targetW = Math.max(1, Math.round(bbW * scale));
    const targetH = Math.max(1, Math.round(bbH * scale));

    // Create an intermediate offscreen canvas to scale bounding box
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 28;
    offCanvas.height = 28;
    const offCtx = offCanvas.getContext('2d');
    offCtx.imageSmoothingEnabled = true;
    offCtx.imageSmoothingQuality = 'high';

    // Temporary canvas for extracted bounding box
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = bbW;
    cropCanvas.height = bbH;
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(canvas, minX, minY, bbW, bbH, 0, 0, bbW, bbH);

    // Initial centered placement in 28x28 (approximate)
    const initX = Math.round((28 - targetW) / 2);
    const initY = Math.round((28 - targetH) / 2);
    offCtx.drawImage(cropCanvas, 0, 0, bbW, bbH, initX, initY, targetW, targetH);

    const scaledData = offCtx.getImageData(0, 0, 28, 28).data;
    const grid = new Float32Array(28 * 28);
    let totalMass = 0;
    let cx = 0, cy = 0;

    for (let y = 0; y < 28; y++) {
      for (let x = 0; x < 28; x++) {
        const idx = (y * 28 + x) * 4;
        const lum = Math.max(scaledData[idx], scaledData[idx + 1], scaledData[idx + 2]) / 255.0 * (scaledData[idx + 3] / 255.0);
        grid[y * 28 + x] = lum;
        totalMass += lum;
        cx += x * lum;
        cy += y * lum;
      }
    }

    if (totalMass < 0.1) {
      return { raw28: new Float32Array(784), isEmpty: true };
    }

    // Center of Mass coordinates
    cx /= totalMass;
    cy /= totalMass;

    // Shift required to put Center of Mass at (14.0, 14.0)
    const shiftX = Math.round(14.0 - cx);
    const shiftY = Math.round(14.0 - cy);

    // Final translated 28x28 grid
    const final28 = new Float32Array(784);
    for (let y = 0; y < 28; y++) {
      for (let x = 0; x < 28; x++) {
        const srcX = x - shiftX;
        const srcY = y - shiftY;
        if (srcX >= 0 && srcX < 28 && srcY >= 0 && srcY < 28) {
          final28[y * 28 + x] = grid[srcY * 28 + srcX];
        }
      }
    }

    return { raw28: final28, isEmpty: false };
  }

  /**
   * Forward pass through 784 -> 128 -> 64 -> 10 MLP
   * @param {Float32Array} input784
   * @returns {{
   *   prediction: number,
   *   confidence: number,
   *   probabilities: number[],
   *   top3: Array<{digit: number, prob: number}>,
   *   entropy: number,
   *   h1: Float32Array,
   *   h2: Float32Array
   * }}
   */
  predict(input784) {
    if (!this.ready || !this.weights) {
      return {
        prediction: 0,
        confidence: 0,
        probabilities: new Array(10).fill(0.1),
        top3: [],
        entropy: 1.0,
        h1: new Float32Array(128),
        h2: new Float32Array(64)
      };
    }

    const { w1, b1, w2, b2, w3, b3 } = this.weights;

    // Layer 1: Dense(128) + ReLU
    const h1 = new Float32Array(128);
    for (let i = 0; i < 128; i++) {
      let sum = b1[i];
      const row = w1[i];
      for (let j = 0; j < 784; j++) {
        sum += row[j] * input784[j];
      }
      h1[i] = sum > 0 ? sum : 0;
    }

    // Layer 2: Dense(64) + ReLU
    const h2 = new Float32Array(64);
    for (let i = 0; i < 64; i++) {
      let sum = b2[i];
      const row = w2[i];
      for (let j = 0; j < 128; j++) {
        sum += row[j] * h1[j];
      }
      h2[i] = sum > 0 ? sum : 0;
    }

    // Layer 3: Dense(10) -> Logits
    const logits = new Float32Array(10);
    let maxLogit = -Infinity;
    for (let i = 0; i < 10; i++) {
      let sum = b3[i];
      const row = w3[i];
      for (let j = 0; j < 64; j++) {
        sum += row[j] * h2[j];
      }
      logits[i] = sum;
      if (sum > maxLogit) maxLogit = sum;
    }

    // Softmax with numerical stability
    let expSum = 0;
    const exps = new Float32Array(10);
    for (let i = 0; i < 10; i++) {
      const e = Math.exp(logits[i] - maxLogit);
      exps[i] = e;
      expSum += e;
    }

    const probabilities = new Array(10);
    let bestDigit = 0;
    let maxProb = -1;
    let entropy = 0;

    for (let i = 0; i < 10; i++) {
      const p = exps[i] / expSum;
      probabilities[i] = p;
      if (p > maxProb) {
        maxProb = p;
        bestDigit = i;
      }
      if (p > 1e-7) {
        entropy -= p * Math.log2(p);
      }
    }

    // Normalized entropy: H / log2(10) (0 = 100% certain, 1.0 = uniform distribution)
    const normEntropy = entropy / Math.log2(10);

    // Sorted top-3
    const indexed = probabilities.map((prob, digit) => ({ digit, prob }));
    indexed.sort((a, b) => b.prob - a.prob);
    const top3 = indexed.slice(0, 3);

    return {
      prediction: bestDigit,
      confidence: maxProb,
      probabilities,
      top3,
      entropy: normEntropy,
      h1,
      h2
    };
  }
}

window.MNISTEngine = MNISTEngine;
