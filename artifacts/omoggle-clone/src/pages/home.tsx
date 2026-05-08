import { useState, useEffect } from "react";
import { NotificationBanner } from "@/components/notification-banner";
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
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

      <NotificationBanner />
      <GuestBanner />

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative z-10 max-w-4xl mx-auto w-full">
        
        <div className="flex flex-col items-center mb-12">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center bg-card/80 border border-border px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-2 h-2 rounded-full bg-accent mr-2 shadow-[0_0_8px_rgba(216,180,254,0.8)]" 
              />
              Live 1v1 Unmog Arena
            </div>
            <div className="text-xs text-muted-foreground uppercase font-bold">
              {onlineCount.toLocaleString()} Online
            </div>
          </div>

          <h1 className="text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter text-white drop-shadow-2xl">
            UNMOGGLE
          </h1>
        </div>

        <div className="w-full max-w-md bg-card/80 backdrop-blur-md border border-border rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl relative overflow-hidden mb-12">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
          
          <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-border flex items-center justify-center mb-6">
            <Swords className="w-8 h-8 text-accent" />
          </div>
          
          <h2 className="text-3xl font-black uppercase tracking-tight mb-8">Enter the Arena</h2>
          
          <button 
            onClick={() => setAgeGateOpen(true)}
            className="w-full bg-white text-black hover:bg-gray-200 uppercase font-black tracking-widest h-16 rounded-full flex items-center justify-center gap-2 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] mb-4 text-lg"
          >
            Start Camera Check <ChevronRight className="w-5 h-5" />
          </button>
          
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest max-w-[280px]">
            By entering the arena you agree to our Terms of Service and Privacy Policy
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-12">
          {[
            { num: "1", title: "Camera Check", desc: "Verify video & audio" },
            { num: "2", title: "Solo Scan", desc: "Face symmetry analysis" },
            { num: "3", title: "Compete & Climb", desc: "Unmog opponents, rank up" }
          ].map((step) => (
            <div key={step.num} className="bg-card/50 border border-border rounded-2xl p-6 text-center">
              <div className="text-accent font-black text-2xl mb-2">{step.num}</div>
              <div className="font-bold uppercase tracking-wider text-sm mb-1">{step.title}</div>
              <div className="text-xs text-muted-foreground uppercase">{step.desc}</div>
            </div>
          ))}
        </div>

        <div className="w-full mb-16">
          <Link href="/leaderboard" className="bg-card hover:bg-card/80 border border-border rounded-2xl p-6 flex items-center justify-between transition-colors group cursor-pointer w-full">
            <div className="flex items-center gap-4">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <span className="font-bold uppercase tracking-wider">View Leaderboard</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
          </Link>
        </div>

        <div className="text-[10px] text-muted-foreground/50 uppercase tracking-widest text-center">
          ANTI-ABUSE SESSION GATE · 18+ ACKNOWLEDGMENT · NOT LEGAL ID VERIFICATION
        </div>
      </main>

      <AgeGateModal open={ageGateOpen} onOpenChange={setAgeGateOpen} />
    </div>
  );
}
