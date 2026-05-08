/**
 * UNMOG chaos scorer — pure functions, no React, no I/O.
 *
 * Pipeline:
 *   landmarks (MediaPipe FaceMesh, 468 pts) + audio frame  ->  features [0..1]
 *                                                          ->  weighted score [0..10]
 *
 * This is NOT attractiveness or identity. It rewards chaotic *performance*:
 * asymmetry, mouth distortion, eye mismatch, head motion, vocal energy,
 * sustained commitment.
 */

export type Pt = { x: number; y: number; z?: number };

/* ---------- landmark indices (MediaPipe FaceMesh) ---------- */
const L = {
  // eyes
  leftEyeTop: 159, leftEyeBot: 145, leftEyeIn: 133, leftEyeOut: 33,
  rightEyeTop: 386, rightEyeBot: 374, rightEyeIn: 362, rightEyeOut: 263,
  // mouth
  mouthTop: 13, mouthBot: 14, mouthLeft: 61, mouthRight: 291,
  upperLipTop: 0, lowerLipBot: 17,
  // face anchors
  noseTip: 1, foreheadCenter: 10, chin: 152,
  jawLeft: 234, jawRight: 454,
  cheekLeft: 50, cheekRight: 280,
  browLeftIn: 55, browLeftOut: 70,
  browRightIn: 285, browRightOut: 300,
};

/* ---------- math helpers ---------- */
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Map a raw measurement into [0,1] with a soft saturating curve. */
const norm = (v: number, lo: number, hi: number) => clamp01((v - lo) / (hi - lo));

/* ---------- spatial features ---------- */

export interface SpatialFeatures {
  asymmetry: number;        // L/R differences
  mouthDistortion: number;  // openness + stretch
  eyeChaos: number;         // mismatch + extreme open/close
  chinCompression: number;  // double-chin / jut
  headAngle: number;        // tilt + rotation magnitude
}

export function extractSpatial(lm: Pt[]): SpatialFeatures {
  // Inter-ocular distance — scale invariant denominator.
  const eyeSpan = dist(lm[L.leftEyeOut], lm[L.rightEyeOut]) || 1e-6;

  /* asymmetry — compare left vs right paired distances from face center axis */
  const cx = (lm[L.foreheadCenter].x + lm[L.chin].x) / 2;
  const pairs: Array<[number, number]> = [
    [L.leftEyeOut, L.rightEyeOut],
    [L.cheekLeft, L.cheekRight],
    [L.mouthLeft, L.mouthRight],
    [L.jawLeft, L.jawRight],
    [L.browLeftOut, L.browRightOut],
  ];
  let asymSum = 0;
  for (const [a, b] of pairs) {
    const dxA = Math.abs(lm[a].x - cx);
    const dxB = Math.abs(lm[b].x - cx);
    const dyDiff = Math.abs(lm[a].y - lm[b].y);
    asymSum += Math.abs(dxA - dxB) + dyDiff;
  }
  const asymmetry = norm(asymSum / eyeSpan, 0.05, 0.6);

  /* mouth distortion — vertical opening + horizontal stretch beyond resting */
  const mouthOpen = dist(lm[L.mouthTop], lm[L.mouthBot]) / eyeSpan;
  const mouthWide = dist(lm[L.mouthLeft], lm[L.mouthRight]) / eyeSpan;
  const lipStretch = dist(lm[L.upperLipTop], lm[L.lowerLipBot]) / eyeSpan;
  const mouthDistortion = clamp01(
    0.55 * norm(mouthOpen, 0.05, 0.55) +
    0.25 * norm(mouthWide, 0.55, 1.05) +
    0.20 * norm(lipStretch, 0.10, 0.65),
  );

  /* eye chaos — wide-open / squint mismatch between eyes */
  const leftOpen = dist(lm[L.leftEyeTop], lm[L.leftEyeBot]) / eyeSpan;
  const rightOpen = dist(lm[L.rightEyeTop], lm[L.rightEyeBot]) / eyeSpan;
  const eyeMismatch = Math.abs(leftOpen - rightOpen);
  const eyeExtreme = Math.max(
    norm(Math.max(leftOpen, rightOpen), 0.10, 0.22),  // bug-eyed
    norm(0.04 - Math.min(leftOpen, rightOpen), 0, 0.04), // squinted shut
  );
  const eyeChaos = clamp01(0.6 * norm(eyeMismatch, 0.005, 0.06) + 0.4 * eyeExtreme);

  /* chin compression — chin pulled toward chest (small forehead->chin Y span vs eye span) */
  const verticalSpan = Math.abs(lm[L.chin].y - lm[L.foreheadCenter].y);
  const compressionRatio = verticalSpan / eyeSpan; // small => squished
  const chinCompression = clamp01(norm(1.6 - compressionRatio, 0, 0.7));

  /* head angle — combine roll (eye-line tilt) and yaw proxy (nose offset) */
  const dyEyes = lm[L.rightEyeOut].y - lm[L.leftEyeOut].y;
  const dxEyes = lm[L.rightEyeOut].x - lm[L.leftEyeOut].x || 1e-6;
  const roll = Math.abs(Math.atan2(dyEyes, dxEyes)); // radians
  const noseOffset = Math.abs(lm[L.noseTip].x - cx) / eyeSpan;
  const headAngle = clamp01(0.6 * norm(roll, 0.05, 0.7) + 0.4 * norm(noseOffset, 0.04, 0.35));

  return { asymmetry, mouthDistortion, eyeChaos, chinCompression, headAngle };
}

