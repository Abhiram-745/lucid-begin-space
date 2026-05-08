import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export function AgeGateModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [, setLocation] = useLocation();

  const handleAccept = () => {
    onOpenChange(false);
    setLocation("/camera-check");
  };

  const handleDecline = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#150e24] border-purple-500/20 border max-w-md text-center p-8 overflow-hidden shadow-[0_0_0_1px_rgba(139,92,246,0.2),_0_40px_100px_rgba(139,92,246,0.15)] relative">
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
        
        <div className="mx-auto bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[10px] px-4 py-1.5 rounded-full w-fit uppercase font-bold tracking-widest mb-6">
          Restricted · 18+
        </div>

        <DialogHeader>
          <DialogTitle className="text-3xl md:text-4xl font-black uppercase tracking-[0.1em] mb-4 text-white">
            ADULTS ONLY
          </DialogTitle>
          <DialogDescription className="text-white/60 uppercase text-xs leading-relaxed mb-8 tracking-wider">
            Live video. By entering, you affirm you are at least 18 years old.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 relative z-10">
          <Button 
            onClick={handleAccept}
            className="w-full bg-white text-black hover:bg-gray-200 uppercase font-black tracking-widest h-14 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.1),_0_10px_30px_rgba(255,255,255,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),_0_15px_40px_rgba(255,255,255,0.2)]"
          >
            I am 18+ — Enter
          </Button>
          
          <Button 
            onClick={handleDecline}
            variant="outline"
            className="w-full bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white uppercase font-bold tracking-widest h-14 rounded-full transition-all"
          >
            I am under 18
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
