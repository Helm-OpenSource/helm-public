import {
  Archive,
  BellRing,
  BookOpenCheck,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type {
  PrivatePlaneHandoffLane,
  PrivatePlaneHandoffReadout,
} from "@/lib/work-unit-governance/private-plane-handoff";

type WorkUnitPrivatePlaneHandoffPanelProps = {
  readonly readout: PrivatePlaneHandoffReadout;
  readonly english: boolean;
};

function laneIcon(laneId: PrivatePlaneHandoffLane["laneId"]) {
  if (laneId === "private_mainline_store") return Archive;
  if (laneId === "owner_notification_dispatcher") return BellRing;
  if (laneId === "activation_runtime_executor") return PlayCircle;
  return BookOpenCheck;
}

function modeCopy(mode: PrivatePlaneHandoffLane["bindingMode"], english: boolean): string {
  if (mode === "public_core_noop") {
    return english ? "Public Core no-op" : "公开 Core 空适配";
  }
  if (mode === "private_control_plane") {
    return english ? "Private control plane" : "私有控制面";
  }
  if (mode === "tenant_overlay") return english ? "Tenant overlay" : "租户私有层";
  return english ? "Private pack adapter" : "私有 Pack 适配器";
}

export function WorkUnitPrivatePlaneHandoffPanel({
  readout,
  english,
}: WorkUnitPrivatePlaneHandoffPanelProps) {
  return (
    <section
      className="border-y border-[color:var(--border)] py-6"
      data-work-unit-private-plane-handoff-panel="true"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="workspace-eyebrow">
            {english ? "Private-plane handoff" : "私有面交接"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {english ? readout.userVisible.title.en : readout.userVisible.title.zh}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted-foreground)]">
            {english ? readout.userVisible.summary.en : readout.userVisible.summary.zh}
          </p>
          <p className="mt-3 text-sm font-semibold text-[color:var(--foreground)]">
            {english
              ? `Suggested next step: ${readout.userVisible.primaryAction.en}`
              : `建议下一步：${readout.userVisible.primaryAction.zh}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">
            {english ? `${readout.lanes.length} handoff objects` : `${readout.lanes.length} 个交接对象`}
          </Badge>
          <Badge variant="neutral">{english ? "Not execution" : "不是执行"}</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {readout.lanes.map((lane) => {
          const Icon = laneIcon(lane.laneId);
          return (
            <article
              key={lane.laneId}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
                    <Icon className="h-4 w-4 shrink-0 text-[color:var(--accent)]" aria-hidden />
                    {english ? lane.label.en : lane.label.zh}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    {english
                      ? lane.privateResponsibility.en
                      : lane.privateResponsibility.zh}
                  </p>
                </div>
                <Badge variant="neutral">{modeCopy(lane.bindingMode, english)}</Badge>
              </div>

              <p className="mt-3 border-t border-[color:var(--border)] pt-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
                {english ? lane.publicCoreBoundary.en : lane.publicCoreBoundary.zh}
              </p>

              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-[color:var(--muted-foreground)]">
                    {english ? "Current state" : "当前状态"}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[color:var(--foreground)]">
                    {english ? "Prepared handoff only" : "仅准备交接"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-[color:var(--muted-foreground)]">
                    {english ? "Binding" : "绑定"}
                  </dt>
                  <dd className="mt-1 break-all text-xs leading-5 text-[color:var(--muted-foreground)]">
                    {lane.bindingRef}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" aria-hidden />
        <p>{english ? readout.userVisible.boundary.en : readout.userVisible.boundary.zh}</p>
      </div>
    </section>
  );
}
