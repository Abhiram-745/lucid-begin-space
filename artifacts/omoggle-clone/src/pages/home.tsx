import { Fragment } from "react";
import { PageShell } from "@/components/page-shell";
import { Swords, ChevronRight, Trophy, MessageCircle } from "lucide-react";
import { Link } from "wouter";

const STEPS = [
  {
    n: "1",
    title: "Camera check",
    body: "Complete a quick camera check to get started.",
    hoverClass:
      "hover:border-violet-400/45 hover:shadow-[0_22px_50px_-14px_rgba(168,85,247,0.55),0_12px_0_-4px_rgba(76,29,149,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] hover:ring-2 hover:ring-violet-500/30",
  },
  {
    n: "2",
    title: "Solo PSL scan",
    body: "Take a Solo PSL Scan to verify you unmog.",
    hoverClass:
      "hover:border-cyan-400/45 hover:shadow-[0_22px_50px_-14px_rgba(34,211,238,0.45),0_12px_0_-4px_rgba(8,145,178,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] hover:ring-2 hover:ring-cyan-400/25",
  },
  {
    n: "3",
    title: "Compete & climb",
    body: "Win matches, earn points, and climb the ladder.",
    hoverClass:
      "hover:border-emerald-400/45 hover:shadow-[0_22px_50px_-14px_rgba(52,211,153,0.45),0_12px_0_-4px_rgba(6,95,70,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] hover:ring-2 hover:ring-emerald-400/25",
  },
] as const;

export default function Home() {
  return (
    <PageShell grid="hero" landing rebelSlash={false} className="flex min-h-[100dvh] flex-col">
      <main className="landing-sans relative z-10 mx-auto flex w-full min-w-0 flex-1 flex-col items-center px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14 viewport-fit-main">
        {/* Top badge */}
        <div className="mb-7 flex justify-center sm:mb-9">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.12] bg-black/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.9)]"
              aria-hidden
            />
            Live 1v1 Unmog Arena
          </div>
        </div>

        {/* Wordmark — full width inside main so cqw + calc() can resolve to visible line */}
        <div className="unmoggle-wordmark-wrap mb-6 w-full min-w-0 px-3 sm:mb-8 sm:px-5">
          <h1 className="unmoggle-wordmark">UNMOGGLE</h1>
        </div>

        {/* Online badge */}
        <div className="mb-10 flex justify-center sm:mb-12">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/35 bg-emerald-950/25 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.15),inset_0_1px_0_rgba(16,185,129,0.12)] backdrop-blur-md">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.85)]"
              aria-hidden
            />
            2.1K Online
          </div>
        </div>

        {/* Primary CTA — entire card is one interactive control */}
        <div className="mb-14 w-full max-w-[42rem]">
          <Link
            href="/camera-check?returnTo=/arena"
            aria-label="Enter the arena, start camera check. By entering you agree to the Terms of Service and Privacy Policy."
            className="group relative block overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-b from-white/[0.07] to-white/[0.02] px-8 py-10 shadow-[0_32px_100px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-all duration-300 hover:border-violet-400/35 hover:shadow-[0_38px_110px_rgba(88,28,135,0.38)] hover:-translate-y-1 active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] sm:px-12 sm:py-12"
          >
            <div className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_0_60px_rgba(168,85,247,0.05)] transition-opacity group-hover:opacity-100" />

            <div className="relative flex flex-col items-center text-center">
              <div className="mb-8 flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-[22px] border border-white/15 bg-gradient-to-br from-zinc-400/25 via-zinc-600/15 to-zinc-900/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_16px_48px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-[1.03]">
                <Swords
                  className="h-11 w-11 text-zinc-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                  strokeWidth={2}
                  aria-hidden
                />
              </div>

              <span className="font-display text-2xl font-bold uppercase tracking-[0.22em] text-white sm:text-[1.65rem] sm:tracking-[0.26em]">
                Enter the Arena
              </span>

              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.28em] text-violet-300/95 transition-colors group-hover:text-violet-200">
                Start Camera Check
                <ChevronRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  strokeWidth={2.5}
                  aria-hidden
                />
              </span>

              <p className="mt-10 max-w-md text-center text-[10px] font-medium uppercase leading-relaxed tracking-[0.18em] text-white/40 sm:text-[11px]">
                By entering the arena you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </Link>
        </div>

        {/* Steps row — hover: lift + 3D coloured shadow */}
        <div className="flex w-full max-w-5xl flex-col gap-6 md:flex-row md:items-stretch md:justify-center md:gap-0 md:py-2">
          {STEPS.map((step, i) => (
            <Fragment key={step.n}>
              <article
                className={`group relative flex flex-1 flex-col rounded-2xl border border-white/[0.09] bg-[#0f0f0f]/85 px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm transition-all duration-300 ease-out will-change-transform hover:z-10 hover:-translate-y-2 hover:scale-[1.03] hover:border-white/20 md:min-w-0 md:flex-1 ${step.hoverClass}`}
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/60 text-sm font-black text-white">
                  {step.n}
                </div>
                <h3 className="text-[12px] font-bold uppercase leading-tight tracking-[0.14em] text-white sm:text-[13px]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[12px] leading-snug text-white/45">{step.body}</p>
              </article>
              {i < STEPS.length - 1 && (
                <div
                  className="hidden shrink-0 items-center justify-center self-center px-1 md:flex"
                  aria-hidden
                >
                  <ChevronRight className="h-5 w-5 text-white/20" strokeWidth={2} />
                </div>
              )}
            </Fragment>
          ))}
        </div>

        {/* Secondary CTAs — Leaderboard + Discord */}
        <div className="mt-8 grid w-full max-w-5xl grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2">
          <Link
            href="/leaderboard"
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/40 via-[#0f0f0f]/85 to-[#0f0f0f]/85 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/55 hover:shadow-[0_18px_44px_-12px_rgba(245,158,11,0.45)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-950/40">
              <Trophy className="h-5 w-5 text-amber-300" strokeWidth={2.2} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200/90">View Leaderboard</div>
              <div className="mt-1 text-[12px] text-white/45">See top players and rankings.</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
          </Link>

          <a
            href="https://discord.gg"
            target="_blank"
            rel="noreferrer"
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/50 via-[#0f0f0f]/85 to-[#0f0f0f]/85 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/55 hover:shadow-[0_18px_44px_-12px_rgba(99,102,241,0.5)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-950/50">
              <MessageCircle className="h-5 w-5 text-indigo-300" strokeWidth={2.2} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-200/90">Join Discord</div>
              <div className="mt-1 text-[12px] text-white/45">Chat, events &amp; updates.</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
          </a>
        </div>

        {/* Footer micro-copy */}
        <p className="mt-12 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-white/25 sm:mt-14">
          Anti-abuse session gate · 18+ acknowledgment · Not legal ID verification
        </p>
      </main>
    </PageShell>
  );
}
