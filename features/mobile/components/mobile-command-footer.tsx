import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MobileCommandFooterItem = {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
};

export function MobileCommandFooter({
  items,
  english = false,
}: {
  items: MobileCommandFooterItem[];
  english?: boolean;
}) {
  return (
    <nav
      aria-label={english ? "Mobile command navigation" : "移动端经营推进导航"}
      className="sticky bottom-3 z-20 mx-3 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)]/95 px-2 py-2 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.75)] backdrop-blur"
      data-testid="mobile-command-footer"
    >
      <div className="grid grid-cols-4 gap-1">
        {items.map((item) => (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-2 text-[11px] font-medium transition active:scale-[0.98]",
              item.active
                ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                : "text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--foreground)]",
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center">
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
