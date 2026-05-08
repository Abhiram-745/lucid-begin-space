import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, OctagonX, Radar, ScanFace, ShieldCheck, Zap, Skull, Smile, AlertOctagon } from "lucide-react";
import { useChaosPipeline } from "@/lib/use-chaos-pipeline";
import { EventDetector, type InstantEvent } from "@/lib/instant-win";

type Phase = "searching" | "live";

const MATCHMAKING_SECONDS = 10;
const ROUND_SECONDS = 60;

function formatStopwatch(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function LiveArena() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("searching");
  const [elapsed, setElapsed] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [roundLeft, setRoundLeft] = useState(ROUND_SECONDS);
  const [oppScore, setOppScore] = useState(0);
  const [peakLocal, setPeakLocal] = useState(0);
  const [peakOpp, setPeakOpp] = useState(0);
  const [events, setEvents] = useState<InstantEvent[]>([]);
  const [winner, setWinner] = useState<"you" | "opp" | "draw" | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detector = useRef(new EventDetector());
  const oppRef = useRef(0); // simulated opponent score

  const pipeline = useChaosPipeline({ videoRef, audioStream });
  const localScore = pipeline.breakdown?.score ?? 0;
  const modelReady = pipeline.ready;

  useEffect(() => {
    if (phase !== "searching") return;

    const timer = window.setInterval(() => {
      setElapsed((value) => {
        const next = value + 1;
        if (next >= MATCHMAKING_SECONDS) {
          setPhase("live");
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "live") return;

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
        audio: true,
      })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          // Mute the local video element to avoid feedback; audio is analysed separately.
          const videoOnly = new MediaStream(stream.getVideoTracks());
          videoRef.current.srcObject = videoOnly;
        }
        setAudioStream(new MediaStream(stream.getAudioTracks()));
        setCameraReady(true);
      })
      .catch(() => {
        setCameraError("Camera access is blocked or unavailable.");
      });

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setAudioStream(null);
      setCameraReady(false);
    };
  }, [phase]);

  // Round timer + simulated opponent + event detection
  useEffect(() => {
    if (phase !== "live" || winner) return;
    const tick = window.setInterval(() => {
      setRoundLeft((s) => {
        if (s <= 1) {
          window.clearInterval(tick);
          // decide winner on time-out
          setWinner((w) => w ?? (localScore >= oppRef.current ? "you" : "opp"));
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [phase, winner, localScore]);

  // Drift the simulated opponent score toward a wandering target so the bar feels alive.
  useEffect(() => {
    if (phase !== "live" || winner) return;
    let target = 4 + Math.random() * 3;
    const id = window.setInterval(() => {
      target = Math.max(1, Math.min(9, target + (Math.random() - 0.5) * 2.5));
      oppRef.current = oppRef.current + (target - oppRef.current) * 0.18;
      setOppScore(oppRef.current);
      setPeakOpp((p) => Math.max(p, oppRef.current));
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, winner]);

  // Track local peak + run instant-win detector
  useEffect(() => {
    if (!pipeline.breakdown) return;
    setPeakLocal((p) => Math.max(p, pipeline.breakdown!.score));
    const audioSpike = pipeline.breakdown.audio.spike;
    // Use simulated opponent mouth proxy from oppScore
    const oppMouthProxy = Math.min(1, oppRef.current / 10 + Math.random() * 0.05);
    const fired = detector.current.step(pipeline.breakdown, oppMouthProxy, true, audioSpike);
    if (fired.length) {
      setEvents((prev) => [...prev, ...fired].slice(-5));
      for (const ev of fired) {
        if (ev.type === "opponent_laugh") setWinner("you");
        if (ev.type === "no_face") setWinner("you");
      }
    }
  }, [pipeline.breakdown]);

  const restart = useCallback(() => {
    detector.current.reset();
    setEvents([]);
    setWinner(null);
    setPeakLocal(0);
    setPeakOpp(0);
    setRoundLeft(ROUND_SECONDS);
    oppRef.current = 0;
    setOppScore(0);
  }, []);

  if (phase === "searching") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-black font-mono text-white">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,22,28,0.88),rgba(8,8,12,1)_45%,rgba(21,10,25,0.96))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_72%_66%,rgba(168,85,247,0.12),transparent_34%)]" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.65)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.65)_1px,transparent_1px)] [background-size:42px_42px]" />

        <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10">
          <Link
            href="/arena"
            className="absolute left-6 top-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/50 transition hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="w-full max-w-[560px] rounded-[36px] border border-cyan-100/20 bg-white/[0.045] p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_100px_rgba(0,0,0,0.44)] backdrop-blur-md">
            <div className="mx-auto mb-9 flex h-28 w-28 items-center justify-center rounded-full border border-cyan-100/20 bg-black shadow-[0_0_80px_rgba(34,211,238,0.14)]">
              <Radar className="h-12 w-12 animate-pulse text-cyan-200" />
            </div>

            <div className="text-xs font-black uppercase tracking-[0.34em] text-cyan-200">
              Matchmaking
            </div>
            <h1 className="mt-5 text-4xl font-black uppercase tracking-[0.16em] text-white">
              Searching for Match
            </h1>

            <div className="mt-8 text-7xl font-black tracking-[-0.08em] text-white">
              {formatStopwatch(elapsed)}
            </div>

            <div className="mt-8 h-2 overflow-hidden rounded-full border border-white/10 bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#22e96b)] shadow-[0_0_24px_rgba(34,211,238,0.45)] transition-all duration-500"
                style={{ width: `${Math.min(100, (elapsed / MATCHMAKING_SECONDS) * 100)}%` }}
              />
            </div>

            <div className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-white/38">
              Test match starts after {MATCHMAKING_SECONDS} seconds
            </div>

            <button
              onClick={() => setLocation("/arena")}
              className="mt-10 inline-flex h-14 min-w-[190px] items-center justify-center gap-3 rounded-full border border-white/12 bg-white/5 px-8 text-sm font-black uppercase tracking-[0.2em] text-white/62 transition hover:border-red-300/45 hover:bg-red-500/10 hover:text-red-200"
            >
              <OctagonX className="h-5 w-5" />
              Abort
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black font-mono text-white">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,20,27,0.82),rgba(7,7,10,1)_42%,rgba(19,9,22,0.95))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_80%_72%,rgba(168,85,247,0.14),transparent_30%)]" />
      <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:42px_42px]" />

      <header className="relative z-20 flex h-16 items-center justify-between border-b border-white/10 bg-black/45 px-4 backdrop-blur-md sm:px-8">
        <Link href="/arena" className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/55 transition hover:text-white">
          <ChevronLeft className="h-4 w-4" />
          Leave Match
        </Link>

        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.24em] text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          Live Face Tracking
        </div>

        <div className="hidden items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 sm:flex">
          <ShieldCheck className="h-4 w-4" />
          {modelReady ? "Model Ready" : "Loading Model"}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[1320px] flex-col px-4 py-5 sm:px-6">
        <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_360px]">
          <div className="relative min-h-[560px] overflow-hidden rounded-[34px] border border-white/14 bg-[#070914] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_80px_rgba(0,0,0,0.46)]">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`absolute inset-0 h-full w-full object-cover -scale-x-100 transition-opacity duration-500 ${
                cameraReady ? "opacity-100" : "opacity-0"
              }`}
            />
            <div className="pointer-events-none absolute inset-5 rounded-[24px] border border-white/35" />
            {/* score HUD bottom */}
            <div className="absolute inset-x-6 bottom-6 grid grid-cols-2 gap-4">
              <ScoreBar label="You" score={localScore} color="emerald" />
              <ScoreBar label="Opponent" score={oppScore} color="violet" />
            </div>

            {/* round timer */}
            <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full border border-white/15 bg-black/60 px-5 py-2 text-xs font-black uppercase tracking-[0.24em] text-white backdrop-blur-md">
              {roundLeft}s
            </div>

            {/* event banners */}
            <div className="pointer-events-none absolute left-1/2 top-20 flex -translate-x-1/2 flex-col items-center gap-2">
              {events.slice(-3).map((e, i) => (
                <EventBadge key={`${e.type}-${e.t}-${i}`} ev={e} />
              ))}
            </div>

            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-center">
                  <ScanFace className="mx-auto mb-5 h-14 w-14 animate-pulse text-cyan-200/70" />
                  <div className="text-sm font-black uppercase tracking-[0.24em] text-white/60">
                    Opening camera
                  </div>
                </div>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center">
                <div>
                  <div className="text-2xl font-black uppercase tracking-[0.16em] text-white">
                    Camera unavailable
                  </div>
                  <div className="mt-3 text-sm font-bold uppercase tracking-[0.12em] text-white/45">
                    {cameraError}
                  </div>
                </div>
              </div>
            )}

            {winner && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md">
                <div className="text-center">
                  <div className="text-xs font-black uppercase tracking-[0.32em] text-cyan-200">Round Over</div>
                  <div className="mt-3 text-6xl font-black uppercase tracking-[0.1em] text-white">
                    {winner === "you" ? "You UNMOG'd" : winner === "opp" ? "You Got UNMOG'd" : "Draw"}
                  </div>
                  <div className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-white/60">
                    Peak {peakLocal.toFixed(1)} vs {peakOpp.toFixed(1)}
                  </div>
                  <div className="mt-8 flex justify-center gap-3">
                    <button onClick={restart} className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-7 py-3 text-xs font-black uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-500/20">
                      Rematch
                    </button>
                    <Link href="/arena" className="rounded-full border border-white/15 bg-white/5 px-7 py-3 text-xs font-black uppercase tracking-[0.2em] text-white/70 hover:bg-white/10">
                      Exit
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-[34px] border border-white/12 bg-white/[0.045] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_80px_rgba(0,0,0,0.32)] backdrop-blur-md">
            <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">UNMOG Telemetry</div>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white">{localScore.toFixed(2)}<span className="text-xl text-white/40"> / 10</span></h1>
            <div className="mt-1 text-[11px] font-black uppercase tracking-[0.2em] text-white/45">Peak {peakLocal.toFixed(2)}</div>

            <div className="mt-8 grid gap-2">
              <FeatureRow label="Asymmetry"  v={pipeline.breakdown?.spatial.asymmetry ?? 0} />
              <FeatureRow label="Mouth"      v={pipeline.breakdown?.spatial.mouthDistortion ?? 0} />
              <FeatureRow label="Eye Chaos"  v={pipeline.breakdown?.spatial.eyeChaos ?? 0} />
              <FeatureRow label="Chin"       v={pipeline.breakdown?.spatial.chinCompression ?? 0} />
              <FeatureRow label="Head Angle" v={pipeline.breakdown?.spatial.headAngle ?? 0} />
              <FeatureRow label="Motion"     v={pipeline.breakdown?.temporal.motionInstability ?? 0} />
              <FeatureRow label="Volatility" v={pipeline.breakdown?.temporal.expressionVolatility ?? 0} />
              <FeatureRow label="Commit"     v={pipeline.breakdown?.temporal.commitment ?? 0} />
              <FeatureRow label="Audio"      v={pipeline.breakdown?.audio.energy ?? 0} />
              <FeatureRow label="Pitch Var"  v={pipeline.breakdown?.audio.pitchVariation ?? 0} />
            </div>

            <div className="mt-6 flex items-center justify-between rounded-[18px] border border-white/10 bg-black/35 px-4 py-3">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Face Detected</span>
              <span className={`text-sm font-black uppercase tracking-[0.16em] ${pipeline.hasFace ? "text-emerald-300" : "text-red-300"}`}>{pipeline.hasFace ? "Yes" : "No"}</span>
            </div>

            <Link
              href="/arena"
              className="mt-10 inline-flex h-14 w-full items-center justify-center gap-3 rounded-full border border-white/12 bg-white/5 px-7 text-sm font-black uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <OctagonX className="h-5 w-5" />
              Exit Match
            </Link>
          </aside>
        </section>
      </main>
    </div>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: "emerald" | "violet" }) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  const grad = color === "emerald"
    ? "from-emerald-400 to-cyan-300"
    : "from-violet-400 to-fuchsia-400";
  return (
    <div className="rounded-[18px] border border-white/15 bg-black/55 p-3 backdrop-blur-md">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">{label}</span>
        <span className="text-2xl font-black tracking-[-0.04em] text-white">{score.toFixed(1)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-150`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FeatureRow({ label, v }: { label: string; v: number }) {
  const pct = Math.max(0, Math.min(100, v * 100));
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-300" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-[10px] font-black tabular-nums text-white/55">{v.toFixed(2)}</span>
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
    <div className={`flex items-center gap-2 rounded-full bg-gradient-to-r ${cfg.color} px-5 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-black shadow-[0_8px_30px_rgba(0,0,0,0.45)] animate-in fade-in slide-in-from-top-2 duration-300`}>
      <Icon className="h-4 w-4" />
      {cfg.text}
    </div>
  );
}
