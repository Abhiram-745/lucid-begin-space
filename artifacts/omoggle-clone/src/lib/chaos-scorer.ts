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

/* ---------- pose normalization ----------
 * Rotate, translate, and scale landmarks into a canonical frame so that
 *  - the eye-line is horizontal (roll = 0)
 *  - the face center is at the origin
 *  - the inter-ocular distance is 1
 * This makes downstream features invariant to where the user sits or how
 * they tilt their head, which is the #1 source of "random" score swings.
 * The pre-normalization roll/yaw is returned separately so headAngle can
 * still reward intentional head movement.
 */
export interface NormalizedFace {
  points: Pt[];
  roll: number;       // radians, original eye-line tilt
  yawProxy: number;   // nose horizontal offset / eye span, pre-normalization
  eyeSpan: number;    // original inter-ocular distance (scale)
}

export function normalizeLandmarks(lm: Pt[]): NormalizedFace {
  const lEye = lm[L.leftEyeOut];
  const rEye = lm[L.rightEyeOut];
  const eyeSpan = dist(lEye, rEye) || 1e-6;
  const cx = (lm[L.foreheadCenter].x + lm[L.chin].x) / 2;
  const cy = (lm[L.foreheadCenter].y + lm[L.chin].y) / 2;
  const roll = Math.atan2(rEye.y - lEye.y, rEye.x - lEye.x);
  const yawProxy = (lm[L.noseTip].x - cx) / eyeSpan;
  const cos = Math.cos(-roll);
  const sin = Math.sin(-roll);
  const points: Pt[] = new Array(lm.length);
  for (let i = 0; i < lm.length; i++) {
    const p = lm[i];
    const dx = (p.x - cx) / eyeSpan;
    const dy = (p.y - cy) / eyeSpan;
    points[i] = { x: dx * cos - dy * sin, y: dx * sin + dy * cos, z: p.z };
  }
  return { points, roll, yawProxy, eyeSpan };
}

/* ---------- spatial features ---------- */

export interface SpatialFeatures {
  asymmetry: number;        // L/R differences
  mouthDistortion: number;  // openness + stretch
  eyeChaos: number;         // mismatch + extreme open/close
  chinCompression: number;  // double-chin / jut
  headAngle: number;        // tilt + rotation magnitude
}

export function extractSpatial(lm: Pt[]): SpatialFeatures {
  // Work in canonical (centered, rotated, unit-eye-span) space so features
  // describe the *expression* rather than head pose or camera framing.
  const nf = normalizeLandmarks(lm);
  const p = nf.points;
  const eyeSpan = 1; // by definition after normalization

  /* asymmetry — compare left vs right paired distances from face midline (x=0) */
  const pairs: Array<[number, number]> = [
    [L.leftEyeOut, L.rightEyeOut],
    [L.cheekLeft, L.cheekRight],
    [L.mouthLeft, L.mouthRight],
    [L.jawLeft, L.jawRight],
    [L.browLeftOut, L.browRightOut],
  ];
  let asymSum = 0;
  for (const [a, b] of pairs) {
    const dxA = Math.abs(p[a].x);
    const dxB = Math.abs(p[b].x);
    const dyDiff = Math.abs(p[a].y - p[b].y);
    asymSum += Math.abs(dxA - dxB) + dyDiff;
  }
  const asymmetry = norm(asymSum, 0.05, 0.6);

  /* mouth distortion — vertical opening + horizontal stretch beyond resting */
  const mouthOpen = dist(p[L.mouthTop], p[L.mouthBot]);
  const mouthWide = dist(p[L.mouthLeft], p[L.mouthRight]);
  const lipStretch = dist(p[L.upperLipTop], p[L.lowerLipBot]);
  const mouthDistortion = clamp01(
    0.55 * norm(mouthOpen, 0.05, 0.55) +
    0.25 * norm(mouthWide, 0.55, 1.05) +
    0.20 * norm(lipStretch, 0.10, 0.65),
  );

  /* eye chaos — wide-open / squint mismatch between eyes */
  const leftOpen = dist(p[L.leftEyeTop], p[L.leftEyeBot]);
  const rightOpen = dist(p[L.rightEyeTop], p[L.rightEyeBot]);
  const eyeMismatch = Math.abs(leftOpen - rightOpen);
  const eyeExtreme = Math.max(
    norm(Math.max(leftOpen, rightOpen), 0.10, 0.22),  // bug-eyed
    norm(0.04 - Math.min(leftOpen, rightOpen), 0, 0.04), // squinted shut
  );
  const eyeChaos = clamp01(0.6 * norm(eyeMismatch, 0.005, 0.06) + 0.4 * eyeExtreme);

  /* chin compression — chin pulled toward chest (small forehead->chin Y span vs eye span) */
  const verticalSpan = Math.abs(p[L.chin].y - p[L.foreheadCenter].y);
  const compressionRatio = verticalSpan; // small => squished
  const chinCompression = clamp01(norm(1.6 - compressionRatio, 0, 0.7));

  /* head angle — original (pre-normalization) roll + yaw proxy */
  const headAngle = clamp01(
    0.6 * norm(Math.abs(nf.roll), 0.05, 0.7) +
    0.4 * norm(Math.abs(nf.yawProxy), 0.04, 0.35),
  );

  return { asymmetry, mouthDistortion, eyeChaos, chinCompression, headAngle };
}

