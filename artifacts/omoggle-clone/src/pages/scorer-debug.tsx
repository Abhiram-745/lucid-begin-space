import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, Mic, MicOff } from "lucide-react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import {
  AudioTracker,
  TemporalTracker,
  extractSpatial,
  extractEmotion,
  extractStructure,
  scoreFromFeatures,
  type ChaosBreakdown,
} from "@/lib/chaos-scorer";
import { analyzeSkin } from "@/lib/skin-analyzer";

/** Connection sets shipped with @mediapipe/tasks-vision — typed loosely so
 *  we don't depend on the internal Connection shape. */
const TESSELATION = (FaceLandmarker as unknown as {
  FACE_LANDMARKS_TESSELATION: Array<{ start: number; end: number }>;
}).FACE_LANDMARKS_TESSELATION;
const FACE_OVAL = (FaceLandmarker as unknown as {
  FACE_LANDMARKS_FACE_OVAL: Array<{ start: number; end: number }>;
}).FACE_LANDMARKS_FACE_OVAL;
const LIPS = (FaceLandmarker as unknown as {
  FACE_LANDMARKS_LIPS: Array<{ start: number; end: number }>;
}).FACE_LANDMARKS_LIPS;
const LEFT_EYE = (FaceLandmarker as unknown as {
  FACE_LANDMARKS_LEFT_EYE: Array<{ start: number; end: number }>;
}).FACE_LANDMARKS_LEFT_EYE;
const RIGHT_EYE = (FaceLandmarker as unknown as {
  FACE_LANDMARKS_RIGHT_EYE: Array<{ start: number; end: number }>;
}).FACE_LANDMARKS_RIGHT_EYE;
const LEFT_BROW = (FaceLandmarker as unknown as {
  FACE_LANDMARKS_LEFT_EYEBROW: Array<{ start: number; end: number }>;
}).FACE_LANDMARKS_LEFT_EYEBROW;
const RIGHT_BROW = (FaceLandmarker as unknown as {
  FACE_LANDMARKS_RIGHT_EYEBROW: Array<{ start: number; end: number }>;
}).FACE_LANDMARKS_RIGHT_EYEBROW;

/* Smoothed contour paths through subsets of the FaceMesh vertex set.
 * Indices chosen to draw clean curves with no internal noise. */
const CONTOURS: number[][] = [
  // jawline (left ear -> chin -> right ear)
  [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454],
  // left brow
  [70, 63, 105, 66, 107],
  // right brow
  [336, 296, 334, 293, 300],
  // nose bridge
  [168, 6, 197, 195, 5, 4, 1],
  // left eye outline
  [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7, 33],
  // right eye outline
  [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249, 263],
  // outer mouth
  [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61],
  // inner mouth
  [78, 81, 13, 311, 308, 402, 14, 178, 78],
];
const NODE_LANDMARKS = [33, 133, 362, 263, 1, 61, 291, 13, 14, 152, 10, 234, 454];

/** Cool-blue → purple → red-pink gradient stop at given chaos [0..1] */
function chaosColor(t: number, alpha = 1) {
  // 3-stop gradient: cyan(190°) -> purple(285°) -> hot pink(335°)
  const h = t < 0.5 ? 190 + (285 - 190) * (t / 0.5) : 285 + (335 - 285) * ((t - 0.5) / 0.5);
  const s = 90;
  const l = 55 + t * 10;
  return `hsla(${h.toFixed(1)}, ${s}%, ${l}%, ${alpha})`;
}

