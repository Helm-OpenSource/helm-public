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
            ? "Choose which business extensions this workspace should show. Changes take effect the next time the related page opens."
            : "选择这个工作区要显示哪些业务扩展。变更会在下次打开相关页面时生效。"}
        </p>
      </div>

      <Card className="border-[color:var(--border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {english ? "Business extensions" : "可启用的业务扩展"}
          </CardTitle>
          <CardDescription className="text-xs">
            {english
              ? `Current workspace: ${workspace.name}`
              : `当前工作区：${workspace.name}`}
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

      <details className="group rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[color:var(--foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <Lock className="h-4 w-4 text-[color:var(--accent)]" />
            {english ? "Reference: enablement boundary" : "引用：启用边界"}
          </span>
          <span className="text-[color:var(--muted-foreground)] group-open:hidden">
            +
          </span>
          <span className="hidden text-[color:var(--muted-foreground)] group-open:inline">
            -
          </span>
        </summary>
        <div className="mt-3 space-y-2 border-t border-[color:var(--border)] pt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          <p>
            {english
              ? "Workspace toggles only decide whether an already-allowed extension appears here. Tenant access, environment allowlists and extension status still apply before any extension route opens."
              : "这里的开关只决定已允许的扩展是否在当前工作区出现。租户访问、环境白名单和扩展状态仍会在扩展页面打开前继续生效。"}
          </p>
          <p className="font-mono text-xs">
            {english
              ? `Internal reference: workspace=${workspace.slug}`
              : `内部引用：workspace=${workspace.slug}`}
          </p>
        </div>
      </details>
    </div>
  );
}
