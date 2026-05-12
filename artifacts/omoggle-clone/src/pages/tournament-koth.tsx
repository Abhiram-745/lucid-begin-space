import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Crown, ChevronLeft, Trophy, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useChaosPipeline } from "@/lib/use-chaos-pipeline";
import { useTournament } from "@/lib/use-tournament";

export default function TournamentKoth() {
  const params = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const t = useTournament();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [peakLocal, setPeakLocal] = useState(0);
  const lastRoundEndRef = useRef<number>(0);

  // Reconnect on direct navigation.
  useEffect(() => {
    if (!params.code) return;
    if (t.room?.code === params.code) return;
    void t.joinRoom(params.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  // Camera + mic.
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: "user", width: 1280, height: 720 }, audio: true })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        if (localVideoRef.current) localVideoRef.current.srcObject = new MediaStream(s.getVideoTracks());
        setAudioStream(new MediaStream(s.getAudioTracks()));
      })
      .catch((e: { message?: string }) => setCameraError(e?.message || "Camera blocked"));
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const r = t.room;
  const isCompetitor = !!(r && t.userId && (r.active_a === t.userId || r.active_b === t.userId));

  const pipeline = useChaosPipeline({ videoRef: localVideoRef, audioStream: isCompetitor ? audioStream : null });
  const localScore = pipeline.hasFace && isCompetitor ? pipeline.breakdown?.score ?? 0 : 0;

  // Update local peak + broadcast score.
  useEffect(() => {
    if (!pipeline.breakdown || !isCompetitor) return;
    const sc = pipeline.hasFace ? pipeline.breakdown.score : 0;
    setPeakLocal((p) => Math.max(p, sc));
    t.broadcastScore(sc, Math.max(peakLocal, sc));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.breakdown, isCompetitor]);

  // Reset local peak whenever the active pair changes (i.e. new sub-round).
  useEffect(() => {
    setPeakLocal(0);
  }, [r?.active_a, r?.active_b, r?.current_round]);

  // Host: when timer hits 0, end the round.
  useEffect(() => {
    if (!t.isHost || !r || r.status !== "running" || t.msRemaining === null) return;
    if (t.msRemaining > 0) return;
    // Debounce: avoid firing endRound multiple times for the same round.
    if (lastRoundEndRef.current === r.current_round) return;
    lastRoundEndRef.current = r.current_round;

    const peaks: Record<string, number> = {};
    // Local host's peak
    if (t.userId) peaks[t.userId] = peakLocal;
    // Other live scores
    for (const u of Object.keys(t.liveScores)) {
      peaks[u] = Math.max(peaks[u] ?? 0, t.liveScores[u].peak);
    }
    void t.endRound(peaks);
  }, [t.isHost, r, t.msRemaining, t.userId, peakLocal, t.liveScores, t]);

  // Redirect to lobby when ended.
  useEffect(() => {
    if (r?.status === "ended") {
      navigate(`/tournament/lobby/${r.code}`);
    }
  }, [r?.status, r?.code, navigate]);

  const queueOrdered = useMemo(() => {
    if (!r) return [];
    return [...t.participants]
      .filter((p) => !p.eliminated && p.user_id !== r.active_a && p.user_id !== r.active_b)
      .sort((a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999));
  }, [t.participants, r]);

  if (!r) {
    return (
      <PageShell grid="hero" landing>
        <main className="flex min-h-[60vh] items-center justify-center text-xs font-black uppercase tracking-[0.28em] text-white/40">
          Loading tournament…
        </main>
      </PageShell>
    );
  }

  const playerA = t.participants.find((p) => p.user_id === r.active_a);
  const playerB = t.participants.find((p) => p.user_id === r.active_b);
  const aScore = r.active_a === t.userId ? localScore : t.liveScores[r.active_a ?? ""]?.score ?? 0;
  const bScore = r.active_b === t.userId ? localScore : t.liveScores[r.active_b ?? ""]?.score ?? 0;
  const aPeak = r.active_a === t.userId ? peakLocal : t.liveScores[r.active_a ?? ""]?.peak ?? 0;
  const bPeak = r.active_b === t.userId ? peakLocal : t.liveScores[r.active_b ?? ""]?.peak ?? 0;
  const secs = t.msRemaining === null ? 0 : Math.ceil(t.msRemaining / 1000);

  return (
    <PageShell grid="hero" landing>
      <header className="relative z-20 flex h-12 items-center justify-between border-b border-white/10 bg-black/45 px-3 backdrop-blur-md sm:h-14 sm:px-6">
        <Link href={`/tournament/lobby/${r.code}`} className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/55 hover:text-white">
          <ChevronLeft className="h-4 w-4" /> Lobby
        </Link>
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-white">
          <Crown className="h-4 w-4 text-amber-300" />
          KOTH · Round {r.current_round}/{r.total_rounds}
        </div>
        <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">{secs}s</div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-5">
        {/* Active match score bar */}
        <div className="rounded-[14px] border border-white/10 bg-black/40 px-3 py-2 backdrop-blur">
          <div className="mb-1 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em]">
            <span className="text-amber-300 truncate">
              {playerA?.display_name ?? "P1"} · {aScore.toFixed(1)} (peak {aPeak.toFixed(1)})
            </span>
            <span className="text-white/40">Active Match</span>
            <span className="text-violet-300 truncate">
              {playerB?.display_name ?? "P2"} · {bScore.toFixed(1)} (peak {bPeak.toFixed(1)})
            </span>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[1fr_280px]">
          {/* Stage */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
            <CompetitorTile
              label={playerA?.display_name ?? "Player A"}
              score={aScore}
              isYou={r.active_a === t.userId}
              videoRef={r.active_a === t.userId ? localVideoRef : undefined}
              color="amber"
            />
            <CompetitorTile
              label={playerB?.display_name ?? "Player B"}
              score={bScore}
              isYou={r.active_b === t.userId}
              videoRef={r.active_b === t.userId ? localVideoRef : undefined}
              color="violet"
            />
          </div>

          {/* Queue + Standings sidebar */}
          <aside className="flex flex-col gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                <Users className="h-3.5 w-3.5" /> Queue
              </div>
              {queueOrdered.length === 0 ? (
                <div className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">
                  No challengers
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {queueOrdered.map((p, i) => (
                    <li key={p.id} className="flex items-center justify-between px-4 py-2 text-[12px] text-white/80">
                      <span className="truncate">#{i + 1} {p.display_name ?? `P${p.user_id.slice(0, 4)}`}</span>
                      {p.user_id === t.userId && (
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">You</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                <Trophy className="h-3.5 w-3.5 text-amber-300" /> Standings
              </div>
              <ul className="divide-y divide-white/5">
                {[...t.participants].sort((a, b) => b.points - a.points).map((p, i) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-2 text-[12px] text-white/80">
                    <span className="truncate">#{i + 1} {p.display_name ?? `P${p.user_id.slice(0, 4)}`}</span>
                    <span className="font-mono font-black text-amber-200">{p.points}</span>
                  </li>
                ))}
              </ul>
            </div>

            {!isCompetitor && (
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-950/20 px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
                Waiting in queue
              </div>
            )}
          </aside>
        </section>

        {cameraError && (
          <div className="rounded-md border border-red-500/30 bg-red-950/40 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">
            {cameraError}
          </div>
        )}
      </main>

      {/* Always render the local video — used by both competitor and queue (preview) so the
          pipeline keeps warming even when not the active player. Hidden when not in stage. */}
      {!isCompetitor && (
        <video ref={localVideoRef} autoPlay muted playsInline className="pointer-events-none fixed -bottom-1 -right-1 h-1 w-1 opacity-0" />
      )}
    </PageShell>
  );
}

function CompetitorTile({
  label, score, isYou, videoRef, color,
}: {
  label: string;
  score: number;
  isYou: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  color: "amber" | "violet";
}) {
  const grad = color === "amber" ? "from-amber-400 to-orange-400" : "from-violet-400 to-fuchsia-400";
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  return (
    <div className="relative aspect-[3/4] min-h-[260px] overflow-hidden rounded-[20px] border border-white/14 bg-[#070914]">
      {isYou && videoRef ? (
        <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-black/80 to-black/40">
          <div className="text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/40">Remote player</div>
            <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/25">Score syncing via channel</div>
          </div>
        </div>
      )}
      <div className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white">
        {label}{isYou ? " (You)" : ""}
      </div>
      <div className="absolute right-2 top-2 rounded-[12px] border border-white/15 bg-black/55 px-3 py-1.5 text-right backdrop-blur-md">
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">UNMOG</div>
        <div className="text-2xl font-black tracking-[-0.05em] text-white">{score.toFixed(1)}</div>
      </div>
      <div className="absolute inset-x-4 bottom-4">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-150`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
