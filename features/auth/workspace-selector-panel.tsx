"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { selectLoginWorkspaceAction } from "@/features/auth/actions";
import type { UiLocale } from "@/lib/i18n/config";

type WorkspaceChoice = {
  workspaceId: string;
  workspaceName: string;
  roleLabel: string;
  status: "ACTIVE" | "INVITED";
};

export function WorkspaceSelectorPanel({
  locale,
  options,
}: {
  locale: UiLocale;
  options: WorkspaceChoice[];
}) {
  const router = useRouter();
  const english = locale === "en-US";
  const [pending, startTransition] = useTransition();

  const chooseWorkspace = (workspaceId: string) => {
    startTransition(async () => {
      const result = await selectLoginWorkspaceAction({ workspaceId, locale });
      if (!result.ok || !result.redirectTo) {
        toast.error(
          result.error ??
            (english ? "Unable to enter the selected organization." : "当前无法进入该组织。"),
        );
        return;
      }

      toast.success(english ? "Organization selected" : "组织已选择");
      router.push(result.redirectTo);
      router.refresh();
    });
  };

  return (
    <Card className="border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
      <CardHeader>
        <CardTitle className="text-[color:var(--foreground)]">
          {english ? "Choose organization to enter" : "选择要进入的组织"}
        </CardTitle>
        <CardDescription>
          {english
            ? "Pick one to continue."
            : "选一个进入。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {options.map((option) => (
          <div
            key={option.workspaceId}
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
                  <Building2 className="h-4 w-4" />
                  <span>{option.workspaceName}</span>
                </p>
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  {option.roleLabel} ·{" "}
                  {option.status === "ACTIVE"
                    ? english
                      ? "Active"
                      : "已激活"
                    : english
                      ? "Invited"
                      : "已邀请"}
                </p>
              </div>
              <Button
                disabled={pending}
                onClick={() => chooseWorkspace(option.workspaceId)}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {english ? "Enter this organization" : "进入该组织"}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
