import { ChevronLeft, Info } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

const MOCK_LEADERBOARD = [
  { rank: 1, name: "nightwing_kv", score: 24500, avatar: "N", tier: "ADAM" },
  { rank: 2, name: "lukasz_m", score: 18200, avatar: "L", tier: "SLAYER" },
  { rank: 3, name: "treyval", score: 16400, avatar: "T", tier: "SLAYER" },
  { rank: 4, name: "dezzy", score: 14500, avatar: "D", tier: "SLAYER" },
  { rank: 5, name: "xo_frankie", score: 12100, avatar: "X", tier: "SLAYER" },
  { rank: 6, name: "moonshard", score: 8800, avatar: "M", tier: "SLAYER" },
  { rank: 7, name: "ayo_k", score: 6450, avatar: "A", tier: "SLAYER" },
  { rank: 8, name: "brix22", score: 4900, avatar: "B", tier: "CHAD" },
  { rank: 9, name: "caspar_fw", score: 3200, avatar: "C", tier: "CHADLITE" },
  { rank: 10, name: "jvlian", score: 2800, avatar: "J", tier: "CHADLITE" },
  { rank: 11, name: "riven_88", score: 2600, avatar: "R", tier: "CHADLITE" },
  { rank: 12, name: "solenne", score: 2400, avatar: "S", tier: "CHADLITE" },
  { rank: 13, name: "kai_voss", score: 2100, avatar: "K", tier: "CHADLITE" },
  { rank: 14, name: "axl_tm", score: 1900, avatar: "A", tier: "HTN" },
  { rank: 15, name: "celeste_d", score: 1700, avatar: "C", tier: "HTN" },
  { rank: 16, name: "kian_x", score: 1600, avatar: "K", tier: "HTN" },
  { rank: 17, name: "mira_v", score: 1400, avatar: "M", tier: "MTN" },
  { rank: 18, name: "zephyr_j", score: 1200, avatar: "Z", tier: "MTN" },
  { rank: 19, name: "orion_s", score: 900, avatar: "O", tier: "LTN" },
  { rank: 20, name: "lyra_w", score: 400, avatar: "L", tier: "SUB3" },
];

const TIER_COLORS: Record<string, string> = {
  "ADAM": "border-red-500",
  "SLAYER": "border-purple-500",
  "CHAD": "border-yellow-500",
  "CHADLITE": "border-blue-500",
  "HTN": "border-cyan-500",
  "MTN": "border-green-500",
  "LTN": "border-gray-500",
  "SUB3": "border-slate-500",
  "MOLECULE": "border-zinc-500"
};

const TIER_BG_COLORS: Record<string, string> = {
  "ADAM": "bg-red-500",
  "SLAYER": "bg-purple-500",
  "CHAD": "bg-yellow-500",
  "CHADLITE": "bg-blue-500",
  "HTN": "bg-cyan-500",
  "MTN": "bg-green-500",
  "LTN": "bg-gray-500",
  "SUB3": "bg-slate-500",
  "MOLECULE": "bg-zinc-500"
};

