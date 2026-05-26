"use server";

import {
  ActionExecutionMode,
  ActionStatus,
  ActionType,
  ActorType,
  ApprovalStatus,
  RiskLevel,
  SourceType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  canManageProgramApplications,
  getProgramApplicationManagementDeniedMessage,
} from "@/lib/auth/commercial-governance";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  buildGtmCustomerDemandBriefDraft,
  GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_KIND,
} from "@/lib/gtm-customer-demand-brief-draft";
import { jsonStringify } from "@/lib/utils";
import {
  getHelmReservedWorkspaceDeniedMessage,
  isOperationalHelmReservedWorkspace,
} from "@/lib/workspace-reserved";

const createDemandBriefDraftSchema = z.object({
  applicationId: z.string().min(1),
});

const openDraftStatuses = [
  ActionStatus.PENDING_APPROVAL,
  ActionStatus.APPROVED,
  ActionStatus.SUGGESTED,
  ActionStatus.MANUAL,
  ActionStatus.BLOCKED,
] as const;

function redirectToDraftFlow(status: "created" | "existing" | "denied" | "invalid"): never {
  redirect(`/operating?gtmBriefDraft=${status}#gtm-demand-brief-draft`);
}

export async function createGtmCustomerDemandBriefDraftAction(formData: FormData) {
  const parsed = createDemandBriefDraftSchema.safeParse({
    applicationId: formData.get("applicationId"),
  });
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!parsed.success) {
    redirectToDraftFlow("invalid");
  }

  if (!isOperationalHelmReservedWorkspace(workspace)) {
    throw new Error(getHelmReservedWorkspaceDeniedMessage(english, "program_applications"));
  }

  if (!canManageProgramApplications(membership.role)) {
    throw new Error(getProgramApplicationManagementDeniedMessage(english));
  }

  const application = await db.programApplication.findFirst({
    where: {
      id: parsed.data.applicationId,
      workspaceId: workspace.id,
    },
    include: {
      partnerProgram: {
        select: {
          title: true,
          slug: true,
        },
      },
      participantPortalAccess: {
        select: {
          id: true,
        },
      },
      salesReferral: {
        select: {
          id: true,
          beneficiaryLabel: true,
        },
      },
    },
  });

  if (!application) {
    redirectToDraftFlow("invalid");
  }

  const sourceId = `gtm-customer-demand-brief:${application.id}`;
  const existingDraft = await db.actionItem.findFirst({
    where: {
      workspaceId: workspace.id,
      actionType: ActionType.DRAFT_INTERNAL_NOTE,
      sourceId,
      status: {
        in: [...openDraftStatuses],
      },
      metadata: {
        contains: `"kind": "${GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_KIND}"`,
      },
    },
    select: {
      id: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (existingDraft) {
    revalidatePath("/operating");
    redirectToDraftFlow("existing");
  }

  const spec = buildGtmCustomerDemandBriefDraft({
    application,
    english,
    requestedBy: user.name,
  });

  const created = await db.$transaction(async (tx) => {
    const actionItem = await tx.actionItem.create({
      data: {
        workspaceId: workspace.id,
        ownerId: user.id,
        actionType: ActionType.DRAFT_INTERNAL_NOTE,
        title: spec.title,
        description: spec.description,
        aiReason: spec.aiReason,
        draftContent: spec.draftContent,
        metadata: jsonStringify(spec.metadata),
        sourceType: SourceType.SYSTEM_INFERENCE,
        sourceId,
        riskLevel: RiskLevel.MEDIUM,
        executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
        requiresApproval: true,
        status: ActionStatus.PENDING_APPROVAL,
        executionStatus: "gtm_customer_demand_brief_pending_review",
        statusReason:
          "CustomerDemandBrief draft candidate requires reserved internal review before any trial initialization candidate.",
      },
    });

    const approvalTask = await tx.approvalTask.create({
      data: {
        workspaceId: workspace.id,
        actionItemId: actionItem.id,
        status: ApprovalStatus.PENDING,
        isHighRisk: false,
        autoExecute: false,
        contextSnapshot: spec.description,
        reasoning: spec.approvalReasoning,
        editableContent: spec.draftContent,
        resultPreview: spec.resultPreview,
        decisionReason:
          "Review-gated internal demand brief candidate; no workspace creation, customer send, customer-system write or trial initialization happens here.",
        channel: spec.approvalChannel,
      },
    });

    return {
      actionItem,
      approvalTask,
    };
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_CREATED",
    targetType: "ActionItem",
    targetId: created.actionItem.id,
    relatedObjectType: "ProgramApplication",
    relatedObjectId: application.id,
    sourcePage: "/operating",
    summary: english
      ? `Created CustomerDemandBrief draft candidate for ${application.applicantName}`
      : `已为 ${application.applicantName} 创建 CustomerDemandBrief 草稿候选`,
    payload: {
      applicationId: application.id,
      approvalTaskId: created.approvalTask.id,
      kind: GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_KIND,
      boundary: spec.metadata.boundary,
    },
  });

  revalidatePath("/operating");
  revalidatePath("/approvals");
  redirectToDraftFlow("created");
}
