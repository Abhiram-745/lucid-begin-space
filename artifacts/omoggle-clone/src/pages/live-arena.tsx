import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ScanFace, Zap, Skull, Smile, AlertOctagon, Wifi, Check, X, Hexagon, Flag, RotateCcw, MessageSquare } from "lucide-react";
import { useChaosPipeline } from "@/lib/use-chaos-pipeline";
import { EventDetector, type InstantEvent } from "@/lib/instant-win";
import { useMultiplayer } from "@/lib/use-multiplayer";

const ROUND_SECONDS = 60;

export default function LiveArena() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [roundLeft, setRoundLeft] = useState(ROUND_SECONDS);
  const [peakLocal, setPeakLocal] = useState(0);
  const [events, setEvents] = useState<InstantEvent[]>([]);
  const [winner, setWinner] = useState<"you" | "opp" | "draw" | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [matchStarted, setMatchStarted] = useState(false);

  const detector = useRef(new EventDetector());
  const mp = useMultiplayer();

  const pipeline = useChaosPipeline({ videoRef: localVideoRef, audioStream });
  const localScore = pipeline.hasFace ? pipeline.breakdown?.score ?? 0 : 0;
  const traits = pipeline.breakdown?.traits ?? { good: [], bad: [] };

  // 1. Acquire camera + start matchmaking
  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "This browser doesn't expose getUserMedia. Open the site over HTTPS in Chrome, Edge, Firefox or Safari.",
      );
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
        audio: true,
      })
      .then(async (stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (localVideoRef.current) {
          const videoOnly = new MediaStream(stream.getVideoTracks());
          localVideoRef.current.srcObject = videoOnly;
        }
        setAudioStream(new MediaStream(stream.getAudioTracks()));
        setCameraReady(true);
        await mp.start(stream);
      })
      .catch((err: unknown) => {
        const e = err as { name?: string; message?: string };
        const name = e?.name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setCameraError(
            "Camera/mic permission was blocked. Click the camera icon in the address bar, allow access, and reload.",
          );
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setCameraError("No camera/microphone was found on this device.");
        } else if (name === "NotReadableError") {
          setCameraError("Your camera is in use by another app. Close it and reload.");
        } else {
          setCameraError(e?.message || "Camera access is blocked or unavailable.");
        }
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      mp.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Attach remote stream
  useEffect(() => {
    if (mp.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = mp.remoteStream;
    }
  }, [mp.remoteStream]);

  // 3a. Pre-round countdown when both peers are connected
  useEffect(() => {
    if (mp.status !== "live" || matchStarted || winner) return;
    if (!mp.remoteStream) return;
    setCountdown(3);
    const id = window.setInterval(() => {
      setCountdown((c) => {
        if (c === null) return null;
        if (c <= 1) {
          window.clearInterval(id);
          setMatchStarted(true);
          return null;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [mp.status, mp.remoteStream, matchStarted, winner]);

  // 3b. Round timer (only after countdown)
  useEffect(() => {
    if (!matchStarted || winner) return;
    const tick = window.setInterval(() => {
      setRoundLeft((s) => {
        if (s <= 1) {
          window.clearInterval(tick);
          setWinner((w) => w ?? (peakLocal >= mp.opponentPeak ? "you" : peakLocal === mp.opponentPeak ? "draw" : "opp"));
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [matchStarted, winner, peakLocal, mp.opponentPeak]);

  // 4. Opponent forfeit
  useEffect(() => {
    if (mp.opponentLeft && !winner && mp.status === "live") {
      setWinner("you");
      setEvents((p) => [...p, { type: "no_face" as const, t: performance.now() }].slice(-5));
    }
  }, [mp.opponentLeft, winner, mp.status]);

  // 5. Pipeline tick → score broadcast + event detection + peak tracking
  useEffect(() => {
    if (!pipeline.breakdown) return;
    const sc = pipeline.hasFace ? pipeline.breakdown.score : 0;
    if (matchStarted) setPeakLocal((p) => Math.max(p, sc));
    if (mp.status === "live") mp.broadcastScore(sc);

    const audioSpike = pipeline.breakdown.audio.spike;
    const oppMouthProxy = Math.min(1, mp.opponentScore / 10);
    const fired = detector.current.step(pipeline.breakdown, oppMouthProxy, !mp.opponentLeft, audioSpike);
    if (fired.length) {
      setEvents((prev) => [...prev, ...fired].slice(-5));
      for (const ev of fired) {
        if (ev.type === "opponent_laugh") setWinner("you");
        if (ev.type === "mega_unmog" || ev.type === "double_chin_lock") {
          mp.broadcastEvent(ev.type);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.breakdown]);

  // 6. On winner decided → finalize
  useEffect(() => {
    if (!winner) return;
    mp.finalize({
      localScore: peakLocal,
      localPeak: peakLocal,
      reason: winner === "draw" ? "time" : "win",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  const restart = useCallback(() => {
    detector.current.reset();
    setEvents([]);
    setWinner(null);
    setPeakLocal(0);
    setRoundLeft(ROUND_SECONDS);
    setMatchStarted(false);
    setCountdown(null);
    mp.leave();
    if (streamRef.current) mp.start(streamRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ================== Searching screen ==================
  if (mp.status === "queueing" || mp.status === "waiting" || mp.status === "auth" || mp.status === "idle" || mp.status === "connecting") {
    return <SearchingScreen status={mp.status} cameraReady={cameraReady} cameraError={cameraError} errorMsg={mp.errorMsg} />;
  }

  if (mp.status === "error") {
    return <SearchingScreen status="error" cameraReady={cameraReady} cameraError={cameraError} errorMsg={mp.errorMsg} />;
  }

  // ================== Live screen ==================
  // Tug-of-war bar: 50 = even, fills toward higher score.
  const diff = localScore - mp.opponentScore; // -10..+10
  const tugPct = Math.max(0, Math.min(100, 50 + (diff / 10) * 50));

  return (
    <div className="relative min-h-screen overflow-hidden bg-black font-mono text-white">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,20,27,0.82),rgba(7,7,10,1)_42%,rgba(19,9,22,0.95))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_80%_72%,rgba(168,85,247,0.14),transparent_30%)]" />

      <header className="relative z-20 flex h-12 items-center justify-between border-b border-white/10 bg-black/45 px-3 backdrop-blur-md sm:h-14 sm:px-6">
        <Link href="/arena" className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/55 hover:text-white">
          <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Leave</span>
        </Link>
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          1v1 · {matchStarted ? `${roundLeft}s` : "READY"}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
          <Wifi className="h-4 w-4" /> {mp.isPlayerA ? "Host" : "Peer"}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[1400px] flex-col gap-2 px-2 py-2 pb-[env(safe-area-inset-bottom)] sm:gap-4 sm:px-4 sm:py-3">
        {/* Tug-of-war bar */}
        <div className="rounded-[14px] border border-white/10 bg-black/40 px-3 py-2 backdrop-blur">
          <div className="mb-1 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em]">
            <span className="text-emerald-300">You {localScore.toFixed(1)}</span>
            <span className="text-white/40">{matchStarted ? "MOG WAR" : countdown !== null ? `STARTS IN ${countdown}` : "WAITING"}</span>
            <span className="text-violet-300">Opp {mp.opponentScore.toFixed(1)}</span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="absolute left-1/2 top-0 z-10 h-full w-px -translate-x-1/2 bg-white/40" />
            {tugPct >= 50 ? (
              <div className="absolute left-1/2 top-0 h-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all" style={{ width: `${tugPct - 50}%` }} />
            ) : (
              <div className="absolute right-1/2 top-0 h-full bg-gradient-to-l from-violet-400 to-fuchsia-400 transition-all" style={{ width: `${50 - tugPct}%` }} />
            )}
          </div>
          <div className="mt-1 text-center text-[9px] font-black uppercase tracking-[0.2em] text-white/35">
            Peak You {peakLocal.toFixed(1)} · Peak Opp {mp.opponentPeak.toFixed(1)}
          </div>
        </div>

        <section className="grid flex-1 grid-cols-1 gap-2 sm:gap-4 lg:grid-cols-2">
          <VideoTile
            videoRef={localVideoRef}
            label="You"
            score={localScore}
            color="emerald"
            mirror
            badges={events.filter((e) => e.type !== "no_face").slice(-2)}
            noFace={!pipeline.hasFace}
            traits={traits}
          />
          <VideoTile
            videoRef={remoteVideoRef}
            label="Opponent"
            score={mp.opponentScore}
            color="violet"
            badges={[]}
            empty={!mp.remoteStream}
          />
        </section>

        {/* Event banner row */}
        {events.length > 0 && (
          <div className="pointer-events-none flex justify-center gap-2">
            {events.slice(-3).map((e, i) => <EventBadge key={`${e.type}-${e.t}-${i}`} ev={e} />)}
          </div>
        )}
      </main>

      {/* Countdown overlay */}
      {countdown !== null && !winner && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.4em] text-cyan-200">Get Ready</div>
            <div className="mt-2 text-[clamp(80px,28vw,140px)] font-black leading-none tracking-[-0.08em] text-white drop-shadow-[0_0_40px_rgba(34,211,238,0.5)]">
              {countdown}
            </div>
          </div>
        </div>
      )}

      {/* BRUTALIZED / win overlay */}
      {winner && (
        <ResultOverlay
          winner={winner}
          youScore={peakLocal}
          oppScore={mp.opponentPeak}
          oppName="Opponent"
          onRematch={restart}
        />
      )}
    </div>
  );
}

/* -------- BRUTALIZED result overlay -------- */
function ResultOverlay({
  winner, youScore, oppScore, oppName, onRematch,
}: {
  winner: "you" | "opp" | "draw";
  youScore: number;
  oppScore: number;
  oppName: string;
  onRematch: () => void;
}) {
  const [rated, setRated] = useState<number | null>(null);

  const verdict =
    winner === "you" ? { word: "DOMINATED", color: "from-emerald-400 via-emerald-300 to-cyan-300", glow: "rgba(52,211,153,0.55)" }
    : winner === "opp" ? { word: "BRUTALIZED", color: "from-red-500 via-rose-400 to-orange-400", glow: "rgba(239,68,68,0.55)" }
    : { word: "STALEMATE", color: "from-zinc-300 via-zinc-100 to-zinc-300", glow: "rgba(255,255,255,0.35)" };

  const youLost = winner === "opp";
  const youWon = winner === "you";
  const eloDelta = winner === "draw" ? 0 : winner === "you" ? 4 : -4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/92 px-4 py-6 backdrop-blur-md">
      <div className="relative w-full max-w-[640px]">
        {/* radial halo */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 blur-[80px]"
          style={{ background: `radial-gradient(circle at 50% 30%, ${verdict.glow}, transparent 65%)` }}
        />

        {/* Title */}
        <h1
          className={`bg-gradient-to-b ${verdict.color} bg-clip-text text-center text-5xl font-black uppercase tracking-[-0.02em] text-transparent sm:text-[68px]`}
          style={{ filter: `drop-shadow(0 0 32px ${verdict.glow})` }}
        >
          {verdict.word}
        </h1>
        <p className="mt-2 text-center text-[11px] font-black uppercase tracking-[0.32em] text-white/45">
          BY {oppName.toUpperCase()}
        </p>

        {/* Score cards */}
        <div className="relative mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <ScoreCard label="YOU" value={youScore} elo={eloDelta} loser={youLost} winner={youWon} />
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
            VS
          </div>
          <ScoreCard label={oppName.slice(0, 14).toUpperCase()} value={oppScore} elo={-eloDelta} loser={youWon} winner={youLost} />
        </div>

        {/* Action stack */}
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={onRematch}
            className="h-12 w-full rounded-md border border-cyan-400/30 bg-cyan-950/30 text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200 transition-all hover:border-cyan-300/60 hover:bg-cyan-900/40"
          >
            Find New Match
          </button>
          <button
            onClick={onRematch}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-950/25 text-[11px] font-black uppercase tracking-[0.28em] text-emerald-200 transition-all hover:border-emerald-400/60 hover:bg-emerald-900/40"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Rematch &amp; Chat
          </button>
          <Link
            href="/arena"
            className="flex h-12 w-full items-center justify-center rounded-md border border-violet-500/30 bg-violet-950/30 text-[11px] font-black uppercase tracking-[0.28em] text-violet-200 transition-all hover:border-violet-400/60 hover:bg-violet-900/40"
          >
            Return to Menu
          </Link>
          <button className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-red-500/25 bg-red-950/25 text-[10px] font-black uppercase tracking-[0.28em] text-red-300/80 transition-all hover:border-red-400/55 hover:bg-red-900/40">
            <Flag className="h-3.5 w-3.5" /> Report Opponent
          </button>
        </div>

        {/* Rate opponent */}
        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.22em] text-white/55">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" /> Rate Opponent <span className="text-white/30">(Public Appeal)</span>
            </span>
            <span className="text-white/35">1 – 10</span>
          </div>
          <div className="flex flex-wrap justify-between gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setRated(n)}
                className={`h-9 flex-1 min-w-[28px] rounded-md border text-[12px] font-black transition-all ${
                  rated === n
                    ? "border-violet-300 bg-violet-500/40 text-white"
                    : "border-white/10 bg-violet-950/30 text-violet-200 hover:border-violet-400/40 hover:bg-violet-900/40"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <button className="rounded-md border border-amber-500/35 bg-amber-950/35 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.24em] text-amber-200 hover:border-amber-400/60 hover:bg-amber-900/40">
            ◆ View Match Analysis
          </button>
        </div>
        <p className="mt-3 text-center text-[9px] font-bold uppercase tracking-[0.22em] text-white/30">
          Turn on clip mode in account settings to enable replays.
        </p>
      </div>
    </div>
  );
}

function ScoreCard({
  label, value, elo, loser, winner,
}: { label: string; value: number; elo: number; loser?: boolean; winner?: boolean }) {
  const ring = loser ? "border-red-500/70 bg-red-950/45 shadow-[0_0_60px_rgba(239,68,68,0.45)]"
    : winner ? "border-emerald-500/55 bg-emerald-950/30 shadow-[0_0_50px_rgba(52,211,153,0.32)]"
    : "border-white/15 bg-white/[0.04]";
  return (
    <div className={`rounded-2xl border px-4 py-5 text-center backdrop-blur-md ${ring}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">{label}</div>
      <div className="mt-1 text-5xl font-black tracking-[-0.04em] text-white tabular-nums">{value.toFixed(1)}</div>
      <div className={`mt-2 text-[10px] font-black uppercase tracking-[0.24em] ${
        elo > 0 ? "text-emerald-300" : elo < 0 ? "text-red-300" : "text-white/40"
      }`}>
        {elo > 0 ? "+" : ""}{elo} ELO
      </div>
    </div>
  );
}

/* -------- subcomponents -------- */

function SearchingScreen({
  status, cameraReady, cameraError, errorMsg,
}: { status: string; cameraReady: boolean; cameraError: string; errorMsg: string }) {
  const label =
    cameraError ? "Camera blocked" :
    status === "auth" ? "Signing in…" :
    status === "queueing" ? "Searching…" :
    status === "waiting" ? "Waiting for opponent…" :
    status === "connecting" ? "Connecting…" :
    status === "error" ? "Error" :
    "Preparing…";
  const tagline = cameraError || errorMsg || "Good lighting beats a good camera.";

  const handleFindNew = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black font-mono text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(120,40,90,0.25),transparent_55%)]" />
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10">
        {/* Hex spinner */}
        <div className="relative mb-10 h-[100px] w-[100px]">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_70%)] blur-xl" />
          <div className="absolute inset-0 animate-spin [animation-duration:6s]">
            <Hexagon className="h-full w-full text-white/15" strokeWidth={1.2} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Hexagon className="h-9 w-9 fill-white/85 text-white/85" strokeWidth={1.2} />
          </div>
        </div>

        <h1 className="mb-3 text-2xl font-black uppercase tracking-[0.34em] text-white sm:text-[28px]">
          {label.toUpperCase()}
        </h1>
        <p className="mb-10 max-w-md text-center text-[12px] uppercase tracking-[0.18em] text-white/40">
          {tagline}
        </p>

        <div className="flex w-full max-w-[280px] flex-col gap-3">
          <button
            onClick={handleFindNew}
            className="h-12 w-full rounded-md border border-cyan-400/30 bg-cyan-950/30 text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200 transition-all hover:border-cyan-300/60 hover:bg-cyan-900/40 hover:text-cyan-100"
          >
            Find New Match
          </button>
          <Link
            href="/arena"
            className="flex h-12 w-full items-center justify-center rounded-md border border-white/15 bg-white/[0.03] text-[11px] font-black uppercase tracking-[0.28em] text-white/70 transition-all hover:border-white/30 hover:bg-white/[0.06] hover:text-white"
          >
            Return to Menu
          </Link>
        </div>

        {(cameraError || errorMsg) && (
          <div className="mt-8 max-w-md text-center text-[10px] uppercase tracking-[0.22em] text-red-300/70">
            {cameraError || errorMsg}
          </div>
        )}
      </main>
    </div>
  );
}

function VideoTile({
  videoRef, label, score, color, mirror, badges, empty, noFace, traits,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  label: string;
  score: number;
  color: "emerald" | "violet";
  mirror?: boolean;
  badges: InstantEvent[];
  empty?: boolean;
  noFace?: boolean;
  traits?: { good: Array<{ label: string; v: number }>; bad: Array<{ label: string; v: number }> };
}) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  const grad = color === "emerald" ? "from-emerald-400 to-cyan-300" : "from-violet-400 to-fuchsia-400";
  return (
    <div className="relative aspect-[3/4] min-h-[200px] overflow-hidden rounded-[20px] border border-white/14 bg-[#070914] sm:aspect-auto sm:min-h-[420px]">
      <video
        ref={videoRef}
        autoPlay
        muted={mirror}
        playsInline
        className={`absolute inset-0 h-full w-full object-cover ${mirror ? "-scale-x-100" : ""}`}
      />
      {empty && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-center">
            <ScanFace className="mx-auto mb-4 h-12 w-12 animate-pulse text-cyan-200/70" />
            <div className="text-xs font-black uppercase tracking-[0.24em] text-white/55">Connecting opponent</div>
          </div>
        </div>
      )}
      {noFace && !empty && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-center">
            <AlertOctagon className="mx-auto mb-3 h-10 w-10 text-red-300" />
            <div className="text-xs font-black uppercase tracking-[0.24em] text-red-200">No face detected</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Center yourself in frame</div>
          </div>
        </div>
      )}
      <div className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white sm:left-4 sm:top-4 sm:px-3">{label}</div>
      <div className="absolute right-2 top-2 rounded-[12px] border border-white/15 bg-black/55 px-2.5 py-1.5 text-right backdrop-blur-md sm:right-4 sm:top-4 sm:rounded-[14px] sm:px-3 sm:py-2">
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">UNMOG</div>
        <div className="text-2xl font-black tracking-[-0.05em] text-white sm:text-3xl">{score.toFixed(1)}</div>
      </div>
      {traits && (traits.good.length > 0 || traits.bad.length > 0) && !noFace && (
        <div className="absolute right-2 top-[64px] hidden max-w-[160px] rounded-[12px] border border-white/15 bg-black/60 p-2 backdrop-blur-md sm:right-3 sm:top-20 sm:block sm:max-w-[200px]">
          {traits.bad.length > 0 && (
            <div className="mb-1.5">
              <div className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-rose-300">Boosting</div>
              {traits.bad.map((t) => (
                <div key={t.label} className="flex items-center gap-1.5 text-[10px] text-white/85">
                  <X className="h-3 w-3 shrink-0 text-rose-400" />
                  <span className="truncate">{t.label}</span>
                </div>
              ))}
            </div>
          )}
          {traits.good.length > 0 && (
            <div>
              <div className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-emerald-300">Lowering</div>
              {traits.good.map((t) => (
                <div key={t.label} className="flex items-center gap-1.5 text-[10px] text-white/85">
                  <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                  <span className="truncate">{t.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="absolute inset-x-4 bottom-4">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-150`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-1/3 flex flex-col items-center gap-2">
        {badges.map((e, i) => <EventBadge key={`${e.type}-${i}`} ev={e} />)}
      </div>
    </div>
  );
}

function EventBadge({ ev }: { ev: InstantEvent }) {
  const map = {
    opponent_laugh:   { Icon: Smile,        text: "OPPONENT LAUGHED — INSTANT WIN", color: "from-emerald-400 to-lime-300" },
    double_chin_lock: { Icon: Skull,        text: "DOUBLE CHIN LOCK +200",          color: "from-amber-400 to-orange-400" },
    mega_unmog:       { Icon: Zap,          text: "MEGA UNMOG x2",                  color: "from-fuchsia-400 to-violet-400" },
    no_face:          { Icon: AlertOctagon, text: "OPPONENT FORFEIT",               color: "from-red-400 to-rose-400" },
  } as const;
  const cfg = map[ev.type];
  const Icon = cfg.Icon;
  return (
    <div className={`flex items-center gap-2 rounded-full bg-gradient-to-r ${cfg.color} px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-[0_8px_30px_rgba(0,0,0,0.45)]`}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.text}
    </div>
  );
}