const TIERS = [
  { emoji: "🍎", name: "ADAM", range: "20,001+ ELO", color: "bg-red-500" },
  { emoji: "💀", name: "SLAYER", range: "5,001-20,000 ELO", color: "bg-purple-500" },
  { emoji: "👑", name: "CHAD", range: "3,501-5,000 ELO", color: "bg-yellow-500" },
  { emoji: "⭐", name: "CHADLITE", range: "2,001-3,500 ELO", color: "bg-blue-500" },
  { emoji: "✨", name: "HTN", range: "1,501-2,000 ELO", color: "bg-cyan-500" },
  { emoji: "⭐", name: "MTN", range: "1,001-1,500 ELO", color: "bg-green-500" },
  { emoji: "🌙", name: "LTN", range: "501-1,000 ELO", color: "bg-gray-500" },
  { emoji: "🔵", name: "SUB3", range: "1-500 ELO", color: "bg-slate-500" },
  { emoji: "🔵", name: "MOLECULE", range: "≤ -1 ELO", color: "bg-zinc-500" },
];

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<"global" | "season">("global");

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign("/arena");
  };

  return (
    <div className="min-h-screen bg-[#050505] p-4 sm:p-8 flex flex-col items-center font-mono">
      <div className="w-full max-w-6xl">
        <div className="flex items-center justify-between mb-8 mt-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-white/50 hover:text-white uppercase font-bold text-xs tracking-wider transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Arena
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Tabs */}
            <div className="flex gap-4 mb-8">
              <button 
                onClick={() => setActiveTab("global")}
                className={`px-6 py-3 rounded-full font-bold uppercase text-sm tracking-wider transition-colors ${activeTab === "global" ? "bg-white text-black" : "bg-white/5 text-white/50 hover:text-white border border-white/10"}`}
              >
                ⚡ Global Arena
              </button>
              <button 
                onClick={() => setActiveTab("season")}
                className={`px-6 py-3 rounded-full font-bold uppercase text-sm tracking-wider transition-colors ${activeTab === "season" ? "bg-white text-black" : "bg-white/5 text-white/50 hover:text-white border border-white/10"}`}
              >
                🏆 Season 1
              </button>
            </div>

            {/* Heading */}
            <div className="mb-12">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white mb-2">
                Leaderboard
              </h1>
              <p className="text-white/50 uppercase text-xs tracking-widest mb-6">
                Top 100 ranked players by Elo. Only claimed accounts appear.
              </p>
              <div className="flex items-start gap-3 text-amber-400 text-xs max-w-2xl bg-amber-950/20 p-4 rounded-xl border border-amber-500/20">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                <p className="leading-relaxed">Elo changes depend on opponent rating. Beating lower-rated players gives less, and losing to them costs more.</p>
              </div>
            </div>

            {/* Podium */}
            <div className="flex items-end justify-center gap-4 mb-16 pt-8">
              {/* 2nd Place */}
              <div className="flex flex-col items-center w-32 relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 p-[3px] mb-3 relative z-10 shadow-[0_0_20px_rgba(148,163,184,0.3)]">
                  <div className="w-full h-full rounded-full bg-[#0d0d1a] border-4 border-[#050505] flex items-center justify-center text-2xl font-black text-white">{MOCK_LEADERBOARD[1].avatar}</div>
                </div>
                <div className="bg-gradient-to-b from-slate-700/30 to-[#0d0d1a] border border-slate-600/30 border-b-0 rounded-t-2xl w-full h-32 flex flex-col items-center pt-8 relative backdrop-blur-sm">
                  <div className="absolute -top-4 w-8 h-8 rounded-full bg-slate-400 text-black font-black flex items-center justify-center border-2 border-[#050505] shadow-[0_0_10px_rgba(148,163,184,0.5)]">2</div>
                  <span className="font-bold text-xs truncate w-full text-center px-2 text-white">{MOCK_LEADERBOARD[1].name}</span>
                  <span className="text-[10px] text-purple-400 mt-1 font-bold">{MOCK_LEADERBOARD[1].tier}</span>
                  <span className="font-mono text-xs font-bold mt-2 text-white/80">{MOCK_LEADERBOARD[1].score.toLocaleString()}</span>
                </div>
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center w-40 relative z-20">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-300 to-amber-600 p-[4px] mb-3 relative z-10 shadow-[0_0_30px_rgba(251,191,36,0.4)]">
                  <div className="w-full h-full rounded-full bg-[#0d0d1a] border-4 border-[#050505] flex items-center justify-center text-4xl font-black text-white">{MOCK_LEADERBOARD[0].avatar}</div>
                </div>
                <div className="bg-gradient-to-b from-amber-900/40 to-[#0d0d1a] border border-amber-600/40 border-b-0 rounded-t-2xl w-full h-44 flex flex-col items-center pt-10 relative backdrop-blur-sm">
                  <div className="absolute -top-5 w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 text-black font-black flex items-center justify-center border-2 border-[#050505] text-lg shadow-[0_0_20px_rgba(234,179,8,0.6)]">1</div>
                  <span className="font-bold text-sm truncate w-full text-center px-2 text-white">{MOCK_LEADERBOARD[0].name}</span>
                  <span className="text-xs text-red-500 mt-1 font-bold tracking-widest">{MOCK_LEADERBOARD[0].tier}</span>
                  <span className="font-mono text-sm font-bold mt-2 text-yellow-400">{MOCK_LEADERBOARD[0].score.toLocaleString()}</span>
                </div>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center w-32 relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-800 p-[3px] mb-3 relative z-10 shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                  <div className="w-full h-full rounded-full bg-[#0d0d1a] border-4 border-[#050505] flex items-center justify-center text-2xl font-black text-white">{MOCK_LEADERBOARD[2].avatar}</div>
                </div>
                <div className="bg-gradient-to-b from-orange-900/30 to-[#0d0d1a] border border-orange-800/30 border-b-0 rounded-t-2xl w-full h-28 flex flex-col items-center pt-8 relative backdrop-blur-sm">
                  <div className="absolute -top-4 w-8 h-8 rounded-full bg-orange-600 text-white font-black flex items-center justify-center border-2 border-[#050505] shadow-[0_0_10px_rgba(234,88,12,0.5)]">3</div>
                  <span className="font-bold text-xs truncate w-full text-center px-2 text-white">{MOCK_LEADERBOARD[2].name}</span>
                  <span className="text-[10px] text-purple-400 mt-1 font-bold">{MOCK_LEADERBOARD[2].tier}</span>
                  <span className="font-mono text-xs font-bold mt-2 text-white/80">{MOCK_LEADERBOARD[2].score.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="bg-[#0d0d1a] border border-white/10 rounded-[2rem] overflow-hidden shadow-xl">
              <div className="grid grid-cols-[60px_1fr_100px_100px] gap-4 p-4 border-b border-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 bg-white/[0.02]">
                <div className="text-center">Rank</div>
                <div>Player</div>
                <div>Tier</div>
                <div className="text-right">ELO</div>
              </div>
              
              <div className="divide-y divide-white/5">
                {MOCK_LEADERBOARD.slice(3).map((player) => (
                  <div key={player.rank} className={`grid grid-cols-[60px_1fr_100px_100px] gap-4 p-4 items-center hover:bg-white/[0.03] transition-colors relative border-l-2 ${player.rank <= 5 ? TIER_COLORS[player.tier] : 'border-transparent'}`}>
                    <div className="text-center font-black text-sm text-white/30">
                      #{player.rank}
                    </div>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 shrink-0 rounded-full bg-white/10 border border-white/10 flex items-center justify-center font-black text-white text-xs">
                        {player.avatar}
                      </div>
                      <span className="font-bold text-sm truncate text-white/90">{player.name}</span>
                    </div>
                    <div className={`text-[10px] uppercase font-bold tracking-widest ${player.tier === 'SLAYER' ? 'text-purple-400' : player.tier === 'CHAD' ? 'text-yellow-400' : player.tier === 'CHADLITE' ? 'text-blue-400' : player.tier === 'HTN' ? 'text-cyan-400' : player.tier === 'MTN' ? 'text-green-400' : player.tier === 'LTN' ? 'text-gray-400' : player.tier === 'SUB3' ? 'text-slate-400' : 'text-zinc-400'}`}>
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
            <div className="bg-[#0d0d1a] border border-white/10 rounded-[2rem] p-6 sticky top-8 shadow-xl">
              <h2 className="text-sm font-black uppercase tracking-widest mb-6 border-b border-white/5 pb-4 text-white">Rank Tiers</h2>
              <div className="flex flex-col gap-2">
                {TIERS.map((tier) => (
                  <div key={tier.name} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors relative border-l-[3px] border-transparent hover:border-white/20" style={{ borderLeftColor: tier.color.replace('bg-', '') /* this is a hack but css vars or explicit maps are better */ }}>
                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full ${tier.color}`} />
                    <div className="w-8 h-8 rounded-full bg-[#050505] border border-white/10 flex items-center justify-center text-lg shrink-0 ml-1">
                      {tier.emoji}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-[10px] text-white uppercase tracking-wider">{tier.name}</span>
                      <span className="text-[9px] text-white/40 tracking-widest">{tier.range}</span>
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
