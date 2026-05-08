import { useState, useEffect } from "react";
import { GuestBanner } from "@/components/guest-banner";
import { AgeGateModal } from "@/components/age-gate-modal";
import { Swords, Trophy, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Home() {
  const [ageGateOpen, setAgeGateOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState(5000);

  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount(prev => prev + Math.floor(Math.random() * 11) - 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(120, 40, 200, 0.15) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none translate-y-1/2 -translate-x-1/4" />

      <GuestBanner />

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative z-10 max-w-4xl mx-auto w-full">
        
        <div className="flex flex-col items-center mb-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] backdrop-blur-md shadow-[0_0_15px_rgba(168,85,247,0.1)]">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-1.5 h-1.5 rounded-full bg-[#a855f7] mr-3 shadow-[0_0_8px_rgba(168,85,247,0.8)]" 
              />
              Live 1v1 Unmog Arena
            </div>
            <div className="flex items-center bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] text-green-400">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2" />
              {onlineCount.toLocaleString()} Online
            </div>
          </div>

          <h1 className="text-[7rem] sm:text-[10rem] md:text-[13rem] font-black tracking-tighter text-white drop-shadow-2xl leading-none shimmer-text select-none">
            UNMOGGLE
          </h1>
        </div>

        <div className="w-full max-w-md bg-[#0d0d1a] border border-white/8 rounded-[2rem] p-10 flex flex-col items-center text-center shadow-2xl relative overflow-hidden mb-12 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-purple-500/50 before:to-transparent">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-900/60 to-purple-950/80 border border-purple-500/20 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
            <Swords className="w-10 h-10 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold uppercase tracking-[0.15em] mb-10 text-white">Enter the Arena</h2>
          
          <button 
            onClick={() => setAgeGateOpen(true)}
            className="w-full bg-white text-black hover:bg-white/90 uppercase font-black tracking-widest h-16 rounded-full flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_0_1px_rgba(255,255,255,0.1),_0_20px_60px_rgba(255,255,255,0.08)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),_0_20px_80px_rgba(255,255,255,0.15)] hover:-translate-y-1 mb-6 text-sm"
          >
            Start Camera Check <ChevronRight className="w-5 h-5" />
          </button>
          
          <p className="text-[10px] text-white/40 uppercase tracking-widest max-w-[280px]">
            By entering the arena you agree to our Terms of Service and Privacy Policy
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-12">
          {[
            { num: "1", title: "Camera Check", desc: "Verify video & audio" },
            { num: "2", title: "Solo Scan", desc: "Face symmetry analysis" },
            { num: "3", title: "Compete & Climb", desc: "Unmog opponents, rank up" }
          ].map((step) => (
            <div key={step.num} className="bg-[#0d0d1a] border border-white/6 hover:border-white/15 hover:bg-[#111126] transition-all duration-300 rounded-2xl p-6 text-center flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-xs font-black text-white mb-4">
                {step.num}
              </div>
              <div className="font-bold uppercase tracking-wider text-sm mb-2 text-white">{step.title}</div>
              <div className="text-xs text-white/50 uppercase">{step.desc}</div>
            </div>
          ))}
        </div>

        <div className="w-full mb-16">
          <Link href="/leaderboard" className="bg-[#0d0d1a] border border-white/6 hover:border-white/15 hover:bg-[#111126] transition-all duration-300 rounded-2xl p-6 flex items-center justify-between group cursor-pointer w-full">
            <div className="flex items-center gap-4">
              <Trophy className="w-6 h-6 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]" />
              <span className="font-normal uppercase tracking-wider text-white">View Leaderboard</span>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
          </Link>
        </div>

        <div className="text-[9px] text-white/20 uppercase tracking-[0.2em] text-center">
          ANTI-ABUSE SESSION GATE · 18+ ACKNOWLEDGMENT · NOT LEGAL ID VERIFICATION
        </div>
      </main>

      <AgeGateModal open={ageGateOpen} onOpenChange={setAgeGateOpen} />
    </div>
  );
}