/* ---------- temporal tracker ---------- */

export interface TemporalFeatures {
  expressionVolatility: number; // variance of spatial features over window
  motionInstability: number;    // landmark velocity
  commitment: number;           // sustained high chaos
  momentum: number;             // 0..1 — chaos is escalating over time
  peak: number;                 // 0..1 — instantaneous burst intensity
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
    // commitment rewards staying chaotic — easier to reach now
    const commitment = clamp01(norm(sustained, 0.18, 0.6));

    // momentum: compare recent half of window vs older half. positive slope = ramping up
    const half = Math.max(2, Math.floor(this.chaosHistory.length / 2));
    const older = this.chaosHistory.slice(0, half);
    const recent = this.chaosHistory.slice(-half);
    const olderMean = older.reduce((s, v) => s + v, 0) / Math.max(older.length, 1);
    const recentMean = recent.reduce((s, v) => s + v, 0) / Math.max(recent.length, 1);
    const slope = recentMean - olderMean;
    const momentum = clamp01(norm(slope, 0.0, 0.25));

    // peak: how high is the current frame vs the recent baseline
    const peak = clamp01(norm(instantChaos - sustained * 0.7, 0.05, 0.45));

    return { expressionVolatility, motionInstability, commitment, momentum, peak };
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
  // Reward ACTION over face structure. Performance signals dominate.
  asymmetry: 0.25,
  mouthDistortion: 1.8,
  eyeChaos: 1.4,
  chinCompression: 0.7,
  headAngle: 0.6,
  expressionVolatility: 2.2,
  motionInstability: 1.9,
  audioEnergy: 1.6,
  audioPitch: 0.9,
  audioEntropy: 0.5,
  audioSpike: 1.0,
  commitment: 2.4,
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

  // Step 1: aggressive non-linear rescale — pulls mid-range up sharply.
  const norm01 = clamp01(raw / weightSum);
  let curved = Math.pow(norm01, 0.55);

  // Step 2: top-end amplification — high performance feels explosive.
  if (curved > 0.6) curved *= 1.25;
  if (curved > 0.78) curved *= 1.18;

  // Step 3: momentum + peak boosts — escalation and burst frames pop.
  curved += 0.18 * t.momentum;
  curved += 0.12 * t.peak;

  // Step 4: commitment bonus — sustained intensity gets a flat reward.
  if (t.commitment > 0.55) curved += 0.08 + 0.12 * (t.commitment - 0.55);

  const target = clamp01(curved) * 10;

  // Smoothing — fast rise, slow fall, but allow peaks to punch through.
  const delta = target - prevScore;
  const maxJumpUp = 2.2;   // bigger room for hype spikes
  const maxJumpDn = 0.9;   // gentler decay
  const clamped = delta > 0
    ? Math.min(maxJumpUp, delta)
    : Math.max(-maxJumpDn, delta);
  const alpha = clamped > 0 ? 0.42 : 0.14;
  let score = prevScore + clamped * alpha;
  if (score < 0) score = 0;
  if (score > 10) score = 10;

  return { spatial: s, temporal: t, audio: a, score };
}