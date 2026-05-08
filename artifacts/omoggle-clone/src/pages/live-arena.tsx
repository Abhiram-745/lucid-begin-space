import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, OctagonX, Radar, ScanFace, Zap, Skull, Smile, AlertOctagon, Wifi } from "lucide-react";
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

  const detector = useRef(new EventDetector());
  const mp = useMultiplayer();

  const pipeline = useChaosPipeline({ videoRef: localVideoRef, audioStream });
  const localScore = pipeline.breakdown?.score ?? 0;

  // 1. Acquire camera + start matchmaking
  useEffect(() => {
    let cancelled = false;
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
      .catch(() => setCameraError("Camera access is blocked or unavailable."));

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

  // 3. Round timer (only when live)
  useEffect(() => {
    if (mp.status !== "live" || winner) return;
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
  }, [mp.status, winner, peakLocal, mp.opponentPeak]);

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
    setPeakLocal((p) => Math.max(p, pipeline.breakdown!.score));
    if (mp.status === "live") mp.broadcastScore(pipeline.breakdown.score);

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
  return (
    <div className="relative min-h-screen overflow-hidden bg-black font-mono text-white">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,20,27,0.82),rgba(7,7,10,1)_42%,rgba(19,9,22,0.95))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_80%_72%,rgba(168,85,247,0.14),transparent_30%)]" />

      <header className="relative z-20 flex h-16 items-center justify-between border-b border-white/10 bg-black/45 px-4 backdrop-blur-md sm:px-8">
        <Link href="/arena" className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/55 hover:text-white">
          <ChevronLeft className="h-4 w-4" /> Leave Match
        </Link>
        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.24em] text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          1v1 Live · {roundLeft}s
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
          <Wifi className="h-4 w-4" /> {mp.isPlayerA ? "Host" : "Peer"}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[1400px] flex-col gap-5 px-4 py-5 sm:px-6">
        <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_1fr_320px]">
          {/* Local video */}
          <VideoTile
            videoRef={localVideoRef}
            label="You"
            score={localScore}
            color="emerald"
            mirror
            badges={events.filter((e) => e.type !== "no_face").slice(-2)}
          />
          {/* Remote video */}
          <VideoTile
            videoRef={remoteVideoRef}
            label="Opponent"
            score={mp.opponentScore}
            color="violet"
            badges={[]}
            empty={!mp.remoteStream}
          />

          {/* Telemetry */}
          <aside className="rounded-[24px] border border-white/12 bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_80px_rgba(0,0,0,0.32)] backdrop-blur-md">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">UNMOG Telemetry</div>
            <div className="mt-3 text-4xl font-black tracking-[-0.04em] text-white">
              {localScore.toFixed(2)}
              <span className="text-base text-white/40"> / 10</span>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Peak {peakLocal.toFixed(2)} · Opp {mp.opponentPeak.toFixed(2)}</div>

            <div className="mt-6 grid gap-2">
              <FeatureRow label="Asymmetry" v={pipeline.breakdown?.spatial.asymmetry ?? 0} />
              <FeatureRow label="Mouth"     v={pipeline.breakdown?.spatial.mouthDistortion ?? 0} />
              <FeatureRow label="Eye Chaos" v={pipeline.breakdown?.spatial.eyeChaos ?? 0} />
              <FeatureRow label="Chin"      v={pipeline.breakdown?.spatial.chinCompression ?? 0} />
              <FeatureRow label="Head"      v={pipeline.breakdown?.spatial.headAngle ?? 0} />
              <FeatureRow label="Motion"    v={pipeline.breakdown?.temporal.motionInstability ?? 0} />
              <FeatureRow label="Volat."    v={pipeline.breakdown?.temporal.expressionVolatility ?? 0} />
              <FeatureRow label="Commit"    v={pipeline.breakdown?.temporal.commitment ?? 0} />
              <FeatureRow label="Audio"     v={pipeline.breakdown?.audio.energy ?? 0} />
              <FeatureRow label="Pitch Δ"   v={pipeline.breakdown?.audio.pitchVariation ?? 0} />
            </div>

            <div className="mt-5 flex items-center justify-between rounded-[14px] border border-white/10 bg-black/35 px-3 py-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Face</span>
              <span className={`text-xs font-black uppercase tracking-[0.16em] ${pipeline.hasFace ? "text-emerald-300" : "text-red-300"}`}>
                {pipeline.hasFace ? "Locked" : "Searching"}
              </span>
            </div>
          </aside>
        </section>

        {/* Event banner row */}
        {events.length > 0 && (
          <div className="pointer-events-none flex justify-center gap-2">
            {events.slice(-3).map((e, i) => <EventBadge key={`${e.type}-${e.t}-${i}`} ev={e} />)}
          </div>
        )}
      </main>

      {/* Win overlay */}
      {winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="text-center">
            <div className="text-xs font-black uppercase tracking-[0.32em] text-cyan-200">Round Over</div>
            <div className="mt-3 text-7xl font-black uppercase tracking-[0.08em] text-white">
              {winner === "you" ? "You UNMOG'd" : winner === "opp" ? "You Got UNMOG'd" : "Draw"}
            </div>
            <div className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-white/60">
              Peak {peakLocal.toFixed(1)} · Opp {mp.opponentPeak.toFixed(1)}
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
  );
}

