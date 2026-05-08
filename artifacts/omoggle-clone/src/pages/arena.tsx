import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ChevronLeft, X, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function Arena() {
  const [waitTime, setWaitTime] = useState(0);
  const [searchingText, setSearchingText] = useState("Searching for opponent...");

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => { 
        if (videoRef.current) {
          videoRef.current.srcObject = stream; 
        }
      })
      .catch(console.error);
      
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setWaitTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const texts = ["Searching for opponent...", "Analyzing queue...", "Finding best match...", "Checking latency..."];
    let i = 0;
    const textTimer = setInterval(() => {
      i = (i + 1) % texts.length;
      setSearchingText(texts[i]);
    }, 3000);
    return () => clearInterval(textTimer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-[100dvh] w-full bg-black flex flex-col overflow-hidden font-mono">
      {/* Top Bar */}
      <header className="h-16 border-b border-white/10 bg-[#050505] flex items-center justify-between px-4 sm:px-8 z-10 shrink-0">
        <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white uppercase font-bold text-xs tracking-wider transition-colors cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> Leave Arena
        </Link>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-black uppercase tracking-widest text-sm text-white">Live</span>
          </div>
        </div>

        <button className="text-white/30 hover:text-red-500 transition-colors">
          <Flag className="w-5 h-5" />
        </button>
      </header>

      {/* Video Grid */}
      <main className="flex-1 flex flex-col md:flex-row gap-4 p-4 bg-black overflow-hidden relative">
        
        {/* Opponent View - Searching UI */}
        <div className="flex-1 bg-[#080810] rounded-2xl relative overflow-hidden flex flex-col border border-white/5 shadow-inner">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
          
          {/* Scan line effect */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="w-full h-2 bg-gradient-to-b from-transparent via-purple-500/10 to-transparent animate-scan-line" />
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center relative z-10">
            <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
              <motion.div
                className="absolute inset-0 border border-purple-500/30 rounded-full"
                animate={{ scale: [1, 2], opacity: [1, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-0 border border-purple-500/20 rounded-full"
                animate={{ scale: [1, 2], opacity: [1, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1 }}
              />
              <div className="w-12 h-12 bg-purple-500/20 rounded-full blur-md absolute" />
              <div className="w-4 h-4 bg-purple-400 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.8)]" />
            </div>
            
            <motion.div 
              key={searchingText}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="font-mono text-purple-300 uppercase font-bold tracking-[0.2em] text-sm mb-6 h-6"
            >
              {searchingText}
            </motion.div>
            
            <div className="flex gap-6 text-xs text-white/50 uppercase tracking-widest bg-black/40 px-6 py-3 rounded-full border border-white/5">
              <div className="flex flex-col items-center">
                <span className="mb-1 text-white/30 text-[10px]">Queue</span>
                <span className="text-white">2,847 in queue</span>
              </div>
              <div className="w-px bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="mb-1 text-white/30 text-[10px]">Wait Time</span>
                <span className="text-white font-mono">{formatTime(waitTime)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* My Video */}
        <div className="flex-1 bg-[#111] rounded-2xl relative overflow-hidden border border-purple-500/20 animate-glow-pulse">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover -scale-x-100"
          />
          
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10 z-10 text-white flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            You (Live)
          </div>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <footer className="h-24 shrink-0 bg-[#050505] border-t border-white/5 flex items-center justify-center px-4 z-10 relative">
        <Link href="/">
          <Button 
            size="lg"
            className="h-14 px-8 bg-white/5 text-white hover:bg-white/10 rounded-full uppercase font-bold tracking-widest text-sm flex items-center gap-2 w-full max-w-[200px] transition-all border border-white/10 hover:border-white/20"
          >
            Cancel <X className="w-4 h-4" />
          </Button>
        </Link>
      </footer>
    </div>
  );
}