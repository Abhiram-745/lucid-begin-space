import { ChevronLeft, Trophy, Info } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const MOCK_LEADERBOARD = [
  { rank: 1, name: "chuddmaxxed-TikT", score: 24500, avatar: "C", tier: "ADAM" },
  { rank: 2, name: "ILLEST", score: 18200, avatar: "I", tier: "SLAYER" },
  { rank: 3, name: "gabo", score: 16400, avatar: "G", tier: "SLAYER" },
  { rank: 4, name: "JawlineKing", score: 14500, avatar: "J", tier: "SLAYER" },
  { rank: 5, name: "SymmetryGod", score: 12100, avatar: "S", tier: "SLAYER" },
  { rank: 6, name: "Player_7742", score: 8800, avatar: "P", tier: "SLAYER" },
  { rank: 7, name: "Apex_Predator", score: 6450, avatar: "A", tier: "SLAYER" },
  { rank: 8, name: "SigmaMale", score: 4900, avatar: "S", tier: "CHAD" },
  { rank: 9, name: "Alpha", score: 3200, avatar: "A", tier: "CHADLITE" },
  { rank: 10, name: "LooksMaxxer", score: 2800, avatar: "L", tier: "CHADLITE" },
  { rank: 11, name: "Anon_User", score: 2600, avatar: "A", tier: "CHADLITE" },
  { rank: 12, name: "Giga", score: 2400, avatar: "G", tier: "CHADLITE" },
  { rank: 13, name: "Chad_Thunder", score: 2100, avatar: "C", tier: "CHADLITE" },
  { rank: 14, name: "Mog_God", score: 1900, avatar: "M", tier: "HTN" },
  { rank: 15, name: "AverageJoe", score: 1700, avatar: "A", tier: "HTN" },
  { rank: 16, name: "Mid_Tier", score: 1600, avatar: "M", tier: "HTN" },
  { rank: 17, name: "Normie", score: 1400, avatar: "N", tier: "MTN" },
  { rank: 18, name: "Basic", score: 1200, avatar: "B", tier: "MTN" },
  { rank: 19, name: "Below_Avg", score: 900, avatar: "B", tier: "LTN" },
  { rank: 20, name: "Sub_Human", score: 400, avatar: "S", tier: "SUB3" },
];

const TIERS = [
  { emoji: "🍎", name: "ADAM", range: "20,001+ ELO" },
  { emoji: "💀", name: "SLAYER", range: "5,001-20,000 ELO" },
  { emoji: "👑", name: "CHAD", range: "3,501-5,000 ELO" },
  { emoji: "⭐", name: "CHADLITE", range: "2,001-3,500 ELO" },
  { emoji: "✨", name: "HTN", range: "1,501-2,000 ELO" },
  { emoji: "⭐", name: "MTN", range: "1,001-1,500 ELO" },
  { emoji: "🌙", name: "LTN", range: "501-1,000 ELO" },
  { emoji: "🔵", name: "SUB3", range: "1-500 ELO" },
  { emoji: "🔵", name: "MOLECULE", range: "≤ -1 ELO" },
];

