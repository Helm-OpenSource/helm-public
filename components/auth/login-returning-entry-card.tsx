"use client";

import { ControlledDisclosure } from "@/components/shared/controlled-disclosure";
import { SimplifiedLoginPanel } from "@/components/auth/simplified-login-panel";
import type { UiLocale } from "@/lib/i18n/config";

type LoginReturningEntryCardProps = {
  locale: UiLocale;
  defaultExpanded?: boolean;
};

export function LoginReturningEntryCard({
  locale,
  defaultExpanded = false,
}: LoginReturningEntryCardProps) {
  const english = locale === "en-US";

  return (
    <div
      className="workspace-panel-muted rounded-3xl border border-[color:var(--border)]/70 p-4"
      data-testid="login-returning-entry-card"
    >
      <ControlledDisclosure
        defaultExpanded={defaultExpanded}
        data-testid="login-returning-entry-disclosure"
        summary={
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Returning member quick entry" : "已有成员快速回流"}
            </span>
            <span className="text-xs leading-5 text-[color:var(--muted-foreground)]">
              {english
                ? "Use this only for password or phone-code re-entry into an existing organization."
                : "这个窄入口只服务已有组织成员的密码或手机号验证码回流。"}
            </span>
          </div>
        }
        summaryClassName="cursor-pointer list-none rounded-2xl px-2 py-1 [&::-webkit-details-marker]:hidden"
        bodyClassName="space-y-3 px-2 pt-3"
      >
        <p className="text-sm leading-6 text-[color:var(--muted)]">
          {english
            ? "Verified signup, invite continuation, and public SSO fallback stay in the main panel above. This quick entry is only a narrower returning-member sub-surface."
            : "正式验证注册、邀请续接和公开 SSO 回退仍在上面的主面板里。这个 quick entry 只是一个更窄的已有成员子入口。"}
        </p>
        <SimplifiedLoginPanel locale={locale} />
      </ControlledDisclosure>
    </div>
  );
}
