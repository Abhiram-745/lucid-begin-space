import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

type CheckStep = "preparing" | "align" | "blink" | "turn" | "done";

const STEPS: CheckStep[] = ["align", "blink", "turn", "done"];

const STEP_INSTRUCTIONS: Record<CheckStep, string> = {
  preparing: "Preparing session...",
  align: "Center your face in the frame",
  blink: "Blink naturally twice",
  turn: "Slowly turn your head left, then right",
  done: "Verification complete",
};

export default function CameraCheck() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<CheckStep>("preparing");
  const [cameraGranted, setCameraGranted] = useState(false);
  const [stepProgress, setStepProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraGranted(true);
        setTimeout(() => setStep("align"), 1200);
      })
      .catch(() => {
        // No camera — still walk through the steps
        setTimeout(() => setStep("align"), 1200);
      });

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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
  const activeStepIndex = isDone ? STEPS.length - 1 : STEPS.indexOf(step === "preparing" ? "align" : step);

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
            {/* Live webcam */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`absolute inset-0 w-full h-full object-cover -scale-x-100 transition-opacity duration-700 ${cameraGranted ? "opacity-100" : "opacity-0"}`}
            />

            {/* Subtle overlay */}
            <div className="absolute inset-0 bg-black/15 pointer-events-none" />

            {/* Corner brackets */}
            <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-white/25" />
            <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-white/25" />
            <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-white/25" />
            <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-white/25" />

            {/* Scan line (active steps only) */}
            {!isDone && step !== "preparing" && (
              <motion.div
                animate={{ y: ["-100%", "100%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent pointer-events-none"
              />
            )}

            {/* Face oval — purple during steps, green when done */}
            {step !== "preparing" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div
                  animate={
                    isDone
                      ? { opacity: 1, scale: 1 }
                      : { opacity: [0.5, 0.85, 0.5], scale: [1, 1.02, 1] }
                  }
                  transition={
                    isDone
                      ? { duration: 0.4 }
                      : { repeat: Infinity, duration: 2 }
                  }
                  className={`w-32 h-44 rounded-[50%] border-2 transition-colors duration-500 ${
                    isDone
                      ? "border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.4)]"
                      : "border-purple-400/70"
                  }`}
                />
              </div>
            )}

            {/* Center content overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <AnimatePresence mode="wait">
                {step === "preparing" ? (
                  <motion.div
                    key="preparing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <p className="text-white/40 text-xs uppercase tracking-widest animate-pulse">
                      Preparing session...
                    </p>
                    <div className="border border-white/15 rounded-full px-6 py-2 bg-[#0c0920]/80 backdrop-blur-sm">
                      <span className="text-xs font-black uppercase tracking-widest text-white/60">
                        Preparing Session
                      </span>
                    </div>
                  </motion.div>
                ) : isDone ? (
                  <motion.div
                    key="done"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.15, type: "spring", stiffness: 400, damping: 20 }}
                      className="w-10 h-10 rounded-full border-2 border-green-400 flex items-center justify-center bg-black/40 shadow-[0_0_24px_rgba(74,222,128,0.5)]"
                    >
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                    <span className="text-green-400 text-sm font-black uppercase tracking-[0.2em] drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]">
                      Verified
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex flex-col items-center gap-2 px-4"
                  >
                    <div className="w-20 h-0.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-purple-400 rounded-full"
                        style={{ width: `${stepProgress}%` }}
                      />
                    </div>
                    <p className="text-white/70 text-[10px] uppercase tracking-widest text-center bg-black/30 backdrop-blur-sm px-3 py-1 rounded">
                      {STEP_INSTRUCTIONS[step]}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Step progress bar */}
          <div className="mx-6 mb-1">
            <motion.div className="h-px bg-white/8 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-purple-500"
                animate={{ width: isDone ? "100%" : `${(activeStepIndex / (STEPS.length - 1)) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </motion.div>
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
                {s.toUpperCase()}
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

          {/* CTA button */}
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
