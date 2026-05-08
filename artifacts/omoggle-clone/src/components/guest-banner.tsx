import { useState } from "react";
import { Link } from "wouter";
import { Ghost } from "lucide-react";

export function GuestBanner() {
  const [isClaimed, setIsClaimed] = useState(false);
  const username = "Player_" + Math.floor(Math.random() * 10000);

  return (
    <div className="bg-[#0b0816] border-b border-white/8 py-3 px-4 flex justify-center items-center text-sm sm:text-base gap-5">
      {isClaimed ? (
        <span className="text-white/50 uppercase tracking-[0.08em]">
          Playing as <Link href="/profile" className="text-white font-bold hover:underline cursor-pointer">{username}</Link>
        </span>
      ) : (
        <>
          <span className="text-white/50 uppercase flex items-center gap-3 tracking-[0.08em]">
            <Ghost className="w-4 h-4" /> Playing as Guest.
          </span>
          <button
            onClick={() => setIsClaimed(true)}
            className="text-white bg-white/10 border border-white/15 px-6 py-2 rounded-full text-sm sm:text-base font-bold uppercase tracking-widest hover:bg-white/20 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            Claim with Google
          </button>
        </>
      )}
    </div>
  );
}
