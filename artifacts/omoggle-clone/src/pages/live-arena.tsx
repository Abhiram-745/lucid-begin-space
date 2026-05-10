import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ChevronLeft,
  OctagonX,
  Radar,
  ScanFace,
  Wifi,
  Check,
  X,
} from "lucide-react";
import { useChaosPipeline } from "@/lib/use-chaos-pipeline";
import { useMultiplayer } from "@/lib/use-multiplayer";
import { getSupabaseProjectDashboardAuthUrl } from "@/lib/supabase";

const ROUND_SECONDS = 60;

export default function LiveArena() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peakLocalRef = useRef(0);
  const oppPeakRef = useRef(0);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [roundLeft, setRoundLeft] = useState(ROUND_SECONDS);
  const [peakLocal, setPeakLocal] = useState(0);
  const [winner, setWinner] = useState<"you" | "opp" | "draw" | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [matchStarted, setMatchStarted] = useState(false);

  const mp = useMultiplayer();
  const pipeline = useChaosPipeline({ videoRef: localVideoRef, audioStream });
  const localScore = pipeline.hasFace ? pipeline.breakdown?.score ?? 0 : 0;
  const traits = pipeline.breakdown?.traits ?? { good: [], bad: [] };

  useEffect(() => {
    peakLocalRef.current = peakLocal;
  }, [peakLocal]);
  useEffect(() => {
    oppPeakRef.current = mp.opponentPeak;
  }, [mp.opponentPeak]);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "This browser needs HTTPS for camera access. Use Chrome, Edge, Firefox, or Safari.",
      );
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
        audio: true,
      })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream(stream.getVideoTracks());
        }
        setAudioStream(new MediaStream(stream.getAudioTracks()));
        setCameraReady(true);
        await mp.start(stream);
      })
      .catch((err: unknown) => {
        const e = err as { name?: string; message?: string };
        const name = e?.name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setCameraError("Allow camera + microphone in the browser address bar, then reload.");
        } else if (name === "NotFoundError") {
          setCameraError("No camera found.");
        } else {
          setCameraError(e?.message || "Could not open camera.");
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

  useEffect(() => {
    if (mp.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = mp.remoteStream;
    }
  }, [mp.remoteStream]);

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

  useEffect(() => {
    if (!matchStarted || winner) return;
    const tick = window.setInterval(() => {
      setRoundLeft((s) => {
        if (s <= 1) {
          window.clearInterval(tick);
          const pl = peakLocalRef.current;
          const op = oppPeakRef.current;
          setWinner((w) =>
            w ?? (pl >= op ? "you" : pl === op ? "draw" : "opp"),
          );
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [matchStarted, winner]);

  useEffect(() => {
    if (mp.opponentLeft && !winner && mp.status === "live") {
      setWinner("you");
    }
  }, [mp.opponentLeft, winner, mp.status]);

  useEffect(() => {
    if (!pipeline.breakdown) return;
    const sc = pipeline.hasFace ? pipeline.breakdown.score : 0;
    if (matchStarted) setPeakLocal((p) => Math.max(p, sc));
    if (mp.status === "live") mp.broadcastScore(sc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.breakdown]);

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
    setWinner(null);
    setPeakLocal(0);
    setRoundLeft(ROUND_SECONDS);
    setMatchStarted(false);
    setCountdown(null);
    mp.leave();
    if (streamRef.current) mp.start(streamRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searching =
    mp.status === "queueing" ||
    mp.status === "waiting" ||
    mp.status === "auth" ||
    mp.status === "idle" ||
    mp.status === "connecting";

  if (searching || mp.status === "error") {
    return (
      <SearchingScreen
        status={mp.status === "error" ? "error" : mp.status}
        cameraReady={cameraReady}
        cameraError={cameraError}
        setupError={mp.errorMsg}
      />
    );
  }

  const diff = localScore - mp.opponentScore;
  const tugPct = Math.max(0, Math.min(100, 50 + (diff / 10) * 50));
  const battlePct = matchStarted ? ((ROUND_SECONDS - roundLeft) / ROUND_SECONDS) * 100 : 0;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-black font-mono text-white">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,20,27,0.82),rgba(7,7,10,1)_42%,rgba(19,9,22,0.95))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_80%_72%,rgba(168,85,247,0.14),transparent_30%)]" />

      <header className="relative z-20 flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-black/45 px-3 backdrop-blur-md sm:h-14 sm:px-6">
        <Link
          href="/arena"
          className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/55 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Leave</span>
        </Link>
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          1v1 · {matchStarted ? `${roundLeft}s` : "READY"}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
          <Wifi className="h-4 w-4" />
          {mp.isPlayerA ? "Host" : "Peer"}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[1400px] flex-col gap-3 px-2 py-2 sm:gap-4 sm:px-4 sm:py-3">
        {/* Battle momentum + round progress */}
        <div className="rounded-[14px] border border-white/10 bg-black/40 px-3 py-2 backdrop-blur">
          <div className="mb-1 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em]">
            <span className="text-emerald-300">You {localScore.toFixed(1)}</span>
            <span className="text-white/40">
              {matchStarted ? "LIVE BATTLE" : countdown !== null ? `START ${countdown}` : "SYNC"}
            </span>
            <span className="text-violet-300">Opp {mp.opponentScore.toFixed(1)}</span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="absolute left-1/2 top-0 z-10 h-full w-px -translate-x-1/2 bg-white/40" />
            {tugPct >= 50 ? (
              <div
                className="absolute left-1/2 top-0 h-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all duration-150"
                style={{ width: `${tugPct - 50}%` }}
              />
            ) : (
              <div
                className="absolute right-1/2 top-0 h-full bg-gradient-to-l from-violet-400 to-fuchsia-400 transition-all duration-150"
                style={{ width: `${50 - tugPct}%` }}
              />
            )}
          </div>
          <div className="mt-2">
            <div className="mb-1 flex justify-between text-[8px] font-black uppercase tracking-[0.2em] text-white/35">
              <span>Round progress</span>
              <span>
                {matchStarted ? `${ROUND_SECONDS - roundLeft}s / ${ROUND_SECONDS}s` : "—"}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-300"
                style={{ width: `${battlePct}%` }}
              />
            </div>
          </div>
          <div className="mt-1 text-center text-[9px] font-black uppercase tracking-[0.2em] text-white/35">
            Peak you {peakLocal.toFixed(1)} · Peak opp {mp.opponentPeak.toFixed(1)}
          </div>
        </div>

        <section className="grid flex-1 gap-3 sm:gap-4 lg:grid-cols-2">
          <VideoTile
            videoRef={localVideoRef}
            label="You"
            score={localScore}
            color="emerald"
            mirror
            noFace={!pipeline.hasFace}
            traits={traits}
          />
          <VideoTile
            videoRef={remoteVideoRef}
            label="Opponent"
            score={mp.opponentScore}
            color="violet"
            empty={!mp.remoteStream}
          />
        </section>
      </main>

      {countdown !== null && !winner && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.4em] text-cyan-200">Get ready</div>
            <div className="mt-2 text-[120px] font-black leading-none tracking-[-0.08em] text-white drop-shadow-[0_0_40px_rgba(34,211,238,0.5)] sm:text-[140px]">
              {countdown}
            </div>
          </div>
        </div>
      )}

      {winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="text-center px-4">
            <div className="text-xs font-black uppercase tracking-[0.32em] text-cyan-200">Round over</div>
            <div className="mt-3 text-5xl font-black uppercase tracking-[0.08em] text-white sm:text-7xl">
              {winner === "you" ? "You win" : winner === "opp" ? "Opponent wins" : "Draw"}
            </div>
            <div className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-white/60">
              Peak {peakLocal.toFixed(1)} · Opp {mp.opponentPeak.toFixed(1)}
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={restart}
                className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-7 py-3 text-xs font-black uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-500/20"
              >
                Find new match
              </button>
              <Link
                href="/arena"
                className="rounded-full border border-white/15 bg-white/5 px-7 py-3 text-xs font-black uppercase tracking-[0.2em] text-white/70 hover:bg-white/10"
              >
                Exit
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchingScreen({
  status,
  cameraReady,
  cameraError,
  setupError,
}: {
  status: string;
  cameraError: string;
  setupError: string;
  cameraReady: boolean;
}) {
  const hasCamErr = Boolean(cameraError);
  const hasSetupErr = Boolean(setupError);
  const dashUrl = getSupabaseProjectDashboardAuthUrl();

  const label =
    hasCamErr ? "Camera blocked" :
    hasSetupErr ? "Sign-in blocked" :
    status === "auth" ? "Signing in" :
    status === "queueing" ? "Joining queue" :
    status === "waiting" ? "Waiting for opponent" :
    status === "connecting" ? "Connecting peer" :
    status === "error" ? "Setup error" :
    "Preparing";

  const subtitle =
    cameraError ||
    setupError ||
    (status === "waiting"
      ? "Another player will join from the matchmaking queue. Open a second browser (or incognito) here to test 1v1."
      : status === "queueing"
        ? "Talking to matchmaker…"
        : "");

  return (
    <div className="relative min-h-screen overflow-hidden bg-black font-mono text-white">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,22,28,0.88),rgba(8,8,12,1)_45%,rgba(21,10,25,0.96))]" />
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10">
        <Link
          href="/arena"
          className="absolute left-6 top-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/50 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <div className="w-full max-w-[560px] rounded-[36px] border border-cyan-100/20 bg-white/[0.045] p-8 text-center backdrop-blur-md">
          <div className="mx-auto mb-9 flex h-28 w-28 items-center justify-center rounded-full border border-cyan-100/20 bg-black shadow-[0_0_80px_rgba(34,211,238,0.14)]">
            {hasCamErr ? (
              <ScanFace className="h-12 w-12 text-red-300" />
            ) : hasSetupErr ? (
              <AlertTriangle className="h-12 w-12 text-amber-300" />
            ) : (
              <Radar className="h-12 w-12 animate-pulse text-cyan-200" />
            )}
          </div>
          <div className="text-xs font-black uppercase tracking-[0.34em] text-cyan-200">Matchmaking</div>
          <h1 className="mt-5 text-3xl font-black uppercase tracking-[0.16em] text-white sm:text-4xl">{label}</h1>
          <div className="mt-6 min-h-[48px] text-xs font-bold uppercase leading-relaxed tracking-[0.14em] text-white/50">
            {subtitle}
          </div>
          {hasSetupErr && dashUrl && (
            <a
              href={dashUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-400 underline decoration-cyan-400/40 underline-offset-4 hover:text-cyan-300"
            >
              Open Supabase → Authentication → Providers
            </a>
          )}
          <div className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
            Camera: {cameraReady ? "Live" : "Pending"}
          </div>
          <Link
            href="/arena"
            className="mt-10 inline-flex h-14 min-w-[190px] items-center justify-center gap-3 rounded-full border border-white/12 bg-white/5 px-8 text-sm font-black uppercase tracking-[0.2em] text-white/62 hover:bg-red-500/10 hover:text-red-200"
          >
            <OctagonX className="h-5 w-5" /> Abort
          </Link>
        </div>
      </main>
    </div>
  );
}

function VideoTile({
  videoRef,
  label,
  score,
  color,
  mirror,
  empty,
  noFace,
  traits,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  label: string;
  score: number;
  color: "emerald" | "violet";
  mirror?: boolean;
  empty?: boolean;
  noFace?: boolean;
  traits?: { good: Array<{ label: string; v: number }>; bad: Array<{ label: string; v: number }> };
}) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  const grad =
    color === "emerald" ? "from-emerald-400 to-cyan-300" : "from-violet-400 to-fuchsia-400";

  return (
    <div className="relative min-h-[280px] overflow-hidden rounded-[20px] border border-white/14 bg-[#070914] sm:min-h-[380px]">
      <video
        ref={videoRef}
        autoPlay
        muted={mirror}
        playsInline
        className={`absolute inset-0 h-full w-full object-cover ${mirror ? "-scale-x-100" : ""}`}
      />
      {empty && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-center px-4">
            <ScanFace className="mx-auto mb-4 h-12 w-12 animate-pulse text-cyan-200/70" />
            <div className="text-xs font-black uppercase tracking-[0.24em] text-white/55">
              Waiting for opponent stream…
            </div>
          </div>
        </div>
      )}
      {noFace && !empty && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center text-xs font-black uppercase tracking-[0.2em] text-white/70">
            No face in frame
          </div>
        </div>
      )}
      <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white sm:left-4 sm:top-4">
        {label}
      </div>
      <div className="absolute right-3 top-3 rounded-[14px] border border-white/15 bg-black/65 px-3 py-2 text-right backdrop-blur-md sm:right-4 sm:top-4">
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">Live score</div>
        <div className="text-2xl font-black tabular-nums text-white sm:text-3xl">{score.toFixed(1)}</div>
      </div>
      {traits && (traits.good.length > 0 || traits.bad.length > 0) && !noFace && (
        <div className="absolute right-3 top-24 max-w-[180px] rounded-[12px] border border-white/15 bg-black/60 p-2 backdrop-blur-md sm:top-28">
          {traits.bad.length > 0 && (
            <div className="mb-1.5">
              <div className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-rose-300">Chaos</div>
              {traits.bad.slice(0, 3).map((t) => (
                <div key={t.label} className="flex items-center gap-1.5 text-[10px] text-white/85">
                  <X className="h-3 w-3 shrink-0 text-rose-400" />
                  <span className="truncate">{t.label}</span>
                </div>
              ))}
            </div>
          )}
          {traits.good.length > 0 && (
            <div>
              <div className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-emerald-300">Calm</div>
              {traits.good.slice(0, 2).map((t) => (
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
          <div
            className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-150`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
