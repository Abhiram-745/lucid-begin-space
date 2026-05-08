import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, Mic, MicOff } from "lucide-react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import {
  AudioTracker,
  TemporalTracker,
  extractSpatial,
  scoreFromFeatures,
  type ChaosBreakdown,
} from "@/lib/chaos-scorer";

const KEY_LANDMARKS = [
  10, 33, 133, 362, 263, 1, 61, 291, 152, 234, 454, 13, 14, 159, 145, 386, 374,
];

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

  const [modelReady, setModelReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [error, setError] = useState("");
  const [breakdown, setBreakdown] = useState<ChaosBreakdown | null>(null);

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
          const spatial = extractSpatial(lm);
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
          );
          prevScoreRef.current = result2.score;
          setBreakdown(result2);

          // Overlay. The wrapping container mirrors BOTH video and canvas,
          // so we draw landmarks in raw (un-mirrored) source coordinates.
          for (const idx of KEY_LANDMARKS) {
            const p = lm[idx];
            if (!p) continue;
            const x = p.x * w;
            const y = p.y * h;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(168,85,247,0.35)";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x, y, 2.4, 0, Math.PI * 2);
            ctx.fillStyle = "#22e96b";
            ctx.fill();
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

            {/* Big score */}
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
              Feature breakdown
            </div>
            <h1 className="mt-3 text-2xl font-black uppercase tracking-[0.10em] text-white">
              Realtime Chaos
            </h1>
            <p className="mt-3 text-[11px] font-bold uppercase leading-relaxed tracking-[0.12em] text-white/40">
              Performative scoring only. No identity, no demographics.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200 mb-2">
                  Spatial
                </div>
                <div className="space-y-2.5">
                  <Bar label="Asymmetry" value={breakdown?.spatial.asymmetry ?? 0} />
                  <Bar label="Mouth distortion" value={breakdown?.spatial.mouthDistortion ?? 0} />
                  <Bar label="Eye chaos" value={breakdown?.spatial.eyeChaos ?? 0} />
                  <Bar label="Chin compression" value={breakdown?.spatial.chinCompression ?? 0} />
                  <Bar label="Head angle" value={breakdown?.spatial.headAngle ?? 0} />
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200 mb-2">
                  Temporal
                </div>
                <div className="space-y-2.5">
                  <Bar label="Volatility" value={breakdown?.temporal.expressionVolatility ?? 0} />
                  <Bar label="Motion" value={breakdown?.temporal.motionInstability ?? 0} />
                  <Bar label="Commitment" value={breakdown?.temporal.commitment ?? 0} />
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200 mb-2">
                  Audio
                </div>
                <div className="space-y-2.5">
                  <Bar label="Energy" value={breakdown?.audio.energy ?? 0} />
                  <Bar label="Pitch variation" value={breakdown?.audio.pitchVariation ?? 0} />
                  <Bar label="Spectral entropy" value={breakdown?.audio.spectralEntropy ?? 0} />
                  <Bar label="Spike" value={breakdown?.audio.spike ?? 0} />
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}