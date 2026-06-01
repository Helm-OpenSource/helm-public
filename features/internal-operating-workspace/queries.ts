import "server-only";

import {
  ActionType,
  PartnerProgramStatus,
  ProgramTermsVersionStatus,
  type WorkspaceClass,
  type WorkspaceStatus,
  type WorkspaceRole,
} from "@prisma/client";
import { canReadContributionRegistry } from "@/lib/auth/commercial-governance";
import { db } from "@/lib/db";
import { buildGtmCapabilityPlanReadout } from "@/lib/gtm-capability-plan-readout";
import {
  GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_KIND,
  parseGtmCustomerDemandBriefDraftMetadata,
} from "@/lib/gtm-customer-demand-brief-draft";
import { getWorkspaceRuntimeOperatorOverview } from "@/lib/helm-v2/runtime-upgrade";
import { getInternalCommercializationLifecycleReadout } from "@/lib/internal-commercialization/runtime";
import { safeParseJson } from "@/lib/utils";
import {
  buildInternalOperatingHomeModel,
  buildInternalRoleSurfaceModel,
  type InternalOperatingRole,
} from "@/lib/internal-operating-workspace";
import { isOperationalHelmReservedWorkspace } from "@/lib/workspace-reserved";

export async function getInternalOperatingWorkspaceData(
  workspaceId: string,
  english: boolean,
  options?: {
    workspace?: {
      status?: WorkspaceStatus | null;
      workspaceClass?: WorkspaceClass | null;
      systemKey?: string | null;
    } | null;
    membershipRole?: WorkspaceRole | null;
  },
) {
  const gtmReadable =
    isOperationalHelmReservedWorkspace(options?.workspace) &&
    canReadContributionRegistry(options?.membershipRole);

  const [
    opportunities,
    approvals,
    audits,
    gtmSource,
    internalCommercializationLifecycleReadout,
  ] = await Promise.all([
    db.opportunity.findMany({
      where: {
        workspaceId,
      },
      include: {
        company: true,
        owner: true,
        contacts: {
          orderBy: { updatedAt: "desc" },
          take: 3,
        },
        meetings: {
          include: {
            note: true,
          },
          orderBy: { startsAt: "desc" },
          take: 3,
        },
        actionItems: {
          include: {
            approvalTask: true,
          },
          orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
          take: 4,
        },
        memoryEntries: {
          where: {
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
      take: 18,
    }),
    db.approvalTask.findMany({
      where: {
        workspaceId,
      },
      include: {
        actionItem: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 12,
    }),
    db.auditLog.findMany({
      where: {
        workspaceId,
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    gtmReadable
      ? getReservedGtmCapabilityPlanSource(workspaceId)
      : Promise.resolve(null),
    gtmReadable
      ? getInternalCommercializationLifecycleReadout(workspaceId, english)
      : Promise.resolve(null),
  ]);

  return buildInternalOperatingHomeModel({
    opportunities,
    approvals,
    audits,
    gtmCapabilityPlanReadout: gtmSource
      ? buildGtmCapabilityPlanReadout({
          english,
          programs: gtmSource.programs,
          applications: gtmSource.applications,
          salesReferrals: gtmSource.salesReferrals,
          demandBriefDrafts: gtmSource.demandBriefDrafts,
        })
      : null,
    internalCommercializationLifecycleReadout,
    english,
  });
}

async function getReservedGtmCapabilityPlanSource(workspaceId: string) {
  const [programs, applications, salesReferrals, demandBriefDrafts] = await Promise.all([
    db.partnerProgram.findMany({
      where: {
        workspaceId,
        status: {
          in: [PartnerProgramStatus.ACTIVE, PartnerProgramStatus.PAUSED],
        },
      },
      include: {
        termsVersions: {
          where: { status: ProgramTermsVersionStatus.ACTIVE },
          orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
        applications: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.programApplication.findMany({
      where: { workspaceId },
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
      },
      orderBy: [{ createdAt: "desc" }],
      take: 12,
    }),
    db.salesReferral.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "desc" }],
      take: 8,
    }),
    db.actionItem.findMany({
      where: {
        workspaceId,
        actionType: ActionType.DRAFT_INTERNAL_NOTE,
        sourceId: {
          startsWith: "gtm-customer-demand-brief:",
        },
        metadata: {
          contains: `"kind": "${GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_KIND}"`,
        },
      },
      include: {
        approvalTask: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 8,
    }),
  ]);

  return {
    programs: programs.map((program) => ({
      id: program.id,
      title: program.title,
      slug: program.slug,
      status: program.status,
      applicationCount: program.applications.length,
      activeTermsVersion: program.termsVersions[0]
        ? { id: program.termsVersions[0].id }
        : null,
    })),
    applications: applications.map((application) => ({
      id: application.id,
      applicantName: application.applicantName,
      applicantOrganization: application.applicantOrganization,
      status: application.status,
      createdAt: application.createdAt,
      partnerProgram: application.partnerProgram,
      participantPortalAccess: application.participantPortalAccess,
    })),
    salesReferrals: salesReferrals.map((referral) => ({
      id: referral.id,
      beneficiaryLabel: referral.beneficiaryLabel,
      status: referral.status,
      createdAt: referral.createdAt,
    })),
    demandBriefDrafts: demandBriefDrafts.map((draft) => ({
      id: draft.id,
      title: draft.title,
      status: draft.status,
      createdAt: draft.createdAt,
      approvalTask: draft.approvalTask
        ? {
            id: draft.approvalTask.id,
            status: draft.approvalTask.status,
          }
        : null,
      metadata: parseGtmCustomerDemandBriefDraftMetadata(draft.metadata),
    })),
  };
}

export async function getInternalOperatingRuntimeOverview(workspaceId: string) {
  return getWorkspaceRuntimeOperatorOverview(workspaceId);
}

export async function getDingTalkWorkflowHealth(workspaceId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const [signals, actions, pendingApprovals, overdueActionCount, recentSignals] =
    await Promise.all([
    db.connectorIngestionRecord.count({
      where: {
        workspaceId,
        sourceScope: { startsWith: "OBJECT:" },
        createdAt: { gte: since },
      },
    }),
    db.actionItem.count({
      where: {
        workspaceId,
        metadata: { contains: "\"sourceProvider\":\"DINGTALK_MCP\"" },
        createdAt: { gte: since },
      },
    }),
    db.approvalTask.count({
      where: {
        workspaceId,
        status: "PENDING",
        actionItem: {
          metadata: { contains: "\"sourceProvider\":\"DINGTALK_MCP\"" },
        },
        createdAt: { gte: since },
      },
    }),
    db.actionItem.count({
      where: {
        workspaceId,
        metadata: { contains: "\"sourceProvider\":\"DINGTALK_MCP\"" },
        dueDate: { lt: new Date() },
        status: {
          in: ["SUGGESTED", "PENDING_APPROVAL", "APPROVED", "MANUAL", "BLOCKED"],
        },
      },
    }),
    db.connectorIngestionRecord.findMany({
      where: {
        workspaceId,
        sourceScope: { startsWith: "OBJECT:" },
        createdAt: { gte: since },
      },
      select: {
        sourceScope: true,
        draftPayload: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const byDomain = recentSignals.reduce<Record<string, number>>((acc, item) => {
    const payload = safeParseJson<Record<string, unknown> | null>(item.draftPayload, null);
    const classification =
      payload && typeof payload.classification === "object"
        ? (payload.classification as Record<string, unknown>)
        : null;
    const domain =
      classification && typeof classification.businessDomain === "string"
        ? classification.businessDomain
        : "unknown";
    acc[domain] = (acc[domain] ?? 0) + 1;
    return acc;
  }, {});
  const byDepartment = recentSignals.reduce<Record<string, number>>((acc, item) => {
    const payload = safeParseJson<Record<string, unknown> | null>(
      item.draftPayload,
      null,
    );
    const upstreamPayload =
      payload && typeof payload.payload === "object" && payload.payload
        ? (payload.payload as Record<string, unknown>)
        : null;
    const dept =
      (typeof upstreamPayload?.dept_name === "string" && upstreamPayload.dept_name.trim()) ||
      (typeof upstreamPayload?.deptName === "string" && upstreamPayload.deptName.trim()) ||
      (typeof upstreamPayload?.department_name === "string" &&
        upstreamPayload.department_name.trim()) ||
      (typeof upstreamPayload?.departmentName === "string" &&
        upstreamPayload.departmentName.trim()) ||
      "unknown";
    acc[dept] = (acc[dept] ?? 0) + 1;
    return acc;
  }, {});

  return {
    windowDays: 7,
    linkedSignalCount: signals,
    convertedActionCount: actions,
    pendingApprovalCount: pendingApprovals,
    overdueActionCount,
    byDomain,
    byDepartment,
  };
}

export async function getInternalOperatingRoleData(
  workspaceId: string,
  role: InternalOperatingRole,
  english: boolean,
) {
  const [opportunities, approvals, audits] = await Promise.all([
    db.opportunity.findMany({
      where: {
        workspaceId,
      },
      include: {
        company: true,
        owner: true,
        contacts: {
          orderBy: { updatedAt: "desc" },
          take: 3,
        },
        meetings: {
          include: {
            note: true,
          },
          orderBy: { startsAt: "desc" },
          take: 3,
        },
        actionItems: {
          include: {
            approvalTask: true,
          },
          orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
          take: 4,
        },
        memoryEntries: {
          where: {
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
      take: 18,
    }),
    db.approvalTask.findMany({
      where: {
        workspaceId,
      },
      include: {
        actionItem: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 12,
    }),
    db.auditLog.findMany({
      where: {
        workspaceId,
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  return buildInternalRoleSurfaceModel(role, {
    opportunities,
    approvals,
    audits,
    english,
  });
}
