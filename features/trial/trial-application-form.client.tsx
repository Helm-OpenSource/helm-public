"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TRIAL_ROLE_LABELS,
  TRIAL_ROLE_OPTIONS,
  type TrialApplicationInput,
  type TrialApplicationResult,
} from "@/features/trial/data";
import { submitTrialApplicationAction } from "@/features/trial/actions";
import type { UiLocale } from "@/lib/i18n/config";

type TrialApplicationFormProps = {
  locale: UiLocale;
};

const initialForm: TrialApplicationInput = {
  email: "",
  organizationName: "",
  role: "founder",
  useCase: "",
};

export function TrialApplicationForm({ locale }: TrialApplicationFormProps) {
  const english = locale === "en-US";
  const [form, setForm] = useState<TrialApplicationInput>(initialForm);
  const [result, setResult] = useState<TrialApplicationResult | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof TrialApplicationInput>(
    key: K,
    value: TrialApplicationInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    startTransition(async () => {
      const response = await submitTrialApplicationAction({ ...form, locale });
      setResult(response);
      if (response.ok) {
        setForm(initialForm);
      }
    });
  }

  if (result?.ok) {
    return (
      <div
        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-card)]"
        data-testid="trial-application-success"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--accent)]" />
          <div className="space-y-2">
            <p className="text-base font-semibold text-[color:var(--foreground)]">
              {english ? "Got it. A human is reading this within 1 business day." : "收到。1 个工作日内会有真人读完你的申请。"}
            </p>
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "We'll come back with a clear yes / not yet / not a fit — no auto-emails, no waitlist black hole. While you wait, the demo workspaces are open."
                : "我们会回你「通过 / 暂时不合适 / 不匹配」三种明确答复——不发自动邮件，不挂候补名单。等的过程中可以先看看演示工作区。"}
            </p>
            {!result.delivered && (
              <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                {english
                  ? "Notification email is not configured in this environment; our team will follow up out-of-band."
                  : "当前环境未配置通知邮箱，我们会通过其他渠道与你联系。"}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-card)]"
      data-testid="trial-application-form"
    >
      <div className="space-y-1.5">
        <label htmlFor="trial-email" className="text-sm font-medium text-[color:var(--foreground)]">
          {english ? "Work email" : "工作邮箱"}
          <span className="ml-1 text-[color:var(--accent-danger)]">*</span>
        </label>
        <Input
          id="trial-email"
          type="email"
          required
          value={form.email}
          onChange={(event) => update("email", event.target.value)}
          placeholder={english ? "you@company.com" : "you@company.com"}
          data-testid="trial-email-input"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="trial-organization"
          className="text-sm font-medium text-[color:var(--foreground)]"
        >
          {english ? "Organization name" : "组织名称"}
          <span className="ml-1 text-[color:var(--accent-danger)]">*</span>
        </label>
        <Input
          id="trial-organization"
          required
          value={form.organizationName}
          onChange={(event) => update("organizationName", event.target.value)}
          placeholder={english ? "Acme Holdings" : "公司或组织名称"}
          data-testid="trial-organization-input"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="trial-role" className="text-sm font-medium text-[color:var(--foreground)]">
          {english ? "Role" : "角色"}
          <span className="ml-1 text-[color:var(--accent-danger)]">*</span>
        </label>
        <select
          id="trial-role"
          required
          value={form.role}
          onChange={(event) =>
            update("role", event.target.value as TrialApplicationInput["role"])
          }
          className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_86%,white_14%)] px-3.5 text-sm text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--ring)]"
          data-testid="trial-role-select"
        >
          {TRIAL_ROLE_OPTIONS.map((option) => {
            const label = TRIAL_ROLE_LABELS[option];
            return (
              <option key={option} value={option}>
                {english ? label.en : label.zh}
              </option>
            );
          })}
        </select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="trial-use-case"
          className="text-sm font-medium text-[color:var(--foreground)]"
        >
          {english ? "Where is your team losing time right now?" : "你团队现在最大的时间漏斗在哪？"}
          <span className="ml-1 text-[color:var(--accent-danger)]">*</span>
        </label>
        <Textarea
          id="trial-use-case"
          required
          rows={4}
          minLength={10}
          maxLength={800}
          value={form.useCase}
          onChange={(event) => update("useCase", event.target.value)}
          placeholder={
            english
              ? "Concrete is best. Example: \"We close 8 deals/month but lose 3-4 in the 2 weeks after the demo because no one names the next step.\""
              : "越具体越好。示例：「每月成 8 单，但有 3-4 单死在演示后两周内——因为没人指定下一步负责人。」"
          }
          data-testid="trial-use-case-input"
        />
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
        <p className="text-xs leading-5 text-[color:var(--muted)]">
          {english
            ? "A human reads every application. Most decisions come back inside 24 hours. We never auto-open workspaces."
            : "每份申请都由人工读。多数申请在 24 小时内会有答复。绝不自动开通工作区。"}
        </p>
      </div>

      {result && !result.ok && (
        <p
          className="text-sm text-[color:var(--accent-danger)]"
          data-testid="trial-application-error"
        >
          {result.error}
        </p>
      )}

      <Button
        type="submit"
        variant="default"
        className="w-full sm:w-auto"
        disabled={pending}
        data-testid="trial-submit-button"
      >
        {pending
          ? english
            ? "Submitting..."
            : "正在提交..."
          : english
            ? "Submit · we reply in 1 business day"
            : "提交 · 1 个工作日答复"}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </form>
  );
}
