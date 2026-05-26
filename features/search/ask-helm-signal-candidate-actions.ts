"use server";

import { randomUUID } from "node:crypto";
import { ActorType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  ASK_HELM_SIGNAL_CANDIDATE_ACTION_TYPE,
  ASK_HELM_SIGNAL_CANDIDATE_TARGET_TYPE,
  AskHelmSignalCandidateError,
  buildAskHelmSignalCandidatePayload,
  normalizeAskHelmSignalRelatedObjectType,
  type AskHelmSignalRelatedObjectType,
} from "@/features/search/ask-helm-signal-candidate";

export type SubmitAskHelmSignalCandidateInput = {
  summary: string;
  signalType?: string | null;
  urgency?: string | null;
  evidenceNote?: string | null;
  sourceQuery?: string | null;
  sourcePage?: string | null;
  relatedObjectType?: string | null;
  relatedObjectId?: string | null;
};

export type SubmitAskHelmSignalCandidateResult =
  | {
      ok: true;
      candidateId: string;
      signalType: string;
      urgency: string;
      reviewPosture: "review_required";
    }
  | { ok: false; error: string; errorCode: string };

async function relatedObjectBelongsToWorkspace(
  workspaceId: string,
  type: AskHelmSignalRelatedObjectType,
  id: string,
): Promise<boolean> {
  const where = { id, workspaceId } as const;
  switch (type) {
    case "contact":
      return Boolean(await db.contact.findFirst({ where, select: { id: true } }));
    case "company":
      return Boolean(await db.company.findFirst({ where, select: { id: true } }));
    case "opportunity":
      return Boolean(
        await db.opportunity.findFirst({ where, select: { id: true } }),
      );
    case "meeting":
      return Boolean(await db.meeting.findFirst({ where, select: { id: true } }));
  }
}

function describeError(code: string, english: boolean): string {
  switch (code) {
    case "empty_summary":
      return english
        ? "Please describe the signal before submitting."
        : "请先填写要上报的经营信号内容。";
    default:
      return english
        ? "Unable to submit signal candidate right now."
        : "暂时无法提交经营信号候选，请稍后再试。";
  }
}

export async function submitAskHelmSignalCandidateAction(
  input: SubmitAskHelmSignalCandidateInput,
): Promise<SubmitAskHelmSignalCandidateResult> {
  const session = await getCurrentWorkspaceSession();
  const { user, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  const hasRelatedType =
    typeof input.relatedObjectType === "string" && input.relatedObjectType !== "";
  const hasRelatedId =
    typeof input.relatedObjectId === "string" && input.relatedObjectId !== "";

  let relatedObjectArg:
    | { type: string; id: string }
    | undefined;

  if (hasRelatedType && hasRelatedId) {
    const resolvedRelatedType = normalizeAskHelmSignalRelatedObjectType(
      input.relatedObjectType,
    );
    const resolvedRelatedId = String(input.relatedObjectId).trim();
    if (resolvedRelatedType && resolvedRelatedId) {
      const belongs = await relatedObjectBelongsToWorkspace(
        workspace.id,
        resolvedRelatedType,
        resolvedRelatedId,
      );
      if (belongs) {
        relatedObjectArg = { type: resolvedRelatedType, id: resolvedRelatedId };
      }
    }
  }

  let payload;
  try {
    payload = buildAskHelmSignalCandidatePayload({
      workspaceId: workspace.id,
      createdByUserId: user.id,
      sourceQuery: input.sourceQuery ?? null,
      summary: input.summary,
      signalType: input.signalType ?? null,
      urgency: input.urgency ?? null,
      evidenceNote: input.evidenceNote ?? null,
      relatedObject: relatedObjectArg,
    });
  } catch (error) {
    if (error instanceof AskHelmSignalCandidateError) {
      return {
        ok: false,
        errorCode: error.code,
        error: describeError(error.code, english),
      };
    }
    throw error;
  }

  const candidateId = `askhelm_sig_${randomUUID()}`;
  const summary = `Ask Helm signal candidate · [${payload.signalType}/${payload.urgency}] ${payload.summary}`.slice(
    0,
    240,
  );

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: ASK_HELM_SIGNAL_CANDIDATE_ACTION_TYPE,
    targetType: ASK_HELM_SIGNAL_CANDIDATE_TARGET_TYPE,
    targetId: candidateId,
    summary,
    payload,
    sourcePage: input.sourcePage ?? "/search",
    relatedObjectType: payload.relatedObject?.type ?? null,
    relatedObjectId: payload.relatedObject?.id ?? null,
  });

  revalidatePath("/search");

  return {
    ok: true,
    candidateId,
    signalType: payload.signalType,
    urgency: payload.urgency,
    reviewPosture: "review_required",
  };
}

function readFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function buildAskHelmRedirectUrl(params: {
  sourceQuery: string;
  signalSubmitted?: boolean;
  signalError?: string;
}) {
  const query = new URLSearchParams();
  query.set("mode", "ask");
  if (params.sourceQuery.trim()) query.set("q", params.sourceQuery.trim());
  if (params.signalSubmitted) query.set("signalSubmitted", "true");
  if (params.signalError) query.set("signalError", params.signalError);
  return `/search?${query.toString()}`;
}

export async function submitAskHelmSignalCandidateFormAction(
  formData: FormData,
) {
  const sourceQuery = readFormText(formData, "sourceQuery");
  const result = await submitAskHelmSignalCandidateAction({
    summary: readFormText(formData, "summary"),
    signalType: readFormText(formData, "signalType"),
    urgency: readFormText(formData, "urgency"),
    evidenceNote: readFormText(formData, "evidenceNote"),
    sourceQuery,
    sourcePage: "/search?mode=ask",
    relatedObjectType: readFormText(formData, "relatedObjectType"),
    relatedObjectId: readFormText(formData, "relatedObjectId"),
  });

  if (!result.ok) {
    redirect(
      buildAskHelmRedirectUrl({
        sourceQuery,
        signalError: result.errorCode,
      }),
    );
  }

  redirect(
    buildAskHelmRedirectUrl({
      sourceQuery,
      signalSubmitted: true,
    }),
  );
}