/** Catmull-Rom-ish smooth stroke through a sequence of points. */
function strokeSmooth(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;
    ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-[10px] font-black uppercase tracking-[0.2em]">
        <span className="text-white/55">{label}</span>
        <span className="text-white tabular-nums">{pct}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#a855f7,#f43f5e)] transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ScorerDebug() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timeBufRef = useRef<Float32Array | null>(null);
  const freqBufRef = useRef<Uint8Array | null>(null);
  const temporalRef = useRef(new TemporalTracker());
  const audioTrackerRef = useRef(new AudioTracker());
  const rafRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  const prevScoreRef = useRef(0);
  const skinRoughnessRef = useRef(0);
  const lastSkinRunRef = useRef(0);
  const skinBusyRef = useRef(false);

  const [modelReady, setModelReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [error, setError] = useState("");
  const [breakdown, setBreakdown] = useState<ChaosBreakdown | null>(null);
  const [hasFace, setHasFace] = useState(false);
  const [skinRoughness, setSkinRoughness] = useState(0);
  const noFaceFramesRef = useRef(0);

  /* Load MediaPipe */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });
        if (!cancelled) {
          landmarkerRef.current = landmarker;
          setModelReady(true);
        }
      } catch (e) {
        if (!cancelled) setError("Failed to load face model.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Open camera + mic */
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
        audio: true,
      })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraReady(true);

        // Audio analyser
        const ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.4;
        src.connect(analyser);
        analyserRef.current = analyser;
        timeBufRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
        freqBufRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        setMicReady(true);
      })
      .catch(() => setError("Camera or microphone access denied."));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /* Per-frame loop */
  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    const analyser = analyserRef.current;

    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // Use the video's NATIVE pixel dimensions so landmark coords (normalized
    // to the source frame) map 1:1 onto the canvas. CSS then scales the
    // canvas with the same object-fit as the video, keeping them aligned.
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    ctx.clearRect(0, 0, w, h);

    if (landmarker && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      try {
        const result = landmarker.detectForVideo(video, performance.now());
        const lm = result.faceLandmarks?.[0];
        if (lm) {
          noFaceFramesRef.current = 0;
          if (!hasFace) setHasFace(true);
          const spatial = extractSpatial(lm);
          const emotion = extractEmotion(lm);
          const structure = extractStructure(lm);
          const temporal = temporalRef.current.update(spatial, lm);

          let audio = { energy: 0, pitchVariation: 0, spectralEntropy: 0, spike: 0 };
          if (analyser && timeBufRef.current && freqBufRef.current) {
            analyser.getFloatTimeDomainData(timeBufRef.current as Float32Array<ArrayBuffer>);
            analyser.getByteFrequencyData(freqBufRef.current as Uint8Array<ArrayBuffer>);
            audio = audioTrackerRef.current.update(
              timeBufRef.current,
              freqBufRef.current,
              audioCtxRef.current?.sampleRate ?? 48000,
            );
          }

          const result2 = scoreFromFeatures(
            spatial,
            temporal,
            audio,
            undefined,
            prevScoreRef.current,
            emotion,
            structure,
            skinRoughnessRef.current,
          );
          prevScoreRef.current = result2.score;
          setBreakdown(result2);

          // ---- Biometric scan overlay ---------------------------------
          // The wrapping container mirrors video + canvas together, so we
          // draw in raw (un-mirrored) source coordinates.
          const t = Math.min(1, result2.score / 10);
          const time = performance.now() / 1000;

          // 1. Face bounding box (for scan line + framing brackets)
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const p of lm) {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
          }
          const bx = minX * w, by = minY * h;
          const bw = (maxX - minX) * w, bh = (maxY - minY) * h;
          const padX = bw * 0.12, padY = bh * 0.10;

          // 2. Corner brackets
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = chaosColor(t, 0.85);
          ctx.shadowColor = chaosColor(t, 0.9);
          ctx.shadowBlur = 10 + t * 18;
          const bracket = Math.min(bw, bh) * 0.18;
          const bx0 = bx - padX, by0 = by - padY;
          const bx1 = bx + bw + padX, by1 = by + bh + padY;
          const corners: Array<[number, number, number, number]> = [
            [bx0, by0, +1, +1], [bx1, by0, -1, +1],
            [bx0, by1, +1, -1], [bx1, by1, -1, -1],
          ];
          for (const [cx0, cy0, sx, sy] of corners) {
            ctx.beginPath();
            ctx.moveTo(cx0, cy0 + sy * bracket);
            ctx.lineTo(cx0, cy0);
            ctx.lineTo(cx0 + sx * bracket, cy0);
            ctx.stroke();
          }

          // 3. FULL TRIANGULATED FACE MESH (FACEMESH_TESSELATION)
          //    Drawn first, low opacity, glow scales with score.
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = 0.5;
          ctx.shadowBlur = 4 + t * 8;
          ctx.shadowColor = chaosColor(t, 0.6);
          ctx.strokeStyle = chaosColor(t, 0.10 + t * 0.18);
          ctx.beginPath();
          for (let i = 0; i < TESSELATION.length; i++) {
            const c = TESSELATION[i];
            const a = lm[c.start]; const b = lm[c.end];
            if (!a || !b) continue;
            ctx.moveTo(a.x * w, a.y * h);
            ctx.lineTo(b.x * w, b.y * h);
          }
          ctx.stroke();

          // 4. CONTOUR LINES — jawline, brows, eyes, lips. Two passes:
          //    fat soft outer glow + thin crisp inner stroke. Glow scales
          //    aggressively with chaos score.
          const drawContour = (
            conns: Array<{ start: number; end: number }>,
            width: number,
          ) => {
            // Outer glow
            ctx.lineWidth = width + 3 + t * 4;
            ctx.strokeStyle = chaosColor(t, 0.22 + t * 0.22);
            ctx.shadowBlur = 14 + t * 26;
            ctx.shadowColor = chaosColor(t, 0.95);
            ctx.beginPath();
            for (const c of conns) {
              const a = lm[c.start]; const b = lm[c.end];
              if (!a || !b) continue;
              ctx.moveTo(a.x * w, a.y * h);
              ctx.lineTo(b.x * w, b.y * h);
            }
            ctx.stroke();
            // Crisp inner stroke
            ctx.lineWidth = width;
            ctx.strokeStyle = chaosColor(t, 0.98);
            ctx.shadowBlur = 6 + t * 8;
            ctx.stroke();
          };
          drawContour(FACE_OVAL, 1.2);
          drawContour(LEFT_BROW, 1.4);
          drawContour(RIGHT_BROW, 1.4);
          drawContour(LEFT_EYE, 1.1);
          drawContour(RIGHT_EYE, 1.1);
          drawContour(LIPS, 1.3);

          // 5. Pulsing landmark nodes
          const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
          for (const idx of NODE_LANDMARKS) {
            const p = lm[idx];
            if (!p) continue;
            const x = p.x * w, y = p.y * h;
            const r = 2.2 + pulse * 1.4 + t * 1.6;
            ctx.shadowBlur = 12 + t * 16;
            ctx.shadowColor = chaosColor(t, 0.9);
            ctx.fillStyle = chaosColor(t, 0.25);
            ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = chaosColor(t, 1);
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
          }

          // 6. Horizontal scan line sweeping across face bbox
          const sweep = (Math.sin(time * 1.3) * 0.5 + 0.5);
          const scanY = by0 + sweep * (by1 - by0);
          const grad = ctx.createLinearGradient(bx0, scanY, bx1, scanY);
          grad.addColorStop(0, chaosColor(t, 0));
          grad.addColorStop(0.5, chaosColor(t, 0.9));
          grad.addColorStop(1, chaosColor(t, 0));
          ctx.shadowBlur = 18 + t * 22;
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(bx0, scanY);
          ctx.lineTo(bx1, scanY);
          ctx.stroke();

          // 7. High-chaos glitch tear
          if (t > 0.7 && Math.random() < 0.25) {
            const ty = by0 + Math.random() * (by1 - by0);
            ctx.fillStyle = chaosColor(t, 0.18);
            ctx.shadowBlur = 0;
            ctx.fillRect(bx0, ty, bx1 - bx0, 2);
          }

          ctx.shadowBlur = 0;

          // 8. TF.js skin-roughness sample — runs every ~400ms on the
          //    cheek/forehead region. Result feeds the next score frame.
          const now = performance.now();
          if (!skinBusyRef.current && now - lastSkinRunRef.current > 400) {
            lastSkinRunRef.current = now;
            skinBusyRef.current = true;
            // Sample a tighter inner region (avoid hairline + jaw edges).
            const sx = bx + bw * 0.18;
            const sy = by + bh * 0.20;
            const sw = bw * 0.64;
            const sh = bh * 0.55;
            analyzeSkin(video, sx, sy, sw, sh)
              .then((r) => {
                // Smooth the roughness signal so it doesn't jitter the score.
                skinRoughnessRef.current =
                  skinRoughnessRef.current * 0.7 + r.roughness * 0.3;
                setSkinRoughness(skinRoughnessRef.current);
              })
              .catch(() => {})
              .finally(() => { skinBusyRef.current = false; });
          }
        }
        else {
          noFaceFramesRef.current += 1;
          // Tolerate brief drops (~10 frames) before hiding the score box.
          if (noFaceFramesRef.current > 10 && hasFace) {
            setHasFace(false);
            prevScoreRef.current = 0;
          }
        }
      } catch {
        // skip frame
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!modelReady || !cameraReady) return;
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [modelReady, cameraReady, tick]);

  const score = breakdown?.score ?? 0;
  const scoreColor =
    score < 3 ? "text-white/60" : score < 6 ? "text-cyan-200" : score < 8 ? "text-fuchsia-300" : "text-rose-400";

  return (
    <div className="relative min-h-screen overflow-hidden bg-black font-mono text-white">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,22,28,0.85),rgba(7,7,10,1)_45%,rgba(21,10,25,0.95))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.10),transparent_30%),radial-gradient(circle_at_75%_70%,rgba(168,85,247,0.14),transparent_32%)]" />
      <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:42px_42px]" />

      <header className="relative z-20 flex h-16 items-center justify-between border-b border-white/10 bg-black/45 px-4 backdrop-blur-md sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/55 transition hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Home
        </Link>
        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.24em]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-fuchsia-400 shadow-[0_0_12px_rgba(232,121,249,0.85)]" />
          UNMOG Scorer · Debug
        </div>
        <div className="hidden items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 sm:flex">
          {micReady ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          {modelReady ? "Model OK" : "Loading model"}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[1320px] flex-col px-4 py-5 sm:px-6">
        <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_380px]">
          {/* Camera */}
          <div className="relative min-h-[480px] overflow-hidden rounded-[34px] border border-white/14 bg-[#070914] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_80px_rgba(0,0,0,0.46)]">
            {/* Mirror wrapper: flips video AND canvas together so landmarks stay aligned in selfie view */}
            <div className="absolute inset-0 -scale-x-100">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${
                  cameraReady ? "opacity-100" : "opacity-0"
                }`}
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full object-contain pointer-events-none"
              />
            </div>

            {/* Big score — only while a face is locked */}
            {hasFace ? (
            <div className="absolute left-6 top-6 rounded-[20px] border border-white/15 bg-black/60 px-5 py-3 backdrop-blur-md">
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/45">
                UNMOG score
              </div>
              <div className={`mt-1 text-6xl font-black tabular-nums tracking-[-0.06em] ${scoreColor}`}>
                {score.toFixed(1)}
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
                / 10
              </div>
            </div>
            ) : (
              <div className="absolute left-6 top-6 rounded-[20px] border border-white/15 bg-black/60 px-5 py-3 backdrop-blur-md">
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/45">
                  Awaiting subject
                </div>
                <div className="mt-1 text-2xl font-black tracking-[-0.04em] text-white/35">
                  NO FACE
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/30">
                  Position face in frame
                </div>
              </div>
            )}

            {/* Scan readouts */}
            {hasFace && breakdown && breakdown.readouts && breakdown.emotion && breakdown.structure && (
              <div className="absolute right-6 top-6 w-[260px] space-y-1.5 rounded-[20px] border border-white/15 bg-black/60 p-4 backdrop-blur-md">
                <ReadoutRow
                  label="Chaos Energy"
                  value={breakdown.readouts.chaosEnergy}
                  tone={breakdown.chaosEnergy ?? 0}
                />
                <ReadoutRow
                  label="Emotional Signal"
                  value={breakdown.readouts.emotion}
                  tone={breakdown.emotion.intensity ?? 0}
                />
                <ReadoutRow
                  label="Performance"
                  value={breakdown.readouts.performance}
                  tone={Math.min(1, score / 10)}
                />
                <ReadoutRow
                  label="Facial Deviation"
                  value={`${breakdown.readouts.deviation}%`}
                  tone={breakdown.structure.inversion ?? 0}
                />
                <div className="pt-1 text-[8px] font-black uppercase tracking-[0.22em] text-white/30">
                  Simulated · entertainment only
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center">
                <div>
                  <div className="text-2xl font-black uppercase tracking-[0.16em] text-white">
                    Permission needed
                  </div>
                  <div className="mt-3 text-sm font-bold uppercase tracking-[0.12em] text-white/45">
                    {error}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live features */}
          <aside className="rounded-[34px] border border-white/12 bg-white/[0.045] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_80px_rgba(0,0,0,0.32)] backdrop-blur-md">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-fuchsia-300">
              Biometric readings
            </div>
            <h1 className="mt-3 text-2xl font-black uppercase tracking-[0.10em] text-white">
              Chaos Telemetry
            </h1>
            <p className="mt-3 text-[11px] font-bold uppercase leading-relaxed tracking-[0.12em] text-white/40">
              Performative biometrics only. No identity, no demographics.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200 mb-2">
                  Spatial · facial geometry
                </div>
                <div className="space-y-2.5">
                  <Bar label="Facial asymmetry index" value={breakdown?.spatial.asymmetry ?? 0} />
                  <Bar label="Expression distortion" value={breakdown?.spatial.mouthDistortion ?? 0} />
                  <Bar label="Ocular instability" value={breakdown?.spatial.eyeChaos ?? 0} />
                  <Bar label="Lower face compression" value={breakdown?.spatial.chinCompression ?? 0} />
                  <Bar label="Cranial deviation" value={breakdown?.spatial.headAngle ?? 0} />
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200 mb-2">
                  Temporal · motion over time
                </div>
                <div className="space-y-2.5">
                  <Bar label="Temporal chaos" value={breakdown?.temporal.expressionVolatility ?? 0} />
                  <Bar label="Motion instability" value={breakdown?.temporal.motionInstability ?? 0} />
                  <Bar label="Commitment lock" value={breakdown?.temporal.commitment ?? 0} />
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200 mb-2">
                  Audio · vocal disruption
                </div>
                <div className="space-y-2.5">
                  <Bar label="Audio disruption" value={breakdown?.audio.energy ?? 0} />
                  <Bar label="Pitch deviation" value={breakdown?.audio.pitchVariation ?? 0} />
                  <Bar label="Spectral entropy" value={breakdown?.audio.spectralEntropy ?? 0} />
                  <Bar label="Vocal spike" value={breakdown?.audio.spike ?? 0} />
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-300 mb-2">
                  Perceived emotion · simulated
                </div>
                <div className="space-y-2.5">
                  <Bar label="Surprise" value={breakdown?.emotion?.surprise ?? 0} />
                  <Bar label="Anger tension" value={breakdown?.emotion?.anger ?? 0} />
                  <Bar label="Confusion" value={breakdown?.emotion?.confusion ?? 0} />
                  <Bar label="Exaggeration" value={breakdown?.emotion?.exaggeration ?? 0} />
                  <Bar label="Cortical overload (sim.)" value={breakdown?.chaosEnergy ?? 0} />
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-300 mb-2">
                  Structural inversion · low weight
                </div>
                <div className="space-y-2.5">
                  <Bar label="Aesthetic deviation" value={breakdown?.structure ? 1 - breakdown.structure.symmetryIdeal : 0} />
                  <Bar label="Ratio mismatch" value={breakdown?.structure?.ratioDeviation ?? 0} />
                  <Bar label="Cantal tilt deviation" value={breakdown?.structure?.cantalDeviation ?? 0} />
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function ReadoutRow({ label, value, tone }: { label: string; value: string; tone: number }) {
  const t = Math.max(0, Math.min(1, tone));
  const hue = t < 0.5 ? 190 + (285 - 190) * (t / 0.5) : 285 + (335 - 285) * ((t - 0.5) / 0.5);
  return (
    <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.18em]">
      <span className="text-white/45">{label}</span>
      <span
        className="rounded-md border px-2 py-0.5 tabular-nums"
        style={{
          color: `hsl(${hue}, 90%, 70%)`,
          borderColor: `hsla(${hue}, 90%, 60%, 0.5)`,
          backgroundColor: `hsla(${hue}, 90%, 50%, 0.10)`,
          textShadow: `0 0 8px hsla(${hue}, 90%, 60%, 0.55)`,
        }}
      >
        {value}
      </span>
    </div>
  );
}