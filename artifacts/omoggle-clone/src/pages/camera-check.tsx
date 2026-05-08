import { useState } from "react";
import { useLocation } from "wouter";
import { Camera, ShieldCheck, Zap, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CameraCheck() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      setLocation("/arena");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 sm:p-8 relative font-mono">
      <button 
        onClick={() => setLocation("/")}
        className="absolute top-8 left-8 flex items-center gap-2 text-white/50 hover:text-white uppercase font-bold text-xs tracking-wider transition-colors cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" /> Cancel
      </button>

      <div className="w-full max-w-md bg-[#0d0d1a] border border-white/8 rounded-[2rem] p-8 flex flex-col relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />
        
        <div className="flex justify-between items-center mb-10 relative z-10 px-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-1 relative">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-all duration-300 relative z-10
                ${step === i ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.6)] scale-110' : step > i ? 'bg-purple-900/50 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-white/30 border border-white/10'}`}
              >
                {i}
              </div>
              {i < 3 && (
                <div className={`absolute top-4 h-[2px] w-full transition-colors duration-500 left-1/2
                  ${step > i ? 'bg-purple-500/50' : 'bg-white/5'}`} 
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 flex flex-col items-center text-center relative z-10 min-h-[320px]">
          {step === 1 && (
            <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mb-6 shadow-lg">
                <Camera className="w-8 h-8 text-white/80" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-[0.1em] mb-4 text-white">Camera Access</h2>
              <p className="text-xs text-white/50 uppercase tracking-widest leading-relaxed mb-8 max-w-[280px]">
                Unmoggle requires camera access to place you in the arena. Your video is live 1v1.
              </p>
              
              <div className="w-full aspect-video bg-[#050505] rounded-xl border border-white/10 flex items-center justify-center mb-8 overflow-hidden relative shadow-inner">
                {/* Viewfinder brackets */}
                <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-white/20" />
                <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-white/20" />
                <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-white/20" />
                <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-white/20" />
                
                <span className="text-white/40 uppercase text-[10px] font-bold tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Waiting for permission...
                </span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-20 h-20 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                <ShieldCheck className="w-8 h-8 text-purple-400" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-[0.1em] mb-4 text-white">Face Scan</h2>
              <p className="text-xs text-white/50 uppercase tracking-widest leading-relaxed mb-8 max-w-[280px]">
                Position your face in the center. We run a quick baseline scan for anti-abuse.
              </p>
              
              <div className="w-full aspect-video bg-[#0a0a0a] rounded-xl border border-purple-500/30 flex items-center justify-center mb-8 relative overflow-hidden shadow-[0_0_30px_rgba(168,85,247,0.1)_inset]">
                {/* Viewfinder brackets */}
                <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-purple-500/40" />
                <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-purple-500/40" />
                <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-purple-500/40" />
                <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-purple-500/40" />

                {/* Mock camera feed / Scan UI */}
                <div className="absolute inset-0 bg-gradient-to-t from-purple-500/10 to-transparent" />
                <div className="w-28 h-36 border-2 border-purple-500/50 rounded-[40px] opacity-80 relative">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-purple-500/30" />
                  <div className="absolute left-1/2 top-0 h-full w-px bg-purple-500/30" />
                </div>
                <div className="absolute bottom-4 text-purple-400 font-bold uppercase text-[10px] tracking-[0.2em] bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20 animate-pulse">
                  Scanning Symmetry...
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-4 duration-500 justify-center h-[320px]">
              <div className="w-24 h-24 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mb-8 relative shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                <div className="absolute inset-0 border-2 border-green-500/30 rounded-full animate-ping" />
                <Zap className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-[0.1em] mb-4 text-white">Ready</h2>
              <p className="text-xs text-white/50 uppercase tracking-widest leading-relaxed max-w-[240px]">
                Your setup is complete. Enter the arena when ready.
              </p>
            </div>
          )}
        </div>

        <Button 
          onClick={handleNext}
          className="w-full bg-white text-black hover:bg-white/90 uppercase font-black tracking-widest h-14 rounded-full relative z-10 shadow-[0_0_0_1px_rgba(255,255,255,0.1),_0_10px_30px_rgba(255,255,255,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),_0_15px_40px_rgba(255,255,255,0.2)]"
        >
          {step === 1 ? "Allow Camera" : step === 2 ? "Confirm Scan" : "Enter Matchmaking"}
        </Button>
      </div>
    </div>
  );
}
