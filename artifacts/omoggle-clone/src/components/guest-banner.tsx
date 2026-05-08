import { useState } from "react";
import { Link } from "wouter";
import { Ghost } from "lucide-react";

export function GuestBanner() {
  const [isClaimed, setIsClaimed] = useState(false);
  const username = "Player_" + Math.floor(Math.random() * 10000);

  return (
    <div className="bg-[#0a0a14] border-b border-white/5 py-2 px-4 flex justify-center items-center text-xs gap-4">
      {isClaimed ? (
        <span className="text-white/50 uppercase">
          Playing as <Link href="/profile" className="text-white font-bold hover:underline cursor-pointer">{username}</Link>
        </span>
      ) : (
        <>
          <span className="text-white/50 uppercase flex items-center gap-2">
            <Ghost className="w-3.5 h-3.5" /> Playing as Guest.
          </span>
          <button
            onClick={() => setIsClaimed(true)}
            className="text-white bg-white/10 border border-white/15 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition-all"
          >
            Claim with Google
          </button>
        </>
      )}
    </div>
  );
}
