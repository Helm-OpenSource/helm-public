import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ActorType, ConnectorProvider, ObjectType, PrismaClient, RecordSource } from "@prisma/client";
import {
  getApprovalTasksData,
  getCompanyDetailData,
  getCustomerSuccessQueueData,
  getOpportunityCommercialDetailData,
} from "@/data/queries";
import { buildCompanyConversationChainExtensionModel } from "@/features/conversation-chain-extension/detail-model";
import { buildCustomerSuccessHandoffPageModel } from "@/features/customer-success-handoff/detail-model";
import { buildCustomerSuccessQueueSurfaceModel } from "@/features/customer-success-handoff/queue-model";
import { buildExpansionReviewDetailPageModel } from "@/features/expansion-review/detail-model";
import { buildReviewRequestDetailPageModel } from "@/features/inbox-followup-review-request/detail-model";
import { buildSuccessCheckDetailPageModel } from "@/features/success-check/detail-model";
import { DEFAULT_MYSQL_DATABASE_URL } from "@/lib/db-url";
import { runMemoryGoldenEval } from "@/lib/evals/memory-evals";
import { runRecommendationGoldenEval } from "@/lib/evals/recommendation-evals";
import { getLocalizedStageLabels } from "@/lib/i18n/labels";
import { generateRecommendationsForObject } from "@/lib/recommendations/recommendation.service";

type EvalResult = {
  name: string;
  ok: boolean;
  detail: string;
};

const root = process.cwd();

function parseEnvFile(relativePath: string) {
  const fullPath = path.join(root, relativePath);
  if (!existsSync(fullPath)) {
    return {};
  }

  const content = readFileSync(fullPath, "utf8");
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        const rawValue = rest.join("=").trim();
        return [key.trim(), rawValue.replace(/^"(.*)"$/, "$1")];
      }),
  );
}

if (!process.env.DATABASE_URL) {
  const merged = {
    ...parseEnvFile(".env.example"),
    ...parseEnvFile(".env"),
  };

  process.env.DATABASE_URL = String(merged.DATABASE_URL || DEFAULT_MYSQL_DATABASE_URL);
}

const prisma = new PrismaClient(
  process.env.DATABASE_URL
    ? {
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      }
    : undefined,
);

function record(name: string, ok: boolean, detail: string): EvalResult {
  return { name, ok, detail };
}

function extractCustomerSuccessIds(payload: unknown) {
  const matches =
    JSON.stringify(payload).match(/\/customer-success\/([A-Za-z0-9_-]+)/g) ?? [];
  return Array.from(
    new Set(
      matches
        .map((match) => match.split("/").at(-1) ?? "")
        .filter(Boolean),
    ),
  );
}

type DemoWorkspaceEvalContext = {
  id: string;
  slug: string;
  defaultLocale: string;
};

type OpportunitySurfaceContext = {
  detail: NonNullable<Awaited<ReturnType<typeof getOpportunityCommercialDetailData>>>;
  company: Awaited<ReturnType<typeof getCompanyDetailData>>;
  reviewTasks: Awaited<ReturnType<typeof getApprovalTasksData>>;
  stageLabel: string;
};

