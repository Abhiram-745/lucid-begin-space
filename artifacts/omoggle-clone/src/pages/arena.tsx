import { useState, type ReactNode } from "react";
import { ChevronLeft, CircleHelp, Trophy, User, X, Gamepad2, ChevronRight, Camera, Upload } from "lucide-react";
import { Link, useLocation } from "wouter";

type LobbyCardProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  accent: string;
  hoverGlow: string;
  hoverBorder: string;
  featured?: boolean;
  extra?: ReactNode;
  href?: string;
  onClick?: () => void;
};

type RuleCardProps = {
  icon: ReactNode;
  title: string;
  body: string;
  pill: string;
  tone: "purple" | "green" | "pink" | "cyan" | "yellow";
};

const ruleToneClasses: Record<RuleCardProps["tone"], string> = {
  purple: "border-purple-500/80 shadow-[0_0_22px_rgba(168,85,247,0.14)] text-purple-300",
  green: "border-green-500/80 shadow-[0_0_22px_rgba(34,197,94,0.13)] text-green-300",
  pink: "border-rose-500/80 shadow-[0_0_22px_rgba(244,63,94,0.13)] text-rose-300",
  cyan: "border-cyan-400/80 shadow-[0_0_22px_rgba(34,211,238,0.13)] text-cyan-300",
  yellow: "border-yellow-400/80 shadow-[0_0_22px_rgba(250,204,21,0.12)] text-yellow-300",
};

