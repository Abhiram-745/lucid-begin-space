/**
 * TensorFlow.js skin-texture / "roughness" analyzer.
 *
 * HONEST LIMITS: there is no reliable off-the-shelf acne classifier, and we
 * are NOT making medical claims. We approximate "skin roughness" by running
 * a Laplacian high-pass filter on the cropped cheek/forehead region and
 * measuring high-frequency energy. Bumpy / textured skin -> more high-
 * frequency variance -> higher roughness. This feeds the entertainment
 * "chaos" score; do not interpret it as a real skin diagnosis.
 */
import * as tf from "@tensorflow/tfjs";

let backendReady: Promise<void> | null = null;
function ensureBackend() {
  if (!backendReady) {
    backendReady = tf.setBackend("webgl").then(() => tf.ready()).catch(async () => {
      await tf.setBackend("cpu");
      await tf.ready();
    });
  }
  return backendReady;
}

// Laplacian kernel — classic 3x3 high-pass.
const LAPLACIAN = tf.tensor4d(
  [0, 1, 0, 1, -4, 1, 0, 1, 0],
  [3, 3, 1, 1],
);

// Running normalization bounds — auto-calibrate to the user's lighting.
let runningMin = 0.005;
let runningMax = 0.05;

export interface SkinReading {
  roughness: number;   // 0..1 normalized high-frequency energy
  rawEnergy: number;   // mean abs Laplacian, pre-normalization
}

export interface TeethReading {
  visibility: number;  // 0..1 bright low-saturation mouth-region pixels
  yellowTint: number;  // 0..1 warm/yellow cast within visible teeth pixels
  signal: number;      // combined reversed-UNMOG teeth signal
}

/**
 * Analyze a rectangular crop of the source video. Caller passes pixel-space
 * bounds within the video element. Internally we sample at 96x96 to keep
 * GPU cost trivial (~1ms on integrated GPUs).
 */
export async function analyzeSkin(
  video: HTMLVideoElement,
  cropX: number, cropY: number, cropW: number, cropH: number,
): Promise<SkinReading> {
  await ensureBackend();
  if (cropW < 24 || cropH < 24) return { roughness: 0, rawEnergy: 0 };

  // Pull the crop onto a small offscreen canvas first — tf.browser.fromPixels
  // can't crop a video directly.
  const tmp = document.createElement("canvas");
  const SIZE = 96;
  tmp.width = SIZE;
  tmp.height = SIZE;
  const tctx = tmp.getContext("2d");
  if (!tctx) return { roughness: 0, rawEnergy: 0 };
  try {
    tctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, SIZE, SIZE);
  } catch {
    return { roughness: 0, rawEnergy: 0 };
  }

  const energy = tf.tidy(() => {
    const img = tf.browser.fromPixels(tmp, 3).toFloat().div(255);
    // Grayscale luminance
    const gray = img.mul(tf.tensor1d([0.299, 0.587, 0.114])).sum(-1).expandDims(-1).expandDims(0);
    // Light blur to suppress sensor noise (3x3 box) before Laplacian.
    const box = tf.fill([3, 3, 1, 1], 1 / 9);
    const blurred = tf.conv2d(gray as tf.Tensor4D, box as tf.Tensor4D, 1, "same");
    const lap = tf.conv2d(blurred, LAPLACIAN as tf.Tensor4D, 1, "same").abs();
    // Crop out the outer ring (face oval edges add false high frequencies).
    const inner = lap.slice([0, 8, 8, 0], [1, SIZE - 16, SIZE - 16, 1]);
    return inner.mean().dataSync()[0];
  });

  // Auto-calibration: slowly expand bounds toward observed extremes.
  if (energy < runningMin) runningMin = runningMin * 0.95 + energy * 0.05;
  if (energy > runningMax) runningMax = runningMax * 0.9 + energy * 0.1;
  const range = Math.max(1e-4, runningMax - runningMin);
  const roughness = Math.max(0, Math.min(1, (energy - runningMin) / range));

  return { roughness, rawEnergy: energy };
}

export async function analyzeTeeth(
  video: HTMLVideoElement,
  cropX: number, cropY: number, cropW: number, cropH: number,
): Promise<TeethReading> {
  await ensureBackend();
  if (cropW < 12 || cropH < 8) return { visibility: 0, yellowTint: 0, signal: 0 };

  const tmp = document.createElement("canvas");
  const W = 80;
  const H = 44;
  tmp.width = W;
  tmp.height = H;
  const tctx = tmp.getContext("2d");
  if (!tctx) return { visibility: 0, yellowTint: 0, signal: 0 };
  try {
    tctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, W, H);
  } catch {
    return { visibility: 0, yellowTint: 0, signal: 0 };
  }

  const reading = tf.tidy(() => {
    const img = tf.browser.fromPixels(tmp, 3).toFloat().div(255);
    const [r, g, b] = tf.split(img, 3, 2);
    const maxRgb = tf.maximum(tf.maximum(r, g), b);
    const minRgb = tf.minimum(tf.minimum(r, g), b);
    const brightness = img.mean(2, true);
    const saturation = maxRgb.sub(minRgb).div(maxRgb.add(1e-4));

    const brightMask = brightness.sub(0.48).mul(9).sigmoid();
    const lowSatMask = tf.scalar(1).sub(saturation.sub(0.46).mul(8).sigmoid());
    const teethMask = brightMask.mul(lowSatMask);
    const visibility = teethMask.mean().dataSync()[0];

    const warm = r.add(g).mul(0.5).sub(b).sub(0.055).mul(10).sigmoid();
    const warmWeighted = warm.mul(teethMask).sum().dataSync()[0];
    const maskMass = teethMask.sum().dataSync()[0];
    const yellowTint = maskMass > 1e-4 ? warmWeighted / maskMass : 0;
    const signal = Math.max(0, Math.min(1, visibility * (0.45 + yellowTint * 0.55)));

    return { visibility, yellowTint, signal };
  });

  return {
    visibility: Math.max(0, Math.min(1, reading.visibility)),
    yellowTint: Math.max(0, Math.min(1, reading.yellowTint)),
    signal: Math.max(0, Math.min(1, reading.signal)),
  };
}