/* ---------- temporal tracker ---------- */

export interface TemporalFeatures {
  expressionVolatility: number; // variance of spatial features over window
  motionInstability: number;    // landmark velocity
  commitment: number;           // sustained high chaos
}

const WINDOW = 30; // ~1s @ 30fps

export class TemporalTracker {
  private history: SpatialFeatures[] = [];
  private prevAnchors: Pt[] | null = null;
  private velocityHistory: number[] = [];
  private chaosHistory: number[] = [];

  update(spatial: SpatialFeatures, lm: Pt[]): TemporalFeatures {
    this.history.push(spatial);
    if (this.history.length > WINDOW) this.history.shift();

    /* volatility: mean stddev across the 5 spatial channels */
    const channels: (keyof SpatialFeatures)[] = [
      "asymmetry", "mouthDistortion", "eyeChaos", "chinCompression", "headAngle",
    ];
    let totalStd = 0;
    for (const k of channels) {
      const vals = this.history.map((h) => h[k]);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
      totalStd += Math.sqrt(variance);
    }
    const expressionVolatility = clamp01((totalStd / channels.length) / 0.25);

    /* motion: sum of displacement of a few anchor points vs last frame */
    const anchorIdx = [L.noseTip, L.foreheadCenter, L.chin, L.leftEyeOut, L.rightEyeOut];
    const anchors = anchorIdx.map((i) => lm[i]);
    let velocity = 0;
    if (this.prevAnchors) {
      for (let i = 0; i < anchors.length; i++) {
        velocity += dist(anchors[i], this.prevAnchors[i]);
      }
    }
    this.prevAnchors = anchors;
    this.velocityHistory.push(velocity);
    if (this.velocityHistory.length > WINDOW) this.velocityHistory.shift();
    const meanVel =
      this.velocityHistory.reduce((s, v) => s + v, 0) / this.velocityHistory.length;
    const motionInstability = clamp01(norm(meanVel, 0.002, 0.05));

    /* commitment: rolling average of an instant chaos proxy staying high */
    const instantChaos =
      0.25 * spatial.mouthDistortion +
      0.2  * spatial.eyeChaos +
      0.2  * spatial.asymmetry +
      0.15 * spatial.chinCompression +
      0.2  * spatial.headAngle;
    this.chaosHistory.push(instantChaos);
    if (this.chaosHistory.length > WINDOW) this.chaosHistory.shift();
    const sustained =
      this.chaosHistory.reduce((s, v) => s + v, 0) / this.chaosHistory.length;
    // commitment rewards staying above 0.4 across the window
    const commitment = clamp01(norm(sustained, 0.3, 0.75));

    return { expressionVolatility, motionInstability, commitment };
  }

  reset() {
    this.history = [];
    this.prevAnchors = null;
    this.velocityHistory = [];
    this.chaosHistory = [];
  }
}

/* ---------- audio features ---------- */

export interface AudioFeatures {
  energy: number;       // RMS volume
  pitchVariation: number;
  spectralEntropy: number;
  spike: number;        // sudden burst detector
}

export class AudioTracker {
  private rmsHistory: number[] = [];
  private centroidHistory: number[] = [];

