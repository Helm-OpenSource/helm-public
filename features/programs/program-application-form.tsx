"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitProgramApplicationAction } from "@/features/programs/actions";
import type { UiLocale } from "@/lib/i18n/config";

type ProgramApplicationFormProps = {
  locale: UiLocale;
  program: {
    id: string;
    title: string;
    status: "ACTIVE" | "PAUSED" | "ARCHIVED";
    activeTerms: {
      id: string;
      versionKey: string;
    } | null;
  };
};

export function ProgramApplicationForm({ locale, program }: ProgramApplicationFormProps) {
  const english = locale === "en-US";
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [draft, setDraft] = useState({
    applicantName: "",
    applicantEmail: "",
    applicantOrganization: "",
    roleTitle: "",
    website: "",
    regionLabel: "",
    background: "",
    contributionPlan: "",
    termsAccepted: false,
  });

  const termsVersionId = program.activeTerms?.id ?? "";
  const intakeState =
    program.status !== "ACTIVE"
      ? "PAUSED"
      : !termsVersionId
        ? "TERMS_PENDING"
        : "OPEN";

  const intakeBlockedMessage =
    intakeState === "PAUSED"
      ? english
        ? "This program is still visible for reference, but new applications are paused right now."
        : "当前计划仍可查看，但新的申请入口已暂停。"
      : intakeState === "TERMS_PENDING"
        ? english
          ? "Current terms are being refreshed. New applications stay closed until an active terms version is published."
          : "当前条款正在更新，只有在新的生效条款版本发布后才会重新开放申请。"
        : null;

  function submitApplication() {
    if (!termsVersionId) {
      toast.error(english ? "Current terms are not available yet." : "当前条款版本尚未就绪。");
      return;
    }

    startTransition(async () => {
      const result = await submitProgramApplicationAction({
        programId: program.id,
        termsVersionId,
        applicantName: draft.applicantName,
        applicantEmail: draft.applicantEmail,
        applicantOrganization: draft.applicantOrganization,
        roleTitle: draft.roleTitle,
        website: draft.website,
        regionLabel: draft.regionLabel,
        background: draft.background,
        contributionPlan: draft.contributionPlan,
        termsAccepted: draft.termsAccepted,
        locale,
      });

      if (!result.ok) {
        toast.error(
          result.error ?? (english ? "Failed to submit the application." : "提交申请失败。"),
        );
        return;
      }

      setSubmitted(true);
      setDraft({
        applicantName: "",
        applicantEmail: "",
        applicantOrganization: "",
        roleTitle: "",
        website: "",
        regionLabel: "",
        background: "",
        contributionPlan: "",
        termsAccepted: false,
      });
      toast.success(
        english
          ? "Application submitted. Internal review will decide whether to waitlist, accept, or invite."
          : "申请已提交。后续会进入内部审核，再决定候补、通过或邀请加入。",
      );
    });
  }

  return (
    <div className="space-y-4">
      {submitted ? (
        <div className="rounded-3xl border border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)]/80 px-5 py-4 text-sm leading-6 text-[color:var(--status-success-text)]">
          {english
            ? "Application submitted. This does not create portal access automatically. Internal review still decides accepted, rejected, waitlisted, or invited."
            : "申请已提交。它不会自动生成门户访问权限，后续仍会经过内部审核，决定通过、拒绝、候补或邀请加入。"}
        </div>
      ) : null}

      {intakeBlockedMessage ? (
        <div className="rounded-3xl border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)]/80 px-5 py-4 text-sm leading-6 text-[color:var(--status-warning-text)]">
          {intakeBlockedMessage}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Input
          value={draft.applicantName}
          onChange={(event) => setDraft((current) => ({ ...current, applicantName: event.target.value }))}
          placeholder={english ? "Your name" : "你的姓名"}
          disabled={intakeState !== "OPEN" || pending}
        />
        <Input
          value={draft.applicantEmail}
          onChange={(event) => setDraft((current) => ({ ...current, applicantEmail: event.target.value }))}
          placeholder={english ? "Work email" : "工作邮箱"}
          disabled={intakeState !== "OPEN" || pending}
        />
        <Input
          value={draft.applicantOrganization}
          onChange={(event) =>
            setDraft((current) => ({ ...current, applicantOrganization: event.target.value }))
          }
          placeholder={english ? "Organization / company" : "机构 / 公司"}
          disabled={intakeState !== "OPEN" || pending}
        />
        <Input
          value={draft.roleTitle}
          onChange={(event) => setDraft((current) => ({ ...current, roleTitle: event.target.value }))}
          placeholder={english ? "Role / title" : "职位 / 角色"}
          disabled={intakeState !== "OPEN" || pending}
        />
        <Input
          value={draft.website}
          onChange={(event) => setDraft((current) => ({ ...current, website: event.target.value }))}
          placeholder={english ? "Website (optional)" : "网站（可选）"}
          disabled={intakeState !== "OPEN" || pending}
        />
        <Input
          value={draft.regionLabel}
          onChange={(event) => setDraft((current) => ({ ...current, regionLabel: event.target.value }))}
          placeholder={english ? "Region / market (optional)" : "区域 / 市场（可选）"}
          disabled={intakeState !== "OPEN" || pending}
        />
      </div>

      <Textarea
        value={draft.background}
        onChange={(event) => setDraft((current) => ({ ...current, background: event.target.value }))}
        placeholder={
          english
            ? "Briefly describe your background, relevant experience, or why you fit this program."
            : "简单介绍你的背景、相关经验，以及为什么适合这个计划。"
        }
        rows={5}
        disabled={intakeState !== "OPEN" || pending}
      />

      <Textarea
        value={draft.contributionPlan}
        onChange={(event) =>
          setDraft((current) => ({ ...current, contributionPlan: event.target.value }))
        }
        placeholder={
          english
            ? "What contribution, referral, delivery, or worker capability would you bring?"
            : "你计划带来什么样的贡献、转介绍、交付能力或可复用能力？"
        }
        rows={5}
        disabled={intakeState !== "OPEN" || pending}
      />

      <label className="flex items-start gap-3 rounded-3xl border border-[color:var(--border)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
        <input
          type="checkbox"
          aria-label={
            english
              ? "Confirm reviewed program boundary"
              : "确认理解计划审核边界"
          }
          checked={draft.termsAccepted}
          onChange={(event) =>
            setDraft((current) => ({ ...current, termsAccepted: event.target.checked }))
          }
          className="mt-1 h-4 w-4 rounded border-[color:var(--border-strong)]"
          disabled={intakeState !== "OPEN" || pending}
        />
        <span>
          {english
            ? "I understand this is a reviewed participation program, not a public marketplace, and that acceptance does not automatically create portal access or payout execution."
            : "我理解这是一条需要审核的参与计划，而不是公开市场；通过也不等于自动获得门户访问权限或自动打款。"}
        </span>
      </label>

      <Button
        onClick={submitApplication}
        disabled={
          intakeState !== "OPEN" ||
          pending ||
          !termsVersionId ||
          draft.applicantName.trim().length < 2 ||
          draft.applicantEmail.trim().length < 5 ||
          !draft.termsAccepted
        }
      >
        {intakeState === "PAUSED"
          ? english
            ? "Applications paused"
            : "申请已暂停"
          : intakeState === "TERMS_PENDING"
            ? english
              ? "Terms updating"
              : "条款更新中"
            : english
              ? "Submit application"
              : "提交申请"}
      </Button>
    </div>
  );
}
