import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type PageShellProps = {
  children: ReactNode;
  className?: string;
  /** Landing focuses the mesh upward; full bleeds the grid across the viewport */
  grid?: "hero" | "full" | "none";
  /** Diagonal electric slash + top hairline (brand rebel accent) */
  rebelSlash?: boolean;
  /** Softer charcoal + purple glows (matches marketing landing mock) */
  landing?: boolean;
};

export function PageShell({
  children,
  className,
  grid = "full",
  rebelSlash = true,
  landing = false,
}: PageShellProps) {
  const gridMask =
    grid === "hero"
      ? "radial-gradient(ellipse 75% 65% at 50% 35%, black 15%, transparent 78%)"
      : grid === "full"
        ? "radial-gradient(ellipse 110% 90% at 50% 40%, black 8%, black 38%, transparent 88%)"
        : "none";

  return (
    <div
      className={cn(
        "relative min-h-[100dvh] overflow-x-hidden font-mono text-white",
        landing ? "bg-[#0a0a0a]" : "bg-[#030306]",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]",
        className,
      )}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: landing
            ? "radial-gradient(ellipse 90% 65% at 50% -5%, rgba(168, 85, 247, 0.2) 0%, rgba(15, 15, 15, 0.4) 42%, transparent 62%), radial-gradient(ellipse 55% 45% at 85% 25%, rgba(120, 53, 199, 0.14) 0%, transparent 52%), radial-gradient(ellipse 50% 40% at 12% 55%, rgba(88, 28, 135, 0.12) 0%, transparent 48%), linear-gradient(180deg, #050505 0%, #0a0a0a 35%, #0f0f0f 100%)"
            : "radial-gradient(ellipse 85% 55% at 50% -8%, rgba(139, 92, 246, 0.22) 0%, rgba(88, 28, 135, 0.08) 38%, transparent 68%), radial-gradient(ellipse 50% 40% at 100% 20%, rgba(56, 189, 248, 0.06) 0%, transparent 55%), radial-gradient(ellipse 45% 35% at 0% 60%, rgba(168, 85, 247, 0.07) 0%, transparent 50%)",
        }}
      />

      {rebelSlash && !landing && (
        <>
          <div className="pointer-events-none absolute -right-[18%] top-[-8%] h-[88vh] w-[min(42vw,420px)] min-w-[240px] rotate-[11deg] bg-gradient-to-b from-[#dfff4a]/[0.12] via-fuchsia-600/[0.045] to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-px w-[min(48%,520px)] bg-gradient-to-l from-[#dfff4a]/50 to-transparent" />
        </>
      )}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% 50%, transparent 0%, rgba(0,0,0,0.58) 100%)",
        }}
      />

      {grid !== "none" && (
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.42]"
          style={{
            backgroundImage: `
            linear-gradient(rgba(255,255,255,0.041) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.041) 1px, transparent 1px)
          `,
            backgroundSize: "72px 72px",
            maskImage: gridMask,
            WebkitMaskImage: gridMask,
          }}
        />
      )}
      <div
        className={cn(
          "absolute inset-0 bg-noise-fine mix-blend-overlay pointer-events-none",
          landing ? "opacity-[0.12]" : "opacity-[0.2]",
        )}
      />

      {!landing && (
        <>
          <div className="pointer-events-none absolute bottom-[-280px] left-[-200px] h-[820px] w-[820px] rounded-full bg-violet-600/12 blur-[160px]" />
          <div className="pointer-events-none absolute top-[12%] right-[-120px] h-[420px] w-[420px] rounded-full bg-fuchsia-500/10 blur-[120px]" />
          <div className="pointer-events-none absolute left-[40%] top-[50%] h-[340px] w-[340px] rounded-full bg-[#dfff4a]/[0.035] blur-[90px]" />
        </>
      )}
      {landing && (
        <>
          <div className="pointer-events-none absolute -bottom-[40%] left-1/2 h-[70vmin] w-[120vmin] -translate-x-1/2 rounded-full bg-violet-600/[0.09] blur-[100px]" />
          <div className="pointer-events-none absolute top-[18%] right-[-8%] h-[38vmin] w-[38vmin] rounded-full bg-[#a855f7]/[0.08] blur-[90px]" />
        </>
      )}

      {children}
    </div>
  );
}