function RuleCard({ icon, title, body, pill, tone }: RuleCardProps) {
  const toneClass = ruleToneClasses[tone];

  return (
    <div className={`relative min-h-[118px] rounded-[14px] border bg-black/45 px-4 py-3 ${toneClass}`}>
      <div className="mb-2.5 flex h-8 items-center justify-center text-[2rem] leading-none">
        {icon}
      </div>
      <h3 className="text-[15px] font-black uppercase leading-none tracking-[0.02em] text-white">
        {title}
      </h3>
      <p className="mt-2 max-w-[220px] text-[12px] font-bold leading-[1.22] text-white/70">
        {body}
      </p>
      <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-black leading-none ${toneClass}`}>
        {pill}
      </div>
    </div>
  );
}

function HowToUnmogModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-3 py-3 backdrop-blur-sm">
      <div className="relative max-h-[min(85dvh,90svh)] w-full max-w-[min(680px,calc(100vw-1.5rem))] lg:max-w-[min(680px,calc(50vw-1rem))] overflow-y-auto overscroll-y-contain rounded-[22px] border border-purple-500/85 bg-[#050710] p-4 shadow-[0_0_48px_rgba(168,85,247,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-purple-300/75 transition hover:text-purple-200"
          aria-label="Close how to unmog"
        >
          <X className="h-6 w-6" strokeWidth={2.3} />
        </button>

        <div className="flex items-start gap-4 pr-8">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[12px] border border-purple-500/55 bg-purple-950/20 text-[2.65rem] shadow-[0_0_24px_rgba(168,85,247,0.2)]">
            🃏
          </div>
          <div>
            <h2 className="text-[28px] font-black uppercase italic leading-none text-white">
              How to <span className="text-purple-500">Unmog</span>
            </h2>
            <p className="mt-2 max-w-[480px] text-[12px] font-black uppercase leading-[1.25] tracking-[0.16em] text-purple-400">
              Quick rules to help you unmog harder, get lower scores, and better clips
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <RuleCard
            icon={<div className="relative w-full text-center"><span>😎</span><span className="absolute left-14 top-1 text-2xl text-purple-400">⌜</span><span className="absolute right-14 top-1 text-2xl text-purple-400">⌝</span></div>}
            title="Be Unhinged"
            body="Act weird, be loud, make faces, do anything to unmog your opponent."
            pill="More chaos = lower score"
            tone="purple"
          />
          <RuleCard
            icon={<div className="flex items-center justify-center gap-2 text-[1.45rem]"><span className="h-3 w-28 rounded-full bg-[linear-gradient(90deg,#22e96b,#f8e441,#ff3e6c)] shadow-[0_0_12px_rgba(34,233,107,0.3)]" /><span className="text-rose-400">↓ -ELO</span></div>}
            title="Lower Is Better"
            body="The goal is to get a LOWER jester score than your opponent."
            pill="Unmog to win"
            tone="green"
          />
          <RuleCard
            icon={<div className="relative"><span>🤡</span><span className="absolute inset-x-[-12px] top-4 h-0.5 rotate-[-28deg] bg-rose-400" /></div>}
            title="Don't Try Too Hard"
            body="Trying to look good will unmog you. Embrace the chaos."
            pill="Trying = unmogging"
            tone="pink"
          />
          <RuleCard
            icon={<div className="relative text-cyan-300"><span className="text-[2.6rem]">▭</span><span className="absolute left-2 top-0 text-[2.5rem]">╱</span></div>}
            title="Camera Stays On"
            body="No turning off, no covers. Full face. Full unmog."
            pill="Always visible"
            tone="cyan"
          />
          <RuleCard
            icon={<span>🏆</span>}
            title="Earn Your Title"
            body="The worst, funniest, and silliest rise to the top."
            pill="Climb the unmog leaderboard"
            tone="yellow"
          />
          <RuleCard
            icon={<span className="text-purple-400">↪</span>}
            title="Clip & Share"
            body="Best unmog moments get clips. Humiliate. Entertain. Go viral."
            pill="Fame through failure"
            tone="purple"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-[12px] border border-purple-500/45 bg-purple-950/14 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-[2.4rem] leading-none">🃏</div>
            <div>
              <div className="text-[14px] font-black uppercase italic tracking-[0.05em] text-white">
                Be the reason they lose.
              </div>
              <div className="text-[22px] font-black uppercase italic leading-none text-purple-500">
                Unmog hard.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-11 min-w-[128px] rounded-[9px] border border-purple-400/70 bg-purple-600/70 px-5 text-[16px] font-black uppercase italic text-purple-100 shadow-[0_0_24px_rgba(168,85,247,0.34)] transition hover:bg-purple-500"
          >
            Got It ›
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfilePhotoGate({ onClose, onContinue }: { onClose: () => void; onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-3 py-3 backdrop-blur-sm">
      <div className="relative w-full max-w-[460px] rounded-[20px] border border-purple-500/70 bg-[#070713] p-7 text-center shadow-[0_0_60px_rgba(168,85,247,0.32)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-white/45 transition hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-purple-400/55 bg-purple-950/40 shadow-[0_0_28px_rgba(168,85,247,0.4)]">
          <Camera className="h-9 w-9 text-purple-300" strokeWidth={1.6} />
        </div>
        <h2 className="text-[22px] font-black uppercase italic leading-tight text-white">
          Add Your Profile Photo
        </h2>
        <p className="mx-auto mt-3 max-w-[340px] text-[12px] font-bold leading-[1.45] text-white/55">
          A profile photo is required to enter the 1v1 Arena. Opponents need to know who they're unmogging.
        </p>
        <button
          onClick={onContinue}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-purple-400/70 bg-gradient-to-b from-purple-600 to-purple-700 px-5 text-[13px] font-black uppercase tracking-[0.18em] text-white shadow-[0_0_28px_rgba(168,85,247,0.45)] transition hover:from-purple-500 hover:to-purple-600"
        >
          <Upload className="h-4 w-4" /> Upload Photo
        </button>
        <button
          onClick={onClose}
          className="mt-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/40 transition hover:text-white/70"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}

function PlayerRankCard({ featured = false }: { featured?: boolean }) {
  return (
    <div
      className={`mt-4 w-full rounded-[16px] border border-cyan-100/80 bg-[linear-gradient(145deg,rgba(79,102,112,0.48),rgba(25,36,42,0.8))] p-2.5 shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_0_48px_rgba(80,240,255,0.08)] sm:mt-5 sm:p-3 ${
        featured ? "max-w-[320px] sm:max-w-[380px]" : "max-w-[300px] sm:max-w-[340px]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 rounded-[12px] border border-cyan-100/70 bg-[#24353b]/80 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] sm:gap-3 sm:rounded-[14px] sm:px-3 sm:py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white sm:text-[11px] sm:tracking-[0.18em]">
            Unmogger #74
          </span>
        </div>
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-cyan-100 sm:text-[10px] sm:tracking-[0.14em]">
          <span className="text-orange-500">Sub3</span> | 400 Elo
        </span>
      </div>

      <div className="my-1.5 h-px bg-cyan-100/35 sm:my-2" />

      <div className="grid grid-cols-2 gap-1.5">
        {[
          ["Season Record", "0W - 0L"],
          ["World Standing", "#273,269"],
          ["Peak", "400 Elo"],
          ["Next Rank", "LTN"],
        ].map(([label, value], index) => (
          <div
            key={label}
            className="rounded-[9px] border border-white/10 bg-white/[0.035] px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:rounded-[10px] sm:px-3 sm:py-1.5"
          >
            <div className="text-[8px] font-black uppercase tracking-[0.12em] text-white/85 sm:text-[9px] sm:tracking-[0.14em]">
              {label}
            </div>
            <div
              className={`mt-0.5 text-[11px] font-black uppercase tracking-[0.12em] sm:text-xs sm:tracking-[0.14em] ${
                index >= 2 ? "text-cyan-200" : "text-white"
              }`}
            >
              {index === 3 ? <span className="text-emerald-300">LTN</span> : value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full border border-cyan-100/20 bg-[#13242d] sm:mt-2.5 sm:h-2.5">
        <div className="h-full w-[80%] rounded-full bg-[linear-gradient(90deg,#00d7ff,#63fff1)] shadow-[0_0_18px_rgba(34,211,238,0.75)]" />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.16em] text-white sm:mt-2 sm:text-[11px] sm:tracking-[0.18em]">
        <span>80%</span>
        <span>101 Elo Needed</span>
      </div>
    </div>
  );
}

function LobbyPanel({
  icon,
  title,
  subtitle,
  accent,
  hoverGlow,
  hoverBorder,
  featured = false,
  extra,
  href,
  onClick,
}: LobbyCardProps) {
  const content = (
    <section
      className={`group relative flex h-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-[38px] border bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.035))] text-center backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_28px_90px_rgba(0,0,0,0.42)] ${hoverBorder} ${
        featured
          ? "min-h-[300px] border-cyan-100/35 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_26px_100px_rgba(34,211,238,0.08),0_20px_80px_rgba(0,0,0,0.36)] sm:min-h-[360px] sm:px-7 sm:py-7 lg:min-h-0"
          : "min-h-[220px] border-white/18 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_80px_rgba(0,0,0,0.34)] sm:min-h-[300px] sm:px-7 sm:py-7 lg:min-h-0"
      }`}
    >
      <div className={`absolute inset-0 opacity-70 ${accent}`} />
      <div
        className={`pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-55 ${hoverGlow}`}
      />
      <div
        className={`pointer-events-none absolute inset-[-18%] opacity-0 blur-3xl transition duration-300 group-hover:opacity-100 ${hoverGlow}`}
      />
      <div
        className={`pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-35 ${hoverGlow}`}
      />
      <div
        className={`pointer-events-none absolute inset-x-6 bottom-0 h-px opacity-0 transition duration-300 group-hover:opacity-100 ${hoverGlow}`}
      />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />

      <div
        className={`relative z-10 flex items-center justify-center text-white/70 drop-shadow-[0_18px_35px_rgba(0,0,0,0.4)] ${
          featured ? "mb-4 h-12 w-12 text-[3rem] sm:mb-6 sm:h-16 sm:w-16 sm:text-[3.8rem]" : "mb-4 h-11 w-11 text-[2.6rem] sm:mb-7 sm:h-14 sm:w-14 sm:text-[3.4rem]"
        }`}
      >
        {icon}
      </div>
      <h2
        className={`relative z-10 font-black uppercase tracking-[-0.01em] text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.16)] ${
          featured ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
        }`}
      >
        {title}
      </h2>
      <p className="relative z-10 mt-3 text-xs font-black uppercase tracking-[0.12em] text-white/38 sm:mt-4 sm:text-base">
        {subtitle}
      </p>
      {extra}
    </section>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="block h-full min-w-0 cursor-pointer text-left">
        {content}
      </button>
    );
  }

  if (!href) return content;

  return (
    <Link href={href} className="block h-full min-w-0 cursor-pointer">
      {content}
    </Link>
  );
}

export default function Arena() {
  const [showHowToUnmog, setShowHowToUnmog] = useState(false);
  const [showPhotoGate, setShowPhotoGate] = useState(false);
  const [, navigate] = useLocation();
  const panels: LobbyCardProps[] = [
    {
      icon: <Trophy className="h-16 w-16 fill-amber-400/35 text-amber-400" strokeWidth={1.6} />,
      title: "Global Rank",
      subtitle: "Top 100 Unmoggers",
      accent: "bg-[radial-gradient(circle_at_50%_32%,rgba(255,194,73,0.09),transparent_46%)]",
      hoverGlow: "bg-[radial-gradient(ellipse_at_bottom,rgba(250,204,21,0.72),rgba(250,204,21,0.32)_42%,rgba(250,204,21,0.08)_68%,transparent_82%)]",
      hoverBorder: "hover:border-yellow-300/85 hover:shadow-[0_0_72px_rgba(250,204,21,0.22),inset_0_1px_0_rgba(255,255,255,0.12)]",
      href: "/leaderboard",
    },
    {
      icon: <span className="text-[4rem] leading-none">⚔️</span>,
      title: "1v1 Arena",
      subtitle: "Ranked Matchmaking",
      accent: "bg-[radial-gradient(circle_at_50%_78%,rgba(101,231,255,0.11),transparent_42%)]",
      hoverGlow: "bg-[radial-gradient(ellipse_at_bottom,rgba(168,85,247,0.82),rgba(34,211,238,0.32)_44%,rgba(168,85,247,0.1)_70%,transparent_84%)]",
      hoverBorder: "hover:border-purple-400/90 hover:shadow-[0_0_76px_rgba(168,85,247,0.3),inset_0_1px_0_rgba(255,255,255,0.12)]",
      featured: true,
      onClick: () => setShowPhotoGate(true),
      extra: <PlayerRankCard featured />,
    },
    {
      icon: <Gamepad2 className="h-16 w-16 text-rose-300/70" strokeWidth={1.4} />,
      title: "Customs",
      subtitle: "Host Tournaments or 1v1s",
      accent: "bg-[radial-gradient(circle_at_50%_75%,rgba(244,63,94,0.12),transparent_46%)]",
      hoverGlow: "bg-[radial-gradient(ellipse_at_bottom,rgba(244,63,94,0.78),rgba(244,114,182,0.3)_42%,rgba(244,63,94,0.08)_70%,transparent_84%)]",
      hoverBorder: "hover:border-rose-400/90 hover:shadow-[0_0_76px_rgba(244,63,94,0.28),inset_0_1px_0_rgba(255,255,255,0.12)]",
      extra: (
        <span className="absolute right-4 top-4 z-20 rounded-full border border-rose-400/55 bg-rose-500/30 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-rose-100 shadow-[0_0_14px_rgba(244,63,94,0.5)]">
          ● New
        </span>
      ),
    },
    {
      icon: <User className="h-16 w-16 fill-sky-300/35 text-sky-300/55" strokeWidth={1.5} />,
      title: "The Lab",
      subtitle: "Solo Calibration",
      accent: "bg-[radial-gradient(circle_at_50%_100%,rgba(135,91,180,0.15),transparent_50%)]",
      hoverGlow: "bg-[radial-gradient(ellipse_at_bottom,rgba(34,211,238,0.78),rgba(56,189,248,0.32)_42%,rgba(59,130,246,0.1)_70%,transparent_84%)]",
      hoverBorder: "hover:border-cyan-400/90 hover:shadow-[0_0_76px_rgba(34,211,238,0.3),inset_0_1px_0_rgba(255,255,255,0.12)]",
      href: "/scorer",
    },
  ];

  return (
    <div className="relative min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#060606] font-mono text-white lg:h-[100dvh] lg:overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,24,28,0.72),rgba(12,12,14,0.92)_34%,rgba(17,12,21,0.94)_72%,rgba(11,10,13,1))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_13%,rgba(255,193,7,0.09),transparent_22%),radial-gradient(circle_at_99%_0%,rgba(120,86,255,0.16),transparent_18%),radial-gradient(circle_at_68%_62%,rgba(128,41,173,0.14),transparent_38%)]" />
      <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:44px_44px]" />

      <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[min(1640px,100%)] min-w-0 flex-col px-3 pt-3 pb-8 sm:px-8 sm:pt-6 sm:pb-10 lg:h-full lg:min-h-0 lg:px-12 lg:py-6">
        <div className="relative flex h-12 shrink-0 items-center justify-between gap-3 sm:h-14">
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/78 shadow-[0_0_24px_rgba(255,255,255,0.03),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition hover:border-white/22 hover:text-white sm:h-11 sm:px-4 sm:text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Back
          </Link>

          {/* Center: Season + Roobet stack */}
          <div className="absolute left-1/2 top-0 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/55 bg-amber-950/35 px-4 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.22)]">
              🏆 Season 1
            </div>
            <a
              href="https://roobet.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-amber-400/65 bg-gradient-to-b from-amber-900/60 to-amber-950 px-5 py-2 text-[12px] font-black uppercase tracking-[0.24em] text-amber-200 shadow-[0_0_28px_rgba(251,191,36,0.35),inset_0_1px_0_rgba(255,224,130,0.3)] transition hover:from-amber-800/70 hover:text-amber-100"
            >
              <span className="text-base">🟡</span> Play on Roobet
            </a>
          </div>

          <button
            onClick={() => setShowHowToUnmog(true)}
            className="inline-flex h-9 w-fit items-center gap-2 rounded-full border border-cyan-100/35 bg-cyan-950/10 px-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/82 shadow-[0_0_32px_rgba(103,232,249,0.08),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md sm:h-12 sm:gap-3 sm:px-5 sm:text-sm sm:tracking-[0.28em]"
          >
            How to Unmog
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-cyan-100/35 text-cyan-100 sm:h-7 sm:w-7">
              <CircleHelp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </button>
        </div>

        <div className="grid min-h-0 flex-1 items-center py-2 sm:py-5 lg:py-7">
          <div className="grid h-full max-h-[calc(100dvh-5rem)] grid-cols-1 items-stretch gap-3 sm:max-h-[calc(100dvh-7rem)] sm:grid-cols-2 sm:gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.05fr)_minmax(0,0.85fr)_minmax(0,0.85fr)] lg:gap-6 xl:gap-7">
          {panels.map((panel) => (
            <LobbyPanel key={panel.title} {...panel} />
          ))}
          </div>
        </div>

        {/* Social row */}
        <div className="grid w-full shrink-0 grid-cols-2 gap-2 pb-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          {[
            { name: "Discord",   sub: "Join the Discord",  href: "https://discord.gg",      icon: "💬", color: "indigo" },
            { name: "TikTok",    sub: "Follow Unmoggle",    href: "https://tiktok.com",      icon: "🎵", color: "rose" },
            { name: "Instagram", sub: "Follow Unmoggle",    href: "https://instagram.com",   icon: "📷", color: "fuchsia" },
            { name: "Reddit",    sub: "Follow Unmoggle",    href: "https://reddit.com",      icon: "👽", color: "orange" },
            { name: "YouTube",   sub: "Follow Unmoggle",    href: "https://youtube.com",     icon: "▶️", color: "red" },
            { name: "X / Twitter", sub: "Follow Unmoggle",  href: "https://x.com",           icon: "✕",  color: "zinc" },
          ].map((s) => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/60 text-sm">
                {s.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-white/85">{s.name}</div>
                <div className="truncate text-[10px] text-white/40">{s.sub}</div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/25 transition-transform group-hover:translate-x-0.5" />
            </a>
          ))}
        </div>
      </main>
      {showHowToUnmog && <HowToUnmogModal onClose={() => setShowHowToUnmog(false)} />}
      {showPhotoGate && (
        <ProfilePhotoGate
          onClose={() => setShowPhotoGate(false)}
          onContinue={() => {
            setShowPhotoGate(false);
            navigate("/arena/1v1");
          }}
        />
      )}
    </div>
  );
}
