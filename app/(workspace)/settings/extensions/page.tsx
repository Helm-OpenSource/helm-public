import Link from "next/link";
import { ArrowLeft, Boxes, Check, Lock, X } from "lucide-react";
import { redirect } from "next/navigation";
import {
  getCurrentMembership,
  getCurrentWorkspace,
} from "@/lib/auth/session";
import { canManageWorkspaceSetup } from "@/lib/auth/settings-governance";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  setWorkspaceSolutionExtensionStatusAction,
} from "@/features/settings/solution-extension-actions";
import { SOLUTION_EXTENSION_CATALOG } from "@/lib/extensions/solution-extension-catalog";

export default async function SettingsExtensionsPage() {
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceSetup(membership.role)) {
    redirect("/settings?status=denied&message=extensions");
  }

  const records = await db.workspaceSolutionExtension.findMany({
    where: { workspaceId: workspace.id },
    select: { extensionKey: true, status: true, updatedAt: true },
  });
  const statusByKey = new Map(records.map((r) => [r.extensionKey, r]));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
      <div>
        <Button asChild size="sm" variant="ghost" className="-ml-2">
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
            {english ? "Back to settings" : "返回设置"}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
          <Boxes className="h-5 w-5 text-[color:var(--accent)]" />
          {english ? "Workspace extensions" : "工作区扩展"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted-foreground)]">
          {english
            ? "Enable or disable per-workspace solution extensions. Changes take effect on the next page navigation. Tenant-level access still requires ENABLED_TENANT_KEYS to include this workspace's tenant."
            : "启用或禁用工作区级别的解决方案扩展。变更下次页面导航生效。租户级别启用仍需 ENABLED_TENANT_KEYS 环境变量包含本工作区所属租户。"}
        </p>
      </div>

      <Card className="border-[color:var(--border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {english ? "Available extensions" : "可配置扩展"}
          </CardTitle>
          <CardDescription className="text-xs">
            {english
              ? `Workspace: ${workspace.name} (slug=${workspace.slug})`
              : `工作区：${workspace.name}（slug=${workspace.slug}）`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {SOLUTION_EXTENSION_CATALOG.map((entry) => {
            const record = statusByKey.get(entry.extensionKey);
            const isActive = record?.status === "ACTIVE";

            return (
              <div
                key={entry.extensionKey}
                className="flex flex-col gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[color:var(--foreground)]">
                      {english ? entry.nameEn : entry.nameZh}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        isActive
                          ? "bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
                          : "bg-[color:var(--muted)]/20 text-[color:var(--muted-foreground)]"
                      }`}
                    >
                      {isActive ? (
                        <>
                          <Check className="h-3 w-3" />
                          {english ? "ACTIVE" : "已启用"}
                        </>
                      ) : (
                        <>
                          <X className="h-3 w-3" />
                          {english ? "DISABLED" : "未启用"}
                        </>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                    {english ? entry.descriptionEn : entry.descriptionZh}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-[color:var(--muted-foreground)]">
                    {entry.extensionKey}
                  </p>
                </div>

                <form
                  action={async () => {
                    "use server";
                    await setWorkspaceSolutionExtensionStatusAction({
                      extensionKey: entry.extensionKey,
                      enabled: !isActive,
                    });
                  }}
                >
                  <Button
                    type="submit"
                    size="sm"
                    variant={isActive ? "outline" : "default"}
                  >
                    {isActive
                      ? english
                        ? "Disable"
                        : "禁用"
                      : english
                        ? "Enable"
                        : "启用"}
                  </Button>
                </form>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex gap-2 border-l-2 border-[color:var(--accent)] pl-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
        <p>
          {english
            ? "Toggling here flips status in WorkspaceSolutionExtension. The 4-layer access gate (tenant_enabled / tenant_match / extension_status / env_allowlist) still applies; status=ACTIVE alone does not bypass tenant or env gates."
            : "切换状态写入 WorkspaceSolutionExtension。4 层访问闸门（租户启用 / 租户匹配 / 扩展状态 / env 白名单）仍生效，单独 status=ACTIVE 不会绕过租户或 env 层。"}
        </p>
      </div>
    </div>
  );
}