function Countdown() {
  const targetDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 23);
    d.setHours(d.getHours() + 7);
    return d;
  }, []);

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) return;
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className="flex items-center gap-4 text-4xl font-black tracking-tighter tabular-nums">
      <div className="flex flex-col items-center">
        <span>{pad(timeLeft.days)}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Days</span>
      </div>
      <span className="text-muted-foreground pb-4">:</span>
      <div className="flex flex-col items-center">
        <span>{pad(timeLeft.hours)}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Hours</span>
      </div>
      <span className="text-muted-foreground pb-4">:</span>
      <div className="flex flex-col items-center">
        <span>{pad(timeLeft.minutes)}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Minutes</span>
      </div>
      <span className="text-muted-foreground pb-4">:</span>
      <div className="flex flex-col items-center text-accent">
        <span>{pad(timeLeft.seconds)}</span>
        <span className="text-[10px] text-accent/70 uppercase tracking-widest mt-1">Seconds</span>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<"global" | "season">("global");

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        <div className="flex items-center justify-between mb-8 mt-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-white uppercase font-bold text-xs tracking-wider transition-colors cursor-pointer">
            <ChevronLeft className="w-4 h-4" /> Back to Arena
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Season Countdown */}
            <div className="bg-card border border-primary/30 rounded-3xl p-8 mb-8 relative overflow-hidden shadow-[0_0_40px_rgba(216,180,254,0.05)]">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <div className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-2">Season Ends In</div>
                  <Countdown />
                  <div className="text-xs text-muted-foreground mt-4 uppercase tracking-widest">Ranks reset every month</div>
                </div>
                <button className="px-6 py-2 rounded-full border border-border bg-black/50 text-white font-bold uppercase text-xs tracking-widest hover:bg-white/10 transition-colors">
                  View Rewards
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-8">
              <button 
                onClick={() => setActiveTab("global")}
                className={`px-6 py-3 rounded-full font-black uppercase text-sm tracking-wider transition-colors ${activeTab === "global" ? "bg-white text-black" : "bg-card text-muted-foreground hover:text-white border border-border"}`}
              >
                ⚡ Global Arena
              </button>
              <button 
                onClick={() => setActiveTab("season")}
                className={`px-6 py-3 rounded-full font-black uppercase text-sm tracking-wider transition-colors ${activeTab === "season" ? "bg-white text-black" : "bg-card text-muted-foreground hover:text-white border border-border"}`}
              >
                🏆 Season 1
              </button>
            </div>

            {/* Heading */}
            <div className="mb-12">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white mb-2">
                Leaderboard
              </h1>
              <p className="text-muted-foreground uppercase text-xs tracking-widest mb-4">
                Top 100 ranked players by Elo. Only claimed accounts appear.
              </p>
              <div className="flex items-start gap-2 text-amber-500/80 text-xs max-w-2xl bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Elo changes depend on opponent rating. Beating lower-rated players gives less, and losing to them costs more.</p>
              </div>
            </div>

            {/* Podium */}
            <div className="flex items-end justify-center gap-4 mb-16 pt-8">
              {/* 2nd Place */}
              <div className="flex flex-col items-center w-32 relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-600 p-1 mb-3 relative z-10 shadow-lg">
                  <div className="w-full h-full rounded-full bg-card border-2 border-background flex items-center justify-center text-2xl font-black">{MOCK_LEADERBOARD[1].avatar}</div>
                </div>
                <div className="bg-gradient-to-b from-gray-800 to-card border border-gray-600 rounded-t-xl w-full h-32 flex flex-col items-center pt-8 relative">
                  <div className="absolute -top-4 w-8 h-8 rounded-full bg-gray-400 text-black font-black flex items-center justify-center border-2 border-background">2</div>
                  <span className="font-bold text-xs truncate w-full text-center px-2">{MOCK_LEADERBOARD[1].name}</span>
                  <span className="text-[10px] text-muted-foreground mt-1">{MOCK_LEADERBOARD[1].tier}</span>
                  <span className="font-mono text-xs font-bold mt-2">{MOCK_LEADERBOARD[1].score}</span>
                </div>
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center w-40 relative">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-300 to-amber-600 p-1 mb-3 relative z-10 shadow-2xl">
                  <div className="w-full h-full rounded-full bg-card border-4 border-background flex items-center justify-center text-4xl font-black">{MOCK_LEADERBOARD[0].avatar}</div>
                </div>
                <div className="bg-gradient-to-b from-amber-900/50 to-card border border-amber-600/50 rounded-t-xl w-full h-40 flex flex-col items-center pt-8 relative">
                  <div className="absolute -top-5 w-10 h-10 rounded-full bg-yellow-500 text-black font-black flex items-center justify-center border-2 border-background text-lg shadow-[0_0_15px_rgba(234,179,8,0.5)]">1</div>
                  <span className="font-bold text-sm truncate w-full text-center px-2">{MOCK_LEADERBOARD[0].name}</span>
                  <span className="text-xs text-amber-500 mt-1 font-bold">{MOCK_LEADERBOARD[0].tier}</span>
                  <span className="font-mono text-sm font-bold mt-2">{MOCK_LEADERBOARD[0].score}</span>
                </div>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center w-32 relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-300 to-orange-800 p-1 mb-3 relative z-10 shadow-lg">
                  <div className="w-full h-full rounded-full bg-card border-2 border-background flex items-center justify-center text-2xl font-black">{MOCK_LEADERBOARD[2].avatar}</div>
                </div>
                <div className="bg-gradient-to-b from-orange-900/40 to-card border border-orange-800/50 rounded-t-xl w-full h-28 flex flex-col items-center pt-8 relative">
                  <div className="absolute -top-4 w-8 h-8 rounded-full bg-orange-500 text-black font-black flex items-center justify-center border-2 border-background">3</div>
                  <span className="font-bold text-xs truncate w-full text-center px-2">{MOCK_LEADERBOARD[2].name}</span>
                  <span className="text-[10px] text-muted-foreground mt-1">{MOCK_LEADERBOARD[2].tier}</span>
                  <span className="font-mono text-xs font-bold mt-2">{MOCK_LEADERBOARD[2].score}</span>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="bg-card border border-border rounded-3xl overflow-hidden">
              <div className="grid grid-cols-[60px_1fr_100px_100px] gap-4 p-4 border-b border-border/50 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-black/20">
                <div className="text-center">Rank</div>
                <div>Player</div>
                <div>Tier</div>
                <div className="text-right">ELO</div>
              </div>
              
              <div className="divide-y border-border/50">
                {MOCK_LEADERBOARD.slice(3).map((player) => (
                  <div key={player.rank} className="grid grid-cols-[60px_1fr_100px_100px] gap-4 p-4 items-center hover:bg-white/5 transition-colors">
                    <div className="text-center font-black text-sm text-muted-foreground">
                      #{player.rank}
                    </div>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 shrink-0 rounded-full bg-secondary border border-border flex items-center justify-center font-black text-white text-xs">
                        {player.avatar}
                      </div>
                      <span className="font-bold text-sm truncate">{player.name}</span>
                    </div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                      {player.tier}
                    </div>
                    <div className="text-right font-mono font-bold text-white text-sm">
                      {player.score.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Rank Tiers */}
          <div className="w-full lg:w-[260px] shrink-0">
            <div className="bg-card border border-border rounded-3xl p-6 sticky top-8">
              <h2 className="text-sm font-black uppercase tracking-widest mb-6 border-b border-border/50 pb-4">Rank Tiers</h2>
              <div className="flex flex-col gap-4">
                {TIERS.map((tier, idx) => (
                  <div key={tier.name} className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${idx === 1 ? 'bg-primary/10 border border-primary/20' : 'hover:bg-white/5'}`}>
                    <div className="w-8 h-8 rounded-full bg-black/50 border border-border flex items-center justify-center text-lg shrink-0">
                      {tier.emoji}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs uppercase tracking-wider">{tier.name}</span>
                      <span className="text-[10px] text-muted-foreground tracking-widest">{tier.range}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}