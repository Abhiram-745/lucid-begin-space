import { ChevronLeft, Trophy, Swords, Target, Crosshair } from "lucide-react";
import { Link } from "wouter";

export default function Profile() {
  const mockMatches = [
    { id: 1, opponent: "Gigachad_99", result: "W", change: "+24", date: "2 mins ago" },
    { id: 2, opponent: "SymmetryGod", result: "L", change: "-18", date: "15 mins ago" },
    { id: 3, opponent: "Anon_User", result: "W", change: "+12", date: "1 hour ago" },
    { id: 4, opponent: "JawlineKing", result: "L", change: "-22", date: "2 hours ago" },
    { id: 5, opponent: "LooksMaxxer", result: "W", change: "+15", date: "3 hours ago" },
  ];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-8 mt-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-white uppercase font-bold text-xs tracking-wider transition-colors cursor-pointer">
            <ChevronLeft className="w-4 h-4" /> Back to Arena
          </Link>
        </div>

        {/* Profile Header */}
        <div className="bg-card border border-border rounded-3xl p-8 mb-8 flex flex-col sm:flex-row items-center gap-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/50 to-secondary p-1 shrink-0 relative z-10">
            <div className="w-full h-full rounded-full bg-background border-4 border-border flex items-center justify-center text-4xl font-black text-muted-foreground">
              P
            </div>
          </div>
          
          <div className="flex-1 text-center sm:text-left relative z-10">
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-white mb-2">
              Player_7742
            </h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-6">
              <div className="flex items-center gap-1.5 bg-black/50 border border-border px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                <span className="text-lg">💀</span> SLAYER
              </div>
              <div className="flex items-center gap-1.5 bg-primary/20 border border-primary/30 text-primary-foreground px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                <Target className="w-4 h-4" /> ELO 8,800
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                <span>Current: Slayer</span>
                <span>Next: Adam</span>
              </div>
              <div className="h-3 bg-black rounded-full border border-border overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-accent w-[70%] rounded-full relative">
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:10px_10px]" />
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-2 text-right">
                11,200 ELO to next tier
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Matches", value: "342", icon: Swords },
            { label: "Wins", value: "184", icon: Trophy },
            { label: "Win Rate", value: "53.8%", icon: Crosshair },
            { label: "Current ELO", value: "8,800", icon: Target },
          ].map((stat, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <stat.icon className="w-6 h-6 text-muted-foreground mb-3" />
              <div className="text-2xl font-black tabular-nums text-white">{stat.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Recent Matches */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-black uppercase tracking-widest">Recent Matches</h2>
          </div>
          
          <div className="divide-y border-border/50">
            {mockMatches.map((match) => (
              <div key={match.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-4 p-4 items-center hover:bg-white/5 transition-colors">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${match.result === 'W' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                  {match.result}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm uppercase tracking-wider">vs {match.opponent}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{match.date}</span>
                </div>
                <div className={`font-mono font-bold text-sm ${match.result === 'W' ? 'text-green-500' : 'text-red-500'}`}>
                  {match.change}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}