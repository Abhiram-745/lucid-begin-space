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
const avgPt = (...pts: Pt[]): Pt => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  z: pts.reduce((s, p) => s + (p.z ?? 0), 0) / pts.length,
});

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
  const lEye = avgPt(lm[L.leftEyeOut], lm[L.leftEyeIn], lm[L.leftEyeTop], lm[L.leftEyeBot]);
  const rEye = avgPt(lm[L.rightEyeOut], lm[L.rightEyeIn], lm[L.rightEyeTop], lm[L.rightEyeBot]);
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
  teethExposure: number;    // visible teeth / mouth interior proxy
  eyeChaos: number;         // mismatch + extreme open/close
  chinCompression: number;  // double-chin / jut
  headAngle: number;        // tilt + rotation magnitude
  raw: {
    asymmetryPct: number;
    mouthOpenRatio: number;
    teethExposure: number;
    chinCompression: number;
    headTiltDeg: number;
  };
}

export function extractSpatial(lm: Pt[]): SpatialFeatures {
  // Work in canonical (centered, rotated, unit-eye-span) space so features
  // describe the *expression* rather than head pose or camera framing.
  const nf = normalizeLandmarks(lm);
  const p = nf.points;
  const eyeSpan = 1; // by definition after normalization

  /* asymmetry — compare mirrored L/R landmark pairs in canonical face space */
  const pairs: Array<[number, number]> = [
    [L.leftEyeOut, L.rightEyeOut],
    [L.leftEyeIn, L.rightEyeIn],
    [L.cheekLeft, L.cheekRight],
    [L.mouthLeft, L.mouthRight],
    [L.jawLeft, L.jawRight],
    [L.browLeftOut, L.browRightOut],
    [L.browLeftIn, L.browRightIn],
  ];
  let asymSum = 0;
  for (const [a, b] of pairs) {
    const mirroredB = { x: -p[b].x, y: p[b].y };
    asymSum += dist(p[a], mirroredB);
  }
  const asymRaw = asymSum / pairs.length;
  const asymmetry = norm(asymRaw, 0.015, 0.20);

  /* mouth distortion — vertical opening + horizontal stretch beyond resting */
  const mouthOpen = dist(p[L.mouthTop], p[L.mouthBot]);
  const mouthWide = dist(p[L.mouthLeft], p[L.mouthRight]);
  const lipStretch = dist(p[L.upperLipTop], p[L.lowerLipBot]);
  const mouthOpenRatio = mouthOpen / Math.max(mouthWide, 1e-6);
  const teethExposure = clamp01(
    0.75 * norm(mouthOpenRatio, 0.035, 0.22) +
    0.25 * norm(lipStretch / Math.max(mouthWide, 1e-6), 0.10, 0.34),
  );
  const mouthDistortion = clamp01(
    0.45 * norm(mouthOpenRatio, 0.04, 0.34) +
    0.25 * norm(mouthWide, 0.55, 1.05) +
    0.15 * norm(lipStretch, 0.10, 0.65) +
    0.15 * teethExposure,
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

  /* chin compression — lower-face/jaw squeezed toward mouth (double-chin proxy).
   * Uses jaw/chin geometry instead of the whole forehead→chin span, so it
   * changes when the chin is tucked, mouth is grimaced, or jawline collapses. */
  const verticalSpan = Math.abs(p[L.chin].y - p[L.foreheadCenter].y);
  const jawMid = avgPt(p[L.jawLeft], p[L.jawRight]);
  const lowerFaceSpan = Math.abs(p[L.chin].y - p[L.mouthBot].y);
  const jawToChinSpan = Math.abs(p[L.chin].y - jawMid.y);
  const faceSquash = clamp01(norm(1.92 - verticalSpan, 0, 0.55));
  const chinCompression = clamp01(
    0.45 * norm(0.62 - lowerFaceSpan, 0, 0.34) +
    0.35 * norm(0.50 - jawToChinSpan, 0, 0.28) +
    0.20 * faceSquash,
  );

  /* head angle — original (pre-normalization) roll + yaw proxy */
  const headAngle = clamp01(
    0.72 * norm(Math.abs(nf.roll), 0.015, 0.50) +
    0.28 * norm(Math.abs(nf.yawProxy), 0.025, 0.28),
  );

  return {
    asymmetry,
    mouthDistortion,
    teethExposure,
    eyeChaos,
    chinCompression,
    headAngle,
    raw: {
      asymmetryPct: clamp01(asymRaw / 0.20),
      mouthOpenRatio,
      teethExposure,
      chinCompression,
      headTiltDeg: Math.abs(nf.roll) * 180 / Math.PI,
    },
  };
}

/* ---------- perceived emotion (NOT scientific — performance cues only) ---------- */

export interface EmotionFeatures {
  surprise: number;     // wide eyes + dropped jaw
  anger: number;        // brow lowered + lip tension + jaw clench
  confusion: number;    // brow asymmetry + squint
  exaggeration: number; // overall amplitude of expression
  intensity: number;    // composite 0..1
  /** 0..1 — corners-up smile detector. HIGH when smiling/laughing (= GOOD look). */
  smile: number;
  /** 0..1 — corners-down grimace / disgust / sneer (= BAD look). */
  grimace: number;
}

export function extractEmotion(lm: Pt[]): EmotionFeatures {
  const nf = normalizeLandmarks(lm);
  const p = nf.points;

  const leftOpen = dist(p[L.leftEyeTop], p[L.leftEyeBot]);
  const rightOpen = dist(p[L.rightEyeTop], p[L.rightEyeBot]);
  const eyeOpen = (leftOpen + rightOpen) / 2;
  const mouthOpen = dist(p[L.mouthTop], p[L.mouthBot]);
  const mouthWide = dist(p[L.mouthLeft], p[L.mouthRight]);

  // brow height = distance from brow to eye center (negative y in canonical = up)
  const browL = (p[L.browLeftIn].y + p[L.browLeftOut].y) / 2;
  const browR = (p[L.browRightIn].y + p[L.browRightOut].y) / 2;
  const eyeMidL = (p[L.leftEyeTop].y + p[L.leftEyeBot].y) / 2;
  const eyeMidR = (p[L.rightEyeTop].y + p[L.rightEyeBot].y) / 2;
  const browLiftL = eyeMidL - browL; // larger = brow raised
  const browLiftR = eyeMidR - browR;
  const browLift = (browLiftL + browLiftR) / 2;
  const browAsym = Math.abs(browLiftL - browLiftR);

  const surprise = clamp01(
    0.5 * norm(eyeOpen, 0.10, 0.22) +
    0.3 * norm(mouthOpen, 0.08, 0.5) +
    0.2 * norm(browLift, 0.18, 0.38),
  );

  // anger: brow lowered (small lift) + mouth tension (narrow + slightly open)
  const lipTension = norm(0.85 - mouthWide, 0, 0.35);
  const browLowered = norm(0.20 - browLift, 0, 0.18);
  const anger = clamp01(0.55 * browLowered + 0.45 * lipTension);

  const squint = norm(0.06 - eyeOpen, 0, 0.05);
  const confusion = clamp01(0.6 * norm(browAsym, 0.01, 0.10) + 0.4 * squint);

  const exaggeration = clamp01(
    0.4 * norm(mouthOpen, 0.05, 0.55) +
    0.3 * norm(mouthWide, 0.55, 1.10) +
    0.3 * norm(eyeOpen, 0.06, 0.22),
  );

  /* Smile vs grimace — corner direction relative to mouth center.
   * In canonical (y-down) space, corners ABOVE the mouth midline (smaller y)
   * = corners up = smile. Corners below = grimace. We also require that
   * BOTH corners agree (symmetry), otherwise it's a sneer (still bad). */
  const mouthMidY = (p[L.mouthTop].y + p[L.mouthBot].y) / 2;
  const cornerLY = p[L.mouthLeft].y;
  const cornerRY = p[L.mouthRight].y;
  // Negative = corner above midline (smiling); positive = corner below (frown).
  const cornerLLift = mouthMidY - cornerLY;
  const cornerRLift = mouthMidY - cornerRY;
  const cornerLift = (cornerLLift + cornerRLift) / 2;
  const cornerSym = 1 - clamp01(Math.abs(cornerLLift - cornerRLift) / 0.12);
  const widening = norm(mouthWide, 0.62, 1.05);
  const smile = clamp01(norm(cornerLift, 0.005, 0.06) * (0.55 + 0.45 * cornerSym) * (0.6 + 0.4 * widening));
  const grimace = clamp01(norm(-cornerLift, 0.005, 0.05) * (0.5 + 0.5 * (1 - cornerSym * 0.5)));

  const intensity = clamp01(
    Math.max(surprise, anger, confusion, exaggeration) * 0.7 +
    0.3 * (surprise + anger + confusion + exaggeration) / 4,
  );

  return { surprise, anger, confusion, exaggeration, intensity, smile, grimace };
}

/* ---------- structural signals (used INVERSELY — small weight) ---------- */

export interface StructureFeatures {
  symmetryIdeal: number;   // 1 = highly symmetric, 0 = irregular
  ratioDeviation: number;  // distance from canonical thirds (0 = ideal, 1 = wild)
  cantalDeviation: number; // exaggerated/awkward eye-corner tilt
  inversion: number;       // composite — HIGH when face deviates from ideal
}

export function extractStructure(lm: Pt[]): StructureFeatures {
  const nf = normalizeLandmarks(lm);
  const p = nf.points;

  const pairs: Array<[number, number]> = [
    [L.cheekLeft, L.cheekRight],
    [L.mouthLeft, L.mouthRight],
    [L.jawLeft, L.jawRight],
    [L.browLeftOut, L.browRightOut],
  ];
  let asym = 0;
  for (const [a, b] of pairs) {
    asym += Math.abs(Math.abs(p[a].x) - Math.abs(p[b].x)) + Math.abs(p[a].y - p[b].y);
  }
  const symmetryIdeal = clamp01(1 - norm(asym, 0.02, 0.45));

  // Vertical thirds: forehead->brow, brow->nose, nose->chin should be ~equal.
  const fy = p[L.foreheadCenter].y;
  const by = (p[L.browLeftIn].y + p[L.browRightIn].y) / 2;
  const ny = p[L.noseTip].y;
  const cy = p[L.chin].y;
  const t1 = Math.abs(by - fy);
  const t2 = Math.abs(ny - by);
  const t3 = Math.abs(cy - ny);
  const total = t1 + t2 + t3 || 1e-6;
  const ideal = total / 3;
  const ratioDeviation = clamp01(
    norm((Math.abs(t1 - ideal) + Math.abs(t2 - ideal) + Math.abs(t3 - ideal)) / total, 0.05, 0.45),
  );

  // Cantal tilt — the looksmaxxing "fox-eye" metric.
  // Definition: signed angle, in radians, from the medial canthus (inner
  // eye corner) to the lateral canthus (outer eye corner), measured
  // against horizontal AFTER pose-normalization. Positive ≈ upturned
  // ("ideal", roughly +5–10°). Flat (≈0°) or negative ("downturned" /
  // hooded) is the "chopped" look. We reward distance from the +0.12 rad
  // ideal so flat & negative tilts both raise the score.
  // NOTE: x is mirrored between eyes — for the LEFT eye in the image the
  // medial corner is at higher x, for the RIGHT eye it's at lower x.
  // We compute each as (lateral - medial) so both sign conventions match.
  const lTilt = Math.atan2(
    p[L.leftEyeOut].y - p[L.leftEyeIn].y,
    p[L.leftEyeOut].x - p[L.leftEyeIn].x,
  );
  const rTilt = Math.atan2(
    p[L.rightEyeOut].y - p[L.rightEyeIn].y,
    p[L.rightEyeOut].x - p[L.rightEyeIn].x,
  );
  // Eyes mirror across midline — flip the right side so positive = upturned
  // for both, then average.
  const avgTilt = (lTilt + -rTilt) / 2;
  // Image coordinates are y-down, so an upturned outer corner has lower y
  // -> negative tilt. Flip sign so "upturned" reads as positive.
  const upturned = -avgTilt;
  const cantalIdeal = 0.12; // ~7°, the looksmaxx "positive cantal tilt" target
  const cantalDeviation = clamp01(norm(Math.abs(upturned - cantalIdeal), 0.03, 0.30));

  // Inversion: reward deviation from ideal — but keep magnitude modest.
  const inversion = clamp01(
    0.5 * (1 - symmetryIdeal) +
    0.3 * ratioDeviation +
    0.2 * cantalDeviation,
  );

  return { symmetryIdeal, ratioDeviation, cantalDeviation, inversion };
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

    /* volatility: mean stddev across the live numeric spatial channels */
    const channels: Array<keyof Pick<SpatialFeatures,
      "asymmetry" | "mouthDistortion" | "teethExposure" | "eyeChaos" | "chinCompression" | "headAngle"
    >> = [
      "asymmetry", "mouthDistortion", "teethExposure", "eyeChaos", "chinCompression", "headAngle",
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
      0.23 * spatial.mouthDistortion +
      0.10 * spatial.teethExposure +
      0.18 * spatial.eyeChaos +
      0.19 * spatial.asymmetry +
      0.15 * spatial.chinCompression +
      0.15 * spatial.headAngle;
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
  emotion: EmotionFeatures;
  structure: StructureFeatures;
  chaosEnergy: number;       // 0..1 — composite "stress signal" for HUD
  readouts: {
    chaosEnergy: "DORMANT" | "RISING" | "HIGH" | "EXTREME";
    emotion: "NEUTRAL" | "SURPRISE" | "ANGER" | "CONFUSION" | "EXAGGERATED";
    performance: "IDLE" | "ACTIVE" | "INTENSE" | "EXTREME";
    deviation: number;       // facial deviation %
  };
  score: number; // 0..10
}

/**
 * Default weights — sum doesn't need to be 1, we normalize.
 * Tweak liberally; entertainment > accuracy.
 */
export const DEFAULT_WEIGHTS = {
  // PHILOSOPHY: "ugliness / unmoggable look" score.
  // HIGH when: double chin, facial asymmetry, negative cantal tilt,
  // weird/contorted lips, tongue out, bad/yellow teeth, sneers, eye
  // mismatch, ratio deviation. LOW when: symmetric, smiling, clean skin,
  // facing camera with neutral pose. Hollow cheeks = NEUTRAL (not bad).
  asymmetry: 2.20,
  chinCompression: 2.80,     // double-chin / jowls — heaviest
  mouthDistortion: 1.40,     // weird lips, funny faces, tongue-out proxy
  teethExposure: 0.60,       // wide gaping mouth bumps it
  eyeChaos: 0.80,
  headAngle: 0.05,
  expressionVolatility: 0.15,
  motionInstability: 0.05,
  audioEnergy: 0.0,
  audioPitch: 0.0,
  audioEntropy: 0.0,
  audioSpike: 0.0,
  commitment: 0.30,
};

export type Weights = typeof DEFAULT_WEIGHTS;

/** Drop tiny noise so micro-jitters don't move the score. */
function deadzone(v: number, threshold = 0.06): number {
  if (!Number.isFinite(v) || v <= threshold) return 0;
  return (v - threshold) / (1 - threshold);
}

/** Smooth, bounded sigmoid mapping a weighted sum into 0..1.
 *  k controls steepness; mid is the inflection point. */
function sigmoid01(x: number, k = 6, mid = 0.45): number {
  return 1 / (1 + Math.exp(-k * (x - mid)));
}

export function scoreFromFeatures(
  s: SpatialFeatures,
  t: TemporalFeatures,
  a: AudioFeatures,
  w: Weights = DEFAULT_WEIGHTS,
  prevScore = 0,
  e: EmotionFeatures = { surprise: 0, anger: 0, confusion: 0, exaggeration: 0, intensity: 0, smile: 0, grimace: 0 },
  st: StructureFeatures = { symmetryIdeal: 0, ratioDeviation: 0, cantalDeviation: 0, inversion: 0 },
  skinRoughness = 0,
  dentalSignal = 0,
  /** 0..1 — multiplied into the final score. Low = no face / unstable. */
  confidence = 1,
): ChaosBreakdown {
  // ---- 1. Dead-zoned, normalized features --------------------------------
  // Every feature is already 0..1 from extraction. Apply a small dead zone
  // so micro-jitter (lighting flicker, sub-pixel landmark noise) yields 0.
  const f = {
    asymmetry:           deadzone(s.asymmetry),
    mouthDistortion:     deadzone(s.mouthDistortion, 0.10),
    teethExposure:       deadzone(s.teethExposure, 0.08),
    eyeChaos:            deadzone(s.eyeChaos, 0.08),
    chinCompression:     deadzone(s.chinCompression, 0.08),
    headAngle:           deadzone(s.headAngle, 0.10),
    expressionVolatility:deadzone(t.expressionVolatility, 0.05),
    motionInstability:   deadzone(t.motionInstability, 0.05),
    audioEnergy:         deadzone(a.energy, 0.08),
    audioPitch:          deadzone(a.pitchVariation, 0.08),
    audioEntropy:        deadzone(a.spectralEntropy, 0.05),
    audioSpike:          deadzone(a.spike, 0.10),
    commitment:          deadzone(t.commitment, 0.10),
  };

  // ---- 2. STRUCTURAL UGLINESS (dominant) ---------------------------------
  // Things that make a face actually look bad regardless of what it's doing:
  // double chin, facial asymmetry, ratio deviation from canonical thirds,
  // negative/flat cantal tilt. Cantal deviation is heavily boosted because
  // it's the single biggest "unmoggable" structural cue.
  const structuralUgly = clamp01(
    0.34 * f.chinCompression +
    0.24 * f.asymmetry +
    0.16 * st.ratioDeviation +
    0.26 * st.cantalDeviation
  );

  // ---- 3. SURFACE UGLINESS — skin + teeth ---------------------------------
  const surfaceUgly = clamp01(
    0.55 * skinRoughness +
    0.45 * dentalSignal
  );

  // ---- 4. EXPRESSION UGLINESS — funny faces, weird lips, tongue out ------
  // Reward contorted / asymmetric / wide-gaping mouths and grimaces. Smiles
  // are neutralised but no longer give a giant credit. A wide open mouth
  // with high lip-stretch is a tongue-out / weird-face proxy and counts
  // even WITHOUT a grimace.
  const tongueProxy = clamp01(f.teethExposure * 1.1 + f.mouthDistortion * 0.6);
  const weirdLips = clamp01(f.mouthDistortion * (1 - e.smile * 0.6));
  const grimaceLike = clamp01(
    0.30 * e.grimace +
    0.15 * (e.anger * (1 - e.smile)) +
    0.20 * weirdLips +
    0.20 * tongueProxy +
    0.10 * (f.mouthDistortion * f.chinCompression * 1.6) +
    0.05 * f.eyeChaos
  );

  // ---- 5. BEAUTY CREDIT (subtracted, lighter) -----------------------------
  // Smaller subtraction so genuine ugliness signals can climb high. We do
  // NOT subtract for hollow cheeks or sharp jaw — those are good looks
  // and absent from this composite. Smile contribution is reduced so
  // "funny faces" with smiles still register as chaotic.
  const teethWhiteness = clamp01(1 - dentalSignal);
  const skinSmoothness = clamp01(1 - skinRoughness);
  const beauty = clamp01(
    0.34 * st.symmetryIdeal +
    0.18 * (1 - st.ratioDeviation) +
    0.18 * (1 - st.cantalDeviation) +    // POSITIVE cantal tilt = beauty
    0.08 * e.smile +
    0.10 * skinSmoothness +
    0.08 * teethWhiteness +
    0.04 * (1 - f.headAngle)
  );

  // ---- 6. COMBINE ---------------------------------------------------------
  const ugliness = clamp01(
    0.42 * structuralUgly +
    0.24 * surfaceUgly +
    0.34 * grimaceLike
  );

  // Lighter beauty subtraction so a real double-chin / sneer / tongue-out
  // / negative cantal tilt frame can land in the 7–10 zone.
  const combined = clamp01(ugliness - 0.22 * beauty);

  // Lower midpoint + steeper slope so bad-look frames climb fast while a
  // clean neutral face still stays under ~3/10.
  let target01 = sigmoid01(combined, 7.5, 0.26);

  // ---- 5. Confidence weighting -------------------------------------------
  const conf = clamp01(confidence);
  target01 = target01 * conf;

  const targetScore = target01 * 10;

  // ---- 6. Temporal stability — EMA + clamped delta -----------------------
  // alpha controls smoothing (0.20–0.30 sweet spot).
  // Hard cap on per-frame change keeps the readout believable.
  const alpha = 0.22;
  const delta = targetScore - prevScore;
  const maxJump = 0.8; // ~0.8 / frame at 30 FPS = full-range swing in ~0.5 s
  const clampedDelta = Math.max(-maxJump, Math.min(maxJump, delta));
  let score = prevScore + alpha * clampedDelta;
  if (score < 0) score = 0;
  if (score > 10) score = 10;

  // Composite "chaos energy" (HUD readout — does NOT feed back into score).
  const chaosEnergy = clamp01(
    0.35 * t.motionInstability +
    0.30 * t.expressionVolatility +
    0.20 * a.energy +
    0.15 * a.spike,
  );

  // Status labels for HUD
  const chaosLabel: ChaosBreakdown["readouts"]["chaosEnergy"] =
    chaosEnergy > 0.78 ? "EXTREME" : chaosEnergy > 0.55 ? "HIGH" : chaosEnergy > 0.30 ? "RISING" : "DORMANT";
  const emotions: Array<[ChaosBreakdown["readouts"]["emotion"], number]> = [
    ["SURPRISE", e.surprise], ["ANGER", e.anger],
    ["CONFUSION", e.confusion], ["EXAGGERATED", e.exaggeration],
  ];
  emotions.sort((x, y) => y[1] - x[1]);
  const emotionLabel = emotions[0][1] > 0.45 ? emotions[0][0] : "NEUTRAL";
  const perfLabel: ChaosBreakdown["readouts"]["performance"] =
    score > 8.5 ? "EXTREME" : score > 6.5 ? "INTENSE" : score > 3.5 ? "ACTIVE" : "IDLE";

  return {
    spatial: s, temporal: t, audio: a, emotion: e, structure: st,
    chaosEnergy, score,
    readouts: {
      chaosEnergy: chaosLabel,
      emotion: emotionLabel,
      performance: perfLabel,
      deviation: Math.round(st.inversion * 100),
    },
  };
}