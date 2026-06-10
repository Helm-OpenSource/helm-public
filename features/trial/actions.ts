"use server";

import { TrialApplicationStatus } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { resolveUiLocale, supportedUiLocales } from "@/lib/i18n/config";
import { normalizeEmailAddress } from "@/lib/auth/formal-auth";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isHelmReservedWorkspace } from "@/lib/workspace-identity";
import {
  getSystemMailSenderEmail,
  sendSystemMailIfConfigured,
  SYSTEM_MAIL_PURPOSES,
} from "@/lib/notifications/system-mail";
import {
  TRIAL_ROLE_LABELS,
  TRIAL_ROLE_OPTIONS,
  type TrialApplicationInput,
  type TrialApplicationResult,
} from "@/features/trial/data";

const trialApplicationSchema = z.object({
  email: z.string().trim().email().max(120),
  organizationName: z.string().trim().min(2).max(80),
  role: z.enum(TRIAL_ROLE_OPTIONS),
  useCase: z.string().trim().min(10).max(800),
  locale: z.enum(supportedUiLocales).optional(),
});

export async function submitTrialApplicationAction(
  input: TrialApplicationInput,
): Promise<TrialApplicationResult> {
  const locale = resolveUiLocale(input.locale);
  const english = locale === "en-US";
  const parsed = trialApplicationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        (english
          ? "Please review the form and try again."
          : "请检查信息后重试。"),
    };
  }

  const data = parsed.data;
  const normalizedEmail = normalizeEmailAddress(data.email);
  const roleLabel = TRIAL_ROLE_LABELS[data.role];
  const submittedAt = new Date();

  let applicationId: string | null = null;
  try {
    const created = await db.trialApplication.create({
      data: {
        email: normalizedEmail,
        organizationName: data.organizationName,
        role: data.role,
        useCase: data.useCase,
        submittedLocale: locale,
        status: TrialApplicationStatus.PENDING,
      },
      select: { id: true },
    });
    applicationId = created.id;
  } catch (error) {
    console.warn("[trial-application] persist failed", error);
    // Even if persistence fails (e.g., database unreachable from a public
    // pre-registration request) we still try to deliver the notification
    // mail so the operator can follow up out-of-band.
  }

  const summaryLines = [
    `applicationId: ${applicationId ?? "n/a"}`,
    `submittedAt: ${submittedAt.toISOString()}`,
    `email: ${normalizedEmail}`,
    `organization: ${data.organizationName}`,
    `role: ${data.role} (${roleLabel.zh} / ${roleLabel.en})`,
    `useCase: ${data.useCase.replace(/\s+/g, " ").slice(0, 600)}`,
  ];

  console.info("[trial-application] received", {
    ...data,
    normalizedEmail,
    submittedAt,
    applicationId,
  });

  const recipient = getSystemMailSenderEmail();
  const subjectLine = english
    ? `[Helm trial] New application from ${normalizedEmail}`
    : `[Helm 试用申请] ${normalizedEmail}`;
  const textBody = [
    english ? "A new Helm trial application was submitted." : "收到一封新的 Helm 试用申请。",
    "",
    ...summaryLines,
  ].join("\n");

  try {
    const mailResult = await sendSystemMailIfConfigured({
      purpose: SYSTEM_MAIL_PURPOSES.TRIAL_APPLICATION_NOTIFY,
      to: recipient,
      subject: subjectLine,
      text: textBody,
    });
    return { ok: true, delivered: mailResult.sent };
  } catch (error) {
    console.warn("[trial-application] mail delivery failed", error);
    return { ok: true, delivered: false };
  }
}

const decisionInputSchema = z.object({
  applicationId: z.string().trim().min(1).max(64),
  status: z.enum([
    TrialApplicationStatus.CONTACTED,
    TrialApplicationStatus.APPROVED,
    TrialApplicationStatus.REJECTED,
  ]),
  decisionReason: z.string().trim().max(800).optional(),
});

export type TrialDecisionInput = z.infer<typeof decisionInputSchema>;

export type TrialDecisionResult =
  | { ok: true }
  | { ok: false; error: string };

function getTrialDecisionActionMessage(
  english: boolean,
  key: "reservedWorkspaceOnly" | "invalidDecisionPayload" | "applicationUpdateFailed",
) {
  const messages = {
    reservedWorkspaceOnly: {
      zh: "试用申请复核仅限 Helm reserved 工作区。",
      en: "Trial review is restricted to the Helm reserved workspace.",
    },
    invalidDecisionPayload: {
      zh: "试用申请决策参数无效。",
      en: "Invalid trial decision payload.",
    },
    applicationUpdateFailed: {
      zh: "无法更新该试用申请；它可能已被移除。",
      en: "Could not update the application. It may have been removed.",
    },
  } as const;
  const message = messages[key];
  return english ? message.en : message.zh;
}

export async function recordTrialDecisionAction(
  input: TrialDecisionInput,
): Promise<TrialDecisionResult> {
  const session = await getCurrentWorkspaceSession();
  const english = session.workspace.defaultLocale === "en-US";

  if (!isHelmReservedWorkspace(session.workspace)) {
    return {
      ok: false,
      error: getTrialDecisionActionMessage(english, "reservedWorkspaceOnly"),
    };
  }

  const parsed = decisionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: getTrialDecisionActionMessage(english, "invalidDecisionPayload"),
    };
  }

  const data = parsed.data;
  try {
    // TrialApplication is intentionally global (no workspaceId column):
    // access is restricted to the Helm reserved workspace above. Do not
    // copy this unscoped `where` for workspace-bound entities.
    await db.trialApplication.update({
      where: { id: data.applicationId },
      data: {
        status: data.status,
        decisionReason: data.decisionReason ?? null,
        decidedByUserId: session.user.id,
        decidedAt: new Date(),
        notifiedAt:
          data.status === TrialApplicationStatus.CONTACTED ? new Date() : undefined,
      },
    });
  } catch (error) {
    console.warn("[trial-application] decision update failed", error);
    return {
      ok: false,
      error: getTrialDecisionActionMessage(english, "applicationUpdateFailed"),
    };
  }

  revalidatePath("/admin/trials");
  revalidatePath(`/admin/trials/${data.applicationId}`);
  return { ok: true };
}
