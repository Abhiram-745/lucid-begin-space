import { useState } from "react";

export function GuestBanner() {
  const [isClaimed, setIsClaimed] = useState(false);
  const username = "Player_" + Math.floor(Math.random() * 10000);

  return (
    <div className="bg-card border-b border-border py-2 px-4 flex justify-center items-center text-sm gap-4">
      {isClaimed ? (
        <span className="text-muted-foreground uppercase">
          Playing as <span className="text-white font-bold">{username}</span>
        </span>
      ) : (
        <>
          <span className="text-muted-foreground uppercase">Playing as Guest.</span>
          <button
            onClick={() => setIsClaimed(true)}
            className="text-primary-foreground bg-primary px-3 py-1 rounded-full text-xs font-bold uppercase hover:bg-primary/80 transition-colors"
          >
            Claim with Google
          </button>
        </>
      )}
    </div>
  );
}