  update(timeBuf: Float32Array, freqBuf: Uint8Array, sampleRate: number): AudioFeatures {
    /* RMS */
    let sumSq = 0;
    for (let i = 0; i < timeBuf.length; i++) sumSq += timeBuf[i] * timeBuf[i];
    const rms = Math.sqrt(sumSq / timeBuf.length);
    this.rmsHistory.push(rms);
    if (this.rmsHistory.length > WINDOW) this.rmsHistory.shift();
    const energy = clamp01(norm(rms, 0.01, 0.35));

    /* spectral centroid (pitch proxy) + entropy */
    let total = 0, weighted = 0, entropy = 0;
    for (let i = 0; i < freqBuf.length; i++) total += freqBuf[i];
    if (total > 0) {
      for (let i = 0; i < freqBuf.length; i++) {
        const p = freqBuf[i] / total;
        weighted += i * p;
        if (p > 0) entropy -= p * Math.log2(p);
      }
    }
    const nyquist = sampleRate / 2;
    const centroidHz = (weighted / Math.max(freqBuf.length - 1, 1)) * nyquist;
    this.centroidHistory.push(centroidHz);
    if (this.centroidHistory.length > WINDOW) this.centroidHistory.shift();
    const cMean =
      this.centroidHistory.reduce((s, v) => s + v, 0) / this.centroidHistory.length;
    const cVar =
      this.centroidHistory.reduce((s, v) => s + (v - cMean) ** 2, 0) /
      this.centroidHistory.length;
    const pitchVariation = clamp01(norm(Math.sqrt(cVar), 50, 1500));

    const maxEntropy = Math.log2(freqBuf.length || 2);
    const spectralEntropy = clamp01(entropy / maxEntropy);

    /* spike: current rms vs trailing average */
    const trail =
      this.rmsHistory.slice(0, -1).reduce((s, v) => s + v, 0) /
      Math.max(this.rmsHistory.length - 1, 1);
    const spike = clamp01((rms - trail) / 0.2);

    return { energy, pitchVariation, spectralEntropy, spike };
  }

  reset() {
    this.rmsHistory = [];
    this.centroidHistory = [];
  }
}

/* ---------- final scoring ---------- */

export interface ChaosBreakdown {
  spatial: SpatialFeatures;
  temporal: TemporalFeatures;
  audio: AudioFeatures;
  score: number; // 0..10
}

/**
 * Default weights — sum doesn't need to be 1, we normalize.
 * Tweak liberally; entertainment > accuracy.
 */
export const DEFAULT_WEIGHTS = {
  asymmetry: 0.9,
  mouthDistortion: 1.4,
  eyeChaos: 1.1,
  chinCompression: 0.8,
  headAngle: 0.9,
  expressionVolatility: 1.2,
  motionInstability: 1.0,
  audioEnergy: 1.1,
  audioPitch: 0.6,
  audioEntropy: 0.4,
  audioSpike: 0.5,
  commitment: 1.3,
};

export type Weights = typeof DEFAULT_WEIGHTS;

export function scoreFromFeatures(
  s: SpatialFeatures,
  t: TemporalFeatures,
  a: AudioFeatures,
  w: Weights = DEFAULT_WEIGHTS,
  prevScore = 0,
): ChaosBreakdown {
  const weightSum = Object.values(w).reduce((sum, v) => sum + v, 0);

  const raw =
    w.asymmetry * s.asymmetry +
    w.mouthDistortion * s.mouthDistortion +
    w.eyeChaos * s.eyeChaos +
    w.chinCompression * s.chinCompression +
    w.headAngle * s.headAngle +
    w.expressionVolatility * t.expressionVolatility +
    w.motionInstability * t.motionInstability +
    w.audioEnergy * a.energy +
    w.audioPitch * a.pitchVariation +
    w.audioEntropy * a.spectralEntropy +
    w.audioSpike * a.spike +
    w.commitment * t.commitment;

  // Slight exaggeration curve — entertainment > accuracy.
  const norm01 = clamp01(raw / weightSum);
  const exaggerated = Math.pow(norm01, 0.78);
  const target = exaggerated * 10;

  // Smooth toward target so the number doesn't twitch.
  const score = lerp(prevScore, target, 0.25);

  return { spatial: s, temporal: t, audio: a, score };
}