"use client";

import { useSearchParams } from "next/navigation";
import { BookOpenText, ShieldAlert, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type HomeSurfaceArrivalKind = "detail" | "approvals" | "memory";

type HomeSurfaceArrivalContract = {
  ownership: string;
  nextStep: string;
  ctaLabel?: string;
  ctaHref?: string;
  boundary?: string | null;
};

export function useHomeSurfaceArrival(kind: HomeSurfaceArrivalKind) {
  const searchParams = useSearchParams();
  const entry = searchParams.get("entry");

  return {
    isHomeSurfaceArrival: entry === `home-surface-${kind}`,
    focus: searchParams.get("focus"),
  };
}

function getSurfaceIcon(kind: HomeSurfaceArrivalKind) {
  switch (kind) {
    case "detail":
      return <Waypoints className="h-3.5 w-3.5" />;
    case "approvals":
      return <ShieldAlert className="h-3.5 w-3.5" />;
    case "memory":
      return <BookOpenText className="h-3.5 w-3.5" />;
  }
}

function getArrivalCopy(
  kind: HomeSurfaceArrivalKind,
  english: boolean,
  focus: string | null,
) {
  switch (kind) {
    case "detail":
      return {
        eyebrow: english ? "Home → detail" : "首页 → 详情",
        title: english
          ? focus
            ? `Home routed you here to explain "${focus}".`
            : "Home routed you here to explain the current object or chain."
          : focus
            ? `首页把你送到这里，是为了把“${focus}”解释清楚。`
            : "首页把你送到这里，是为了把当前对象或推进链解释清楚。",
        summary: english
          ? "Detail owns state, evidence and handling options. Home should only rank the move and send you here."
          : "详情页负责状态、证据和处理选项；首页只负责排序并把你送过来。",
      };
    case "approvals":
      return {
        eyebrow: english ? "Home → review" : "目标推进台 → 复核",
        title: english
          ? focus
            ? `Home routed "${focus}" here because the next move still needs explicit review.`
            : "Home routed you here because the next move still needs explicit review."
          : focus
            ? `目标推进台把“${focus}”送到这里，因为下一步还不能直接放行。`
            : "目标推进台把你送到这里，因为下一步还不能直接放行。",
        summary: english
          ? "Approvals owns boundary-sensitive review, not Home. Read why the draft is held before letting it leave the boundary."
          : "复核页负责边界敏感判断。先读清楚草稿为什么被拦住，再决定通过、改写或转人工。",
      };
    case "memory":
      return {
        eyebrow: english ? "Home → memory" : "首页 → 经营记忆",
        title: english
          ? focus
            ? `Home routed you here to stabilize "${focus}" into readable memory and replay.`
            : "Home routed you here to stabilize the current context into readable memory and replay."
          : focus
            ? `首页把你送到这里，是为了把“${focus}”沉淀成可读的记忆与回放。`
            : "首页把你送到这里，是为了把当前上下文沉淀成可读的记忆与回放。",
        summary: english
          ? "Memory owns durable context, correction and replay. Home should not turn into a memory browser."
          : "经营记忆负责稳定上下文、修正和回放；首页不应该变成记忆浏览器。",
      };
  }
}

export function HomeSurfaceArrivalBanner({
  kind,
  english,
  contract,
}: {
  kind: HomeSurfaceArrivalKind;
  english: boolean;
  contract?: HomeSurfaceArrivalContract;
}) {
  const arrival = useHomeSurfaceArrival(kind);

  if (!arrival.isHomeSurfaceArrival) {
    return null;
  }

  const copy = getArrivalCopy(kind, english, arrival.focus);

  return (
    <section
      className="workspace-panel-muted rounded-[24px] border border-[color:var(--border)] px-4 py-4"
      data-home-surface-arrival={kind}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">{copy.eyebrow}</Badge>
        <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-2.5 py-1 text-xs font-medium text-[color:var(--muted-foreground)]">
          {getSurfaceIcon(kind)}
          {english ? "Landing contract" : "到达合同"}
        </span>
      </div>
      <p className="mt-3 text-base font-semibold tracking-tight text-[color:var(--foreground)]">
        {copy.title}
      </p>
      <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">{copy.summary}</p>
      {contract ? (
        <div className="mt-4 grid gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "This page owns" : "这页当前负责"}
              </p>
              <p className="text-sm leading-6 text-[color:var(--foreground)]">
                {contract.ownership}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Start here" : "先从这里开始"}
              </p>
              <p className="text-sm leading-6 text-[color:var(--foreground)]">
                {contract.nextStep}
              </p>
            </div>
            {contract.boundary ? (
              <p className="text-sm leading-6 text-[color:var(--muted)]">
                {contract.boundary}
              </p>
            ) : null}
          </div>
          {contract.ctaHref && contract.ctaLabel ? (
            <Button asChild className="min-w-[200px] justify-center">
              <a
                href={contract.ctaHref}
                data-home-surface-arrival-cta={kind}
              >
                {contract.ctaLabel}
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
