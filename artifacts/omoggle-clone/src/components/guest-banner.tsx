import { useState } from "react";
import { Link } from "wouter";
import { Ghost } from "lucide-react";

export function GuestBanner() {
  const [isClaimed, setIsClaimed] = useState(false);
  const username = "Player_" + Math.floor(Math.random() * 10000);

  return (
    <div className="relative z-20 border-b border-white/[0.09] bg-[#070510]/88 backdrop-blur-xl py-3.5 px-4 flex flex-col sm:flex-row flex-wrap justify-center items-center gap-3 sm:gap-5 text-center text-xs sm:text-sm md:text-base max-w-full shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_12px_40px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#dfff4a]/90 via-fuchsia-500/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-500/35 to-transparent" />
      {isClaimed ? (
        <span className="text-white/55 uppercase tracking-[0.1em]">
          Playing as <Link href="/profile" className="text-white font-bold hover:text-violet-200 transition-colors cursor-pointer">{username}</Link>
        </span>
      ) : (
        <>
          <span className="text-white/50 uppercase flex items-center gap-3 tracking-[0.1em]">
            <Ghost className="w-4 h-4 text-white/45" /> Playing as Guest.
          </span>
          <button
            type="button"
            onClick={() => setIsClaimed(true)}
            className="text-white bg-white/[0.08] border border-white/15 px-5 py-2.5 sm:px-6 rounded-full text-xs sm:text-sm md:text-base font-bold uppercase tracking-[0.18em] hover:bg-white/[0.14] hover:border-white/25 transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_24px_rgba(0,0,0,0.25)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_12px_32px_rgba(139,92,246,0.15)] active:scale-[0.98] max-w-full shrink-0"
          >
            Claim with Google
          </button>
        </>
      )}
    </div>
  );
}