async function collectSharedAgentRouteHealth(
  workspaces: DemoWorkspaceEvalContext[],
) {
  const opportunityContextCache = new Map<
    string,
    Promise<OpportunitySurfaceContext | null>
  >();

  async function getOpportunityContext(
    workspace: DemoWorkspaceEvalContext,
    opportunityId: string,
    approvalTasks: Awaited<ReturnType<typeof getApprovalTasksData>>,
    stageLabels: Awaited<ReturnType<typeof getLocalizedStageLabels>>,
  ) {
    const cacheKey = `${workspace.id}:${opportunityId}`;
    const cached = opportunityContextCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const promise = (async () => {
      const detail = await getOpportunityCommercialDetailData(
        workspace.id,
        opportunityId,
      );
      if (!detail) {
        return null;
      }

      const company = detail.company
        ? await getCompanyDetailData(workspace.id, detail.company.id)
        : null;

      return {
        detail,
        company,
        reviewTasks: approvalTasks.filter(
          (task) => task.actionItem.opportunity?.id === detail.id,
        ),
        stageLabel: stageLabels[detail.stage],
      };
    })();

    opportunityContextCache.set(cacheKey, promise);
    return promise;
  }

  async function canBuildCustomerSuccessTarget(
    workspace: DemoWorkspaceEvalContext,
    opportunityId: string,
    approvalTasks: Awaited<ReturnType<typeof getApprovalTasksData>>,
    stageLabels: Awaited<ReturnType<typeof getLocalizedStageLabels>>,
  ) {
    const context = await getOpportunityContext(
      workspace,
      opportunityId,
      approvalTasks,
      stageLabels,
    );
    if (!context) {
      return false;
    }

    try {
      buildCustomerSuccessHandoffPageModel({
        detail: context.detail,
        company: context.company,
        reviewTasks: context.reviewTasks,
        stageLabel: context.stageLabel,
        english: workspace.defaultLocale === "en-US",
      });
      return true;
    } catch {
      return false;
    }
  }

  const detailHealth: string[] = [];
  const queueHealth: string[] = [];
  const handoffHealth: string[] = [];
  let detailOk = true;
  let queueOk = true;
  let handoffOk = true;

  for (const workspace of workspaces) {
    const english = workspace.defaultLocale === "en-US";
    const locale = english ? "en-US" : "zh-CN";
    const [stageLabels, approvalTasks, activeOpportunities, queueData, companies] =
      await Promise.all([
        getLocalizedStageLabels(locale),
        getApprovalTasksData(workspace.id),
        prisma.opportunity.findMany({
          where: {
            workspaceId: workspace.id,
            stage: {
              notIn: ["DONE", "LOST"],
            },
          },
          select: {
            id: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
        }),
        getCustomerSuccessQueueData(workspace.id),
        prisma.company.findMany({
          where: {
            workspaceId: workspace.id,
          },
          select: {
            id: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
        }),
      ]);

    let builtCustomerSuccessDetails = 0;
    for (const opportunity of activeOpportunities) {
      if (
        await canBuildCustomerSuccessTarget(
          workspace,
          opportunity.id,
          approvalTasks,
          stageLabels,
        )
      ) {
        builtCustomerSuccessDetails += 1;
      }
    }

    detailHealth.push(
      `${workspace.slug}:customerSuccess=${builtCustomerSuccessDetails}/${activeOpportunities.length}`,
    );
    detailOk = detailOk && builtCustomerSuccessDetails === activeOpportunities.length;

    try {
      const queueModel = buildCustomerSuccessQueueSurfaceModel({
        queueDetails: queueData.queueDetails.map((entry) => ({
          ...entry,
          stageLabel: stageLabels[entry.detail.stage],
        })),
        successInboxThreads: queueData.successInboxThreads,
        english,
      });
      const queueTargetIds = extractCustomerSuccessIds(queueModel);
      const queueTargetResults = await Promise.all(
        queueTargetIds.map((opportunityId) =>
          canBuildCustomerSuccessTarget(
            workspace,
            opportunityId,
            approvalTasks,
            stageLabels,
          ),
        ),
      );
      queueHealth.push(
        `${workspace.slug}:queue=${queueData.queueDetails.length}/${queueData.queueDetails.length}:targets=${queueTargetResults.filter(Boolean).length}/${queueTargetIds.length || queueData.queueDetails.length}`,
      );
      queueOk = queueOk && queueTargetResults.every(Boolean);
    } catch {
      queueHealth.push(`${workspace.slug}:queue=0/${queueData.queueDetails.length}`);
      queueOk = false;
    }

    const handoffStats = new Map<
      string,
      { total: number; linked: number; healthy: number }
    >([
      ["reviewRequests", { total: 0, linked: 0, healthy: 0 }],
      ["successChecks", { total: 0, linked: 0, healthy: 0 }],
      ["expansionReviews", { total: 0, linked: 0, healthy: 0 }],
      ["companies", { total: 0, linked: 0, healthy: 0 }],
    ]);

    for (const task of approvalTasks) {
      const stats = handoffStats.get("reviewRequests");
      if (!stats) continue;
      stats.total += 1;
      const targetIds = extractCustomerSuccessIds(
        buildReviewRequestDetailPageModel({
          task,
          english,
        }),
      );
      if (!targetIds.length) continue;
      stats.linked += 1;
      const targetResults = await Promise.all(
        targetIds.map((opportunityId) =>
          canBuildCustomerSuccessTarget(
            workspace,
            opportunityId,
            approvalTasks,
            stageLabels,
          ),
        ),
      );
      if (targetResults.every(Boolean)) {
        stats.healthy += 1;
      }
    }

    for (const opportunity of activeOpportunities) {
      const context = await getOpportunityContext(
        workspace,
        opportunity.id,
        approvalTasks,
        stageLabels,
      );
      if (!context) {
        continue;
      }

      for (const [label, payload] of [
        [
          "successChecks",
          buildSuccessCheckDetailPageModel({
            detail: context.detail,
            company: context.company,
            reviewTasks: context.reviewTasks,
            stageLabel: context.stageLabel,
            english,
          }),
        ],
        [
          "expansionReviews",
          buildExpansionReviewDetailPageModel({
            detail: context.detail,
            company: context.company,
            reviewTasks: context.reviewTasks,
            stageLabel: context.stageLabel,
            english,
          }),
        ],
      ] as const) {
        const stats = handoffStats.get(label);
        if (!stats) continue;
        stats.total += 1;
        const targetIds = extractCustomerSuccessIds(payload);
        if (!targetIds.length) continue;
        stats.linked += 1;
        const targetResults = await Promise.all(
          targetIds.map((opportunityId) =>
            canBuildCustomerSuccessTarget(
              workspace,
              opportunityId,
              approvalTasks,
              stageLabels,
            ),
          ),
        );
        if (targetResults.every(Boolean)) {
          stats.healthy += 1;
        }
      }
    }

    for (const companyRef of companies) {
      const stats = handoffStats.get("companies");
      if (!stats) continue;
      stats.total += 1;

      const company = await getCompanyDetailData(workspace.id, companyRef.id);
      if (!company) {
        continue;
      }

      const companyOpportunityIds = new Set(
        company.opportunities.map((item) => item.id),
      );
      const pendingReviewRequest =
        approvalTasks.find(
          (task) =>
            task.status === "PENDING" &&
            task.actionItem.opportunity?.id &&
            companyOpportunityIds.has(task.actionItem.opportunity.id),
        ) ?? null;
      const customerSuccessOpportunityId = company.opportunities[0]?.id ?? null;
      const targetIds = extractCustomerSuccessIds(
        buildCompanyConversationChainExtensionModel({
          company,
          english,
          stageLabels,
          pendingReviewRequestId: pendingReviewRequest?.id ?? null,
          customerSuccessOpportunityId,
        }),
      );
      if (!targetIds.length) {
        continue;
      }
      stats.linked += 1;
      const targetResults = await Promise.all(
        targetIds.map((opportunityId) =>
          canBuildCustomerSuccessTarget(
            workspace,
            opportunityId,
            approvalTasks,
            stageLabels,
          ),
        ),
      );
      if (targetResults.every(Boolean)) {
        stats.healthy += 1;
      }
    }

    const summary = Array.from(handoffStats.entries())
      .map(
        ([label, stats]) =>
          `${label}=${stats.healthy}/${stats.linked || stats.total}`,
      )
      .join(" | ");
    handoffHealth.push(`${workspace.slug}:${summary}`);
    handoffOk =
      handoffOk &&
      Array.from(handoffStats.values()).every(
        (stats) => stats.linked === 0 || stats.healthy === stats.linked,
      );
  }

  return {
    detailOk,
    detailDetail: detailHealth.join(" | "),
    queueOk,
    queueDetail: queueHealth.join(" | "),
    handoffOk,
    handoffDetail: handoffHealth.join(" | "),
  };
}

async function main() {
  const results: EvalResult[] = [];

  const [recommendationGoldenSummary, memoryGoldenSummary] = await Promise.all([
    runRecommendationGoldenEval(prisma),
    runMemoryGoldenEval(prisma),
  ]);

  results.push(
    record(
      "recommendation_golden_eval",
      recommendationGoldenSummary.passedCases === recommendationGoldenSummary.totalCases,
      `passed=${recommendationGoldenSummary.passedCases}/${recommendationGoldenSummary.totalCases} | rate=${recommendationGoldenSummary.passRate}%`,
    ),
  );

  results.push(
    record(
      "memory_golden_eval",
      memoryGoldenSummary.passedCases === memoryGoldenSummary.totalCases,
      `passed=${memoryGoldenSummary.passedCases}/${memoryGoldenSummary.totalCases} | facts=${memoryGoldenSummary.factHitRate}% | commitments=${memoryGoldenSummary.commitmentHitRate}% | blockers=${memoryGoldenSummary.blockerHitRate}%`,
    ),
  );

  const [
    memoryFacts,
    commitments,
    blockers,
    recommendations,
    feedbacks,
    patternFacts,
    strategySuggestions,
    captureSessions,
    transcripts,
    insights,
    captureEvents,
    llmLogs,
    importSources,
    importJobs,
    identityMatches,
    workspaceOps,
    demoWorkspaces,
    demoUsers,
  ] = await Promise.all([
    prisma.memoryFact.count(),
    prisma.commitment.count(),
    prisma.blocker.count(),
    prisma.recommendationLog.count(),
    prisma.recommendationFeedback.count(),
    prisma.patternFact.count(),
    prisma.strategySuggestion.count(),
    prisma.captureSession.count(),
    prisma.conversationTranscript.count(),
    prisma.conversationInsight.count(),
    prisma.eventLog.findMany({
      where: {
        eventCategory: "conversation_capture",
      },
      select: {
        eventName: true,
      },
    }),
    prisma.lLMCallLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
      select: {
        taskType: true,
        promptKey: true,
        promptVersion: true,
        modelRole: true,
        modelVersion: true,
        fallbackReason: true,
      },
    }),
    prisma.importSource.findMany({
      where: {
        sourceType: {
          in: ["HUBSPOT", "SALESFORCE"],
        },
      },
      select: {
        sourceType: true,
        status: true,
        externalAccountLabel: true,
      },
    }),
    prisma.importJob.findMany({
      where: {
        source: {
          sourceType: {
            in: ["HUBSPOT", "SALESFORCE"],
          },
        },
      },
      select: {
        id: true,
        status: true,
        successRecords: true,
        warningRecords: true,
        summaryJson: true,
        source: {
          select: {
            sourceType: true,
          },
        },
      },
      orderBy: {
        startedAt: "desc",
      },
    }),
    prisma.identityMatch.findMany({
      where: {
        source: {
          sourceType: {
            in: ["HUBSPOT", "SALESFORCE"],
          },
        },
      },
      select: {
        status: true,
      },
    }),
    prisma.workspace.findFirst({
      select: {
        defaultLocale: true,
        pilotMode: true,
        dataRetentionDays: true,
        captureConsentRequired: true,
        featureFlagsJson: true,
      },
    }),
    prisma.workspace.findMany({
      where: {
        slug: {
          in: ["helm-founder-demo", "helm-sales-demo", "helm-recruiter-demo"],
        },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        profileType: true,
        defaultLocale: true,
        memberships: {
          select: {
            role: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        companies: {
          select: {
            id: true,
          },
        },
        contacts: {
          select: {
            id: true,
          },
        },
        opportunities: {
          select: {
            id: true,
          },
        },
        meetings: {
          select: {
            id: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        email: {
          in: ["founder@demo.com", "saleslead@demo.com", "recruiter@demo.com"],
        },
      },
      select: {
        email: true,
        memberships: {
          select: {
            workspace: {
              select: {
                slug: true,
              },
            },
          },
        },
      },
    }),
  ]);

  results.push(record("memory_counts", memoryFacts > 0 && commitments > 0 && blockers > 0, `facts=${memoryFacts}, commitments=${commitments}, blockers=${blockers}`));
  results.push(record("recommendation_counts", recommendations > 0 && feedbacks > 0, `recommendations=${recommendations}, feedbacks=${feedbacks}`));
  results.push(record("evolution_counts", patternFacts > 0 && strategySuggestions > 0, `patternFacts=${patternFacts}, strategySuggestions=${strategySuggestions}`));
  results.push(record("capture_counts", captureSessions > 0 && transcripts > 0 && insights > 0, `sessions=${captureSessions}, transcripts=${transcripts}, insights=${insights}`));
  results.push(
    record(
      "demo_workspace_modes",
      demoWorkspaces.length === 3 &&
        demoWorkspaces.every(
          (workspace) =>
            workspace.companies.length > 0 &&
            workspace.contacts.length > 0 &&
            workspace.opportunities.length > 0 &&
            workspace.meetings.length > 0,
        ),
      demoWorkspaces
        .map(
          (workspace) =>
            `${workspace.slug}:members=${workspace.memberships.length}:companies=${workspace.companies.length}:contacts=${workspace.contacts.length}:opps=${workspace.opportunities.length}:meetings=${workspace.meetings.length}`,
        )
        .join(" | "),
    ),
  );
  results.push(
    record(
      "demo_account_workspace_binding",
      demoUsers.length === 3 &&
        demoUsers.every((user) => user.memberships.length === 1) &&
        demoUsers.some((user) => user.email === "founder@demo.com" && user.memberships[0]?.workspace.slug === "helm-founder-demo") &&
        demoUsers.some((user) => user.email === "saleslead@demo.com" && user.memberships[0]?.workspace.slug === "helm-sales-demo") &&
        demoUsers.some((user) => user.email === "recruiter@demo.com" && user.memberships[0]?.workspace.slug === "helm-recruiter-demo"),
      demoUsers
        .map((user) => `${user.email}->${user.memberships.map((membership) => membership.workspace.slug).join(",")}`)
        .join(" | "),
    ),
  );

  const sharedAgentRouteHealth = await collectSharedAgentRouteHealth(
    demoWorkspaces.map((workspace) => ({
      id: workspace.id,
      slug: workspace.slug,
      defaultLocale: workspace.defaultLocale,
    })),
  );

  results.push(
    record(
      "shared_agent_route_model_health",
      sharedAgentRouteHealth.detailOk && sharedAgentRouteHealth.queueOk,
      `${sharedAgentRouteHealth.detailDetail} | ${sharedAgentRouteHealth.queueDetail}`,
    ),
  );
  results.push(
    record(
      "shared_agent_cross_surface_handoff_health",
      sharedAgentRouteHealth.handoffOk,
      sharedAgentRouteHealth.handoffDetail,
    ),
  );

  const [overdueCommitmentCount, resolvedBlockerCount] = await Promise.all([
    prisma.commitment.count({
      where: {
        overdueFlag: true,
      },
    }),
    prisma.blocker.count({
      where: {
        status: "RESOLVED",
      },
    }),
  ]);

  results.push(
    record(
      "lifecycle_seed_signals",
      overdueCommitmentCount > 0 && resolvedBlockerCount > 0,
      `overdueCommitments=${overdueCommitmentCount}, resolvedBlockers=${resolvedBlockerCount}`,
    ),
  );

  const [gmailConnector, externalThreadCount, importedMemorySignals] = await Promise.all([
    prisma.connector.findFirst({
      where: {
        provider: ConnectorProvider.GMAIL,
        status: "CONNECTED",
      },
      select: {
        externalAccountEmail: true,
        lastSyncStatus: true,
      },
    }),
    prisma.emailThread.count({
      where: {
        source: {
          in: [RecordSource.GMAIL, RecordSource.IMPORT],
        },
      },
    }),
    prisma.memoryEntry.count({
      where: {
        source: "CSV 导入",
      },
    }),
  ]);

  results.push(
    record(
      "data_ingress_signals",
      Boolean(gmailConnector) && externalThreadCount > 0 && importedMemorySignals > 0,
      `gmailConnected=${Boolean(gmailConnector)}, externalThreads=${externalThreadCount}, importSignals=${importedMemorySignals}`,
    ),
  );

  const hubspotSource = importSources.find((source) => source.sourceType === "HUBSPOT");
  const salesforceSource = importSources.find((source) => source.sourceType === "SALESFORCE");

  results.push(
    record(
      "crm_sources_connected",
      Boolean(hubspotSource && salesforceSource),
      `hubspot=${hubspotSource?.status ?? "missing"} | salesforce=${salesforceSource?.status ?? "missing"}`,
    ),
  );

  const crmWarmJobs = importJobs.filter((job) => Boolean(job.summaryJson));
  results.push(
    record(
      "crm_import_jobs",
      crmWarmJobs.length >= 2 && importJobs.every((job) => job.successRecords > 0),
      importJobs
        .map((job) => `${job.source.sourceType}:${job.status}:success=${job.successRecords}:warning=${job.warningRecords}`)
        .join(" | "),
    ),
  );

  const crmConflictCount = identityMatches.filter((match) => match.status === "NEEDS_REVIEW").length;
  results.push(
    record(
      "crm_conflict_signal",
      crmConflictCount > 0,
      `needsReview=${crmConflictCount}`,
    ),
  );

  const namedOpportunities = await prisma.opportunity.findMany({
    where: {
      title: {
        in: [
          "Acme 年度经营动作控制台试点",
          "GreenPeak VP Sales 职位委托",
          "Atlas AI 联合解决方案合作",
        ],
      },
    },
    select: { title: true },
  });

  results.push(
    record(
      "seed_opportunities",
      namedOpportunities.length === 3,
      namedOpportunities.map((item) => item.title).join(", "),
    ),
  );

  const crmMappedObjects = await prisma.$transaction([
    prisma.company.count({
      where: {
        externalSource: {
          in: ["HUBSPOT", "SALESFORCE"],
        },
      },
    }),
    prisma.contact.count({
      where: {
        externalSource: {
          in: ["HUBSPOT", "SALESFORCE"],
        },
      },
    }),
    prisma.opportunity.count({
      where: {
        externalSource: {
          in: ["HUBSPOT", "SALESFORCE"],
        },
      },
    }),
    prisma.meeting.count({
      where: {
        externalSource: {
          in: ["HUBSPOT", "SALESFORCE"],
        },
      },
    }),
  ]);

  results.push(
    record(
      "crm_object_bindings",
      crmMappedObjects.every((count) => count > 0),
      `companies=${crmMappedObjects[0]}, contacts=${crmMappedObjects[1]}, opportunities=${crmMappedObjects[2]}, meetings=${crmMappedObjects[3]}`,
    ),
  );

  const workspaceFlags = workspaceOps?.featureFlagsJson
    ? JSON.parse(workspaceOps.featureFlagsJson) as Record<string, unknown>
    : {};

  results.push(
    record(
      "workspace_operational_controls",
      Boolean(
        workspaceOps &&
          workspaceOps.pilotMode &&
          workspaceOps.captureConsentRequired &&
          workspaceOps.defaultLocale &&
          workspaceOps.dataRetentionDays >= 30 &&
          workspaceFlags.multilingualUi === true &&
          workspaceFlags.diagnosticsCenter === true,
      ),
      workspaceOps
        ? `locale=${workspaceOps.defaultLocale} | pilot=${workspaceOps.pilotMode} | consent=${workspaceOps.captureConsentRequired} | retention=${workspaceOps.dataRetentionDays} | multilingualUi=${String(workspaceFlags.multilingualUi)} | diagnosticsCenter=${String(workspaceFlags.diagnosticsCenter)}`
        : "no workspace operational controls found",
    ),
  );

  const namedContacts = await prisma.contact.findMany({
    where: {
      name: {
        in: ["Vivian Chen", "Aya Nakamura", "Mason Liu"],
      },
    },
    select: { name: true },
  });

  results.push(
    record(
      "seed_contacts",
      namedContacts.length === 3,
      namedContacts.map((item) => item.name).join(", "),
    ),
  );

  const acmeCompany = await prisma.company.findFirst({
    where: { name: "Acme Robotics" },
    select: {
      name: true,
      contacts: { select: { id: true } },
      opportunities: {
        where: {
          stage: {
            notIn: ["DONE", "LOST"],
          },
        },
        select: { id: true },
      },
      blockers: { select: { id: true } },
      commitments: { select: { id: true } },
    },
  });

  results.push(
    record(
      "company_signal_seed",
      Boolean(
        acmeCompany &&
          acmeCompany.contacts.length > 0 &&
          acmeCompany.opportunities.length > 0 &&
          (acmeCompany.blockers.length > 0 || acmeCompany.commitments.length > 0),
      ),
      acmeCompany
        ? `contacts=${acmeCompany.contacts.length}, activeOpps=${acmeCompany.opportunities.length}, blockers=${acmeCompany.blockers.length}, commitments=${acmeCompany.commitments.length}`
        : "Acme company not found",
    ),
  );

  const acmeMeeting = await prisma.meeting.findFirst({
    where: { title: "Acme 采购评估同步会" },
    select: {
      title: true,
      commitments: { select: { id: true } },
      blockers: { select: { id: true } },
      note: { select: { id: true } },
    },
  });

  results.push(
    record(
      "meeting_memory_pipeline",
      Boolean(acmeMeeting?.note && acmeMeeting.commitments.length > 0 && acmeMeeting.blockers.length > 0),
      acmeMeeting
        ? `note=${Boolean(acmeMeeting.note)}, commitments=${acmeMeeting.commitments.length}, blockers=${acmeMeeting.blockers.length}`
        : "Acme meeting not found",
    ),
  );

  const acmeRecommendation = await prisma.recommendationLog.findFirst({
    where: {
      title: {
        contains: "Acme 年度经营动作控制台试点",
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      title: true,
      explanation: true,
      supportingFactIds: true,
      blockerIds: true,
      commitmentIds: true,
      policyResult: true,
    },
  });

  const acmeRecommendationOk = Boolean(
    acmeRecommendation &&
      acmeRecommendation.explanation.trim().length > 0 &&
      acmeRecommendation.supportingFactIds &&
      acmeRecommendation.blockerIds &&
      acmeRecommendation.commitmentIds,
  );

  results.push(
    record(
      "recommendation_evidence",
      acmeRecommendationOk,
      acmeRecommendation
        ? `${acmeRecommendation.title} | policy=${acmeRecommendation.policyResult}`
        : "Acme recommendation not found",
    ),
  );

  const acmeRecommendationPayload = await prisma.recommendationLog.findFirst({
    where: {
      title: {
        contains: "Acme 年度经营动作控制台试点",
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      recommendationPayload: true,
    },
  });

  let parsedPayload: Record<string, unknown> | null = null;
  try {
    parsedPayload = acmeRecommendationPayload?.recommendationPayload
      ? (JSON.parse(acmeRecommendationPayload.recommendationPayload) as Record<string, unknown>)
      : null;
  } catch {
    parsedPayload = null;
  }

  if (!(parsedPayload && typeof parsedPayload.decisionRole === "string" && typeof parsedPayload.decisionLabel === "string")) {
    const acmeOpportunity = await prisma.opportunity.findFirst({
      where: { title: "Acme 年度经营动作控制台试点" },
      select: {
        id: true,
        workspaceId: true,
        ownerId: true,
      },
    });

    if (acmeOpportunity) {
      const generated = await generateRecommendationsForObject({
        workspaceId: acmeOpportunity.workspaceId,
        actorName: "Pilot Eval",
        actorUserId: acmeOpportunity.ownerId,
        actorType: ActorType.SYSTEM,
        objectType: ObjectType.OPPORTUNITY,
        objectId: acmeOpportunity.id,
        limit: 1,
        persist: false,
        captureTelemetry: false,
      });

      parsedPayload = (generated[0]?.recommendationPayload as Record<string, unknown> | null) ?? parsedPayload;
    }
  }

  results.push(
    record(
      "recommendation_tradeoff_payload",
      Boolean(
        parsedPayload &&
          typeof parsedPayload.decisionRole === "string" &&
          typeof parsedPayload.decisionLabel === "string" &&
          typeof parsedPayload.tradeoffSummary === "string",
      ),
      parsedPayload
        ? `role=${String(parsedPayload.decisionRole)} | label=${String(parsedPayload.decisionLabel ?? "")}`
        : "recommendation payload missing",
    ),
  );

  const openSuggestion = await prisma.strategySuggestion.findFirst({
    where: { status: "OPEN" },
    select: { title: true, suggestionType: true, targetPolicyKey: true },
  });

  const [stalledPattern, coolingPattern, acceptedSuggestion] = await Promise.all([
    prisma.patternFact.findFirst({
      where: {
        status: "ACTIVE",
        patternType: "stalled_opportunity_pattern",
      },
      select: { title: true, patternKey: true, evidenceCount: true },
    }),
    prisma.patternFact.findFirst({
      where: {
        status: "ACTIVE",
        patternType: "contact_cooling_pattern",
      },
      select: { title: true, evidenceCount: true },
    }),
    prisma.strategySuggestion.findFirst({
      where: {
        status: "ACCEPTED",
      },
      orderBy: {
        appliedAt: "desc",
      },
      select: {
        title: true,
        targetPolicyKey: true,
        suggestedValue: true,
      },
    }),
  ]);
  const latestWeeklyReport = await prisma.weeklyReport.findFirst({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      payload: true,
    },
  });
  const latestWeeklyPayload = latestWeeklyReport?.payload
    ? JSON.parse(latestWeeklyReport.payload) as Record<string, unknown>
    : null;

  results.push(
    record(
      "open_strategy_suggestion",
      Boolean(openSuggestion),
      openSuggestion
        ? `${openSuggestion.title} | type=${openSuggestion.suggestionType} | target=${openSuggestion.targetPolicyKey}`
        : "no open strategy suggestion",
    ),
  );

  results.push(
    record(
      "stalled_opportunity_pattern",
      Boolean(stalledPattern),
      stalledPattern
        ? `${stalledPattern.title} | stage=${stalledPattern.patternKey} | evidence=${stalledPattern.evidenceCount}`
        : "no stalled opportunity pattern",
    ),
  );

  results.push(
    record(
      "contact_cooling_pattern",
      Boolean(coolingPattern),
      coolingPattern
        ? `${coolingPattern.title} | evidence=${coolingPattern.evidenceCount}`
        : "no contact cooling pattern",
    ),
  );

  results.push(
    record(
      "accepted_strategy_adoption",
      Boolean(acceptedSuggestion),
      acceptedSuggestion
        ? `${acceptedSuggestion.title} | target=${acceptedSuggestion.targetPolicyKey} | value=${acceptedSuggestion.suggestedValue ?? "n/a"}`
        : "no accepted strategy suggestion",
    ),
  );

  results.push(
    record(
      "weekly_report_management_metrics",
      Boolean(
        latestWeeklyPayload &&
          typeof latestWeeklyPayload.governanceMetrics === "object" &&
          typeof latestWeeklyPayload.integrationMetrics === "object",
      ),
      latestWeeklyPayload
        ? `governance=${Boolean(latestWeeklyPayload.governanceMetrics)} | integration=${Boolean(latestWeeklyPayload.integrationMetrics)}`
        : "no weekly report payload",
    ),
  );

  const completedCapture = await prisma.captureSession.findFirst({
    where: { status: "COMPLETED" },
    select: {
      id: true,
      workspaceId: true,
      startedAt: true,
      linkedMeetingId: true,
      title: true,
      transcript: {
        select: {
          id: true,
          sourceType: true,
          provider: true,
          model: true,
        },
      },
      insights: { select: { id: true } },
    },
  });

  results.push(
    record(
      "capture_pipeline",
      Boolean(completedCapture?.transcript && completedCapture.insights.length > 0),
      completedCapture
        ? `${completedCapture.title || "untitled"} | transcript=${Boolean(completedCapture.transcript)} | insights=${completedCapture.insights.length}`
        : "no completed capture session",
    ),
  );

  const captureRecommendationRefreshCount = completedCapture?.linkedMeetingId
    ? await prisma.recommendationLog.count({
        where: {
          workspaceId: completedCapture.workspaceId,
          createdAt: {
            gte: completedCapture.startedAt,
          },
          objectId: {
            in: [completedCapture.linkedMeetingId],
          },
        },
      })
    : 0;

  results.push(
    record(
      "capture_recommendation_refresh",
      captureRecommendationRefreshCount > 0,
      `refreshedRecommendations=${captureRecommendationRefreshCount}`,
    ),
  );

  results.push(
    record(
      "capture_transcript_source",
      Boolean(completedCapture?.transcript?.sourceType),
      completedCapture?.transcript
        ? `source=${completedCapture.transcript.sourceType} | provider=${completedCapture.transcript.provider ?? "n/a"} | model=${completedCapture.transcript.model ?? "n/a"}`
        : "no transcript source metadata",
    ),
  );

  const captureEventNames = new Set(captureEvents.map((item) => item.eventName));
  const requiredCaptureEvents = [
    "capture_started",
    "transcript_generated",
    "capture_memory_written",
    "capture_recommendations_refreshed",
    "capture_processing_completed",
  ];
  const missingCaptureEvents = requiredCaptureEvents.filter((eventName) => !captureEventNames.has(eventName));

  results.push(
    record(
      "capture_event_funnel",
      missingCaptureEvents.length === 0,
      missingCaptureEvents.length === 0 ? requiredCaptureEvents.join(", ") : `missing=${missingCaptureEvents.join(", ")}`,
    ),
  );

  const llmMetaCoverage = llmLogs.filter(
    (item) => item.promptVersion && item.promptKey && item.modelRole && item.modelVersion,
  ).length;

  results.push(
    record(
      "llm_log_metadata",
      llmLogs.length === 0 || llmMetaCoverage === llmLogs.length,
      llmLogs.length
        ? `logs=${llmLogs.length}, completeMetadata=${llmMetaCoverage}`
        : "no llm logs yet; metadata check skipped",
    ),
  );

  const failed = results.filter((result) => !result.ok);

  for (const result of results) {
    const icon = result.ok ? "PASS" : "FAIL";
    console.log(`${icon}  ${result.name}  ${result.detail}`);
  }

  console.log("");
  console.log(
    JSON.stringify(
      {
        success: failed.length === 0,
        passed: results.length - failed.length,
        failed: failed.length,
      },
      null,
      2,
    ),
  );

  if (failed.length > 0) {
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
