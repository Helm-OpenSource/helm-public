import "server-only";

import { Check, Link2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setWorkspaceSurfaceBindingAction } from "@/features/settings/surface-binding-actions";
import {
  loadWorkspaceSurfaceBindings,
  type SingleWinnerSurfaceKey,
} from "@/lib/shell/surface-binding-store";
import {
  SHELL_MAINLINE_SURFACE_KEY,
  SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
} from "@/lib/shell/resolve-shell-experience";

// 单一生效 shell surface 的绑定授权写入面(蓝图 §4.3 绑定即授权)。
// owner(MANAGE_WORKSPACE_SETUP)选择哪个已注册 provider 生效,或清除回 Core default。
// **绑定 = 授权配置,不是执行**:无执行态、无外发、无自动接管;无绑定/失效/越权/版本不兼容
// 读侧 fail-open 回 Core。渲染只读展示 + 一次写配置(经审计的 server action)。

const SURFACE_LABELS: Record<
  SingleWinnerSurfaceKey,
  { zh: string; en: string; descZh: string; descEn: string }
> = {
  [SHELL_MAINLINE_SURFACE_KEY]: {
    zh: "经营主线",
    en: "Operating mainline",
    descZh: "控制塔顶部的经营主线由哪个 provider 提供。",
    descEn: "Which provider supplies the operating mainline atop the control tower.",
  },
  [SHELL_ROLE_HOME_ROUTING_SURFACE_KEY]: {
    zh: "角色家路由",
    en: "Role-home routing",
    descZh: "各角色的家落在控制塔还是某工位,由哪个 provider 决定。",
    descEn: "Which provider decides whether each role lands in the control tower or a workstation.",
  },
};

export async function SurfaceBindingsCard({
  workspaceId,
  english,
}: {
  workspaceId: string;
  english: boolean;
}) {
  const rows = await loadWorkspaceSurfaceBindings(workspaceId);

  return (
    <Card className="border-[color:var(--border)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4 text-[color:var(--accent)]" />
          {english ? "Shell surface bindings" : "Shell 界面绑定"}
        </CardTitle>
        <CardDescription className="text-xs leading-5">
          {english
            ? "Single-winner surfaces show one provider at a time. Binding authorizes a provider; it is configuration, not execution. No binding — or an ineligible one — falls back to the Core default."
            : "单一生效 surface 每次只显示一个 provider。绑定是授权配置、不是执行；无绑定或候选不合格时回退 Core 默认。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => {
          const label = SURFACE_LABELS[row.surfaceKey];
          const boundButUnregistered =
            row.boundProviderId !== null && !row.boundProviderRegistered;
          return (
            <div
              key={row.surfaceKey}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {english ? label.en : label.zh}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                    {english ? label.descEn : label.descZh}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                  {row.boundProviderId === null
                    ? english
                      ? "Core default"
                      : "Core 默认"
                    : english
                      ? "Bound"
                      : "已绑定"}
                </span>
              </div>

              {boundButUnregistered ? (
                <p className="mt-2 rounded-lg bg-[color:var(--warning-surface,transparent)] text-xs leading-5 text-[color:var(--warning-foreground,var(--muted-foreground))]">
                  {english
                    ? `Bound provider "${row.boundProviderId}" is not currently registered — the surface falls back to the Core default until it is available again.`
                    : `绑定的 provider「${row.boundProviderId}」当前未注册——在其恢复前该 surface 回退 Core 默认。`}
                </p>
              ) : null}

              <div className="mt-3 space-y-2">
                {row.candidates.length === 0 ? (
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    {english
                      ? "No provider registered for this surface — Core default is the only option."
                      : "该 surface 无已注册 provider——只有 Core 默认。"}
                  </p>
                ) : (
                  row.candidates.map((candidate) => (
                    <div
                      key={candidate.providerId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[color:var(--foreground)]">
                          {candidate.provenance}
                        </p>
                        <p className="truncate text-[11px] text-[color:var(--muted-foreground)]">
                          {candidate.providerId}
                          {candidate.compatible
                            ? ""
                            : english
                              ? " · incompatible contract"
                              : " · 契约不兼容"}
                        </p>
                      </div>
                      {candidate.bound ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[color:var(--accent)]">
                          <Check className="h-3 w-3" />
                          {english ? "Bound" : "已绑定"}
                        </span>
                      ) : (
                        <form
                          action={async () => {
                            "use server";
                            await setWorkspaceSurfaceBindingAction({
                              surfaceKey: row.surfaceKey,
                              providerId: candidate.providerId,
                            });
                          }}
                        >
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            disabled={!candidate.compatible}
                          >
                            {english ? "Bind" : "绑定"}
                          </Button>
                        </form>
                      )}
                    </div>
                  ))
                )}

                {row.boundProviderId !== null ? (
                  <form
                    action={async () => {
                      "use server";
                      await setWorkspaceSurfaceBindingAction({
                        surfaceKey: row.surfaceKey,
                        providerId: null,
                      });
                    }}
                  >
                    <Button type="submit" size="sm" variant="ghost">
                      {english ? "Clear → Core default" : "清除 → Core 默认"}
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}

        <p className="flex items-start gap-2 pt-1 text-[11px] leading-5 text-[color:var(--muted-foreground)]">
          <Lock className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--accent)]" />
          {english
            ? "Only members who can manage workspace setup can change bindings; every change is written to the audit log. Binding never grants execution, send, or approval authority."
            : "仅可管理工作区配置的成员能改绑定,每次变更写审计。绑定从不授予执行、外发或审批权限。"}
        </p>
      </CardContent>
    </Card>
  );
}
