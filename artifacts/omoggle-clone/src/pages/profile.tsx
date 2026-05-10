import { useState } from "react";
import { Link } from "wouter";
import {
  X, Trophy, Swords, Calendar, User as UserIcon, Globe, Camera,
  Video, Crown, MessageCircle, LogOut, Trash2, ChevronRight, Check,
} from "lucide-react";

type SectionProps = {
  icon: React.ReactNode;
  title: string;
  tone?: "default" | "amber" | "purple" | "cyan" | "rose" | "indigo" | "red";
  children: React.ReactNode;
};

const toneRing: Record<NonNullable<SectionProps["tone"]>, string> = {
  default: "border-white/10",
  amber: "border-amber-500/40 shadow-[0_0_24px_rgba(251,191,36,0.08)]",
  purple: "border-purple-500/40 shadow-[0_0_24px_rgba(168,85,247,0.08)]",
  cyan: "border-cyan-400/35 shadow-[0_0_24px_rgba(34,211,238,0.07)]",
  rose: "border-rose-500/40 shadow-[0_0_24px_rgba(244,63,94,0.08)]",
  indigo: "border-indigo-500/40 shadow-[0_0_24px_rgba(99,102,241,0.08)]",
  red: "border-red-500/45 shadow-[0_0_24px_rgba(239,68,68,0.1)]",
};

function Section({ icon, title, tone = "default", children }: SectionProps) {
  return (
    <section className={`rounded-2xl border bg-white/[0.025] p-5 ${toneRing[tone]}`}>
      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-white/80">
          {icon}
        </span>
        <h3 className="text-[12px] font-black uppercase tracking-[0.22em] text-white">{title}</h3>
      </header>
      {children}
    </section>
  );
}

function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "amber" | "emerald" | "purple" }) {
  const ring = {
    amber: "border-amber-500/55 bg-amber-950/25 text-amber-200",
    emerald: "border-emerald-500/55 bg-emerald-950/25 text-emerald-200",
    purple: "border-purple-500/55 bg-purple-950/25 text-purple-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${ring} px-4 py-3 text-center`}>
      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/65">{label}</div>
      <div className="mt-1 font-black text-2xl tabular-nums text-white">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] opacity-80">{sub}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/5 py-3 first:border-t-0 first:pt-0">
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/65">{label}</span>
      <div className="text-[12px] text-white/90">{children}</div>
    </div>
  );
}

