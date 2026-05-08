import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, OctagonX, Radar, ScanFace, ShieldCheck } from "lucide-react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

type Phase = "searching" | "live";
type LandmarkPoint = { x: number; y: number };

const MATCHMAKING_SECONDS = 10;
const KEY_LANDMARKS = [
  10,  // forehead
  33,  // left eye
  133,
  362, // right eye
  263,
  1,   // nose bridge
  2,   // nose tip
  49,  // left cheek/nose wing
  279, // right cheek/nose wing
  61,  // mouth left
  291, // mouth right
  199, // chin upper
  152, // chin lower
  234, // left jaw
  454, // right jaw
];

function formatStopwatch(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function LiveArena() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("searching");
  const [elapsed, setElapsed] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  const lastLandmarkPointsRef = useRef<LandmarkPoint[]>([]);

  useEffect(() => {
    if (phase !== "searching") return;

    const timer = window.setInterval(() => {
      setElapsed((value) => {
        const next = value + 1;
        if (next >= MATCHMAKING_SECONDS) {
          setPhase("live");
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    let cancelled = false;

    async function loadLandmarker() {
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
      } catch {
        if (!cancelled) {
          setModelReady(false);
        }
      }
    }

    loadLandmarker();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== "live") return;

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
        audio: false,
      })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      })
      .catch(() => {
        setCameraError("Camera access is blocked or unavailable.");
      });

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraReady(false);
    };
  }, [phase]);

  const drawLandmarks = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(drawLandmarks);
      return;
    }

    const rect = video.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(drawLandmarks);
      return;
    }

    if (landmarker && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;

      try {
        const result = landmarker.detectForVideo(video, performance.now());
        const landmarks = result.faceLandmarks?.[0];

        if (landmarks) {
          lastLandmarkPointsRef.current = KEY_LANDMARKS.flatMap((index) => {
            const point = landmarks[index];
            return point ? [{ x: point.x, y: point.y }] : [];
          });
        }
      } catch {
        // MediaPipe can miss a frame while the stream warms up.
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    for (const point of lastLandmarkPointsRef.current) {
      const x = point.x * canvas.width;
      const y = point.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34, 197, 94, 0.34)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = "#22e96b";
      ctx.shadowBlur = 16;
      ctx.shadowColor = "rgba(34, 233, 107, 0.9)";
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
    rafRef.current = requestAnimationFrame(drawLandmarks);
  }, []);

  useEffect(() => {
    if (phase !== "live" || !cameraReady) return;

    rafRef.current = requestAnimationFrame(drawLandmarks);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [cameraReady, drawLandmarks, phase]);

  if (phase === "searching") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-black font-mono text-white">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,22,28,0.88),rgba(8,8,12,1)_45%,rgba(21,10,25,0.96))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_72%_66%,rgba(168,85,247,0.12),transparent_34%)]" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.65)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.65)_1px,transparent_1px)] [background-size:42px_42px]" />

        <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10">
          <Link
            href="/arena"
            className="absolute left-6 top-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/50 transition hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="w-full max-w-[560px] rounded-[36px] border border-cyan-100/20 bg-white/[0.045] p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_100px_rgba(0,0,0,0.44)] backdrop-blur-md">
            <div className="mx-auto mb-9 flex h-28 w-28 items-center justify-center rounded-full border border-cyan-100/20 bg-black shadow-[0_0_80px_rgba(34,211,238,0.14)]">
              <Radar className="h-12 w-12 animate-pulse text-cyan-200" />
            </div>

            <div className="text-xs font-black uppercase tracking-[0.34em] text-cyan-200">
              Matchmaking
            </div>
            <h1 className="mt-5 text-4xl font-black uppercase tracking-[0.16em] text-white">
              Searching for Match
            </h1>

            <div className="mt-8 text-7xl font-black tracking-[-0.08em] text-white">
              {formatStopwatch(elapsed)}
            </div>

            <div className="mt-8 h-2 overflow-hidden rounded-full border border-white/10 bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#22e96b)] shadow-[0_0_24px_rgba(34,211,238,0.45)] transition-all duration-500"
                style={{ width: `${Math.min(100, (elapsed / MATCHMAKING_SECONDS) * 100)}%` }}
              />
            </div>

            <div className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-white/38">
              Test match starts after {MATCHMAKING_SECONDS} seconds
            </div>

            <button
              onClick={() => setLocation("/arena")}
              className="mt-10 inline-flex h-14 min-w-[190px] items-center justify-center gap-3 rounded-full border border-white/12 bg-white/5 px-8 text-sm font-black uppercase tracking-[0.2em] text-white/62 transition hover:border-red-300/45 hover:bg-red-500/10 hover:text-red-200"
            >
              <OctagonX className="h-5 w-5" />
              Abort
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black font-mono text-white">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,20,27,0.82),rgba(7,7,10,1)_42%,rgba(19,9,22,0.95))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_80%_72%,rgba(168,85,247,0.14),transparent_30%)]" />
      <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:42px_42px]" />

      <header className="relative z-20 flex h-16 items-center justify-between border-b border-white/10 bg-black/45 px-4 backdrop-blur-md sm:px-8">
        <Link href="/arena" className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/55 transition hover:text-white">
          <ChevronLeft className="h-4 w-4" />
          Leave Match
        </Link>

        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.24em] text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          Live Face Tracking
        </div>

        <div className="hidden items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 sm:flex">
          <ShieldCheck className="h-4 w-4" />
          {modelReady ? "Model Ready" : "Loading Model"}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[1320px] flex-col px-4 py-5 sm:px-6">
        <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_360px]">
          <div className="relative min-h-[560px] overflow-hidden rounded-[34px] border border-white/14 bg-[#070914] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_80px_rgba(0,0,0,0.46)]">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`absolute inset-0 h-full w-full object-cover -scale-x-100 transition-opacity duration-500 ${
                cameraReady ? "opacity-100" : "opacity-0"
              }`}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full pointer-events-none"
            />

            <div className="pointer-events-none absolute inset-5 rounded-[24px] border border-white/35" />
            <div className="absolute left-8 top-8 rounded-[16px] border border-white/14 bg-black/60 p-4 backdrop-blur-md">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/45">
                Signal Scan
              </div>
              <div className="mt-1 text-4xl font-black tracking-[-0.08em] text-white">
                {modelReady ? "ON" : "..."}
              </div>
              <div className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
                Key face points
              </div>
            </div>

            <div className="absolute right-8 top-8 rounded-full border border-cyan-100/30 bg-[#152b36]/80 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 backdrop-blur-md">
              Test Match
            </div>

            <div className="absolute inset-x-0 top-1/2 h-px bg-cyan-300/30 shadow-[0_0_18px_rgba(34,211,238,0.45)]" />

            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-center">
                  <ScanFace className="mx-auto mb-5 h-14 w-14 animate-pulse text-cyan-200/70" />
                  <div className="text-sm font-black uppercase tracking-[0.24em] text-white/60">
                    Opening camera
                  </div>
                </div>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center">
                <div>
                  <div className="text-2xl font-black uppercase tracking-[0.16em] text-white">
                    Camera unavailable
                  </div>
                  <div className="mt-3 text-sm font-bold uppercase tracking-[0.12em] text-white/45">
                    {cameraError}
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-[34px] border border-white/12 bg-white/[0.045] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_80px_rgba(0,0,0,0.32)] backdrop-blur-md">
            <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
              Match Found
            </div>
            <h1 className="mt-4 text-4xl font-black uppercase tracking-[0.08em] text-white">
              1v1 Arena
            </h1>
            <p className="mt-5 text-sm font-bold uppercase leading-relaxed tracking-[0.14em] text-white/42">
              Live camera feed with local face landmark detection. Green points are drawn over nose, eyes, cheeks, mouth, and chin.
            </p>

            <div className="mt-10 grid gap-3">
              {[
                ["Model", modelReady ? "Ready" : "Loading"],
                ["Camera", cameraReady ? "Live" : "Pending"],
                ["Overlay", modelReady && cameraReady ? "Active" : "Waiting"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-[18px] border border-white/10 bg-black/35 px-4 py-3"
                >
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
                    {label}
                  </span>
                  <span className="text-sm font-black uppercase tracking-[0.16em] text-white">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <Link
              href="/arena"
              className="mt-10 inline-flex h-14 w-full items-center justify-center gap-3 rounded-full border border-white/12 bg-white/5 px-7 text-sm font-black uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <OctagonX className="h-5 w-5" />
              Exit Match
            </Link>
          </aside>
        </section>
      </main>
    </div>
  );
}
