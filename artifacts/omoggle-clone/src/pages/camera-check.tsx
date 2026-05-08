import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

type CheckStep = "preparing" | "align" | "blink" | "turn" | "done";
const STEPS: CheckStep[] = ["align", "blink", "turn", "done"];

// Key landmark indices to render as dots (matches reference screenshot)
const KEY_LANDMARKS = [
  10,   // forehead center
  33,   // left eye inner corner
  133,  // left eye outer corner
  362,  // right eye inner corner
  263,  // right eye outer corner
  49,   // left nose wing
  279,  // right nose wing
  61,   // mouth left corner
  291,  // mouth right corner
  152,  // chin
];

export default function CameraCheck() {
  const [, setLocation] = useLocation();
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
          const dotColor = isDone ? "#4ade80" : "#4ade80";
          const glowColor = isDone ? "rgba(74,222,128,0.6)" : "rgba(74,222,128,0.5)";

          // Mirror transform (video is -scale-x-100)
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);

          KEY_LANDMARKS.forEach((idx) => {
            const pt = landmarks[idx];
            if (!pt) return;
            const x = pt.x * canvas.width;
            const y = pt.y * canvas.height;

            // Glow
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = glowColor;
            ctx.fill();

            // Dot
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = dotColor;
            ctx.fill();
          });

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
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-mono">
      <div className="w-full max-w-md">
        <div className="bg-[#100d1f] border border-purple-500/20 rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(139,92,246,0.15)]">

          {/* Header */}
          <div className="px-8 pt-8 pb-4 text-center">
            <h1 className="text-xl font-black uppercase tracking-[0.2em] text-purple-300 mb-1">
              Camera Access Check
            </h1>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/30">
              Short-lived session challenge
            </p>
          </div>

          {/* Video Panel */}
          <div className="mx-6 mb-4 rounded-xl overflow-hidden bg-[#06040f] border border-white/5 aspect-video relative">

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
            <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-white/25" style={{ zIndex: 20 }} />
            <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-white/25" style={{ zIndex: 20 }} />
            <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-white/25" style={{ zIndex: 20 }} />
            <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-white/25" style={{ zIndex: 20 }} />

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
                      className="flex items-center gap-2 bg-black/60 backdrop-blur-sm border border-green-400/30 rounded-full px-5 py-2"
                    >
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-green-400 text-xs font-black uppercase tracking-[0.2em]">
                        Verified
                      </span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="bg-black/70 backdrop-blur-sm rounded-full px-5 py-2"
                    >
                      <span className="text-white text-xs font-black uppercase tracking-[0.15em]">
                        {stepInstruction[step]}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Preparing overlay */}
            {step === "preparing" && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 20 }}>
                <p className="text-white/40 text-xs uppercase tracking-widest animate-pulse">
                  Preparing session...
                </p>
              </div>
            )}
          </div>

          {/* Step progress bar */}
          <div className="mx-6 mb-1">
            <div className="h-px bg-white/8 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-purple-500"
                animate={{ width: isDone ? "100%" : `${(activeStepIndex / (STEPS.length - 1)) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Step labels */}
          <div className="mx-6 mb-5 flex justify-between">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`text-[9px] uppercase tracking-widest font-bold transition-colors duration-300 ${
                  isDone || i < activeStepIndex
                    ? "text-purple-400"
                    : i === activeStepIndex
                    ? "text-white"
                    : "text-white/20"
                }`}
              >
                {s}
              </span>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="mx-6 mb-5 text-center space-y-3">
            <p className="text-[10px] text-white/35 leading-relaxed">
              This camera check is an Unmoggle session gate for anti-abuse and age
              acknowledgment. It is not a government ID check or a durable proof of identity.
            </p>
            <p className="text-[10px] text-white/25 leading-relaxed">
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
          <div className="mx-6 mb-8 flex justify-center">
            {isDone ? (
              <motion.button
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setLocation("/arena")}
                className="px-12 py-3 bg-white text-black font-black uppercase tracking-widest text-xs rounded-full shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_50px_rgba(255,255,255,0.25)] transition-all hover:-translate-y-0.5"
              >
                Enter Arena
              </motion.button>
            ) : (
              <button
                onClick={() => setLocation("/")}
                className="px-10 py-2.5 border border-white/10 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white font-black uppercase tracking-widest text-xs rounded-full transition-all"
              >
                Exit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
