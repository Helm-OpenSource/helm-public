"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { selectLoginWorkspaceAction } from "@/features/auth/actions";
import type { WorkspaceChoice } from "@/lib/auth/workspace-choices";
import type { UiLocale } from "@/lib/i18n/config";

export function WorkspaceAccountSwitcher({
  workspaceId, workspaceName, userName, roleLabel, title, locale, options,
}: {
  workspaceId: string;
  workspaceName: string;
  userName: string;
  roleLabel: string;
  title: string;
  locale: UiLocale;
  options: WorkspaceChoice[];
}) {
  const english = locale === "en-US";
  const [switching, setSwitching] = useState(false);
  const inFlight = useRef(false);
  const identity = (
    <>
      <Avatar className="h-9 w-9"><AvatarFallback name={userName} /></Avatar>
      <span className="hidden min-w-0 text-left leading-tight md:block">
        <span className="block truncate whitespace-nowrap text-sm font-semibold text-[color:var(--foreground)]">{userName}</span>
        <span className="block truncate whitespace-nowrap text-[11px] text-[color:var(--muted-foreground)]">
          {switching ? (english ? "Switching…" : "切换中…") : `${workspaceName} · ${roleLabel}`}
        </span>
      </span>
    </>
  );

  async function chooseWorkspace(nextWorkspaceId: string) {
    if (nextWorkspaceId === workspaceId || inFlight.current) return;
    inFlight.current = true;
    setSwitching(true);
    try {
      const result = await selectLoginWorkspaceAction({ workspaceId: nextWorkspaceId, locale });
      if (!result.ok || !result.redirectTo) {
        throw new Error(result.error || (english ? "Unable to switch organization." : "切换租户失败。"));
      }
      // Discard the previous workspace's client state and router cache.
      location.assign(result.redirectTo);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (english ? "Unable to switch organization." : "切换租户失败，请重试。"));
      inFlight.current = false;
      setSwitching(false);
    }
  }

  const className = "workspace-panel-muted flex shrink-0 items-center gap-2.5 rounded-[22px] px-2.5 py-1.5";
  if (options.length <= 1) return <div className={className} title={title}>{identity}</div>;

  return (
    <Select value={workspaceId} onValueChange={chooseWorkspace} disabled={switching}>
      <SelectTrigger
        className={`${className} h-auto w-auto max-w-[min(32rem,50vw)] disabled:cursor-wait disabled:opacity-70`}
        aria-label={english ? `Switch organization, current: ${workspaceName}` : `切换租户，当前：${workspaceName}`}
        aria-busy={switching}
        title={english ? "Switch organization" : "切换租户"}
      >{identity}</SelectTrigger>
      <SelectContent align="end" className="max-h-[min(24rem,var(--radix-select-content-available-height))] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto">
        {options.map((option) => (
          <SelectItem key={option.workspaceId} value={option.workspaceId} textValue={option.workspaceName}>
            <span className="block whitespace-normal break-words font-medium">{option.workspaceName}</span>
            <span className="block text-xs text-[color:var(--muted-foreground)]">
              {option.roleLabel} · {option.workspaceId === workspaceId
                ? (english ? "Current organization" : "当前租户")
                : option.status === "INVITED" ? (english ? "Invited" : "已邀请") : (english ? "Active" : "已激活")}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
