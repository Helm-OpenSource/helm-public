"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { buildBreadcrumbCrumbs } from "@/lib/navigation/breadcrumb-trail";

export function BreadcrumbTrail() {
  const pathname = usePathname();
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const crumbs = buildBreadcrumbCrumbs(pathname, english);

  if (!crumbs.length) return null;

  const linkClassName =
    "inline-flex min-h-7 items-center rounded-lg px-1.5 font-medium text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--mode-link)]";

  return (
    <nav
      data-breadcrumb-trail="true"
      className="flex flex-wrap items-center gap-1.5 text-xs text-[color:var(--muted-foreground)]"
    >
      <Link href="/dashboard" className={linkClassName}>
        {english ? "Console" : "控制台"}
      </Link>
      {crumbs.map((crumb, index) => (
        <div key={`${crumb.href}-${index}`} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
          {index === crumbs.length - 1 || !crumb.isNavigable ? (
            <span className="inline-flex min-h-7 items-center px-1 font-medium text-[color:var(--muted)]">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className={linkClassName}>
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
