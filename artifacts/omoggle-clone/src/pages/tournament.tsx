import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, Crown, Users, Trophy, Hash, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useTournament, type TournamentMode } from "@/lib/use-tournament";

export default function TournamentEntry() {
  const [, navigate] = useLocation();
  const t = useTournament();

  const [mode, setMode] = useState<TournamentMode>("group");
  const [roundSeconds, setRoundSeconds] = useState(60);
  const [totalRounds, setTotalRounds] = useState(5);
  const [elimination, setElimination] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    const code = await t.createRoom({ mode, roundSeconds, totalRounds, elimination });
    setBusy(false);
    if (code) navigate(`/tournament/lobby/${code}`);
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);
    const ok = await t.joinRoom(joinCode);
    setBusy(false);
    if (ok) navigate(`/tournament/lobby/${joinCode.trim().toUpperCase()}`);
  };

  return (
    <PageShell grid="hero" landing>
      <header className="relative z-20 flex h-12 items-center justify-between border-b border-white/10 bg-black/45 px-3 backdrop-blur-md sm:h-14 sm:px-6">
        <Link href="/arena" className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/55 hover:text-white">
          <ChevronLeft className="h-4 w-4" /><span>Back</span>
        </Link>
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-white">
          <Trophy className="h-4 w-4 text-amber-300" />
          Tournament Mode
        </div>
        <div className="w-12" />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 sm:px-8 sm:py-12">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-[-0.02em] text-white sm:text-4xl">
            Choose Your Format
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Compete with friends in private rooms — up to 10 players per session.
          </p>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModeCard
            active={mode === "koth"}
            onClick={() => setMode("koth")}
            icon={<Crown className="h-6 w-6" />}
            title="King of the Hill"
            subtitle="1v1 rotating queue. Winner stays, loser rotates out."
            accent="amber"
          />
          <ModeCard
            active={mode === "group"}
            onClick={() => setMode("group")}
            icon={<Users className="h-6 w-6" />}
            title="Group Tournament"
            subtitle="All players compete in parallel. Ranked each round."
            accent="violet"
          />
        </div>

        {/* Settings */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-white/50">
            Configure
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField label="Round seconds" value={roundSeconds} onChange={setRoundSeconds} min={15} max={180} />
            <NumberField label="Total rounds" value={totalRounds} onChange={setTotalRounds} min={1} max={20} />
            <label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/55">
              Elimination
              <button
                onClick={() => setElimination((v) => !v)}
                className={`h-10 rounded-md border px-3 text-[11px] font-black uppercase tracking-[0.2em] transition ${
                  elimination
                    ? "border-rose-400/60 bg-rose-950/40 text-rose-200"
                    : "border-white/15 bg-white/[0.03] text-white/55 hover:border-white/30"
                }`}
              >
                {elimination ? "On — lowest out" : "Off"}
              </button>
            </label>
          </div>
        </div>

        {/* Create */}
        <button
          onClick={handleCreate}
          disabled={busy}
          className="group flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-950/30 text-[13px] font-black uppercase tracking-[0.28em] text-emerald-200 transition hover:border-emerald-300/70 hover:bg-emerald-900/40 disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create Room"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.24em] text-white/30">
          <div className="h-px flex-1 bg-white/10" />
          Or join
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Join */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
          <label className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
            <Hash className="h-3 w-3" /> Room code
          </label>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABCD23"
              maxLength={6}
              className="flex-1 rounded-md border border-white/15 bg-black/60 px-4 py-3 text-center font-mono text-xl font-black tracking-[0.4em] text-white placeholder:text-white/20 focus:border-cyan-400/60 focus:outline-none"
            />
            <button
              onClick={handleJoin}
              disabled={busy || joinCode.length < 4}
              className="rounded-md border border-cyan-400/40 bg-cyan-950/30 px-5 text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200 transition hover:border-cyan-300/70 hover:bg-cyan-900/40 disabled:opacity-40"
            >
              Join
            </button>
          </div>
        </div>

        {t.errorMsg && (
          <div className="rounded-md border border-red-500/30 bg-red-950/40 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-red-300">
            {t.errorMsg}
          </div>
        )}
      </main>
    </PageShell>
  );
}

function ModeCard({
  active, onClick, icon, title, subtitle, accent,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: "amber" | "violet";
}) {
  const tone = accent === "amber"
    ? "from-amber-950/40 border-amber-400/60 shadow-[0_18px_50px_-12px_rgba(245,158,11,0.45)]"
    : "from-violet-950/40 border-violet-400/60 shadow-[0_18px_50px_-12px_rgba(168,85,247,0.45)]";
  const inactive = "border-white/10 bg-black/40 hover:border-white/25";
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-start gap-3 rounded-2xl border bg-gradient-to-br to-black/40 p-5 text-left transition ${
        active ? tone : inactive
      }`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
        active ? (accent === "amber" ? "border-amber-300/60 bg-amber-900/40 text-amber-200" : "border-violet-300/60 bg-violet-900/40 text-violet-200")
              : "border-white/10 bg-black/60 text-white/60"
      }`}>{icon}</div>
      <div className="text-[14px] font-black uppercase tracking-[0.14em] text-white">{title}</div>
      <div className="text-[12px] text-white/55">{subtitle}</div>
    </button>
  );
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/55">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="h-10 rounded-md border border-white/15 bg-black/60 px-3 text-[13px] font-black text-white focus:border-cyan-400/60 focus:outline-none"
      />
    </label>
  );
}
