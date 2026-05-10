import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { PageShell } from "@/components/page-shell";

type CheckStep = "preparing" | "align" | "blink" | "turn" | "done";
const STEPS: CheckStep[] = ["align", "blink", "turn", "done"];

// Key landmark indices for the prominent green dots (forehead, brows, nose,
// cheeks, mouth corners, chin). Everything else is drawn as a faint cyan dot.
const KEY_LANDMARKS = [10, 55, 285, 1, 50, 280, 61, 291, 152, 17];

export default function CameraCheck() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const returnTo = new URLSearchParams(search).get("returnTo") ?? "/arena";
  const [step, setStep] = useState<CheckStep>("preparing");
  const [cameraGranted, setCameraGranted] = useState(false);
  const [stepProgress, setStepProgress] = useState(0);
  const [landmarkerReady, setLandmarkerReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  const stepRef = useRef<CheckStep>("preparing");

  stepRef.current = step;

  // Load MediaPipe face landmarker
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
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
          setLandmarkerReady(true);
        }
      } catch {
        // silently fail — dots just won't show
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Request webcam
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraGranted(true);
        setTimeout(() => setStep("align"), 1200);
      })
      .catch(() => {
        setTimeout(() => setStep("align"), 1200);
      });

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Draw landmark dots on canvas
  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    // Match canvas size to video display size
    const rect = video.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isDone = stepRef.current === "done";
    const isActive = stepRef.current !== "preparing";

    if (landmarker && isActive && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      try {
        const result = landmarker.detectForVideo(video, performance.now());
        const faces = result.faceLandmarks;
        if (faces && faces.length > 0) {
          const landmarks = faces[0];
          // Mirror transform (video is -scale-x-100)
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);

          // 1. Faint cyan dot per landmark — light, dotted "scan" feel.
          ctx.fillStyle = "rgba(120,220,255,0.55)";
          for (let i = 0; i < landmarks.length; i++) {
            const p = landmarks[i];
            if (!p) continue;
            ctx.fillRect(p.x * canvas.width - 0.5, p.y * canvas.height - 0.5, 1, 1);
          }

          // 2. Bright green key-point dots with a soft glow.
          ctx.shadowColor = "rgba(74,222,128,0.85)";
          ctx.shadowBlur = 8;
          ctx.fillStyle = isDone ? "rgba(74,222,128,1)" : "rgba(74,222,128,0.95)";
          for (const idx of KEY_LANDMARKS) {
            const p = landmarks[idx];
            if (!p) continue;
            ctx.beginPath();
            ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;

          ctx.restore();
        }
      } catch {
        // skip frame on error
      }
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  // Start render loop once camera is granted
  useEffect(() => {
    if (!cameraGranted) return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cameraGranted, drawFrame]);

  // Auto-advance steps
  useEffect(() => {
    if (step === "preparing" || step === "done") return;
    setStepProgress(0);
    const duration = step === "align" ? 2500 : step === "blink" ? 3000 : 3500;
    const intervalMs = 40;
    const increment = (intervalMs / duration) * 100;

    const progressTimer = setInterval(() => {
      setStepProgress((p) => Math.min(p + increment, 100));
    }, intervalMs);

    const advanceTimer = setTimeout(() => {
      setStep((s) => {
        if (s === "align") return "blink";
        if (s === "blink") return "turn";
        return "done";
      });
    }, duration);

    return () => {
      clearInterval(progressTimer);
      clearTimeout(advanceTimer);
    };
  }, [step]);

  const isDone = step === "done";
  const activeStepIndex = isDone
    ? STEPS.length - 1
    : STEPS.indexOf(step === "preparing" ? "align" : step);

  const stepInstruction: Record<CheckStep, string> = {
    preparing: "Preparing session...",
    align: "Face the camera",
    blink: "Blink naturally",
    turn: "Turn head right",
    done: "Verified",
  };

  return (
    <PageShell grid="hero">
      <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-4 py-8 sm:py-10 font-mono overflow-x-hidden">
      <div className="relative z-10 w-full max-w-[min(584px,92vw)] lg:max-w-[min(584px,calc(50vw-1rem))] min-w-0">
        <div className="rebel-card overflow-hidden rounded-[20px] border border-purple-500/40 border-t-[#dfff4a]/25 bg-[#100d1f]/95 shadow-[0_0_90px_rgba(139,92,246,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]">

          {/* Header */}
          <div className="px-8 pt-12 pb-6 text-center">
            <h1 className="rebel-heading text-[27px] uppercase tracking-[0.28em] text-white mb-3 drop-shadow-[0_0_22px_rgba(255,255,255,0.18)]">
              Camera Access Check
            </h1>
            <p className="text-[12px] uppercase tracking-[0.42em] text-white/35">
              Short-lived session challenge
            </p>
          </div>

          {/* Video Panel */}
          <div className="mx-4 sm:mx-8 mb-6 rounded-[22px] overflow-hidden bg-[#06040f] border border-white/5 aspect-video max-h-[min(48vh,56vw)] relative">

            {/* Live webcam — mirrored */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`absolute inset-0 w-full h-full object-cover -scale-x-100 transition-opacity duration-700 ${cameraGranted ? "opacity-100" : "opacity-0"}`}
            />

            {/* Canvas overlay for landmark dots */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 10 }}
            />

            {/* Corner brackets */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-white/30" style={{ zIndex: 20 }} />
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-white/30" style={{ zIndex: 20 }} />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-white/30" style={{ zIndex: 20 }} />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-white/30" style={{ zIndex: 20 }} />

            {/* Scan line (active non-done steps) */}
            {!isDone && step !== "preparing" && (
              <motion.div
                animate={{ y: ["-100%", "100%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-green-400/40 to-transparent pointer-events-none"
                style={{ zIndex: 15 }}
              />
            )}

            {/* Instruction pill at bottom of video */}
            {step !== "preparing" && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none" style={{ zIndex: 20 }}>
                <AnimatePresence mode="wait">
                  {isDone ? (
                    <motion.div
                      key="done"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-3 bg-[#33291f]/95 backdrop-blur-sm border border-green-400/35 rounded-full px-8 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.32)]"
                    >
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-green-400 text-[13px] font-black uppercase tracking-[0.34em]">
                        Verified
                      </span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="bg-black/75 backdrop-blur-sm rounded-full px-7 py-3"
                    >
                      <span className="text-white text-[12px] font-black uppercase tracking-[0.24em]">
                        {stepInstruction[step]}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Preparing overlay */}
            {step === "preparing" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5" style={{ zIndex: 20 }}>
                <div className="h-12 w-12 rounded-full border-2 border-cyan-400/25 border-t-cyan-300 animate-spin" />
                <p className="text-cyan-300 text-[12px] uppercase tracking-[0.28em] font-bold">
                  Requesting camera access…
                </p>
                <p className="text-cyan-300/35 text-[10px] uppercase tracking-[0.3em]">
                  Mediapipe Face Landmarker · WASM + GPU
                </p>
              </div>
            )}
          </div>

          {/* Step progress bar */}
          <div className="mx-8 mb-2">
            <div className="h-px bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-cyan-400"
                animate={{ width: isDone ? "100%" : `${(activeStepIndex / (STEPS.length - 1)) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Step labels */}
          <div className="mx-8 mb-8 flex justify-between">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`text-[11px] uppercase tracking-[0.14em] font-bold transition-colors duration-300 ${
                  isDone || i < activeStepIndex
                    ? "text-cyan-400"
                    : i === activeStepIndex
                    ? "text-cyan-300"
                    : "text-white/20"
                }`}
              >
                {s}
              </span>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="mx-10 mb-8 text-center space-y-5">
            <p className="text-[13px] text-white/35 leading-relaxed">
              This camera check is an Unmoggle session gate for anti-abuse and age
              acknowledgment. It is not a government ID check or a durable proof of identity.
            </p>
            <p className="text-[13px] text-white/25 leading-relaxed">
              Facial landmarks are processed{" "}
              <span className="text-white/50 font-bold">locally in your browser</span>{" "}
              and are never uploaded. By starting the check you agree to the{" "}
              <span className="text-purple-400 hover:underline">Privacy Policy</span>{" "}
              and{" "}
              <span className="text-purple-400 hover:underline">Terms of Service</span>
              , including the biometric-data consent described there.
            </p>
          </div>

          {/* CTA */}
          <div className="mx-8 mb-12 flex justify-center">
            {isDone ? (
              <motion.button
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  sessionStorage.setItem("unmog_camera_ok", "1");
                  setLocation(returnTo);
                }}
                className="min-w-[246px] px-12 py-4 bg-white text-black font-black uppercase tracking-[0.22em] text-sm rounded-full shadow-[0_0_42px_rgba(255,255,255,0.14)] hover:shadow-[0_0_60px_rgba(255,255,255,0.24)] transition-all hover:-translate-y-0.5"
              >
                Enter Arena
              </motion.button>
            ) : (
              <button
                onClick={() => setLocation("/")}
                className="min-w-[190px] px-10 py-3 border border-white/10 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white font-black uppercase tracking-widest text-xs rounded-full transition-all"
              >
                Exit
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </PageShell>
  );
}
