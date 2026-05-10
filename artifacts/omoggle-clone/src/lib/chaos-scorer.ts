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
  // NOTE: do NOT include jawToChinSpan — a sharp/defined jaw makes that
  // distance small and would falsely register as "double chin". Real chin
  // compression shows up as the lower-face span collapsing toward the
  // mouth, plus overall vertical face squash from a tucked head.
  const chinCompression = clamp01(
    0.65 * norm(0.62 - lowerFaceSpan, 0, 0.34) +
    0.35 * faceSquash,
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
  /** 0..1 — only fires for symmetric, balanced, "real" smiles. */
  genuineSmile: number;
  /** 0..1 — asymmetric / lopsided / smirk smile. Counts as WEIRD, not good. */
  weirdSmile: number;
  /** 0..1 — mouth wide+open with corners NOT up (tongue-out / gape). */
  tongueOut: number;
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
  const smileRaw = norm(cornerLift, 0.005, 0.06);
  const smile = clamp01(smileRaw * (0.55 + 0.45 * cornerSym) * (0.6 + 0.4 * widening));
  // Genuine smile = corners up AND symmetric. Lopsided "smiles" don't count.
  const genuineSmile = clamp01(smileRaw * cornerSym * cornerSym * (0.5 + 0.5 * widening));
  // Weird smile = corners up but asymmetric (smirk / sneer-smile).
  const weirdSmile = clamp01(smileRaw * (1 - cornerSym) * 1.4);
  const grimace = clamp01(norm(-cornerLift, 0.005, 0.05) * (0.5 + 0.5 * (1 - cornerSym * 0.5)));
  // Tongue-out / gape: mouth very open AND wide, but corners NOT lifted.
  const mouthOpenness = norm(mouthOpen, 0.06, 0.42);
  const mouthWideness = norm(mouthWide, 0.62, 1.05);
  const tongueOut = clamp01(
    mouthOpenness * (0.5 + 0.5 * mouthWideness) * (1 - smileRaw * 0.7),
  );

  const intensity = clamp01(
    Math.max(surprise, anger, confusion, exaggeration) * 0.7 +
    0.3 * (surprise + anger + confusion + exaggeration) / 4,
  );

  return { surprise, anger, confusion, exaggeration, intensity, smile, grimace, genuineSmile, weirdSmile, tongueOut };
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
  /** TRUE when no face is reliably detected → score is 0 and HUD should grey out. */
  noFace: boolean;
  /** Top contributors to the *current* score, for the live HUD. */
  traits: {
    good: Array<{ label: string; v: number }>; // why score is LOW (aesthetic)
    bad: Array<{ label: string; v: number }>;  // why score is HIGH (chaos)
  };
  score: number; // 0..10
}

/**
 * Default weights — sum doesn't need to be 1, we normalize.
 * Tweak liberally; entertainment > accuracy.
 */
