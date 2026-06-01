"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { completeFirstLoginIdentityCompletionAction } from "@/features/auth/actions";
import type { UiLocale } from "@/lib/i18n/config";

type FirstLoginIdentityCompletionPanelProps = {
  locale: UiLocale;
  requiresEmail: boolean;
  requiresPhone: boolean;
  requiresPasswordSetup: boolean;
  defaultEmail: string;
  defaultPhone: string;
};

export function FirstLoginIdentityCompletionPanel({
  locale,
  requiresEmail,
  requiresPhone,
  requiresPasswordSetup,
  defaultEmail,
  defaultPhone,
}: FirstLoginIdentityCompletionPanelProps) {
  const router = useRouter();
  const english = locale === "en-US";
  const [form, setForm] = useState({
    email: defaultEmail,
    phone: defaultPhone,
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const requiresAnyUpdate = requiresEmail || requiresPhone || requiresPasswordSetup;

  return (
    <Card className="border border-[color:var(--border)] bg-[color:var(--surface)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">
          {english ? "Complete account setup" : "完成账号初始化"}
        </CardTitle>
        <CardDescription>
          {requiresAnyUpdate
            ? english
              ? "Fill in what's missing — then you're in."
              : "把下面缺的补上——然后就能进。"
            : english
              ? "All set. Continue to workspace."
              : "都填好了，进入工作区。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {requiresEmail ? (
          <div className="space-y-2">
            <label htmlFor="first-login-email" className="text-sm font-medium">
              {english ? "Work email" : "工作邮箱"}
            </label>
            <Input
              id="first-login-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder={english ? "name@company.com" : "name@company.com"}
              autoComplete="email"
              disabled={pending}
            />
          </div>
        ) : null}

        {requiresPhone ? (
          <div className="space-y-2">
            <label htmlFor="first-login-phone" className="text-sm font-medium">
              {english ? "Mobile phone" : "手机号"}
            </label>
            <Input
              id="first-login-phone"
              type="tel"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder={english ? "13800000000" : "13800000000"}
              autoComplete="tel"
              disabled={pending}
            />
          </div>
        ) : null}

        {requiresPasswordSetup ? (
          <>
            <div className="space-y-2">
              <label htmlFor="first-login-password" className="text-sm font-medium">
                {english ? "Set password" : "设置登录密码"}
              </label>
              <Input
                id="first-login-password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder={english ? "At least 8 chars with letter + number" : "至少 8 位，包含字母和数字"}
                autoComplete="new-password"
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="first-login-confirm-password" className="text-sm font-medium">
                {english ? "Confirm password" : "确认密码"}
              </label>
              <Input
                id="first-login-confirm-password"
                type="password"
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm((current) => ({ ...current, confirmPassword: event.target.value }))
                }
                placeholder={english ? "Re-enter password" : "再次输入密码"}
                autoComplete="new-password"
                disabled={pending}
              />
            </div>
          </>
        ) : null}

        {error ? (
          <p className="text-sm text-[color:var(--status-danger-text)]" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          className="w-full"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await completeFirstLoginIdentityCompletionAction({
                email: requiresEmail ? form.email : undefined,
                phone: requiresPhone ? form.phone : undefined,
                password: requiresPasswordSetup ? form.password : undefined,
                confirmPassword: requiresPasswordSetup ? form.confirmPassword : undefined,
                locale,
              });

              if (!result.ok) {
                const errorMessage =
                  result.error ?? (english ? "Failed to save account setup." : "账号初始化保存失败。");
                setError(errorMessage);
                toast.error(errorMessage);
                return;
              }

              router.replace(result.redirectTo ?? "/dashboard");
              router.refresh();
            });
          }}
        >
          {pending
            ? english
              ? "Saving..."
              : "保存中..."
            : requiresAnyUpdate
              ? english
                ? "Save and continue"
                : "保存并继续"
              : english
                ? "Continue"
                : "继续"}
        </Button>
      </CardContent>
    </Card>
  );
}
