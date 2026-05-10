import { ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type ChromeBackLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  className?: string;
  showLabel?: boolean;
};

/** Consistent “rebel premium” back control across routes */
export function ChromeBackLink({
  children,
  className,
  showLabel = true,
  ...props
}: ChromeBackLinkProps) {
  return (
    <Link
      {...props}
      className={cn(
        "group inline-flex h-9 items-center gap-2 rounded-full border border-white/[0.11] bg-white/[0.05] px-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.11),0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-300 hover:border-[#dfff4a]/40 hover:text-white hover:shadow-[0_0_28px_rgba(223,255,74,0.12)] sm:h-11 sm:px-4 sm:text-xs",
        className,
      )}
    >
      <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 sm:h-4 sm:w-4" />
      {showLabel ? children : null}
    </Link>
  );
}
