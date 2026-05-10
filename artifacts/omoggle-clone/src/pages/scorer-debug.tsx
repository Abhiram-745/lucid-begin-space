import { FlaskConical } from "lucide-react";
import { ChromeBackLink } from "@/components/chrome-nav";
import { PageShell } from "@/components/page-shell";
import { Link } from "wouter";

/** Placeholder route — full Lab / MediaPipe scorer can be restored when lib modules are present in-repo. */
export default function ScorerDebug() {
  return (
    <PageShell>
      <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[min(36rem,92vw)] lg:max-w-[min(36rem,calc(50vw-1rem))] flex-col items-center justify-center px-5 py-16 text-center min-w-0">
        <ChromeBackLink href="/arena" className="absolute left-6 top-6">
          Lobby
        </ChromeBackLink>
        <div className="rebel-card rounded-[28px] px-10 py-12">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#dfff4a]/25 bg-black/50 text-[#dfff4a]">
            <FlaskConical className="h-8 w-8" strokeWidth={2} />
          </div>
          <p className="font-display text-[10px] font-black uppercase tracking-[0.35em] text-[#dfff4a]/90">The Lab</p>
          <h1 className="rebel-heading mt-3 text-3xl uppercase text-white sm:text-4xl">Scorer debug</h1>
          <p className="mt-4 text-sm uppercase tracking-[0.14em] text-white/45">
            Full biometric scorer UI ships with the extended workspace bundle. This stub keeps routing and theming consistent.
          </p>
          <Link
            href="/arena"
            className="mt-10 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-10 text-xs font-black uppercase tracking-[0.22em] text-black shadow-[0_22px_70px_rgba(255,255,255,0.12)] transition hover:-translate-y-0.5"
          >
            Back to Arena
          </Link>
        </div>
      </main>
    </PageShell>
  );
}
