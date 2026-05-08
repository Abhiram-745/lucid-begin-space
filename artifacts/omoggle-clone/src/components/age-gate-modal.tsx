import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export function AgeGateModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleAccept = () => {
    onOpenChange(false);
    setLocation("/camera-check");
  };

  const handleDecline = () => {
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => onOpenChange(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(4px)",
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "26rem",
              margin: "1rem",
            }}
            className="bg-[#150e24] border border-purple-500/20 rounded-2xl p-8 text-center font-mono shadow-[0_0_0_1px_rgba(139,92,246,0.2),_0_40px_100px_rgba(139,92,246,0.2)]"
          >
            {/* Close button */}
            <button
              onClick={handleDecline}
              className="absolute right-4 top-4 text-white/30 hover:text-white/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[10px] px-4 py-1.5 rounded-full uppercase font-bold tracking-widest mb-6">
              Restricted · 18+
            </div>

            {/* Title */}
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-[0.1em] mb-4 text-white">
              Adults Only
            </h2>

            {/* Description */}
            <p className="text-white/60 uppercase text-xs leading-relaxed mb-8 tracking-wider">
              Live video. By entering, you affirm you are at least 18 years old.
            </p>

            {/* Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleAccept}
                className="w-full bg-white text-black hover:bg-white/90 uppercase font-black tracking-widest h-14 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.1),_0_10px_30px_rgba(255,255,255,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),_0_15px_40px_rgba(255,255,255,0.2)] text-sm"
              >
                I Am 18+ — Enter
              </button>

              <button
                onClick={handleDecline}
                className="w-full bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white uppercase font-bold tracking-widest h-14 rounded-full transition-all text-xs"
              >
                I Am Under 18
              </button>
            </div>

            {/* Fine print */}
            <p className="text-[10px] text-white/25 mt-6 leading-relaxed">
              By entering, you agree to our{" "}
              <span className="text-purple-400 cursor-pointer hover:underline">Terms of Service</span>{" "}
              and{" "}
              <span className="text-purple-400 cursor-pointer hover:underline">Privacy Policy</span>.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
