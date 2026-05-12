import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Users, ChevronLeft, Trophy, AlertOctagon } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useChaosPipeline } from "@/lib/use-chaos-pipeline";
import { useTournament, percentileRank } from "@/lib/use-tournament";

export default function TournamentGroup() {
  const params = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const t = useTournament();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [peakLocal, setPeakLocal] = useState(0);
  const lastRoundEndRef = useRef<number>(0);

  useEffect(() => {
    if (!params.code) return;
    if (t.room?.code === params.code) return;
    void t.joinRoom(params.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: "user", width: 640, height: 480 }, audio: true })
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
  const isParticipant = !!(r && t.userId && t.participants.some((p) => p.user_id === t.userId && !p.eliminated));

  const pipeline = useChaosPipeline({ videoRef: localVideoRef, audioStream: isParticipant ? audioStream : null });
  const localScore = pipeline.hasFace && isParticipant ? pipeline.breakdown?.score ?? 0 : 0;

  useEffect(() => {
    if (!pipeline.breakdown || !isParticipant) return;
    const sc = pipeline.hasFace ? pipeline.breakdown.score : 0;
    setPeakLocal((p) => Math.max(p, sc));
    t.broadcastScore(sc, Math.max(peakLocal, sc));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.breakdown, isParticipant]);

  useEffect(() => {
    setPeakLocal(0);
  }, [r?.current_round]);

  // Host: end round when timer expires.
  useEffect(() => {
    if (!t.isHost || !r || r.status !== "running" || t.msRemaining === null) return;
    if (t.msRemaining > 0) return;
    if (lastRoundEndRef.current === r.current_round) return;
    lastRoundEndRef.current = r.current_round;

    const peaks: Record<string, number> = {};
    if (t.userId) peaks[t.userId] = peakLocal;
    for (const u of Object.keys(t.liveScores)) {
      peaks[u] = Math.max(peaks[u] ?? 0, t.liveScores[u].peak);
    }
    // Ensure each non-eliminated participant has an entry (zero if no broadcast).
    for (const p of t.participants) {
      if (!p.eliminated && peaks[p.user_id] === undefined) peaks[p.user_id] = 0;
    }
    void t.endRound(peaks);
  }, [t.isHost, r, t.msRemaining, t.userId, peakLocal, t.liveScores, t.participants, t]);

  useEffect(() => {
    if (r?.status === "ended") navigate(`/tournament/lobby/${r.code}`);
  }, [r?.status, r?.code, navigate]);

  // Live ranking + normalized scores across the room.
  const ranking = useMemo(() => {
    if (!r) return [] as { userId: string; name: string; score: number; peak: number; normalized: number; isMe: boolean }[];
    const competitors = t.participants.filter((p) => !p.eliminated);
    const peaks = competitors.map((p) => {
      if (p.user_id === t.userId) return peakLocal;
      return t.liveScores[p.user_id]?.peak ?? 0;
    });
    return competitors
      .map((p) => {
        const isMe = p.user_id === t.userId;
        const score = isMe ? localScore : t.liveScores[p.user_id]?.score ?? 0;
        const peak = isMe ? peakLocal : t.liveScores[p.user_id]?.peak ?? 0;
        return {
          userId: p.user_id,
          name: p.display_name ?? `P${p.user_id.slice(0, 4)}`,
          score, peak,
          normalized: percentileRank(peaks, peak),
          isMe,
        };
      })
      .sort((a, b) => b.peak - a.peak);
  }, [r, t.participants, t.userId, t.liveScores, peakLocal, localScore]);

  if (!r) {
    return (
      <PageShell grid="hero" landing>
        <main className="flex min-h-[60vh] items-center justify-center text-xs font-black uppercase tracking-[0.28em] text-white/40">
          Loading tournament…
        </main>
      </PageShell>
    );
  }

  const competitorCount = t.participants.filter((p) => !p.eliminated).length;
  const gridCols = competitorCount <= 1 ? "grid-cols-1"
    : competitorCount <= 2 ? "grid-cols-2"
    : competitorCount <= 4 ? "grid-cols-2"
    : competitorCount <= 6 ? "grid-cols-3"
    : "grid-cols-4";

  const secs = t.msRemaining === null ? 0 : Math.ceil(t.msRemaining / 1000);

  return (
    <PageShell grid="hero" landing>
      <header className="relative z-20 flex h-12 items-center justify-between border-b border-white/10 bg-black/45 px-3 backdrop-blur-md sm:h-14 sm:px-6">
        <Link href={`/tournament/lobby/${r.code}`} className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/55 hover:text-white">
          <ChevronLeft className="h-4 w-4" /> Lobby
        </Link>
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-white">
          <Users className="h-4 w-4 text-violet-300" />
          Group · Round {r.current_round}/{r.total_rounds}
        </div>
        <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">{secs}s</div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-3 py-3 sm:px-5">
        {/* Hidden self-video used by pipeline; mirrored tile renders below in the grid. */}
        <video ref={localVideoRef} autoPlay muted playsInline className="pointer-events-none fixed -bottom-1 -right-1 h-1 w-1 opacity-0" />

        <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className={`grid gap-2 sm:gap-3 ${gridCols}`}>
            {ranking.map((p, i) => (
              <PlayerTile
                key={p.userId}
                rank={i + 1}
                name={p.name}
                score={p.score}
                peak={p.peak}
                normalized={p.normalized}
                isMe={p.isMe}
                showLocalVideo={p.isMe}
                localVideoRef={localVideoRef}
                isLeader={i === 0 && p.peak > 0}
                noFace={p.isMe && !pipeline.hasFace}
              />
            ))}
          </div>

          {/* Standings sidebar */}
          <aside className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
              <Trophy className="h-3.5 w-3.5 text-amber-300" /> Cumulative
            </div>
            <ul className="divide-y divide-white/5">
              {[...t.participants].sort((a, b) => b.points - a.points).map((p, i) => (
                <li key={p.id} className={`flex items-center justify-between px-4 py-2 text-[12px] ${p.eliminated ? "opacity-30" : "text-white/80"}`}>
                  <span className="truncate">#{i + 1} {p.display_name ?? `P${p.user_id.slice(0, 4)}`}</span>
                  <span className="font-mono font-black text-amber-200">{p.points}</span>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        {cameraError && (
          <div className="rounded-md border border-red-500/30 bg-red-950/40 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">
            {cameraError}
          </div>
        )}
      </main>
    </PageShell>
  );
}

function PlayerTile({
  rank, name, score, peak, normalized, isMe, showLocalVideo, localVideoRef, isLeader, noFace,
}: {
  rank: number;
  name: string;
  score: number;
  peak: number;
  normalized: number;
  isMe: boolean;
  showLocalVideo?: boolean;
  localVideoRef?: React.RefObject<HTMLVideoElement | null>;
  isLeader?: boolean;
  noFace?: boolean;
}) {
  // Mirror tile for local video. Remote tiles show score-only since we don't
  // have WebRTC for >2 peers (keeping the multi-user view performant).
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  const ringClass = isLeader
    ? "border-amber-300/60 shadow-[0_0_28px_-6px_rgba(245,158,11,0.55)]"
    : isMe
    ? "border-cyan-400/40"
    : "border-white/12";
  return (
    <div className={`relative aspect-[4/3] min-h-[140px] overflow-hidden rounded-[16px] border bg-[#070914] ${ringClass}`}>
      {showLocalVideo && localVideoRef ? (
        // Render the local video again using a small mirrored canvas-like clone via the same ref isn't ideal,
        // but we can attach the stream to a second video by referencing srcObject. Keep it simple by reusing
        // the same element via a wrapping div with object-cover — we already have the hidden source for the
        // pipeline, so render an additional <video> bound to the same stream.
        <LocalVideoMirror sourceRef={localVideoRef} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-black/80 to-black/40">
          <div className="px-2 text-center">
            <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/40">{name}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/25">Score only</div>
          </div>
        </div>
      )}

      {noFace && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <AlertOctagon className="h-6 w-6 text-red-300" />
        </div>
      )}

      <div className="absolute left-2 top-2 flex items-center gap-1">
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] ${
          isLeader ? "border-amber-300/60 bg-amber-950/40 text-amber-200" : "border-white/15 bg-black/55 text-white/75"
        }`}>#{rank}</span>
        {isLeader && <span className="rounded-full bg-amber-400/90 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.2em] text-black">Lead</span>}
      </div>
      <div className="absolute right-2 top-2 rounded-md border border-white/15 bg-black/55 px-2 py-1 text-right backdrop-blur-md">
        <div className="text-[8px] font-black uppercase tracking-[0.2em] text-white/45">UNMOG</div>
        <div className="text-base font-black leading-none tracking-[-0.03em] text-white">{score.toFixed(1)}</div>
        <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.2em] text-amber-200/80">PK {peak.toFixed(1)}</div>
      </div>
      <div className="absolute bottom-1 left-1 right-1">
        <div className="mb-0.5 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.2em] text-white/40">
          <span className="truncate">{name}{isMe ? " (You)" : ""}</span>
          <span className="text-cyan-300">{Math.round(normalized * 100)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-all duration-150" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Mirror the hidden source video into a visible tile using the same MediaStream.
 *  Avoids creating a second getUserMedia request. */
function LocalVideoMirror({ sourceRef }: { sourceRef: React.RefObject<HTMLVideoElement | null> }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const update = () => {
      const src = sourceRef.current?.srcObject;
      if (ref.current && src) ref.current.srcObject = src as MediaStream;
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [sourceRef]);
  return <video ref={ref} autoPlay muted playsInline className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />;
}
