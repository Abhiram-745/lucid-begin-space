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
      <DialogContent className="bg-card border-border border max-w-md text-center p-8 overflow-hidden relative">
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
        
        <div className="mx-auto bg-destructive/10 text-destructive border border-destructive/20 text-xs px-3 py-1 rounded-full w-fit uppercase font-bold tracking-widest mb-4">
          Restricted · 18+
        </div>

        <DialogHeader>
          <DialogTitle className="text-3xl font-black uppercase tracking-tighter mb-2 text-white">
            Adults Only
          </DialogTitle>
          <DialogDescription className="text-muted-foreground uppercase text-xs leading-relaxed mb-6">
            Live video. By entering, you affirm you are at least 18 years old.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 relative z-10">
          <Button 
            onClick={handleAccept}
            className="w-full bg-white text-black hover:bg-gray-200 uppercase font-black tracking-widest h-14 rounded-full"
          >
            I am 18+ — Enter
          </Button>
          
          <Button 
            onClick={handleDecline}
            variant="outline"
            className="w-full border-border text-muted-foreground hover:text-white uppercase font-bold tracking-widest h-14 rounded-xl bg-transparent"
          >
            I am under 18
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
