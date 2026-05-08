import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, Zap, SkipForward, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Arena() {
  const [searching, setSearching] = useState(true);
  const [opponent, setOpponent] = useState<string | null>(null);

  useEffect(() => {
    if (searching) {
      const timer = setTimeout(() => {
        setSearching(false);
        setOpponent("Gigachad_99");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [searching]);

  const handleSkip = () => {
    setOpponent(null);
    setSearching(true);
  };

  return (
    <div className="h-screen w-full bg-black flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="h-16 border-b border-border bg-background flex items-center justify-between px-4 sm:px-8 z-10">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-white uppercase font-bold text-xs tracking-wider transition-colors cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> Leave Arena
        </Link>
        
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-black uppercase tracking-widest text-sm">Live</span>
        </div>

        <button className="text-muted-foreground hover:text-destructive transition-colors">
          <AlertTriangle className="w-5 h-5" />
        </button>
      </header>

      {/* Video Grid */}
      <main className="flex-1 flex flex-col md:flex-row gap-1 p-1 bg-black">
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
              
              {/* Overlay UI */}
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded text-xs font-bold uppercase tracking-widest border border-border/50">
                {opponent}
              </div>
              <div className="absolute bottom-4 left-4 bg-accent text-accent-foreground px-3 py-1 rounded text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-3 h-3" /> Score: 9,999
              </div>
            </>
          )}
        </div>

        {/* My Video */}
        <div className="flex-1 bg-[#111] rounded-xl relative overflow-hidden border border-border/20">
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded text-xs font-bold uppercase tracking-widest border border-border/50">
            You (Player_7742)
          </div>
          {/* Mock Video Content */}
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <div className="w-32 h-40 border border-white/20 rounded-full" />
          </div>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <footer className="h-24 bg-background border-t border-border flex items-center justify-center px-4 z-10">
        <Button 
          onClick={handleSkip}
          size="lg"
          className="h-14 px-8 bg-white text-black hover:bg-gray-200 rounded-full uppercase font-black tracking-widest text-lg flex items-center gap-2 w-full max-w-sm"
        >
          Skip <SkipForward className="w-5 h-5" />
        </Button>
      </footer>
    </div>
  );
}
