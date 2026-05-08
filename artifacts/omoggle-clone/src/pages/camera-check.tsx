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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-8 relative">
      <button 
        onClick={() => setLocation("/")}
        className="absolute top-8 left-8 flex items-center gap-2 text-muted-foreground hover:text-white uppercase font-bold text-xs tracking-wider transition-colors cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" /> Cancel
      </button>

      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        
        <div className="flex justify-between items-center mb-8 relative z-10">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-colors
                ${step >= i ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'}`}
              >
                {i}
              </div>
              {i < 3 && (
                <div className={`absolute top-4 h-[2px] w-[calc(50%-2rem)] transition-colors
                  ${i === 1 ? 'left-[25%]' : 'left-[75%]'}
                  ${step > i ? 'bg-accent' : 'bg-secondary'}`} 
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 flex flex-col items-center text-center relative z-10 min-h-[300px]">
          {step === 1 && (
            <div className="flex flex-col items-center w-full animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center mb-6">
                <Camera className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-4 text-white">Camera Access</h2>
              <p className="text-sm text-muted-foreground uppercase tracking-widest leading-relaxed mb-8">
                Unmoggle requires camera access to place you in the arena. Your video is live 1v1.
              </p>
              
              <div className="w-full aspect-video bg-black rounded-xl border border-border flex items-center justify-center mb-8 overflow-hidden relative">
                <div className="absolute inset-0 border-2 border-dashed border-accent/20 m-4 rounded-lg pointer-events-none" />
                <span className="text-muted-foreground uppercase text-xs font-bold tracking-widest">Waiting for permission...</span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center w-full animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center mb-6">
                <ShieldCheck className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-4 text-white">Face Scan</h2>
              <p className="text-sm text-muted-foreground uppercase tracking-widest leading-relaxed mb-8">
                Position your face in the center. We run a quick baseline scan for anti-abuse.
              </p>
              
              <div className="w-full aspect-video bg-[#111] rounded-xl border border-accent/50 flex items-center justify-center mb-8 relative overflow-hidden">
                {/* Mock camera feed */}
                <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
                <div className="w-32 h-40 border-2 border-accent rounded-full opacity-50 relative">
                  <div className="absolute top-1/2 left-0 w-full h-[1px] bg-accent/30" />
                  <div className="absolute left-1/2 top-0 h-full w-[1px] bg-accent/30" />
                </div>
                <div className="absolute bottom-4 text-accent font-bold uppercase text-xs tracking-widest animate-pulse">
                  Scanning Symmetry...
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center w-full animate-in fade-in zoom-in duration-300 justify-center h-full">
              <div className="w-24 h-24 bg-accent/20 rounded-full flex items-center justify-center mb-8">
                <Zap className="w-12 h-12 text-accent" />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tight mb-4 text-white">Ready</h2>
              <p className="text-sm text-muted-foreground uppercase tracking-widest leading-relaxed">
                Your setup is complete. Enter the arena when ready.
              </p>
            </div>
          )}
        </div>

        <Button 
          onClick={handleNext}
          className="w-full bg-white text-black hover:bg-gray-200 uppercase font-black tracking-widest h-14 rounded-full relative z-10"
        >
          {step === 1 ? "Allow Camera" : step === 2 ? "Confirm Scan" : "Enter Matchmaking"}
        </Button>
      </div>
    </div>
  );
}
