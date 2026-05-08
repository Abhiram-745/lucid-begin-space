import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ChevronLeft, Zap, SkipForward, AlertTriangle, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export default function Arena() {
  const [searching, setSearching] = useState(true);
  const [opponent, setOpponent] = useState<string | null>(null);
  const [matchState, setMatchState] = useState<"searching" | "found" | "voting" | "result">("searching");
  
  const [myScore, setMyScore] = useState<number | null>(null);
  const [opponentScore, setOpponentScore] = useState<number | null>(null);
  const [result, setResult] = useState<"win" | "loss" | null>(null);

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
    if (matchState === "searching") {
      const timer = setTimeout(() => {
        setMatchState("found");
        setOpponent("Gigachad_99");
        setSearching(false);
      }, 3000);
      return () => clearTimeout(timer);
    }

    if (matchState === "found") {
      const timer = setTimeout(() => {
        setMatchState("voting");
      }, 2000);
      return () => clearTimeout(timer);
    }

    if (matchState === "voting") {
      const timer = setTimeout(() => {
        const me = Math.floor(Math.random() * 200) + 450;
        const opp = Math.floor(Math.random() * 250) + 700;
        setMyScore(me);
        setOpponentScore(opp);
        setResult(me < opp ? "win" : "loss");
        setMatchState("result");
      }, 5000);
      
      const scoreInterval = setInterval(() => {
        setMyScore(Math.floor(Math.random() * 200) + 450);
        setOpponentScore(Math.floor(Math.random() * 250) + 700);
      }, 500);
      
      return () => {
        clearTimeout(timer);
        clearInterval(scoreInterval);
      };
    }
  }, [matchState]);

  const handleSkip = () => {
    setOpponent(null);
    setMatchState("searching");
    setSearching(true);
    setMyScore(null);
    setOpponentScore(null);
    setResult(null);
  };

  const isWinning = myScore !== null && opponentScore !== null && myScore < opponentScore;

  return (
    <div className="h-[100dvh] w-full bg-black flex flex-col overflow-hidden font-mono">
      {/* Top Bar */}
      <header className="h-16 border-b border-border bg-background flex items-center justify-between px-4 sm:px-8 z-10 shrink-0">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-white uppercase font-bold text-xs tracking-wider transition-colors cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> Leave Arena
        </Link>
        
        <div className="flex items-center gap-4">
          {matchState !== "searching" && (
            <div className="px-3 py-1 bg-card border border-border rounded-full text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Round 1 of 3
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-black uppercase tracking-widest text-sm">Live</span>
          </div>
        </div>

        <button className="text-muted-foreground hover:text-destructive transition-colors">
          <Flag className="w-5 h-5" />
        </button>
      </header>

      {/* Video Grid */}
      <main className="flex-1 flex flex-col md:flex-row gap-2 p-2 bg-black overflow-hidden relative">
        
        {/* Match State Overlays */}
        <AnimatePresence>
          {matchState === "found" && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div className="bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-black text-4xl uppercase tracking-tighter shadow-[0_0_50px_rgba(216,180,254,0.5)]">
                Opponent Found
              </div>
            </motion.div>
          )}
          
          {matchState === "result" && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center pointer-events-none"
            >
              <div className={`px-8 py-4 rounded-2xl font-black text-4xl uppercase tracking-tighter mb-4 shadow-2xl border ${result === 'win' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'}`}>
                {result === 'win' ? 'You Win — Lower Unmog Score!' : 'Opponent Wins'}
              </div>
              <div className="bg-card border border-border px-6 py-2 rounded-full font-bold uppercase tracking-widest text-sm shadow-xl flex items-center gap-2">
                Elo Change: <span className={result === 'win' ? 'text-green-500' : 'text-red-500'}>{result === 'win' ? '+24' : '-18'}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Opponent Video */}
        <div className="flex-1 bg-[#0a0a0a] rounded-xl relative overflow-hidden flex flex-col border border-border/20">
          {searching ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-border border-t-accent animate-spin mb-4" />
              <div className="font-mono text-accent uppercase font-bold tracking-widest text-sm animate-pulse">
                Searching for Opponent...
              </div>
            </div>
          ) : (
            <>
              {/* Mock Video Content */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <Zap className="w-32 h-32" />
              </div>
              
              {/* Face HUD Overlay */}
              <div className="absolute inset-0 border-2 border-accent/30 rounded-xl m-2 animate-pulse pointer-events-none" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div 
                  animate={{ y: [-5, 5, -5], x: [-2, 2, -2] }}
                  transition={{ repeat: Infinity, duration: 4 }}
                  className="w-48 h-64 border border-dashed border-accent/50 relative"
                >
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-accent" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-accent" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-accent" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-accent" />
                  
                  {matchState === "voting" || matchState === "result" ? (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                      <span className="text-[10px] text-accent font-bold uppercase tracking-widest bg-black/50 px-2 py-0.5 rounded">Unmog Score</span>
                      <span className={`text-4xl font-black tabular-nums drop-shadow-lg ${matchState === 'result' ? (result === 'loss' ? 'text-green-500' : 'text-red-500') : 'text-white'}`}>
                        {opponentScore}
                      </span>
                    </div>
                  ) : (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-accent font-bold uppercase tracking-widest whitespace-nowrap bg-black/50 px-2 py-0.5 rounded animate-pulse">
                      Analyzing...
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Top UI */}
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded text-xs font-bold uppercase tracking-widest border border-border/50 z-10">
                {opponent}
              </div>
            </>
          )}
        </div>

        {/* My Video */}
        <div className="flex-1 bg-[#111] rounded-xl relative overflow-hidden border border-border/20">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover -scale-x-100"
          />
          
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded text-xs font-bold uppercase tracking-widest border border-border/50 z-10">
            You
          </div>

          {/* Face HUD Overlay */}
          {!searching && (
            <>
              <div className="absolute inset-0 border-2 border-primary/30 rounded-xl m-2 animate-pulse pointer-events-none z-10" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <motion.div 
                  animate={{ y: [5, -5, 5], x: [2, -2, 2] }}
                  transition={{ repeat: Infinity, duration: 4.5 }}
                  className="w-48 h-64 border border-dashed border-primary/50 relative"
                >
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary" />
                  
                  {matchState === "voting" || matchState === "result" ? (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                      <span className="text-[10px] text-primary-foreground font-bold uppercase tracking-widest bg-black/50 px-2 py-0.5 rounded">Unmog Score</span>
                      <span className={`text-4xl font-black tabular-nums drop-shadow-lg ${matchState === 'result' ? (result === 'win' ? 'text-green-500' : 'text-red-500') : 'text-white'}`}>
                        {myScore}
                      </span>
                    </div>
                  ) : (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-primary-foreground font-bold uppercase tracking-widest whitespace-nowrap bg-black/50 px-2 py-0.5 rounded animate-pulse">
                      Analyzing...
                    </div>
                  )}
                </motion.div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Bottom Action Bar */}
      <footer className="h-24 shrink-0 bg-background border-t border-border flex items-center justify-center px-4 z-10 relative">
        {matchState === "voting" ? (
          <Button 
            disabled
            size="lg"
            className="h-14 px-8 bg-card text-muted-foreground rounded-full uppercase font-black tracking-widest text-lg flex items-center gap-2 w-full max-w-sm border border-border"
          >
            Community Voting...
          </Button>
        ) : matchState === "result" ? (
          <Button 
            onClick={handleSkip}
            size="lg"
            className="h-14 px-8 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full uppercase font-black tracking-widest text-lg flex items-center gap-2 w-full max-w-sm shadow-[0_0_20px_rgba(216,180,254,0.3)]"
          >
            Next Opponent <SkipForward className="w-5 h-5" />
          </Button>
        ) : (
          <Button 
            onClick={handleSkip}
            size="lg"
            className="h-14 px-8 bg-white text-black hover:bg-gray-200 rounded-full uppercase font-black tracking-widest text-lg flex items-center gap-2 w-full max-w-sm transition-all"
          >
            Skip <SkipForward className="w-5 h-5" />
          </Button>
        )}
      </footer>
    </div>
  );
}