import { GuestBanner } from "@/components/guest-banner";
import { Swords, Trophy, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#050505] relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-[980px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 48% at 50% 0%, rgba(120, 40, 200, 0.18) 0%, rgba(120, 40, 200, 0.06) 34%, transparent 72%)",
        }}
      />
      <div className="absolute bottom-[-260px] left-[-180px] w-[760px] h-[760px] bg-primary/10 blur-[140px] rounded-full pointer-events-none" />

      <GuestBanner />

      <main className="flex-1 flex flex-col items-center justify-start px-5 pb-8 pt-9 sm:px-8 sm:pb-10 sm:pt-12 relative z-10 max-w-[880px] mx-auto w-full">
        
        <div className="flex flex-col items-center mb-10 sm:mb-12 w-full">
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8 sm:mb-10">
            <div className="flex items-center bg-white/8 border border-white/10 px-4 sm:px-5 py-2 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] backdrop-blur-md shadow-[0_0_24px_rgba(168,85,247,0.16)]">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-2 h-2 rounded-full bg-[#a855f7] mr-3 shadow-[0_0_14px_rgba(168,85,247,0.9)]" 
              />
              Live 1v1 Unmog Arena
            </div>
          </div>

          <h1 className="text-[clamp(5.25rem,14vw,10.75rem)] font-black text-white drop-shadow-2xl leading-[0.82] shimmer-text select-none whitespace-nowrap">
            UNMOGGLE
          </h1>
        </div>

        <div className="w-full max-w-[600px] bg-[#0d0d1a] border border-white/8 rounded-[34px] px-7 py-10 sm:px-12 sm:py-12 flex flex-col items-center text-center shadow-[0_24px_90px_rgba(0,0,0,0.45)] relative overflow-hidden mb-10 sm:mb-12 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-purple-500/55 before:to-transparent">
          <div className="w-20 h-20 rounded-[22px] bg-gradient-to-br from-purple-800/70 to-purple-950/90 border border-purple-500/25 flex items-center justify-center mb-8 shadow-[0_0_54px_rgba(168,85,247,0.28)]">
            <Swords className="w-10 h-10 text-white" strokeWidth={2.4} />
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-[0.18em] mb-8 sm:mb-10 text-white">Enter the Arena</h2>
          
          <Link
            href="/arena"
            className="w-full bg-white text-black hover:bg-white/90 uppercase font-black tracking-widest h-16 sm:h-18 rounded-full flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_0_1px_rgba(255,255,255,0.1),_0_24px_70px_rgba(255,255,255,0.1)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),_0_20px_80px_rgba(255,255,255,0.16)] hover:-translate-y-1 mb-6 text-sm sm:text-base"
          >
            Enter Arena <ChevronRight className="w-5 h-5" />
          </Link>
          
          <p className="text-[10px] sm:text-xs text-white/40 uppercase tracking-[0.18em] max-w-[390px] leading-relaxed">
            By entering the arena you agree to our Terms of Service and Privacy Policy
          </p>
        </div>

        <div className="w-full mb-8">
          <Link href="/leaderboard" className="min-h-[82px] bg-[#0d0d1a] border border-white/8 hover:border-white/15 hover:bg-[#111126] transition-all duration-300 rounded-[18px] px-7 py-5 flex items-center justify-between group cursor-pointer w-full">
            <div className="flex items-center gap-5">
              <Trophy className="w-7 h-7 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.35)]" />
              <span className="font-normal uppercase tracking-wider text-lg sm:text-xl text-white">View Leaderboard</span>
            </div>
            <ChevronRight className="w-6 h-6 text-white/40 group-hover:text-white transition-colors" />
          </Link>
        </div>

        <div className="text-xs text-white/20 uppercase tracking-[0.2em] text-center">
          LIVE 1V1 ARENA · RANKED MATCHES · REAL-TIME LEADERBOARD
        </div>
      </main>

    </div>
  );
}
