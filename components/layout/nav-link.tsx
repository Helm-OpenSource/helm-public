"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavLinkActive } from "@/components/layout/nav-link-active";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  icon,
  label,
  activeDescendantExclusions,
  trailing,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  activeDescendantExclusions?: string[];
  trailing?: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = isNavLinkActive(pathname, href, {
    activeDescendantExclusions,
  });

  return (
    <Link
      href={href}
      className={cn(
        "nav-link group flex w-full items-center gap-3 rounded-[20px] px-3 py-3 text-sm font-medium transition-all duration-200",
        active
          ? "nav-active bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-hover)] text-white shadow-md"
          : "text-[color:var(--foreground)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--foreground)]",
      )}
    >
      <span
        className={cn(
          "nav-icon flex h-9 w-9 items-center justify-center rounded-2xl transition",
          active
            ? "bg-white/20 text-white"
            : "bg-[color:color-mix(in_oklab,var(--surface-subtle)_90%,var(--background)_10%)] text-[color:var(--muted-foreground)] ring-1 ring-[color:var(--border)] group-hover:text-[color:var(--foreground)]",
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 text-[17px] tracking-tight",
          active ? "text-white font-medium" : "text-[color:var(--foreground)]",
        )}
      >
        {label}
      </span>
      {trailing ? <span className="ml-auto shrink-0">{trailing}</span> : null}
    </Link>
  );
}
