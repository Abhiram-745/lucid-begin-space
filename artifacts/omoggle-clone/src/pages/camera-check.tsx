import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

type CheckStep = "preparing" | "align" | "blink" | "turn" | "done";

const STEPS: CheckStep[] = ["align", "blink", "turn", "done"];

const STEP_LABELS: Record<CheckStep, string> = {
  preparing: "PREPARE",
  align: "ALIGN",
  blink: "BLINK",
  turn: "TURN",
  done: "DONE",
};

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
  const [cameraError, setCameraError] = useState(false);
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
        setTimeout(() => setStep("align"), 1500);
      })
      .catch(() => {
        setCameraError(true);
        setTimeout(() => setStep("align"), 1500);
      });

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (step === "preparing" || step === "done") return;
    setStepProgress(0);
    const duration = step === "align" ? 3000 : step === "blink" ? 3500 : 4000;
    const interval = 50;
    const increment = (interval / duration) * 100;
    const timer = setInterval(() => {
      setStepProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          return 100;
        }
        return p + increment;
      });
    }, interval);
    const advance = setTimeout(() => {
      setStep((s) => {
        if (s === "align") return "blink";
        if (s === "blink") return "turn";
        if (s === "turn") return "done";
        return s;
      });
    }, duration);
    return () => {
      clearInterval(timer);
      clearTimeout(advance);
    };
  }, [step]);

  const activeStepIndex = STEPS.indexOf(step === "preparing" ? "align" : step);

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
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`absolute inset-0 w-full h-full object-cover -scale-x-100 transition-opacity duration-700 ${cameraGranted ? "opacity-100" : "opacity-0"}`}
            />

            {/* Dark overlay when video active */}
            {cameraGranted && <div className="absolute inset-0 bg-black/20 pointer-events-none" />}

            {/* Face guide oval */}
            {cameraGranted && step !== "preparing" && step !== "done" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div
                  animate={{ opacity: [0.4, 0.7, 0.4] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-28 h-36 rounded-[50%] border-2 border-purple-400/60"
                />
              </div>
            )}

            {/* Corner brackets */}
            <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-white/20" />
            <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-white/20" />
            <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-white/20" />
            <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-white/20" />

            {/* Scan line animation */}
            {cameraGranted && step !== "done" && (
              <motion.div
                animate={{ y: ["-100%", "100%"] }}
                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent pointer-events-none"
              />
            )}

            {/* Center overlay text / button */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AnimatePresence mode="wait">
                {step === "preparing" || cameraError ? (
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
                ) : step === "done" ? (
                  <motion.div
                    key="done"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="w-12 h-12 rounded-full border-2 border-green-400/60 flex items-center justify-center shadow-[0_0_20px_rgba(74,222,128,0.3)]">
                      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-green-400 text-xs font-black uppercase tracking-widest">Verified</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex flex-col items-center gap-3"
                  >
                    {/* Progress bar for step */}
                    <div className="w-24 h-0.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-purple-400 rounded-full"
                        style={{ width: `${stepProgress}%` }}
                      />
                    </div>
                    <p className="text-white/60 text-xs uppercase tracking-widest text-center px-4">
                      {STEP_INSTRUCTIONS[step]}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Step progress bar */}
          <div className="mx-6 mb-1">
            <div className="h-px bg-white/8 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-purple-500/60"
                animate={{ width: `${((activeStepIndex) / (STEPS.length - 1)) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Step labels */}
          <div className="mx-6 mb-6 flex justify-between">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`text-[9px] uppercase tracking-widest font-bold transition-colors duration-300 ${
                  i < activeStepIndex
                    ? "text-purple-400"
                    : i === activeStepIndex
                    ? "text-white"
                    : "text-white/20"
                }`}
              >
                {STEP_LABELS[s]}
              </span>
            ))}
          </div>

          {/* Disclaimer text */}
          <div className="mx-6 mb-6 text-center space-y-3">
            <p className="text-[10px] text-white/35 leading-relaxed">
              This camera check is an Unmoggle session gate for anti-abuse and age acknowledgment. It is not a government ID check or a durable proof of identity.
            </p>
            <p className="text-[10px] text-white/25 leading-relaxed">
              Facial landmarks are processed{" "}
              <span className="text-white/50 font-bold">locally in your browser</span>{" "}
              and are never uploaded. By starting the check you agree to the{" "}
              <span className="text-purple-400 cursor-pointer hover:underline">Privacy Policy</span>{" "}
              and{" "}
              <span className="text-purple-400 cursor-pointer hover:underline">Terms of Service</span>
              , including the biometric-data consent described there.
            </p>
          </div>

          {/* Exit / Enter button */}
          <div className="mx-6 mb-8 flex justify-center">
            {step === "done" ? (
              <button
                onClick={() => setLocation("/arena")}
                className="px-10 py-2.5 bg-white text-black font-black uppercase tracking-widest text-xs rounded-full shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all hover:-translate-y-0.5"
              >
                Enter Arena
              </button>
            ) : (
              <button
                onClick={() => setLocation("/")}
                className="px-10 py-2.5 border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-black uppercase tracking-widest text-xs rounded-full transition-all"
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