/* -------- subcomponents -------- */

function SearchingScreen({
  status, cameraReady, cameraError, errorMsg,
}: { status: string; cameraReady: boolean; cameraError: string; errorMsg: string }) {
  const label =
    cameraError ? "Camera blocked" :
    status === "auth" ? "Signing in" :
    status === "queueing" ? "Joining queue" :
    status === "waiting" ? "Waiting for opponent" :
    status === "connecting" ? "Connecting" :
    status === "error" ? "Error" :
    "Preparing";
  const subtitle =
    cameraError || errorMsg ||
    (status === "waiting" ? "Open another browser window to test 1v1." : "");

  return (
    <div className="relative min-h-screen overflow-hidden bg-black font-mono text-white">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,22,28,0.88),rgba(8,8,12,1)_45%,rgba(21,10,25,0.96))]" />
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10">
        <Link href="/arena" className="absolute left-6 top-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/50 hover:text-white">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <div className="w-full max-w-[560px] rounded-[36px] border border-cyan-100/20 bg-white/[0.045] p-8 text-center backdrop-blur-md">
          <div className="mx-auto mb-9 flex h-28 w-28 items-center justify-center rounded-full border border-cyan-100/20 bg-black shadow-[0_0_80px_rgba(34,211,238,0.14)]">
            {cameraError ? <ScanFace className="h-12 w-12 text-red-300" /> : <Radar className="h-12 w-12 animate-pulse text-cyan-200" />}
          </div>
          <div className="text-xs font-black uppercase tracking-[0.34em] text-cyan-200">Matchmaking</div>
          <h1 className="mt-5 text-4xl font-black uppercase tracking-[0.16em] text-white">{label}</h1>
          <div className="mt-6 min-h-[24px] text-xs font-black uppercase tracking-[0.18em] text-white/50">{subtitle}</div>
          <div className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
            Camera: {cameraReady ? "Live" : "Pending"}
          </div>
          <Link href="/arena" className="mt-10 inline-flex h-14 min-w-[190px] items-center justify-center gap-3 rounded-full border border-white/12 bg-white/5 px-8 text-sm font-black uppercase tracking-[0.2em] text-white/62 hover:bg-red-500/10 hover:text-red-200">
            <OctagonX className="h-5 w-5" /> Abort
          </Link>
        </div>
      </main>
    </div>
  );
}

function VideoTile({
  videoRef, label, score, color, mirror, badges, empty,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  label: string;
  score: number;
  color: "emerald" | "violet";
  mirror?: boolean;
  badges: InstantEvent[];
  empty?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  const grad = color === "emerald" ? "from-emerald-400 to-cyan-300" : "from-violet-400 to-fuchsia-400";
  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-[24px] border border-white/14 bg-[#070914]">
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
      <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white">{label}</div>
      <div className="absolute right-4 top-4 rounded-[14px] border border-white/15 bg-black/55 px-3 py-2 text-right backdrop-blur-md">
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">UNMOG</div>
        <div className="text-3xl font-black tracking-[-0.05em] text-white">{score.toFixed(1)}</div>
      </div>
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

function FeatureRow({ label, v }: { label: string; v: number }) {
  const pct = Math.max(0, Math.min(100, v * 100));
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-[9px] font-black uppercase tracking-[0.18em] text-white/45">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-300" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-7 text-right text-[9px] font-black tabular-nums text-white/55">{v.toFixed(2)}</span>
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