export const DEFAULT_WEIGHTS = {
  // UNMOG v2 — performance > structure.
  // PERFORMANCE BLOCK (75% of score) — what the user is *doing*.
  distortion: 0.22,            // mouth / lip / tongue contortion
  eyeChaos: 0.16,              // wide / squint / mismatched eyes
  chinCompression: 0.22,       // double-chin / lower-face squash
  motionInstability: 0.12,     // erratic head movement
  expressionVolatility: 0.10,  // expression changing fast
  commitment: 0.18,            // sustained chaos
  // STRUCTURAL BLOCK (25% of score) — static facial geometry.
  asymmetry: 0.40,
  ratioDeviation: 0.25,
  cantalDeviation: 0.35,
  // Bonus: awkward head angle nudges score up slightly.
  headAngle: 0.06,
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
  _w: Weights = DEFAULT_WEIGHTS,
  prevScore = 0,
  e: EmotionFeatures = { surprise: 0, anger: 0, confusion: 0, exaggeration: 0, intensity: 0, smile: 0, grimace: 0, genuineSmile: 0, weirdSmile: 0, tongueOut: 0 },
  st: StructureFeatures = { symmetryIdeal: 0, ratioDeviation: 0, cantalDeviation: 0, inversion: 0 },
  _skinRoughness = 0,
  _dentalSignal = 0,
  /** 0..1 — multiplied into the final score. Low = no face / unstable. */
  confidence = 1,
): ChaosBreakdown {
  // ---- Confidence gate: no face → return zeroed, neutral breakdown -------
  const conf0 = clamp01(confidence);
  if (conf0 < 0.2) {
    return {
      spatial: s, temporal: t, audio: a, emotion: e, structure: st,
      chaosEnergy: 0, score: 0, noFace: true,
      traits: { good: [], bad: [] },
      readouts: { chaosEnergy: "DORMANT", emotion: "NEUTRAL", performance: "IDLE", deviation: 0 },
    };
  }
  // ============================================================
  // UNMOG SCORING v3 — PERFORMANCE-FIRST
  //   aesthetic / composed → 1–3
  //   neutral resting      → 2–4
  //   mild silly           → 4–6
  //   strong performance   → 6–8
  //   extreme distortion   → 8–10
  // Pipeline: bucket (mouth/eye/jaw/emotion) → weighted sum
  //           → sigmoid → 0..10 → fast attack / slow release
  // ============================================================
  const conf = conf0;
  const dz = (v: number, th = 0.06) => deadzone(v, th);

  // ---- 1. MOUTH CHAOS bucket -------------------------------------------
  // Anything weird the mouth/lips can do. Genuine symmetric smiles do NOT
  // veto this anymore — they're handled later via a "composed face" credit.
  const mouthChaos = clamp01(
    0.45 * s.mouthDistortion +
    0.30 * e.tongueOut +
    0.22 * e.weirdSmile +
    0.18 * e.grimace +
    0.12 * s.teethExposure,
  );

  // ---- 2. EYE / BROW PERFORMANCE bucket --------------------------------
  // Wide bug-eyes, hard squints, lopsided eyes, raised/lowered brows.
  const eyePerf = clamp01(
    0.55 * s.eyeChaos +
    0.35 * e.surprise +    // wide eyes + raised brow
    0.30 * e.anger +       // lowered brow + tense
    0.30 * e.confusion +   // asym brow + squint
    0.22 * e.exaggeration,
  );

  // ---- 3. JAW / LOWER-FACE bucket --------------------------------------
  // Chin tuck, jaw skew, head twist, overall jawline asymmetry.
  const jawChaos = clamp01(
    0.55 * s.chinCompression +
    0.35 * s.asymmetry +
    0.30 * s.headAngle,
  );

  // ---- 4. TEMPORAL bucket ----------------------------------------------
  const tempo = clamp01(
    0.40 * t.motionInstability +
    0.30 * t.expressionVolatility +
    0.40 * t.commitment +
    0.25 * t.peak,
  );

  // ---- 5. Structural deviation (small static contribution) -------------
  const structural = clamp01(
    0.40 * st.ratioDeviation +
    0.35 * st.cantalDeviation +
    0.25 * (1 - st.symmetryIdeal),
  );

  // ---- 6. Composite — performance dominates ----------------------------
  // Weights tuned so a single bucket maxed out → ~6, two maxed → ~8,
  // three+ maxed → ~9-10.
  const composite = clamp01(
    0.34 * dz(mouthChaos, 0.08) +
    0.26 * dz(eyePerf,   0.08) +
    0.26 * dz(jawChaos,  0.08) +
    0.10 * dz(tempo,     0.08) +
    0.08 * dz(structural,0.06)
  );

  // ---- 7. Composed-face credit (subtractive, replaces smile veto) ------
  // Only fires when the WHOLE face is calm — symmetric, low distortion,
  // low motion, no weird mouth or eye signals. Pulls "good looking" faces
  // down into 1–3.
  const calmness = clamp01(
    1
    - 1.3 * mouthChaos
    - 1.0 * eyePerf
    - 1.0 * jawChaos
    - 0.8 * t.motionInstability
    - 0.6 * t.expressionVolatility
  );
  const composed = clamp01(
    0.50 * calmness +
    0.30 * st.symmetryIdeal +
    0.20 * (1 - st.ratioDeviation)
  );
  const adjusted = clamp01(composite - 0.12 * composed);

  // ---- 8. Sigmoid → 0..10 ----------------------------------------------
  const target01 = sigmoid01(adjusted, 6.0, 0.28) * conf;
  const targetScore = target01 * 10;

  // ---- 9. Fast attack / slow release + dead-band -----------------------
  // Going UP: respond fast (alpha 0.55) so weird faces are felt instantly.
  // Going DOWN: ease out (alpha 0.18) so brief still-frames don't crash
  // the score. Tiny moves under ±0.20 hold the previous value.
  let score: number;
  const diff = targetScore - prevScore;
  if (Math.abs(diff) < 0.20) {
    score = prevScore;
  } else {
    const alpha = diff > 0 ? 0.55 : 0.18;
    const maxJump = diff > 0 ? 3.0 : 1.2;
    const clampedDelta = Math.max(-maxJump, Math.min(maxJump, diff));
    score = prevScore + alpha * clampedDelta;
  }
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

  // ---- TRAITS: which channels drive the current score -------------------
  const badChannels: Array<{ label: string; v: number }> = [
    { label: "Mouth distortion",  v: s.mouthDistortion },
    { label: "Tongue / gape",     v: e.tongueOut },
    { label: "Asymmetric smirk",  v: e.weirdSmile },
    { label: "Grimace",           v: e.grimace },
    { label: "Eye chaos",         v: s.eyeChaos },
    { label: "Chin compression",  v: s.chinCompression },
    { label: "Anger",             v: e.anger },
    { label: "Surprise",          v: e.surprise },
    { label: "Head angle",        v: s.headAngle },
    { label: "Motion instability",v: t.motionInstability },
    { label: "Asymmetry",         v: s.asymmetry },
    { label: "Cantal deviation",  v: st.cantalDeviation },
  ].filter((x) => x.v > 0.18).sort((x, y) => y.v - x.v).slice(0, 3);

  const goodChannels: Array<{ label: string; v: number }> = [
    { label: "Facial symmetry",     v: st.symmetryIdeal },
    { label: "Ideal proportions",   v: 1 - st.ratioDeviation },
    { label: "Positive cantal tilt",v: 1 - st.cantalDeviation },
    { label: "Genuine smile",       v: e.genuineSmile },
    { label: "Composed expression", v: 1 - clamp01(s.mouthDistortion + e.weirdSmile + e.grimace) },
    { label: "Steady head",         v: 1 - s.headAngle },
    { label: "Calm eyes",           v: 1 - s.eyeChaos },
  ].filter((x) => x.v > 0.55).sort((x, y) => y.v - x.v).slice(0, 3);

  return {
    spatial: s, temporal: t, audio: a, emotion: e, structure: st,
    chaosEnergy, score, noFace: false,
    traits: { good: goodChannels, bad: badChannels },
    readouts: {
      chaosEnergy: chaosLabel,
      emotion: emotionLabel,
      performance: perfLabel,
      deviation: Math.round(st.inversion * 100),
    },
  };
}