function Toggle({ on: initial = false }: { on?: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <button
      onClick={() => setOn(!on)}
      className={`relative h-6 w-11 rounded-full border transition ${on ? "border-emerald-400/70 bg-emerald-500/40" : "border-white/15 bg-white/5"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function Profile() {
  const trophies = ["🏆", "🥇", "🥈", "🥉", "🃏", "💀", "👑", "⚔️"];

  return (
    <div className="min-h-screen bg-[#040408] py-8 px-3 sm:px-6">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.12),transparent_40%),radial-gradient(circle_at_85%_85%,rgba(34,211,238,0.08),transparent_45%)]" />
      <div className="relative mx-auto w-full max-w-[860px] rounded-[28px] border border-white/10 bg-[#070710]/90 p-6 sm:p-8 shadow-[0_40px_120px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tight text-white">Account</h1>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
              Manage your unmog identity, settings, and rewards
            </p>
          </div>
          <Link href="/arena" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/60 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </Link>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatTile label="ELO" value="8,800" sub="Slayer" tone="purple" />
          <StatTile label="Wins" value="184" sub="of 342" tone="emerald" />
          <StatTile label="Season" value="#74" sub="Global Rank" tone="amber" />
        </div>

        <div className="grid gap-4">
          {/* Identity */}
          <Section icon={<UserIcon className="h-4 w-4" />} title="Profile Identity" tone="purple">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 p-0.5">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-black text-2xl font-black text-white/85">P</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-black text-white">Player_7742</div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">Joined Mar 2025</div>
              </div>
              <button className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/80 transition hover:bg-white/5">
                Edit
              </button>
            </div>
          </Section>

          {/* Trophy case */}
          <Section icon={<Trophy className="h-4 w-4 text-amber-300" />} title="Trophy Case" tone="amber">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {trophies.map((t, i) => (
                <div key={i} className="aspect-square rounded-lg border border-amber-500/30 bg-amber-950/20 flex items-center justify-center text-2xl">
                  {t}
                </div>
              ))}
            </div>
          </Section>

          {/* Country */}
          <Section icon={<Globe className="h-4 w-4" />} title="Country">
            <Row label="Region">
              <span className="inline-flex items-center gap-2">🇺🇸 United States <ChevronRight className="h-3 w-3 text-white/40" /></span>
            </Row>
          </Section>

          {/* Camera */}
          <Section icon={<Camera className="h-4 w-4 text-cyan-300" />} title="Camera Settings" tone="cyan">
            <Row label="Active Device"><span>FaceTime HD Camera</span></Row>
            <Row label="Mirror Preview"><Toggle on /></Row>
            <Row label="Background Blur"><Toggle /></Row>
          </Section>

          {/* Replays */}
          <Section icon={<Video className="h-4 w-4 text-rose-300" />} title="Replay Settings" tone="rose">
            <Row label="Save Match Replays"><Toggle on /></Row>
            <Row label="Auto-clip Best Moments"><Toggle on /></Row>
            <Row label="Storage Used"><span className="text-white/60">1.2 GB / 5 GB</span></Row>
          </Section>

          {/* Subscription */}
          <Section icon={<Crown className="h-4 w-4 text-amber-300" />} title="Subscription" tone="amber">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-black uppercase tracking-[0.14em] text-white">Unmog Pro</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">Renews Jun 14, 2026</div>
              </div>
              <button className="rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200 transition hover:bg-amber-500/25">
                Manage
              </button>
            </div>
          </Section>

          {/* Discord */}
          <Section icon={<MessageCircle className="h-4 w-4 text-indigo-300" />} title="Discord Role Sync" tone="indigo">
            <Row label="Linked Account">
              <span className="inline-flex items-center gap-1.5 text-emerald-300"><Check className="h-3 w-3" /> player7742#0001</span>
            </Row>
            <Row label="Auto-sync Rank Role"><Toggle on /></Row>
          </Section>

          {/* Account actions */}
          <Section icon={<LogOut className="h-4 w-4 text-red-400" />} title="Account Actions" tone="red">
            <div className="grid gap-2">
              <button className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition hover:bg-white/5">
                <span className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.18em] text-white/85">
                  <LogOut className="h-4 w-4" /> Sign Out
                </span>
                <ChevronRight className="h-4 w-4 text-white/40" />
              </button>
              <button className="flex items-center justify-between rounded-lg border border-red-500/40 bg-red-950/25 px-4 py-3 text-left transition hover:bg-red-950/40">
                <span className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.18em] text-red-300">
                  <Trash2 className="h-4 w-4" /> Delete Account
                </span>
                <ChevronRight className="h-4 w-4 text-red-400/60" />
              </button>
            </div>
          </Section>

          <Section icon={<Swords className="h-4 w-4" />} title="Recent Matches">
            <div className="divide-y divide-white/5">
              {[
                { o: "Gigachad_99", r: "W", d: "+24", t: "2m ago" },
                { o: "SymmetryGod", r: "L", d: "-18", t: "15m ago" },
                { o: "JawlineKing", r: "L", d: "-22", t: "2h ago" },
              ].map((m) => (
                <div key={m.o} className="flex items-center justify-between py-3 first:pt-0">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${m.r === "W" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>{m.r}</span>
                    <div>
                      <div className="text-[12px] font-black uppercase tracking-[0.14em] text-white/90">vs {m.o}</div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">{m.t}</div>
                    </div>
                  </div>
                  <div className={`font-mono font-black text-sm ${m.r === "W" ? "text-emerald-300" : "text-red-300"}`}>{m.d}</div>
                </div>
              ))}
            </div>
          </Section>

          <div className="flex items-center justify-center gap-2 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
            <Calendar className="h-3 w-3" /> Member since March 2025
          </div>
        </div>
      </div>
    </div>
  );
}
