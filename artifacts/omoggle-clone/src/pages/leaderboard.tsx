import { ChevronLeft, Trophy } from "lucide-react";
import { Link } from "wouter";

const MOCK_LEADERBOARD = [
  { rank: 1, name: "Gigachad", score: 9999, avatar: "G" },
  { rank: 2, name: "Mogger_01", score: 8750, avatar: "M" },
  { rank: 3, name: "HunterX", score: 8120, avatar: "H" },
  { rank: 4, name: "JawlineKing", score: 7650, avatar: "J" },
  { rank: 5, name: "SymmetryGod", score: 7100, avatar: "S" },
  { rank: 6, name: "Player_7742", score: 6800, avatar: "P" },
  { rank: 7, name: "Apex_Predator", score: 6450, avatar: "A" },
  { rank: 8, name: "SigmaMale", score: 5900, avatar: "S" },
  { rank: 9, name: "Alpha", score: 5200, avatar: "A" },
  { rank: 10, name: "LooksMaxxer", score: 4800, avatar: "L" },
];

export default function Leaderboard() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-12 mt-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-white uppercase font-bold text-xs tracking-wider transition-colors cursor-pointer">
            <ChevronLeft className="w-4 h-4" /> Back to Arena
          </Link>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h1 className="text-xl font-black uppercase tracking-widest text-white">Top 10 Moggers</h1>
          </div>
          <div className="w-[100px]"></div> {/* Spacer */}
        </div>

        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="grid grid-cols-[80px_1fr_120px] gap-4 p-4 border-b border-border/50 text-xs font-bold uppercase tracking-widest text-muted-foreground bg-black/20">
            <div className="text-center">Rank</div>
            <div>Player</div>
            <div className="text-right">Mog Score</div>
          </div>
          
          <div className="divide-y border-border/50">
            {MOCK_LEADERBOARD.map((player) => (
              <div key={player.rank} className="grid grid-cols-[80px_1fr_120px] gap-4 p-4 items-center hover:bg-white/5 transition-colors">
                <div className="text-center font-black text-lg text-accent">
                  #{player.rank}
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center font-black text-white">
                    {player.avatar}
                  </div>
                  <span className="font-bold uppercase tracking-wider text-sm">{player.name}</span>
                </div>
                <div className="text-right font-mono font-bold text-white">
                  {player.score.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
