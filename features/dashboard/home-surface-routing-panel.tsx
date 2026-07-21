import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  BriefcaseBusiness,
  ShieldAlert,
  Waypoints,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import type { DashboardHomeSurfaceRoutingModel } from "@/features/dashboard/home-surface-routing";

function getSurfaceBadgeLabel(
  surface: "detail" | "approvals" | "work" | "memory",
  english: boolean,
) {
  switch (surface) {
    case "detail":
      return english ? "Detail" : "详情页";
    case "approvals":
      return english ? "Approvals" : "复核与边界";
    case "work":
      return english ? "Role work" : "角色工位";
    case "memory":
      return english ? "Memory" : "经营记忆";
  }
}

function getSurfaceIcon(surface: "detail" | "approvals" | "work" | "memory") {
  switch (surface) {
    case "detail":
      return <Waypoints className="h-3.5 w-3.5" />;
    case "approvals":
      return <ShieldAlert className="h-3.5 w-3.5" />;
    case "work":
      return <BriefcaseBusiness className="h-3.5 w-3.5" />;
    case "memory":
      return <BookOpenText className="h-3.5 w-3.5" />;
  }
}

export function DashboardHomeSurfaceRoutingPanel({
  model,
  english,
}: {
  model: DashboardHomeSurfaceRoutingModel;
  english: boolean;
}) {
  return (
    <Card
      className="workspace-panel border-[color:var(--mode-card-border)]"
      data-dashboard-home-surface-routing="true"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
          <Waypoints className="h-3.5 w-3.5" />
          {english ? "Next work surfaces" : "下一层工作面"}
        </div>
        <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
          {model.title}
        </p>
        <CardDescription>{model.summary}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-3">
        {model.cards.map((card) => (
          <div
            key={card.id}
            className="theme-surface-panel rounded-2xl px-4 py-4"
            data-dashboard-home-surface-card={card.surface}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-[color:var(--foreground)]">{card.title}</p>
              <Badge variant="info">{getSurfaceBadgeLabel(card.surface, english)}</Badge>
            </div>
            <p className="mt-2 flex items-center gap-2 text-xs font-medium text-[color:var(--muted-foreground)]">
              {getSurfaceIcon(card.surface)}
              <span>{card.focus}</span>
            </p>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">{card.summary}</p>
            {card.boundary ? (
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">{card.boundary}</p>
            ) : null}
            <div className="mt-4">
              <Button asChild size="sm" variant="secondary">
                <Link href={card.href}>
                  {card.ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
