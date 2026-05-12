import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ChevronLeft, Copy, Crown, Users, Check, X, Play, LogOut, Trophy } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useTournament, MAX_ROOM_SIZE } from "@/lib/use-tournament";

export default function TournamentLobby() {
  const params = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const t = useTournament();
  const [copied, setCopied] = useState(false);

  // Reconnect to the room on direct navigation / refresh.
  useEffect(() => {
    if (!params.code) return;
    if (t.room?.code === params.code) return;
    void t.joinRoom(params.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  // Once the host starts, redirect everyone to the live screen.
  useEffect(() => {
    if (!t.room) return;
    if (t.room.status === "running") {
      if (t.room.mode === "koth") navigate(`/tournament/koth/${t.room.code}`);
      else navigate(`/tournament/group/${t.room.code}`);
    }
  }, [t.room, navigate]);

  if (!t.room) {
    return (
      <PageShell grid="hero" landing>
        <main className="flex min-h-[60vh] items-center justify-center text-center">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.28em] text-white/40">{t.errorMsg || "Loading room…"}</div>
            {t.errorMsg && (
              <Link href="/tournament" className="mt-4 inline-block rounded-md border border-white/15 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/70 hover:bg-white/[0.04]">
                Back
              </Link>
            )}
          </div>
        </main>
      </PageShell>
    );
  }

  const r = t.room;
  const me = t.participants.find((p) => p.user_id === t.userId);
  const allReady = t.participants.length >= 2 && t.participants.every((p) => p.ready || p.user_id === r.host_id);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(r.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <PageShell grid="hero" landing>
      <header className="relative z-20 flex h-12 items-center justify-between border-b border-white/10 bg-black/45 px-3 backdrop-blur-md sm:h-14 sm:px-6">
        <button
          onClick={async () => { await t.leaveRoom(); navigate("/tournament"); }}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/55 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" /> Leave
        </button>
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-white">
          {r.mode === "koth" ? <Crown className="h-4 w-4 text-amber-300" /> : <Users className="h-4 w-4 text-violet-300" />}
          {r.mode === "koth" ? "King of the Hill" : "Group Tournament"}
        </div>
        <div className="w-12" />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 sm:px-8 sm:py-12">
        {/* Room code card */}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/45 p-6 text-center backdrop-blur">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Room Code</div>
          <button
            onClick={copyCode}
            className="group flex items-center gap-3 rounded-lg border border-white/15 bg-black/60 px-5 py-3 font-mono text-3xl font-black tracking-[0.4em] text-white transition hover:border-cyan-400/60 hover:bg-cyan-950/30 sm:text-4xl"
          >
            {r.code}
            {copied ? <Check className="h-5 w-5 text-emerald-300" /> : <Copy className="h-5 w-5 text-white/40 group-hover:text-cyan-300" />}
          </button>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
            {r.round_seconds}s rounds · {r.total_rounds} rounds{r.elimination ? " · elimination" : ""}
          </div>
        </div>

        {/* Player list */}
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
            <span>Players</span>
            <span>{t.participants.length} / {MAX_ROOM_SIZE}</span>
          </div>
          <ul className="divide-y divide-white/5">
            {t.participants.map((p, i) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/60 text-[11px] font-black text-white/80">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-black text-white">
                      {p.display_name ?? `Player ${p.user_id.slice(0, 6)}`}
                      {p.user_id === r.host_id && (
                        <span className="ml-2 rounded-full border border-amber-400/40 bg-amber-950/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">
                          Host
                        </span>
                      )}
                      {p.user_id === t.userId && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">You</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${
                  p.ready || p.user_id === r.host_id ? "text-emerald-300" : "text-white/30"
                }`}>
                  {p.ready || p.user_id === r.host_id ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {p.user_id === r.host_id ? "Ready" : p.ready ? "Ready" : "Waiting"}
                </div>
              </li>
            ))}
            {Array.from({ length: Math.max(0, MAX_ROOM_SIZE - t.participants.length) }).map((_, i) => (
              <li key={`empty-${i}`} className="flex items-center px-5 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/15">
                Empty slot
              </li>
            ))}
          </ul>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3">
          {!t.isHost && (
            <button
              onClick={() => t.toggleReady()}
              className={`h-12 w-full rounded-md border text-[11px] font-black uppercase tracking-[0.28em] transition ${
                me?.ready
                  ? "border-emerald-400/60 bg-emerald-950/40 text-emerald-200"
                  : "border-cyan-400/40 bg-cyan-950/30 text-cyan-200 hover:border-cyan-300/70"
              }`}
            >
              {me?.ready ? "Ready ✓" : "Mark Ready"}
            </button>
          )}
          {t.isHost && (
            <button
              onClick={() => t.startTournament()}
              disabled={!allReady}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-emerald-400/50 bg-emerald-950/40 text-[12px] font-black uppercase tracking-[0.28em] text-emerald-200 transition hover:border-emerald-300/70 hover:bg-emerald-900/40 disabled:opacity-30"
            >
              <Play className="h-4 w-4" />
              {allReady ? "Start Tournament" : `Need ${Math.max(0, 2 - t.participants.length)} more players`}
            </button>
          )}
          <button
            onClick={async () => { await t.leaveRoom(); navigate("/tournament"); }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.24em] text-white/55 hover:bg-white/[0.06]"
          >
            <LogOut className="h-3.5 w-3.5" /> Leave Room
          </button>
        </div>

        {/* Live leaderboard preview (if any rounds played) */}
        {t.participants.some((p) => p.points > 0) && (
          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur">
            <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
              <Trophy className="h-3.5 w-3.5 text-amber-300" /> Standings
            </div>
            <ul className="divide-y divide-white/5">
              {[...t.participants].sort((a, b) => b.points - a.points).map((p, i) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-2 text-[12px] text-white/80">
                  <span>#{i + 1} {p.display_name ?? `Player ${p.user_id.slice(0, 6)}`}</span>
                  <span className="font-mono font-black text-amber-200">{p.points} pts · {p.wins}W</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </PageShell>
  );
}
