import {
  ActionExecutionMode,
  ActionStatus,
  ActionType,
  ActorType,
  ApprovalStatus,
  ConnectorProvider,
  ConnectorStatus,
  IdentityMatchStatus,
  ImportConflictStatus,
  ImportJobStatus,
  ImportJobType,
  ImportMatchStatus,
  ImportSourceStatus,
  ImportSourceType,
  CommitmentStatus,
  ConversationInsightType,
  CaptureProcessingStatus,
  CaptureSessionStatus,
  CaptureSourceType,
  ExecutionReceiptOutcome,
  ExecutionReceiptSubjectType,
  ExecutionReceiptVerificationState,
  AccessState,
  RevenueBeneficiaryType,
  RevenueRuleCadence,
  RevenueRuleStatus,
  RevenueRuleValueType,
  RevenueSourceType,
  MeetingStatus,
  MembershipStatus,
  MemoryCorrectionType,
  MemoryFactType,
  MemoryEntityType,
  MemoryRelationType,
  MemoryType,
  NotificationType,
  ObjectType,
  OpportunityStage,
  OpportunityType,
  RecommendationFeedbackType,
  RelationshipWarmth,
  RiskLevel,
  SourceType,
  ThreadStatus,
  WorkspaceClass,
  WorkspaceRole,
  WorkerEntitlementStatus,
  WorkerEntitlementType,
  PrismaClient,
  RecordSource,
} from "@prisma/client";
import { addDays, addHours, addMinutes, format, setHours, setMinutes, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import {
  HELM_FIRST_PARTY_PUBLISHER_KEY,
  REVENUE_PERCENT_BASE,
  ensureWorkspaceRevenueAttributionFoundation,
  recordRevenueAttribution,
} from "@/lib/billing/revenue-attribution";
import {
  approveSettlementBatch,
  closeSettlementBatch,
  createSettlementBatchForPeriod,
  markSettlementBatchExported,
  markSettlementBatchLinePaid,
  reverseSettlementBatchLine,
} from "@/lib/billing/manual-settlement";
import { issueParticipantPortalInvite } from "@/lib/auth/participant-portal-access";
import { getDefaultPaymentProvider } from "@/lib/billing/payment-provider-resolver";
import { refreshEvolutionState } from "@/lib/evolution/pattern-detection.service";
import { acceptStrategySuggestion } from "@/lib/evolution/strategy-suggestion.service";
import { defaultWorkspaceFeatureFlags } from "@/lib/workspace-ops";
import { createBlocker, resolveBlocker } from "@/lib/memory/blocker.service";
import { createCommitment, updateCommitmentStatus } from "@/lib/memory/commitment.service";
import { correctMemoryFact } from "@/lib/memory/correction.service";
import { createMemoryFact } from "@/lib/memory/memory-fact.service";
import { hydrateMeetingMemoryFromNote } from "@/lib/memory/pipeline.service";
import { generateMeetingBriefingSnapshot } from "@/lib/memory/briefing.service";
import { submitRecommendationFeedback } from "@/lib/recommendations/recommendation-feedback.service";
import { generateRecommendationsForObject } from "@/lib/recommendations/recommendation.service";
import {
  HELM_RESERVED_WORKSPACE_SYSTEM_KEY,
  isHelmReservedWorkspace,
} from "@/lib/workspace-identity";

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
}

const prisma = new PrismaClient(
  databaseUrl
    ? {
        datasources: {
          db: {
            url: databaseUrl,
          },
        },
      }
    : undefined,
);

const now = new Date();
const today = startOfDay(now);
const todayAt = (hour: number, minute = 0) => setMinutes(setHours(today, hour), minute);
const json = (value: unknown) => JSON.stringify(value);
const coreWorkers = [
  {
    workerKey: "meeting_os_worker",
    entitlementType: WorkerEntitlementType.INCLUDED,
    status: WorkerEntitlementStatus.ACTIVE,
  },
  {
    workerKey: "review_memory_worker",
    entitlementType: WorkerEntitlementType.INCLUDED,
    status: WorkerEntitlementStatus.ACTIVE,
  },
  {
    workerKey: "deal_desk_worker",
    entitlementType: WorkerEntitlementType.ADD_ON_MONTHLY,
    status: WorkerEntitlementStatus.INACTIVE,
  },
  {
    workerKey: "specialist_review_worker",
    entitlementType: WorkerEntitlementType.ADD_ON_PER_USE,
    status: WorkerEntitlementStatus.INACTIVE,
  },
];

async function seedWorkspaceCommercialFoundation(workspaceId: string, startedAt: Date, locale: string) {
  await prisma.billingAccount.create({
    data: {
      workspaceId,
      currentPlan: "helm_team_v1",
      currency: "CNY",
      billingStatus: AccessState.TRIALING,
      paymentProvider: getDefaultPaymentProvider(locale),
      baseFeeCents: 19_900,
      activeSeatPriceCents: 9_900,
      includedAdminSeats: 1,
      createdAt: startedAt,
    },
  });

  await prisma.trialState.create({
    data: {
      workspaceId,
      trialStartedAt: startedAt,
      trialEndsAt: addDays(startedAt, 30),
      graceEndsAt: addDays(startedAt, 37),
      status: AccessState.TRIALING,
      createdAt: startedAt,
    },
  });

  await prisma.workerEntitlement.createMany({
    data: coreWorkers.map((worker) => ({
      workspaceId,
      workerKey: worker.workerKey,
      entitlementType: worker.entitlementType,
      status: worker.status,
      effectiveFrom: startedAt,
      effectiveTo: worker.workerKey === "specialist_review_worker" ? addDays(startedAt, 90) : null,
      internalLimit: worker.workerKey === "specialist_review_worker" ? 12 : null,
    })),
  });
}

async function seedSettlementOperationsProofPack(input: {
  workspaceId: string;
  workspaceSlug: string;
  workspaceLabel: string;
  startedAt: Date;
}) {
  const workspace = await prisma.workspace.findUnique({
    where: {
      id: input.workspaceId,
    },
    select: {
      workspaceClass: true,
      systemKey: true,
    },
  });

  // First-party settlement proof data belongs on the reserved host only.
  if (!isHelmReservedWorkspace(workspace)) {
    return;
  }

  await ensureWorkspaceRevenueAttributionFoundation(input.workspaceId, input.startedAt);

  const firstPartyPublisher = await prisma.workerPublisherProfile.findUniqueOrThrow({
    where: {
      workspaceId_publisherKey: {
        workspaceId: input.workspaceId,
        publisherKey: HELM_FIRST_PARTY_PUBLISHER_KEY,
      },
    },
  });

  const salesReferral = await prisma.salesReferral.upsert({
    where: {
      workspaceId_referralKey: {
        workspaceId: input.workspaceId,
        referralKey: `${input.workspaceSlug}_sales_partner`,
      },
    },
    update: {},
    create: {
      workspaceId: input.workspaceId,
      referralKey: `${input.workspaceSlug}_sales_partner`,
      beneficiaryLabel: `${input.workspaceLabel} 销售转介绍`,
      beneficiaryContact: `${input.workspaceSlug}.referral@demo.com`,
      notes: "Seeded sales referral proof line for manual settlement readiness.",
    },
  });

  const customEngagement = await prisma.customEngagement.upsert({
    where: {
      workspaceId_engagementKey: {
        workspaceId: input.workspaceId,
        engagementKey: `${input.workspaceSlug}_custom_impl`,
      },
    },
    update: {},
    create: {
      workspaceId: input.workspaceId,
      engagementKey: `${input.workspaceSlug}_custom_impl`,
      engagementType: "IMPLEMENTATION",
      label: `${input.workspaceLabel} 定制实施`,
      beneficiaryLabel: `${input.workspaceLabel} 实施伙伴`,
      contractValueCents: 49_900,
      currency: "CNY",
      notes: "Seeded custom implementation proof line for manual settlement readiness.",
    },
  });

  const salesRule = await prisma.revenueRule.upsert({
    where: {
      workspaceId_ruleKey: {
        workspaceId: input.workspaceId,
        ruleKey: `${input.workspaceSlug}_sales_referral_recurring_percent`,
      },
    },
    update: {},
    create: {
      workspaceId: input.workspaceId,
      ruleKey: `${input.workspaceSlug}_sales_referral_recurring_percent`,
      name: `${input.workspaceLabel} sales referral recurring split`,
      sourceType: RevenueSourceType.SALES_REFERRAL,
      beneficiaryType: RevenueBeneficiaryType.SALES_REFERRAL,
      beneficiaryLabel: salesReferral.beneficiaryLabel,
      cadence: RevenueRuleCadence.RECURRING,
      valueType: RevenueRuleValueType.FIXED_PERCENT,
      percentBps: Math.round(REVENUE_PERCENT_BASE * 0.2),
      currency: "CNY",
      reverseOnCancel: true,
      notes: "Seeded sales referral split for settlement proof pack.",
      salesReferralId: salesReferral.id,
      status: RevenueRuleStatus.ACTIVE,
      effectiveFrom: input.startedAt,
    },
  });

  const customRule = await prisma.revenueRule.upsert({
    where: {
      workspaceId_ruleKey: {
        workspaceId: input.workspaceId,
        ruleKey: `${input.workspaceSlug}_custom_impl_one_time_percent`,
      },
    },
    update: {},
    create: {
      workspaceId: input.workspaceId,
      ruleKey: `${input.workspaceSlug}_custom_impl_one_time_percent`,
      name: `${input.workspaceLabel} custom implementation split`,
      sourceType: RevenueSourceType.CUSTOM_IMPLEMENTATION,
      beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
      beneficiaryLabel: customEngagement.beneficiaryLabel,
      cadence: RevenueRuleCadence.ONE_TIME,
      valueType: RevenueRuleValueType.FIXED_PERCENT,
      percentBps: Math.round(REVENUE_PERCENT_BASE * 0.35),
      currency: "CNY",
      reverseOnCancel: true,
      notes: "Seeded custom implementation split for settlement proof pack.",
      customEngagementId: customEngagement.id,
      status: RevenueRuleStatus.ACTIVE,
      effectiveFrom: input.startedAt,
    },
  });

  const payoutProfileSeeds = [
    {
      beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
      beneficiaryReference: firstPartyPublisher.publisherKey,
      displayName: firstPartyPublisher.displayName,
      legalName: `${input.workspaceLabel} Worker Studio`,
      contact: `${input.workspaceSlug}.worker@demo.com`,
      payoutMethodLabel: "Bank transfer (manual)",
      payoutDetailsReference: `seed://${input.workspaceSlug}/worker`,
      workerPublisherProfileId: firstPartyPublisher.id,
      salesReferralId: null,
      customEngagementId: null,
      notes: "Seeded active payout profile for worker beneficiary readiness.",
    },
    {
      beneficiaryType: RevenueBeneficiaryType.SALES_REFERRAL,
      beneficiaryReference: salesReferral.referralKey,
      displayName: salesReferral.beneficiaryLabel,
      legalName: `${input.workspaceLabel} Referral Services`,
      contact: salesReferral.beneficiaryContact,
      payoutMethodLabel: "Bank transfer (manual)",
      payoutDetailsReference: `seed://${input.workspaceSlug}/sales-referral`,
      workerPublisherProfileId: null,
      salesReferralId: salesReferral.id,
      customEngagementId: null,
      notes: "Seeded active payout profile for sales referral readiness.",
    },
    {
      beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
      beneficiaryReference: customEngagement.engagementKey,
      displayName: customEngagement.beneficiaryLabel,
      legalName: `${input.workspaceLabel} Implementation Services`,
      contact: `${input.workspaceSlug}.custom@demo.com`,
      payoutMethodLabel: "Bank transfer (manual)",
      payoutDetailsReference: `seed://${input.workspaceSlug}/custom-services`,
      workerPublisherProfileId: null,
      salesReferralId: null,
      customEngagementId: customEngagement.id,
      notes: "Seeded active payout profile for custom engagement readiness.",
    },
  ];

  for (const profile of payoutProfileSeeds) {
    await prisma.beneficiaryPayoutProfile.upsert({
      where: {
        workspaceId_beneficiaryType_beneficiaryReference: {
          workspaceId: input.workspaceId,
          beneficiaryType: profile.beneficiaryType,
          beneficiaryReference: profile.beneficiaryReference,
        },
      },
      update: {
        displayName: profile.displayName,
        legalName: profile.legalName,
        contact: profile.contact,
        payoutMethodLabel: profile.payoutMethodLabel,
        payoutDetailsReference: profile.payoutDetailsReference,
        status: "ACTIVE",
        notes: profile.notes,
      },
      create: {
        workspaceId: input.workspaceId,
        beneficiaryType: profile.beneficiaryType,
        beneficiaryReference: profile.beneficiaryReference,
        displayName: profile.displayName,
        legalName: profile.legalName,
        contact: profile.contact,
        payoutMethodLabel: profile.payoutMethodLabel,
        payoutDetailsReference: profile.payoutDetailsReference,
        invoiceRequired: true,
        status: "ACTIVE",
        notes: profile.notes,
        workerPublisherProfileId: profile.workerPublisherProfileId,
        salesReferralId: profile.salesReferralId,
        customEngagementId: profile.customEngagementId,
      },
    });
  }

  await issueParticipantPortalInvite({
    workspaceId: input.workspaceId,
    beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
    beneficiaryId: firstPartyPublisher.id,
    inviteEmail: `${input.workspaceSlug}.worker.portal@demo.com`,
    displayName: firstPartyPublisher.displayName,
    notes: "Seeded invited worker participant access for settlement proof readiness.",
    now: input.startedAt,
  });
  await issueParticipantPortalInvite({
    workspaceId: input.workspaceId,
    beneficiaryType: RevenueBeneficiaryType.SALES_REFERRAL,
    beneficiaryId: salesReferral.id,
    inviteEmail: `${input.workspaceSlug}.sales.portal@demo.com`,
    displayName: salesReferral.beneficiaryLabel,
    notes: "Seeded invited sales referral participant access for settlement proof readiness.",
    now: input.startedAt,
  });
  await issueParticipantPortalInvite({
    workspaceId: input.workspaceId,
    beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
    beneficiaryId: customEngagement.id,
    inviteEmail: `${input.workspaceSlug}.custom.portal@demo.com`,
    displayName: customEngagement.beneficiaryLabel,
    notes: "Seeded invited custom-services participant access for settlement proof readiness.",
    now: input.startedAt,
  });

  const previousPeriod = format(subMonths(now, 1), "yyyy-MM");
  const currentPeriod = format(now, "yyyy-MM");
  const previousPeriodStart = startOfMonth(subMonths(now, 1));
  const previousRecognizedAt = addDays(previousPeriodStart, 3);
  const previousPayableAt = addDays(previousPeriodStart, 5);
  const currentRecognizedAt = subDays(now, 5);
  const currentPayableAt = addDays(now, 6);

  await recordRevenueAttribution({
    workspaceId: input.workspaceId,
    ruleKey: "first_party_add_on_worker_per_use_percent",
    sourceLabel: `${input.workspaceLabel} worker proof batch`,
    sourceReference: `${input.workspaceSlug}_worker_proof_prev`,
    grossAmountCents: 9_900,
    recognizedAt: previousRecognizedAt,
    payableAfter: previousPayableAt,
    metadata: { seedPack: "settlement-proof", period: previousPeriod },
  });
  await recordRevenueAttribution({
    workspaceId: input.workspaceId,
    revenueRuleId: salesRule.id,
    sourceLabel: `${input.workspaceLabel} sales referral proof batch`,
    sourceReference: `${input.workspaceSlug}_sales_proof_prev`,
    grossAmountCents: 12_000,
    recognizedAt: previousRecognizedAt,
    payableAfter: previousPayableAt,
    metadata: { seedPack: "settlement-proof", period: previousPeriod },
  });
  await recordRevenueAttribution({
    workspaceId: input.workspaceId,
    revenueRuleId: customRule.id,
    sourceLabel: `${input.workspaceLabel} custom implementation proof batch`,
    sourceReference: `${input.workspaceSlug}_custom_proof_current`,
    grossAmountCents: 28_000,
    recognizedAt: currentRecognizedAt,
    payableAfter: currentPayableAt,
    metadata: { seedPack: "settlement-proof", period: currentPeriod },
  });

  const historicalBatch = await createSettlementBatchForPeriod({
    workspaceId: input.workspaceId,
    periodLabel: previousPeriod,
    notes: "Seeded proof batch with exported / paid / reversed evidence.",
  });
  await approveSettlementBatch({
    workspaceId: input.workspaceId,
    batchId: historicalBatch.id,
    approvedAt: subDays(now, 21),
  });
  await markSettlementBatchExported({
    workspaceId: input.workspaceId,
    batchId: historicalBatch.id,
    exportedAt: subDays(now, 20),
  });
  const historicalLines = await prisma.settlementBatchLine.findMany({
    where: {
      settlementBatchId: historicalBatch.id,
    },
    orderBy: [{ createdAt: "asc" }],
  });
  for (const [index, line] of historicalLines.entries()) {
    if (index === 1) {
      await reverseSettlementBatchLine({
        workspaceId: input.workspaceId,
        lineId: line.id,
        reason: "Seeded reversal evidence for readiness gate.",
        reversedAt: subDays(now, 18),
      });
      continue;
    }

    await markSettlementBatchLinePaid({
      workspaceId: input.workspaceId,
      lineId: line.id,
      paidAt: subDays(now, 19),
      notes: "Seeded paid evidence for settlement readiness.",
    });
  }
  await closeSettlementBatch({
    workspaceId: input.workspaceId,
    batchId: historicalBatch.id,
    closedAt: subDays(now, 17),
  });

  const currentBatch = await createSettlementBatchForPeriod({
    workspaceId: input.workspaceId,
    periodLabel: currentPeriod,
    notes: "Seeded open batch for current settlement review posture.",
  });
  await approveSettlementBatch({
    workspaceId: input.workspaceId,
    batchId: currentBatch.id,
    approvedAt: subDays(now, 2),
  });
}

async function seedStage1OwnerLoopDemo(input: {
  workspaceId: string;
  ownerUserId: string;
  operatorUserId: string;
}) {
  const authorizationRef = "authorization:synthetic-owner-observation-v1";
  const program = await prisma.enterpriseObservationProgram.create({
    data: {
      workspaceId: input.workspaceId,
      purpose: "只读观察合成经营数据，为一把手决策提供证据",
      scopeRefs: json(["scope:synthetic-sales", "scope:synthetic-finance"]),
      dataCategories: json(["synthetic-opportunity", "synthetic-cash-position"]),
      startsAt: subDays(now, 7),
      expiresAt: addDays(now, 30),
      retentionDays: 30,
      authorizationRef,
      status: "ACTIVE",
      auditRefs: json(["audit:synthetic-owner-authorization"]),
    },
  });

  const healthySource = await prisma.observationSource.create({
    data: {
      workspaceId: input.workspaceId,
      programId: program.id,
      sourceKey: "synthetic-crm",
      sourceKind: "crm",
      accessMode: "read_only_api",
      ownerRef: input.ownerUserId,
      freshnessSlaMinutes: 60,
      sensitivity: "internal",
      authorizationRef,
      secretRef: "secret-manager:synthetic-crm",
      retentionDays: 30,
      status: "ACTIVE",
      lastObservedAt: addMinutes(now, -12),
    },
  });
  const staleSource = await prisma.observationSource.create({
    data: {
      workspaceId: input.workspaceId,
      programId: program.id,
      sourceKey: "synthetic-finance",
      sourceKind: "finance",
      accessMode: "scheduled_snapshot",
      ownerRef: input.ownerUserId,
      freshnessSlaMinutes: 24 * 60,
      sensitivity: "confidential",
      authorizationRef,
      secretRef: "secret-manager:synthetic-finance",
      retentionDays: 30,
      status: "ACTIVE",
      lastObservedAt: subDays(now, 2),
    },
  });
  await prisma.observationSourceRun.createMany({
    data: [
      {
        workspaceId: input.workspaceId,
        programId: program.id,
        sourceId: healthySource.id,
        executionKey: "synthetic-crm-latest",
        authorizationVersion: 1,
        windowStart: addMinutes(now, -30),
        windowEnd: addMinutes(now, -12),
        status: "SUCCEEDED",
        observedAt: addMinutes(now, -12),
        summaryHash: "sha256:synthetic-crm-summary",
        completenessPercent: 96,
        freshness: "FRESH",
        outcome: "SUCCESS",
        evidenceRefs: json(["evidence:synthetic-crm-pipeline"]),
        errorCodes: json([]),
      },
      {
        workspaceId: input.workspaceId,
        programId: program.id,
        sourceId: staleSource.id,
        executionKey: "synthetic-finance-stale",
        authorizationVersion: 1,
        windowStart: subDays(now, 3),
        windowEnd: subDays(now, 2),
        status: "SUCCEEDED",
        observedAt: subDays(now, 2),
        summaryHash: "sha256:synthetic-finance-summary",
        completenessPercent: 88,
        freshness: "STALE",
        outcome: "PARTIAL_SUCCESS",
        evidenceRefs: json(["evidence:synthetic-cash-position"]),
        errorCodes: json(["SOURCE_FRESHNESS_SLA_MISSED"]),
      },
    ],
  });

  await prisma.decisionRecord.create({
    data: {
      workspaceId: input.workspaceId,
      decisionKey: "decision:synthetic-cash-priority",
      decisionType: "prioritization",
      businessQuestion: "本周应优先保现金流还是扩大试点投入？",
      problemCategoryRef: "synthetic-cash-priority",
      contextRefs: json(["context:synthetic-weekly-operations"]),
      knowledgeRefs: json(["knowledge:synthetic-capital-policy"]),
      evidenceRefs: json(["evidence:synthetic-cash-position"]),
      policyRefs: json(["policy:review-first"]),
      receiptRefs: json([]),
      alternatives: json(["保持现金缓冲", "扩大试点投入"]),
      recommendedOption: "保持现金缓冲，并在获得新回执后复核",
      confidence: "medium",
      riskLevel: "high",
      allowedActionLevel: "draft_task",
      ownerGate: "approval_required",
      rollbackPath: "在派发前撤销建议并重新收集财务证据",
      factsJson: json([
        {
          statement: "合成财务来源已超过时效 SLA",
          evidenceRefs: ["evidence:synthetic-cash-position"],
          freshness: "stale",
        },
      ]),
      inferencesJson: json([
        {
          statement: "现金缓冲可能低于计划",
          evidenceRefs: ["evidence:synthetic-cash-position"],
          freshness: "stale",
        },
      ]),
      unknownsJson: json(["最新银行余额尚未观察"]),
      risksJson: json(["过期证据可能导致优先级判断偏差"]),
      status: "EVIDENCE_READY",
      validUntil: addDays(now, 2),
    },
  });

  const followedDecision = await prisma.decisionRecord.create({
    data: {
      workspaceId: input.workspaceId,
      decisionKey: "decision:synthetic-renewal-recovery",
      decisionType: "intervention",
      businessQuestion: "是否启动高风险续约机会的恢复计划？",
      problemCategoryRef: "synthetic-renewal-risk",
      contextRefs: json(["context:synthetic-sales-review"]),
      knowledgeRefs: json(["knowledge:synthetic-renewal-playbook"]),
      evidenceRefs: json(["evidence:synthetic-crm-pipeline"]),
      policyRefs: json(["policy:review-first"]),
      receiptRefs: json(["receipt:synthetic-renewal-recovery"]),
      alternatives: json(["启动恢复计划", "继续观察"]),
      recommendedOption: "启动恢复计划",
      confidence: "high",
      riskLevel: "medium",
      allowedActionLevel: "draft_task",
      ownerGate: "approval_required",
      rollbackPath: "停止恢复任务并回到只读观察",
      factsJson: json([
        {
          statement: "合成续约机会连续两周没有下一步",
          evidenceRefs: ["evidence:synthetic-crm-pipeline"],
          freshness: "fresh",
        },
      ]),
      inferencesJson: json([]),
      unknownsJson: json([]),
      risksJson: json(["客户优先级可能继续下降"]),
      ownerRef: input.ownerUserId,
      ownerConclusion: "启动恢复计划并由运营复核结果",
      ownerConfirmedAt: subDays(now, 1),
      status: "OWNER_CONFIRMED",
      validUntil: addDays(now, 5),
    },
  });
  const action = await prisma.actionItem.create({
    data: {
      workspaceId: input.workspaceId,
      ownerId: input.operatorUserId,
      actionType: ActionType.CREATE_TASK,
      title: "完成合成续约机会恢复计划",
      description: "根据一把手已确认决策形成的 public-safe 合成 Work Packet",
      aiReason: "续约机会连续两周没有下一步",
      metadata: json({
        stage1DecisionRecordId: followedDecision.id,
        acceptanceCriteria: ["恢复计划有独立验收回执"],
        evidenceRequirements: ["evidence:synthetic-recovery-plan"],
      }),
      sourceType: SourceType.SYSTEM_INFERENCE,
      sourceId: `decision-record:${followedDecision.id}`,
      riskLevel: RiskLevel.MEDIUM,
      dueDate: addDays(now, 2),
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.EXECUTED,
      executionStatus: "completed",
      policyName: "stage1-owner-confirmed-work-packet",
      createdByUserId: input.ownerUserId,
      contentAuthorship: ActorType.AI,
      executedAt: addHours(now, -4),
    },
  });
  await prisma.approvalTask.create({
    data: {
      workspaceId: input.workspaceId,
      actionItemId: action.id,
      approverId: input.ownerUserId,
      reviewedById: input.ownerUserId,
      status: ApprovalStatus.EXECUTED,
      isHighRisk: false,
      autoExecute: false,
      decisionReason: "合成恢复计划边界清晰",
      reviewedAt: addHours(now, -5),
    },
  });
  await prisma.decisionWorkPacketClaim.create({
    data: {
      workspaceId: input.workspaceId,
      decisionRecordId: followedDecision.id,
      actionItemId: action.id,
      ownerCommandJson: json({
        goal: "恢复高风险续约机会",
        acceptanceCriteria: ["恢复计划有独立验收回执"],
        externalSideEffects: [],
        automationLevel: "assist",
      }),
    },
  });
  await prisma.executionReceipt.create({
    data: {
      workspaceId: input.workspaceId,
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: action.id,
      actionItemId: action.id,
      outcome: ExecutionReceiptOutcome.SUCCESS,
      actionTaken: "SYNTHETIC_RENEWAL_RECOVERY_PLAN",
      evidenceRefs: json(["evidence:synthetic-recovery-plan"]),
      nextStep: "等待下一次 CRM 观察确认客户回复",
      executedByUserId: input.operatorUserId,
      executedByActorType: ActorType.USER,
      verifiedByUserId: input.ownerUserId,
      verificationState: ExecutionReceiptVerificationState.VERIFIED,
      qualityScore: 92,
      qualityFlags: json([]),
    },
  });

  await prisma.supervisionSignalRecord.create({
    data: {
      workspaceId: input.workspaceId,
      decisionRecordId: followedDecision.id,
      signalKey: "signal:synthetic-finance-stale",
      signalType: "process_deviation",
      observedObjectRef: "source:synthetic-finance",
      baselineRef: "sla:synthetic-finance-daily",
      evidenceRefs: json(["evidence:synthetic-cash-position"]),
      severity: "warning",
      confidence: "high",
      recommendedRoute: "owner_review",
      ownerRef: input.ownerUserId,
      deadlineOrSla: addHours(now, 8),
      status: "open",
      observedFact: "合成财务来源已超过每日时效 SLA",
      interpretation: "现金优先级判断需要更新证据",
      expectedState: "每日完成一次只读快照",
      actualState: "最近一次快照为两天前",
      responsibilityScopeRef: "team:synthetic-finance",
      escalationCondition: "超过 8 小时仍无新快照则升级给一把手",
    },
  });
}

async function main() {
  const forceReset =
    process.env.SEED_FORCE_RESET === "1" ||
    process.env.SEED_FORCE_RESET === "true";

  if (!forceReset) {
    const existingWorkspaceCount = await prisma.workspace.count();
    if (existingWorkspaceCount > 0) {
      console.log(
        `Seed skipped: found ${existingWorkspaceCount} existing workspace record(s). Set SEED_FORCE_RESET=true to reseed.`,
      );
      return;
    }
  }

  await prisma.notification.deleteMany();
  await prisma.usageLedger.deleteMany();
  await prisma.strategySuggestion.deleteMany();
  await prisma.patternFact.deleteMany();
  await prisma.deltaEvent.deleteMany();
  await prisma.briefingSnapshot.deleteMany();
  await prisma.conversationInsight.deleteMany();
  await prisma.conversationTranscript.deleteMany();
  await prisma.captureSession.deleteMany();
  await prisma.preferenceSignal.deleteMany();
  await prisma.recommendationFeedback.deleteMany();
  await prisma.recommendationLog.deleteMany();
  await prisma.memoryCorrection.deleteMany();
  await prisma.memoryLink.deleteMany();
  await prisma.memoryFact.deleteMany();
  await prisma.blocker.deleteMany();
  await prisma.commitment.deleteMany();
  await prisma.weeklyReport.deleteMany();
  await prisma.dailyUsageSnapshot.deleteMany();
  await prisma.eventLog.deleteMany();
  await prisma.importItem.deleteMany();
  await prisma.identityMatch.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.importSource.deleteMany();
  await prisma.workerEntitlement.deleteMany();
  await prisma.trialState.deleteMany();
  await prisma.billingAccount.deleteMany();
  await prisma.connector.deleteMany();
  await prisma.approvalTask.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.meetingNote.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.emailMessage.deleteMany();
  await prisma.emailThread.deleteMany();
  await prisma.memoryEntry.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.policyRule.deleteMany();
  await prisma.budgetRule.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();

  const workspace = await prisma.workspace.create({
    data: {
      name: "创始人经营工作台 Demo",
      slug: "helm-founder-demo",
      workspaceClass: WorkspaceClass.HELM_RESERVED,
      systemKey: HELM_RESERVED_WORKSPACE_SYSTEM_KEY,
      description: "面向创始人 / COO 的 Helm 经营推进 Demo 工作区",
      profileType: "创始人 / COO",
      connectedSources: json([
        { name: "Gmail", status: "connected" },
        { name: "HubSpot", status: "connected" },
        { name: "Salesforce", status: "connected" },
        { name: "Zoom / Meet", status: "connected" },
        { name: "上传历史纪要", status: "connected" },
      ]),
      focusAreas: json(["跨线经营判断", "合作拓展", "内部事项", "审批与策略"]),
      defaultStrategies: json([
        "对外邮件默认需审批",
        "内部纪要按规则发送",
        "创建日程可自动执行",
        "更新机会状态可自动执行",
      ]),
      defaultLLMProvider: "qwen",
      defaultLLMModel: process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      extractionModel: process.env.LLM_EXTRACTION_MODEL || process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      briefingModel: process.env.LLM_BRIEFING_MODEL || process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      reasoningModel: process.env.LLM_REASONING_MODEL || process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      llmBudgetTier: "pilot",
      llmEnabled: process.env.LLM_ENABLED !== "false",
      defaultLocale: "zh-CN",
      pilotMode: true,
      featureFlagsJson: json({
        ...defaultWorkspaceFeatureFlags,
        multilingualUi: true,
        diagnosticsCenter: true,
      }),
      dataRetentionDays: 90,
      captureConsentRequired: true,
      configuration: json({
        demoMode: "founder",
        workspaceLabel: "Helm 掌舵者",
        operatingModel: "经营控制台 for AI Agents and Teams",
        conversionPrompt: "用这一套模式讲清楚 Helm 不是 CRM，而是跨销售、合作、内部冲突和审批边界的一体化经营控制层。",
      }),
    },
  });
  await seedWorkspaceCommercialFoundation(workspace.id, subDays(now, 12), workspace.defaultLocale ?? "zh-CN");

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: "founder@demo.com",
        name: "林舟",
        title: "创始人 / COO",
      },
    }),
    prisma.user.create({
      data: {
        email: "saleslead@demo.com",
        name: "周玥",
        title: "销售负责人",
      },
    }),
    prisma.user.create({
      data: {
        email: "recruiter@demo.com",
        name: "沈乔",
        title: "招聘顾问",
      },
    }),
    prisma.user.create({
      data: {
        email: "ops@demo.com",
        name: "陈路",
        title: "运营协调",
      },
    }),
    prisma.user.create({
      data: {
        email: "finance@demo.com",
        name: "唐霁",
        title: "计费运营",
      },
    }),
    prisma.user.create({
      data: {
        email: "advisor@demo.com",
        name: "方衡",
        title: "外部顾问",
      },
    }),
  ]);

  const userMap = Object.fromEntries(users.map((user) => [user.email, user]));

  await prisma.membership.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        role: WorkspaceRole.OWNER,
        // rolePresetKey 必填:控制塔开启后,无 preset 的 OWNER 会落空白 generic home
        // (CodeX 运行审计 P1)。合成数据须写实——OWNER=创始人/COO→FOUNDER_CEO 控制塔。
        rolePresetKey: "FOUNDER_CEO",
        title: "创始人 / COO",
        persona: "创始人 / COO",
      },
      {
        workspaceId: workspace.id,
        userId: userMap["ops@demo.com"].id,
        role: WorkspaceRole.OPERATOR,
        rolePresetKey: "GENERAL_OPERATOR",
        title: "运营协调",
        persona: "顾问 / 服务商",
      },
      {
        workspaceId: workspace.id,
        userId: userMap["finance@demo.com"].id,
        role: WorkspaceRole.BILLING_ADMIN,
        status: MembershipStatus.INVITED,
        title: "计费运营",
        persona: "计费与订阅运营",
      },
      {
        workspaceId: workspace.id,
        userId: userMap["advisor@demo.com"].id,
        role: WorkspaceRole.REVIEWER,
        status: MembershipStatus.INACTIVE,
        title: "外部顾问",
        persona: "阶段性外部顾问",
      },
    ],
  });

  await seedStage1OwnerLoopDemo({
    workspaceId: workspace.id,
    ownerUserId: userMap["founder@demo.com"].id,
    operatorUserId: userMap["ops@demo.com"].id,
  });

  const companyInputs = [
    {
      name: "Acme Robotics",
      industry: "智能制造",
      website: "https://acme-robotics.demo",
      description: "正在评估经营动作控制台用于大客户经营与复盘。",
      maturityScore: 78,
      cooperationMaturity: "试点进入采购评估",
      recommendedPath: "围绕 ROI、交付边界和跨部门协同推进采购决策。",
      tags: json(["销售主线", "年度大单"]),
    },
    {
      name: "Beacon Retail",
      industry: "零售连锁",
      website: "https://beacon-retail.demo",
      description: "旧机会恢复中，对内部资源投入较敏感。",
      maturityScore: 42,
      cooperationMaturity: "接近流失",
      recommendedPath: "先争取试点续命，再决定是否升级方案包。",
      tags: json(["流失风险", "价格敏感"]),
    },
    {
      name: "Nimbus Systems",
      industry: "企业软件",
      website: "https://nimbus-systems.demo",
      description: "项目需要售前、交付和法务同步。",
      maturityScore: 60,
      cooperationMaturity: "需要内部协同",
      recommendedPath: "明确内外部时间表，再做方案冻结。",
      tags: json(["内部协同", "复杂项目"]),
    },
    {
      name: "GreenPeak Health",
      industry: "医疗健康",
      website: "https://greenpeak.demo",
      description: "招聘 VP Sales 与增长总监，流程推进较快。",
      maturityScore: 71,
      cooperationMaturity: "招聘合作推进中",
      recommendedPath: "优先对齐职位画像和面试节奏。",
      tags: json(["招聘主线", "职位需求"]),
    },
    {
      name: "Atlas AI",
      industry: "AI Infra",
      website: "https://atlas-ai.demo",
      description: "正在讨论联合解决方案和内容合作。",
      maturityScore: 66,
      cooperationMaturity: "合作探索期",
      recommendedPath: "先定义联名方案，再确定渠道与分账。",
      tags: json(["合作拓展", "品牌协同"]),
    },
    {
      name: "Delta Capital",
      industry: "投资与并购",
      website: "https://delta-capital.demo",
      description: "潜在合作方，希望共办闭门沙龙。",
      maturityScore: 58,
      cooperationMaturity: "关系升温中",
      recommendedPath: "把一次活动合作做成长期转介入口。",
      tags: json(["创始人主线", "高客单价合作"]),
    },
  ];

  await prisma.company.createMany({
    data: companyInputs.map((company) => ({
      workspaceId: workspace.id,
      ...company,
    })),
  });

  const companies = await prisma.company.findMany({
    where: { workspaceId: workspace.id },
  });
  const companyMap = Object.fromEntries(companies.map((company) => [company.name, company]));

  const contactInputs = [
    {
      name: "Vivian Chen",
      title: "CFO",
      email: "vivian@acme.demo",
      companyName: "Acme Robotics",
      ownerId: userMap["saleslead@demo.com"].id,
      tags: json(["采购关键人", "会后需跟进"]),
      relationshipWarmth: RelationshipWarmth.HOT,
      lastInteractionAt: subDays(now, 1),
      notes: "对 ROI 证明敏感，喜欢会前收到结构化 briefing。",
    },
    {
      name: "Daniel Xu",
      title: "COO",
      email: "daniel@acme.demo",
      companyName: "Acme Robotics",
      ownerId: userMap["saleslead@demo.com"].id,
      tags: json(["项目发起人"]),
      relationshipWarmth: RelationshipWarmth.CHAMPION,
      lastInteractionAt: subDays(now, 3),
      notes: "愿意内部推动试点，但担心多团队落地复杂度。",
    },
    {
      name: "Olivia Park",
      title: "VP Strategy",
      email: "olivia@beacon.demo",
      companyName: "Beacon Retail",
      ownerId: userMap["saleslead@demo.com"].id,
      tags: json(["高风险", "价格博弈"]),
      relationshipWarmth: RelationshipWarmth.WARM,
      lastInteractionAt: subDays(now, 8),
      notes: "最近回复变慢，需要重新定义价值而不是继续追价格。",
    },
    {
      name: "Zack Han",
      title: "CTO",
      email: "zack@nimbus.demo",
      companyName: "Nimbus Systems",
      ownerId: userMap["saleslead@demo.com"].id,
      tags: json(["技术评审", "法务依赖"]),
      relationshipWarmth: RelationshipWarmth.WARM,
      lastInteractionAt: subDays(now, 9),
      notes: "技术方案认可，但要求法务 SLA 明确。",
    },
    {
      name: "Teresa Wang",
      title: "Talent Lead",
      email: "teresa@greenpeak.demo",
      companyName: "GreenPeak Health",
      ownerId: userMap["recruiter@demo.com"].id,
      tags: json(["职位 owner"]),
      relationshipWarmth: RelationshipWarmth.HOT,
      lastInteractionAt: subDays(now, 1),
      notes: "需要尽快推进 VP Sales 终面安排。",
    },
    {
      name: "Ben Carter",
      title: "候选人",
      email: "ben.carter@candidate.demo",
      ownerId: userMap["recruiter@demo.com"].id,
      tags: json(["候选人", "进入二面"]),
      relationshipWarmth: RelationshipWarmth.HOT,
      lastInteractionAt: subDays(now, 1),
      notes: "对 package 和决策速度敏感。",
    },
    {
      name: "Aya Nakamura",
      title: "候选人",
      email: "aya@candidate.demo",
      ownerId: userMap["recruiter@demo.com"].id,
      tags: json(["候选人", "待安排面试"]),
      relationshipWarmth: RelationshipWarmth.WARM,
      lastInteractionAt: subDays(now, 2),
      notes: "下周可安排面试，偏好提前收到 panel 介绍。",
    },
    {
      name: "Leo Sun",
      title: "候选人",
      email: "leo@candidate.demo",
      ownerId: userMap["recruiter@demo.com"].id,
      tags: json(["候选人", "已流失"]),
      relationshipWarmth: RelationshipWarmth.COLD,
      lastInteractionAt: subDays(now, 9),
      notes: "已接受其他 offer，仍可作为未来人才地图保留。",
    },
    {
      name: "Lena Zhou",
      title: "Founder",
      email: "lena@atlas.demo",
      companyName: "Atlas AI",
      ownerId: userMap["founder@demo.com"].id,
      tags: json(["合作", "内容联名"]),
      relationshipWarmth: RelationshipWarmth.HOT,
      lastInteractionAt: subDays(now, 1),
      notes: "更关心合作 launch 节奏和品牌露出方式。",
    },
    {
      name: "Mason Liu",
      title: "Partner",
      email: "mason@delta.demo",
      companyName: "Delta Capital",
      ownerId: userMap["founder@demo.com"].id,
      tags: json(["资源型合作"]),
      relationshipWarmth: RelationshipWarmth.WARM,
      lastInteractionAt: subDays(now, 8),
      notes: "愿意试一次联合沙龙，前提是嘉宾质量能保证。",
    },
    {
      name: "Iris Qiao",
      title: "产品负责人",
      email: "iris@internal.demo",
      ownerId: userMap["founder@demo.com"].id,
      tags: json(["内部事项", "优先级冲突"]),
      relationshipWarmth: RelationshipWarmth.CHAMPION,
      lastInteractionAt: subDays(now, 1),
      notes: "当前卡在路线优先级和销售需求冲突。",
    },
    {
      name: "Samuel Lee",
      title: "交付负责人",
      email: "samuel@internal.demo",
      ownerId: userMap["founder@demo.com"].id,
      tags: json(["内部事项", "交付容量"]),
      relationshipWarmth: RelationshipWarmth.HOT,
      lastInteractionAt: subDays(now, 1),
      notes: "如果新增 Acme 试点，需要先确认交付资源。",
    },
    {
      name: "Nina Rao",
      title: "Head of People",
      email: "nina@greenpeak.demo",
      companyName: "GreenPeak Health",
      ownerId: userMap["recruiter@demo.com"].id,
      tags: json(["最终面试人"]),
      relationshipWarmth: RelationshipWarmth.WARM,
      lastInteractionAt: subDays(now, 3),
      notes: "需要明确候选人是否能承担 0-1 团队搭建。",
    },
  ];

  for (const contact of contactInputs) {
    await prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        companyId: contact.companyName ? companyMap[contact.companyName].id : undefined,
        ownerId: contact.ownerId,
        name: contact.name,
        title: contact.title,
        email: contact.email,
        tags: contact.tags,
        notes: contact.notes,
        relationshipStage:
          contact.relationshipWarmth === RelationshipWarmth.CHAMPION
            ? "champion"
            : contact.relationshipWarmth === RelationshipWarmth.HOT
              ? "active"
              : contact.relationshipWarmth === RelationshipWarmth.WARM
                ? "warming"
                : "cooling",
        relationshipTemperature:
          contact.relationshipWarmth === RelationshipWarmth.CHAMPION
            ? 90
            : contact.relationshipWarmth === RelationshipWarmth.HOT
              ? 78
              : contact.relationshipWarmth === RelationshipWarmth.WARM
                ? 62
                : 38,
        relationshipWarmth: contact.relationshipWarmth,
        lastInteractionAt: contact.lastInteractionAt,
      },
    });
  }

  const contacts = await prisma.contact.findMany({
    where: { workspaceId: workspace.id },
  });
  const contactMap = Object.fromEntries(contacts.map((contact) => [contact.name, contact]));

  const opportunityInputs = [
    {
      title: "Acme 年度经营动作控制台试点",
      description: "围绕销售与交付协同落地第一期试点。",
      type: OpportunityType.CLIENT,
      stage: OpportunityStage.ADVANCING,
      riskLevel: RiskLevel.MEDIUM,
      nextAction: "发送会后 ROI 跟进邮件并确认采购评估流程",
      dueDate: addDays(now, 1),
      priorityScore: 95,
      companyName: "Acme Robotics",
      ownerId: userMap["saleslead@demo.com"].id,
      contacts: ["Vivian Chen", "Daniel Xu"],
    },
    {
      title: "Beacon 零售网络恢复单",
      description: "机会接近流失，需要重新定义切入点。",
      type: OpportunityType.CLIENT,
      stage: OpportunityStage.WAITING_THEM,
      riskLevel: RiskLevel.HIGH,
      nextAction: "重新给出试点范围和内部 champion 方案",
      dueDate: todayAt(11, 0),
      priorityScore: 81,
      companyName: "Beacon Retail",
      ownerId: userMap["saleslead@demo.com"].id,
      contacts: ["Olivia Park"],
    },
    {
      title: "Nimbus 实施与法务联动项目",
      description: "方案方向明确，但卡在内部协同和交付资源。",
      type: OpportunityType.CLIENT,
      stage: OpportunityStage.INTERNAL_SYNC,
      riskLevel: RiskLevel.HIGH,
      nextAction: "组织售前、法务、交付三方对齐会",
      dueDate: addDays(now, 2),
      priorityScore: 84,
      companyName: "Nimbus Systems",
      ownerId: userMap["saleslead@demo.com"].id,
      contacts: ["Zack Han", "Samuel Lee"],
    },
    {
      title: "GreenPeak VP Sales 职位委托",
      description: "核心职位，需在本周确认 shortlist。",
      type: OpportunityType.RECRUITING,
      stage: OpportunityStage.ADVANCING,
      riskLevel: RiskLevel.MEDIUM,
      nextAction: "安排候选人终面并同步反馈模板",
      dueDate: todayAt(15, 30),
      priorityScore: 90,
      companyName: "GreenPeak Health",
      ownerId: userMap["recruiter@demo.com"].id,
      contacts: ["Teresa Wang", "Nina Rao"],
    },
    {
      title: "Ben Carter 候选人推进",
      description: "进入二面，需尽快锁终面和 package 预期。",
      type: OpportunityType.RECRUITING,
      stage: OpportunityStage.ADVANCING,
      riskLevel: RiskLevel.MEDIUM,
      nextAction: "确认二面 panel 与时间窗",
      dueDate: addDays(now, 1),
      priorityScore: 86,
      companyName: "GreenPeak Health",
      ownerId: userMap["recruiter@demo.com"].id,
      contacts: ["Ben Carter", "Teresa Wang"],
    },
    {
      title: "Aya Nakamura 候选人推进",
      description: "待安排面试，需先发 panel briefing。",
      type: OpportunityType.RECRUITING,
      stage: OpportunityStage.CONTACTED,
      riskLevel: RiskLevel.HIGH,
      nextAction: "生成后续面试安排动作并等待审批",
      dueDate: todayAt(16, 0),
      priorityScore: 83,
      companyName: "GreenPeak Health",
      ownerId: userMap["recruiter@demo.com"].id,
      contacts: ["Aya Nakamura", "Teresa Wang", "Nina Rao"],
    },
    {
      title: "Leo Sun 候选人补位",
      description: "候选人已流失，需记入人才地图。",
      type: OpportunityType.RECRUITING,
      stage: OpportunityStage.LOST,
      riskLevel: RiskLevel.MEDIUM,
      nextAction: "记录流失原因并保留长期关系",
      dueDate: subDays(now, 1),
      priorityScore: 41,
      companyName: "GreenPeak Health",
      ownerId: userMap["recruiter@demo.com"].id,
      contacts: ["Leo Sun"],
      lossReason: "已接受其他 offer",
    },
    {
      title: "Atlas AI 联合解决方案合作",
      description: "合作可能带来内容与渠道双向增益。",
      type: OpportunityType.PARTNERSHIP,
      stage: OpportunityStage.CONTACTED,
      riskLevel: RiskLevel.MEDIUM,
      nextAction: "确认联名方案、渠道分工和发布时间",
      dueDate: todayAt(16, 30),
      priorityScore: 88,
      companyName: "Atlas AI",
      ownerId: userMap["founder@demo.com"].id,
      contacts: ["Lena Zhou"],
    },
    {
      title: "Delta Capital 闭门沙龙共办",
      description: "有望升级为长期转介合作。",
      type: OpportunityType.PARTNERSHIP,
      stage: OpportunityStage.ADVANCING,
      riskLevel: RiskLevel.MEDIUM,
      nextAction: "确认嘉宾名单和品牌呈现方式",
      dueDate: addDays(now, 3),
      priorityScore: 79,
      companyName: "Delta Capital",
      ownerId: userMap["founder@demo.com"].id,
      contacts: ["Mason Liu"],
    },
    {
      title: "产品路线优先级冲突处理",
      description: "内部需统一本周经营优先级和交付安排。",
      type: OpportunityType.INTERNAL,
      stage: OpportunityStage.INTERNAL_SYNC,
      riskLevel: RiskLevel.CRITICAL,
      nextAction: "在本周内明确版本优先级与承诺边界",
      dueDate: todayAt(18, 0),
      priorityScore: 92,
      ownerId: userMap["founder@demo.com"].id,
      contacts: ["Iris Qiao", "Samuel Lee"],
    },
  ];

  for (const opportunity of opportunityInputs) {
    const lastProgressAt =
      opportunity.title === "Beacon 零售网络恢复单"
        ? subDays(now, 6)
        : opportunity.title === "Nimbus 实施与法务联动项目"
          ? subDays(now, 7)
          : opportunity.title === "Ben Carter 候选人推进"
            ? subDays(now, 8)
            : opportunity.title === "Atlas AI 联合解决方案合作"
              ? subDays(now, 6)
              : opportunity.title === "Delta Capital 闭门沙龙共办"
                ? subDays(now, 8)
                : opportunity.title === "产品路线优先级冲突处理"
                  ? subDays(now, 7)
                  : subDays(now, 1);

    await prisma.opportunity.create({
      data: {
        workspaceId: workspace.id,
        companyId: opportunity.companyName ? companyMap[opportunity.companyName].id : undefined,
        ownerId: opportunity.ownerId,
        title: opportunity.title,
        description: opportunity.description,
        type: opportunity.type,
        stage: opportunity.stage,
        riskLevel: opportunity.riskLevel,
        nextAction: opportunity.nextAction,
        lastProgressAt,
        nextStepSummary: opportunity.nextAction,
        dueDate: opportunity.dueDate,
        priorityScore: opportunity.priorityScore,
        lossReason: opportunity.lossReason,
        contacts: {
          connect: opportunity.contacts.map((name) => ({ id: contactMap[name].id })),
        },
      },
    });
  }

  const opportunities = await prisma.opportunity.findMany({
    where: { workspaceId: workspace.id },
  });
  const opportunityMap = Object.fromEntries(opportunities.map((opportunity) => [opportunity.title, opportunity]));

  const meetingInputs = [
    {
      title: "Acme 采购评估同步会",
      agenda: "对齐 ROI、采购流程与内部推动节奏",
      location: "Zoom",
      status: MeetingStatus.SCHEDULED,
      startsAt: todayAt(9, 30),
      endsAt: todayAt(10, 15),
      companyName: "Acme Robotics",
      opportunityTitle: "Acme 年度经营动作控制台试点",
      ownerId: userMap["saleslead@demo.com"].id,
      contacts: ["Vivian Chen", "Daniel Xu"],
    },
    {
      title: "Beacon 恢复方案电话会",
      agenda: "确认是否以缩小试点范围挽回机会",
      location: "Meet",
      status: MeetingStatus.SCHEDULED,
      startsAt: todayAt(11, 0),
      endsAt: todayAt(11, 30),
      companyName: "Beacon Retail",
      opportunityTitle: "Beacon 零售网络恢复单",
      ownerId: userMap["saleslead@demo.com"].id,
      contacts: ["Olivia Park"],
    },
    {
      title: "GreenPeak 职位推进同步",
      agenda: "对齐 shortlist 与后续面试安排",
      location: "Zoom",
      status: MeetingStatus.SCHEDULED,
      startsAt: todayAt(14, 30),
      endsAt: todayAt(15, 15),
      companyName: "GreenPeak Health",
      opportunityTitle: "GreenPeak VP Sales 职位委托",
      ownerId: userMap["recruiter@demo.com"].id,
      contacts: ["Teresa Wang", "Nina Rao", "Aya Nakamura"],
    },
    {
      title: "Atlas 联名合作讨论",
      agenda: "确认合作范围、launch 节点和内容素材",
      location: "Meet",
      status: MeetingStatus.SCHEDULED,
      startsAt: todayAt(16, 30),
      endsAt: todayAt(17, 15),
      companyName: "Atlas AI",
      opportunityTitle: "Atlas AI 联合解决方案合作",
      ownerId: userMap["founder@demo.com"].id,
      contacts: ["Lena Zhou"],
    },
    {
      title: "经营优先级冲突复盘",
      agenda: "明确销售承诺与产品路线优先级",
      location: "War Room",
      status: MeetingStatus.COMPLETED,
      startsAt: subDays(todayAt(18, 30), 1),
      endsAt: subDays(todayAt(19, 30), 1),
      ownerId: userMap["founder@demo.com"].id,
      opportunityTitle: "产品路线优先级冲突处理",
      contacts: ["Iris Qiao", "Samuel Lee"],
    },
    {
      title: "Delta 闭门沙龙方案回顾",
      agenda: "梳理嘉宾名单、议题与合作口径",
      location: "Zoom",
      status: MeetingStatus.COMPLETED,
      startsAt: subDays(todayAt(15, 0), 1),
      endsAt: subDays(todayAt(15, 45), 1),
      companyName: "Delta Capital",
      opportunityTitle: "Delta Capital 闭门沙龙共办",
      ownerId: userMap["founder@demo.com"].id,
      contacts: ["Mason Liu"],
    },
    {
      title: "Ben Carter 首轮复盘",
      agenda: "对齐候选人表现与补充考察点",
      location: "Zoom",
      status: MeetingStatus.COMPLETED,
      startsAt: subDays(todayAt(13, 0), 3),
      endsAt: subDays(todayAt(13, 45), 3),
      companyName: "GreenPeak Health",
      opportunityTitle: "Ben Carter 候选人推进",
      ownerId: userMap["recruiter@demo.com"].id,
      contacts: ["Ben Carter", "Teresa Wang"],
    },
    {
      title: "Acme Discovery 回顾",
      agenda: "梳理初步需求和关键约束",
      location: "Meet",
      status: MeetingStatus.COMPLETED,
      startsAt: subDays(todayAt(10, 0), 5),
      endsAt: subDays(todayAt(10, 45), 5),
      companyName: "Acme Robotics",
      opportunityTitle: "Acme 年度经营动作控制台试点",
      ownerId: userMap["saleslead@demo.com"].id,
      contacts: ["Vivian Chen", "Daniel Xu"],
    },
  ];

  for (const meeting of meetingInputs) {
    await prisma.meeting.create({
      data: {
        workspaceId: workspace.id,
        companyId: meeting.companyName ? companyMap[meeting.companyName].id : undefined,
        opportunityId: meeting.opportunityTitle ? opportunityMap[meeting.opportunityTitle].id : undefined,
        ownerId: meeting.ownerId,
        title: meeting.title,
        agenda: meeting.agenda,
        location: meeting.location,
        status: meeting.status,
        startsAt: meeting.startsAt,
        endsAt: meeting.endsAt,
        contacts: {
          connect: meeting.contacts.map((name) => ({ id: contactMap[name].id })),
        },
      },
    });
  }

  const meetings = await prisma.meeting.findMany({
    where: { workspaceId: workspace.id },
  });
  const meetingMap = Object.fromEntries(meetings.map((meeting) => [meeting.title, meeting]));

  await prisma.company.update({
    where: { id: companyMap["Acme Robotics"].id },
    data: {
      externalSource: ImportSourceType.HUBSPOT,
      externalObjectType: "COMPANY",
      externalObjectId: "hubspot-company-acme",
      externalOwnerId: "hubspot-owner-sales",
      externalSyncedAt: subDays(now, 2),
    },
  });
  await prisma.company.update({
    where: { id: companyMap["Delta Capital"].id },
    data: {
      externalSource: ImportSourceType.HUBSPOT,
      externalObjectType: "COMPANY",
      externalObjectId: "hubspot-company-delta",
      externalOwnerId: "hubspot-owner-founder",
      externalSyncedAt: subDays(now, 2),
    },
  });
  await prisma.company.update({
    where: { id: companyMap["GreenPeak Health"].id },
    data: {
      externalSource: ImportSourceType.SALESFORCE,
      externalObjectType: "ACCOUNT",
      externalObjectId: "sf-account-greenpeak",
      externalOwnerId: "sf-owner-recruiting",
      externalSyncedAt: subDays(now, 1),
    },
  });
  await prisma.company.update({
    where: { id: companyMap["Atlas AI"].id },
    data: {
      externalSource: ImportSourceType.SALESFORCE,
      externalObjectType: "ACCOUNT",
      externalObjectId: "sf-account-atlas",
      externalOwnerId: "sf-owner-founder",
      externalSyncedAt: subDays(now, 1),
    },
  });

  await prisma.contact.update({
    where: { id: contactMap["Vivian Chen"].id },
    data: {
      externalSource: ImportSourceType.HUBSPOT,
      externalObjectType: "CONTACT",
      externalObjectId: "hubspot-contact-vivian",
      externalOwnerId: "hubspot-owner-sales",
      externalSyncedAt: subDays(now, 2),
    },
  });
  await prisma.contact.update({
    where: { id: contactMap["Mason Liu"].id },
    data: {
      externalSource: ImportSourceType.HUBSPOT,
      externalObjectType: "CONTACT",
      externalObjectId: "hubspot-contact-mason",
      externalOwnerId: "hubspot-owner-founder",
      externalSyncedAt: subDays(now, 2),
    },
  });
  await prisma.contact.update({
    where: { id: contactMap["Aya Nakamura"].id },
    data: {
      externalSource: ImportSourceType.SALESFORCE,
      externalObjectType: "CONTACT",
      externalObjectId: "sf-contact-aya",
      externalOwnerId: "sf-owner-recruiting",
      externalSyncedAt: subDays(now, 1),
    },
  });
  await prisma.contact.update({
    where: { id: contactMap["Lena Zhou"].id },
    data: {
      externalSource: ImportSourceType.SALESFORCE,
      externalObjectType: "CONTACT",
      externalObjectId: "sf-contact-lena",
      externalOwnerId: "sf-owner-founder",
      externalSyncedAt: subDays(now, 1),
    },
  });

  await prisma.opportunity.update({
    where: { id: opportunityMap["Acme 年度经营动作控制台试点"].id },
    data: {
      externalSource: ImportSourceType.HUBSPOT,
      externalObjectType: "DEAL",
      externalObjectId: "hubspot-deal-acme",
      externalOwnerId: "hubspot-owner-sales",
      externalSyncedAt: subDays(now, 2),
    },
  });
  await prisma.opportunity.update({
    where: { id: opportunityMap["Delta Capital 闭门沙龙共办"].id },
    data: {
      externalSource: ImportSourceType.HUBSPOT,
      externalObjectType: "DEAL",
      externalObjectId: "hubspot-deal-delta",
      externalOwnerId: "hubspot-owner-founder",
      externalSyncedAt: subDays(now, 2),
    },
  });
  await prisma.opportunity.update({
    where: { id: opportunityMap["GreenPeak VP Sales 职位委托"].id },
    data: {
      externalSource: ImportSourceType.SALESFORCE,
      externalObjectType: "OPPORTUNITY",
      externalObjectId: "sf-opp-greenpeak",
      externalOwnerId: "sf-owner-recruiting",
      externalSyncedAt: subDays(now, 1),
    },
  });
  await prisma.opportunity.update({
    where: { id: opportunityMap["Atlas AI 联合解决方案合作"].id },
    data: {
      externalSource: ImportSourceType.SALESFORCE,
      externalObjectType: "OPPORTUNITY",
      externalObjectId: "sf-opp-atlas",
      externalOwnerId: "sf-owner-founder",
      externalSyncedAt: subDays(now, 1),
    },
  });

  await prisma.meeting.update({
    where: { id: meetingMap["Acme Discovery 回顾"].id },
    data: {
      externalSource: ImportSourceType.HUBSPOT,
      externalObjectType: "NOTE",
      externalObjectId: "hubspot-note-acme-discovery",
      externalOwnerId: "hubspot-owner-sales",
      externalSyncedAt: subDays(now, 2),
    },
  });
  await prisma.meeting.update({
    where: { id: meetingMap["Delta 闭门沙龙方案回顾"].id },
    data: {
      externalSource: ImportSourceType.HUBSPOT,
      externalObjectType: "NOTE",
      externalObjectId: "hubspot-note-delta-salon",
      externalOwnerId: "hubspot-owner-founder",
      externalSyncedAt: subDays(now, 2),
    },
  });
  await prisma.meeting.update({
    where: { id: meetingMap["GreenPeak 职位推进同步"].id },
    data: {
      externalSource: ImportSourceType.SALESFORCE,
      externalObjectType: "EVENT",
      externalObjectId: "sf-event-greenpeak-sync",
      externalOwnerId: "sf-owner-recruiting",
      externalSyncedAt: subDays(now, 1),
    },
  });
  await prisma.meeting.update({
    where: { id: meetingMap["Atlas 联名合作讨论"].id },
    data: {
      externalSource: ImportSourceType.SALESFORCE,
      externalObjectType: "EVENT",
      externalObjectId: "sf-event-atlas-partnership",
      externalOwnerId: "sf-owner-founder",
      externalSyncedAt: subDays(now, 1),
    },
  });

  const meetingNotes = [
    {
      meetingTitle: "Acme 采购评估同步会",
      attendeesSummary: "Vivian 关注 ROI 与采购流程，Daniel 关注实施协同。",
      relationshipSummary: "过去 14 天内已完成 discovery 与内部方案 review，关系处于升温期。",
      previousConclusion: "客户认可价值，但需要一封结构化跟进帮 Vivian 带回财务评估。",
      meetingGoal: "拿到采购评估下一步，并确认内部 champion 如何推动。",
      recommendedQuestions: "如果在 2 周内启动试点，内部最需要先确认哪三个条件？\nVivian 对 ROI 证明需要什么形式？\nDaniel 是否愿意同步 IT 与交付团队参加下轮会？",
      riskAlerts: "若会后 24 小时内未跟进，机会会回到等待对方状态；内部交付容量也需同步。",
      liveTranscript: "09:32 Vivian: 我们愿意进入评估，但需要更清楚的收益假设。\n09:41 Daniel: 我们内部会需要交付和 IT 一起看范围。\n09:57 你方: 会后补发 ROI 摘要和试点建议。",
      summary: "客户已进入采购评估窗口，最重要动作是 24 小时内发出 ROI + 试点范围 follow-up。",
      keyDecisions: "客户接受试点思路。\nVivian 负责拉财务评估。\nDaniel 愿意组织内部 review。",
      confirmations: "确认一封会后邮件需附 ROI 框架。\n确认下周需要一次内部 + 客户联合会。",
    },
    {
      meetingTitle: "Beacon 恢复方案电话会",
      attendeesSummary: "Olivia 独立参会，当前内部兴趣下降。",
      relationshipSummary: "上次报价后沉默 9 天，关系进入风险期。",
      previousConclusion: "继续追价无效，需要缩小试点范围重新切入。",
      meetingGoal: "验证是否还有可恢复切口。",
      recommendedQuestions: "如果只保留最小试点，团队还会不会推进？\n当前最大的内部阻力是什么？",
      riskAlerts: "若本周没有新的切入点，建议标记为流失。",
      liveTranscript: "11:08 Olivia: 预算更紧，但如果先试一个区域，或许还能讨论。\n11:21 你方: 可以给你一版更小的试点范围。",
      summary: "机会尚未完全关闭，但必须换打法。",
      keyDecisions: "给出缩小版试点。\n若无回复，周五转入 lost 复盘。",
      confirmations: "需要一封更克制的 follow-up 邮件。",
    },
    {
      meetingTitle: "GreenPeak 职位推进同步",
      attendeesSummary: "Teresa 和 Nina 关注候选人节奏，Aya 候选人出席 10 分钟确认可用时间。",
      relationshipSummary: "客户紧迫度高，候选人兴趣稳定。",
      previousConclusion: "职位已进入 shortlist 冲刺阶段，需要加快面试安排。",
      meetingGoal: "锁定 Aya 的后续面试安排，并统一 panel 关注点。",
      recommendedQuestions: "Aya 下周二或周三哪个时间更稳？\nNina 最想验证的能力维度是什么？",
      riskAlerts: "若本周不锁时间，Aya 可能转向其他流程。",
      liveTranscript: "14:36 Teresa: 希望本周确认 panel。\n14:44 Aya: 下周三下午更合适。\n14:50 Nina: 需要提前看到候选人摘要。",
      summary: "建议生成“安排 Aya 终面”的动作，并附候选人 briefing。",
      keyDecisions: "Teresa 同意下周三为首选。\nNina 需要提前 briefing。",
      confirmations: "生成后续面试安排动作。\n若审批通过，系统创建会议占位。",
    },
    {
      meetingTitle: "Atlas 联名合作讨论",
      attendeesSummary: "Lena 亲自对接，合作意愿明确。",
      relationshipSummary: "已经有 2 次合作交流，关系稳定升温。",
      previousConclusion: "双方认可联合方案，需要把内容和渠道写清楚。",
      meetingGoal: "确认 launch 节点和分工。",
      recommendedQuestions: "首波发布更偏内容还是活动？\n双方对 leads 归属如何定义？",
      riskAlerts: "若分工不清，合作会拖延。",
      liveTranscript: "16:37 Lena: 更希望先做联合内容，再试活动。\n16:51 你方: 会后给你一版合作路径图。",
      summary: "合作有明确推进意愿，建议发送合作 brief。",
      keyDecisions: "先做联合内容。\n活动作为第二阶段。",
      confirmations: "48 小时内发合作 brief。",
    },
    {
      meetingTitle: "经营优先级冲突复盘",
      attendeesSummary: "Iris 与 Samuel 需要统一本周承诺边界。",
      relationshipSummary: "内部信任良好，但优先级观点冲突。",
      previousConclusion: "先有一致经营目标，再排产品资源。",
      meetingGoal: "定本周优先级与对外承诺边界。",
      recommendedQuestions: "哪些事情必须在本周完成？\n哪些承诺需要重新对齐客户？",
      riskAlerts: "若不立即记录 action items，内部冲突会外溢到客户。",
      liveTranscript: "18:41 Iris: 不能继续边卖边改范围。\n18:50 Samuel: 交付这周最多接一个新试点。\n19:10 你方: 今晚整理纪要并同步团队。",
      summary: "需要立即发送内部纪要，并把 Acme 交付容量同步给销售。",
      keyDecisions: "本周只接一个新试点。\n产品路线优先级以经营影响排序。",
      confirmations: "发送内部纪要。\n更新 Acme 机会下一步动作。",
    },
    {
      meetingTitle: "Delta 闭门沙龙方案回顾",
      attendeesSummary: "Mason 关注活动品牌质感和嘉宾质量。",
      relationshipSummary: "关系向长期合作转化的窗口刚打开。",
      previousConclusion: "先把一次活动做成样板合作。",
      meetingGoal: "确认活动方向与资源交换。",
      recommendedQuestions: "什么样的嘉宾结构最能打动你？\n你期望活动后如何承接 leads？",
      riskAlerts: "如果嘉宾标准不明确，推进会反复。",
      liveTranscript: "15:08 Mason: 更关注创始人圈层质量。\n15:30 你方: 会整理嘉宾画像和合作说明。",
      summary: "建议发一版沙龙合作简报并提出嘉宾画像。",
      keyDecisions: "双方先围绕创始人圈层设计活动。",
      confirmations: "48 小时内发简报。",
    },
    {
      meetingTitle: "Ben Carter 首轮复盘",
      attendeesSummary: "客户认可 Ben 的销售体系化能力。",
      relationshipSummary: "候选人与客户均在正向推进。",
      previousConclusion: "需要二面验证 0-1 招聘搭建能力。",
      meetingGoal: "明确二面 panel 和补充问题。",
      recommendedQuestions: "Ben 最适合带多大规模团队？\n需要在终面前补什么案例？",
      riskAlerts: "若面试节奏拖慢，Ben 会并行其他机会。",
      liveTranscript: "13:14 Teresa: 想再看 Ben 的团队搭建案例。\n13:36 你方: 我们整理二面面试提纲。",
      summary: "需要安排二面并同步评估标准。",
      keyDecisions: "进入二面。",
      confirmations: "生成二面安排动作。",
    },
    {
      meetingTitle: "Acme Discovery 回顾",
      attendeesSummary: "Vivian 与 Daniel 对问题定义一致。",
      relationshipSummary: "关系建立顺利，价值认知明确。",
      previousConclusion: "下一步是将价值语言转化为采购语言。",
      meetingGoal: "回顾问题和下一步。",
      recommendedQuestions: "采购周期通常多长？\n交付时最怕出现什么？",
      riskAlerts: "不要只讲 AI 能力，要讲可控与审计。",
      liveTranscript: "10:05 Daniel: 关键在于没人能持续盯动作。\n10:28 Vivian: 如果能审批和追踪，就有说服力。",
      summary: "客户核心诉求已明确，为后续 briefing 打下基础。",
      keyDecisions: "进入下一轮 ROI 讨论。",
      confirmations: "准备采购视角材料。",
    },
  ];

  for (const note of meetingNotes) {
    await prisma.meetingNote.create({
      data: {
        workspaceId: workspace.id,
        meetingId: meetingMap[note.meetingTitle].id,
        attendeesSummary: note.attendeesSummary,
        relationshipSummary: note.relationshipSummary,
        previousConclusion: note.previousConclusion,
        meetingGoal: note.meetingGoal,
        recommendedQuestions: note.recommendedQuestions,
        riskAlerts: note.riskAlerts,
        liveTranscript: note.liveTranscript,
        summary: note.summary,
        keyDecisions: note.keyDecisions,
        confirmations: note.confirmations,
      },
    });
  }

  const actionItems = [
    {
      title: "发送 Acme 会后 ROI 跟进邮件",
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      description: "基于今天会议内容生成一封可直接发出的跟进邮件。",
      aiReason: "会议刚确认采购评估窗口，24 小时内跟进能显著提升推进概率。",
      draftContent: "Vivian 你好，基于今天的讨论，我整理了 ROI 框架、试点范围建议以及下周内部 review 所需的准备项……",
      metadata: json({ nextStage: OpportunityStage.WAITING_THEM, threadSubject: "Acme ROI follow-up" }),
      riskLevel: RiskLevel.HIGH,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.PENDING_APPROVAL,
      suggestedExecutionAt: addMinutes(todayAt(10, 20), 10),
      dueDate: todayAt(12, 0),
      opportunityTitle: "Acme 年度经营动作控制台试点",
      meetingTitle: "Acme 采购评估同步会",
      contactName: "Vivian Chen",
      ownerId: userMap["saleslead@demo.com"].id,
    },
    {
      title: "更新 Acme 机会为等待对方",
      actionType: ActionType.UPDATE_OPPORTUNITY_STAGE,
      description: "客户已接受评估路径，更新机会阶段。",
      aiReason: "会后下一步已明确，阶段应同步反映状态。",
      metadata: json({ nextStage: OpportunityStage.WAITING_THEM }),
      riskLevel: RiskLevel.MEDIUM,
      executionMode: ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
      requiresApproval: false,
      status: ActionStatus.EXECUTED,
      suggestedExecutionAt: todayAt(10, 20),
      dueDate: todayAt(10, 30),
      opportunityTitle: "Acme 年度经营动作控制台试点",
      meetingTitle: "Acme 采购评估同步会",
      contactName: "Daniel Xu",
      ownerId: userMap["saleslead@demo.com"].id,
    },
    {
      title: "起草 Beacon 恢复试点邮件",
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      description: "输出一封更克制的恢复联系邮件。",
      aiReason: "当前机会已接近流失，需要先降低推进摩擦。",
      draftContent: "Olivia 你好，我们整理了一版更轻量的试点建议，希望把投入控制在最小范围……",
      riskLevel: RiskLevel.HIGH,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.PENDING_APPROVAL,
      suggestedExecutionAt: todayAt(11, 45),
      dueDate: todayAt(17, 0),
      opportunityTitle: "Beacon 零售网络恢复单",
      meetingTitle: "Beacon 恢复方案电话会",
      contactName: "Olivia Park",
      ownerId: userMap["saleslead@demo.com"].id,
    },
    {
      title: "安排 Nimbus 内部协同会",
      actionType: ActionType.CREATE_MEETING,
      description: "组织售前、法务、交付三方同步。",
      aiReason: "当前卡点来自内部协同，不先打通会继续拖慢客户侧推进。",
      riskLevel: RiskLevel.MEDIUM,
      executionMode: ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
      requiresApproval: false,
      status: ActionStatus.EXECUTED,
      suggestedExecutionAt: addDays(now, 1),
      dueDate: addDays(now, 1),
      opportunityTitle: "Nimbus 实施与法务联动项目",
      contactName: "Zack Han",
      ownerId: userMap["saleslead@demo.com"].id,
    },
    {
      title: "发送内部纪要给产品与交付",
      actionType: ActionType.SEND_MEETING_SUMMARY,
      description: "同步经营优先级冲突复盘纪要。",
      aiReason: "内部纪要默认可自动执行，且这是统一节奏的关键动作。",
      draftContent: "今日复盘结论：本周只承接一个新试点，Acme 进入评估阶段，但交付资源需先锁定……",
      riskLevel: RiskLevel.MEDIUM,
      executionMode: ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
      requiresApproval: false,
      status: ActionStatus.EXECUTED,
      suggestedExecutionAt: subDays(todayAt(20, 0), 1),
      dueDate: todayAt(9, 0),
      opportunityTitle: "产品路线优先级冲突处理",
      meetingTitle: "经营优先级冲突复盘",
      contactName: "Iris Qiao",
      ownerId: userMap["founder@demo.com"].id,
    },
    {
      title: "更新内部优先级事项下一步",
      actionType: ActionType.UPDATE_OPPORTUNITY_STAGE,
      description: "把内部事项下一步更新为资源确认。",
      aiReason: "避免内部冲突继续影响外部承诺。",
      metadata: json({ nextAction: "确认 Acme 试点的交付资源并同步销售承诺边界" }),
      riskLevel: RiskLevel.HIGH,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.PENDING_APPROVAL,
      suggestedExecutionAt: todayAt(9, 0),
      dueDate: todayAt(12, 0),
      opportunityTitle: "产品路线优先级冲突处理",
      meetingTitle: "经营优先级冲突复盘",
      contactName: "Samuel Lee",
      ownerId: userMap["founder@demo.com"].id,
    },
    {
      title: "安排 Aya Nakamura 终面",
      actionType: ActionType.SCHEDULE_INTERVIEW,
      description: "创建候选人终面并发送 panel briefing。",
      aiReason: "Aya 当前处于高流失窗口，审批通过后应立刻锁定时间。",
      draftContent: "候选人终面建议安排在下周三 15:00-16:00，panel 为 Teresa + Nina，附件含候选人摘要。",
      metadata: json({ createMeetingTitle: "Aya Nakamura 终面", nextStage: OpportunityStage.ADVANCING }),
      riskLevel: RiskLevel.HIGH,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.PENDING_APPROVAL,
      suggestedExecutionAt: todayAt(15, 20),
      dueDate: todayAt(18, 0),
      opportunityTitle: "Aya Nakamura 候选人推进",
      meetingTitle: "GreenPeak 职位推进同步",
      contactName: "Aya Nakamura",
      ownerId: userMap["recruiter@demo.com"].id,
    },
    {
      title: "给 Ben Carter 发送二面说明",
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      description: "起草候选人二面说明邮件。",
      aiReason: "Ben 关注流程效率，提前说明能稳住体验。",
      draftContent: "Ben，你好，和你同步一下 GreenPeak 二面的安排思路以及 panel 关注点……",
      riskLevel: RiskLevel.MEDIUM,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.PENDING_APPROVAL,
      suggestedExecutionAt: addDays(now, 1),
      dueDate: addDays(now, 1),
      opportunityTitle: "Ben Carter 候选人推进",
      meetingTitle: "Ben Carter 首轮复盘",
      contactName: "Ben Carter",
      ownerId: userMap["recruiter@demo.com"].id,
    },
    {
      title: "发送 Atlas 合作 brief",
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      description: "会后 48 小时内发送合作路径图和 brief。",
      aiReason: "Lena 已表明合作意愿，及时收口可避免热度流失。",
      draftContent: "Lena 你好，基于今天讨论，我把合作方向、launch 节点和双方分工整理成一页 brief……",
      metadata: json({ nextStage: OpportunityStage.ADVANCING }),
      riskLevel: RiskLevel.MEDIUM,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.PENDING_APPROVAL,
      suggestedExecutionAt: todayAt(17, 30),
      dueDate: addDays(now, 2),
      opportunityTitle: "Atlas AI 联合解决方案合作",
      meetingTitle: "Atlas 联名合作讨论",
      contactName: "Lena Zhou",
      ownerId: userMap["founder@demo.com"].id,
    },
    {
      title: "创建 Delta 沙龙嘉宾画像待办",
      actionType: ActionType.CREATE_TASK,
      description: "输出一版嘉宾画像待办并指派给运营协调。",
      aiReason: "先把嘉宾画像成形，再推进合作具体落地。",
      riskLevel: RiskLevel.LOW,
      executionMode: ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
      requiresApproval: false,
      status: ActionStatus.EXECUTED,
      suggestedExecutionAt: addDays(now, 1),
      dueDate: addDays(now, 2),
      opportunityTitle: "Delta Capital 闭门沙龙共办",
      meetingTitle: "Delta 闭门沙龙方案回顾",
      contactName: "Mason Liu",
      ownerId: userMap["ops@demo.com"].id,
    },
    {
      title: "修订 Beacon 截止时间",
      actionType: ActionType.CHANGE_DUE_DATE,
      description: "将恢复方案截止时间延后一天，以等待 Olivia 内部反馈。",
      aiReason: "目前需要保留窗口，但不宜继续频繁推进。",
      metadata: json({ dueDateOffsetDays: 1 }),
      riskLevel: RiskLevel.MEDIUM,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.PENDING_APPROVAL,
      suggestedExecutionAt: todayAt(12, 0),
      dueDate: todayAt(12, 30),
      opportunityTitle: "Beacon 零售网络恢复单",
      contactName: "Olivia Park",
      ownerId: userMap["saleslead@demo.com"].id,
    },
    {
      title: "指派 Samuel 跟进 Acme 交付评估",
      actionType: ActionType.ASSIGN_OWNER,
      description: "新增内部协同 owner。",
      aiReason: "交付容量是当前推进的关键前置条件。",
      metadata: json({ assignToEmail: "ops@demo.com" }),
      riskLevel: RiskLevel.MEDIUM,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.PENDING_APPROVAL,
      suggestedExecutionAt: todayAt(10, 40),
      dueDate: todayAt(13, 0),
      opportunityTitle: "Acme 年度经营动作控制台试点",
      contactName: "Samuel Lee",
      ownerId: userMap["founder@demo.com"].id,
    },
    {
      title: "起草 GreenPeak 内部纪要",
      actionType: ActionType.DRAFT_INTERNAL_NOTE,
      description: "把 shortlist 和面试关注点整理为内部纪要。",
      aiReason: "招聘协同信息密度高，内部纪要自动执行可以减少漏项。",
      draftContent: "GreenPeak 当前 shortlist：Ben / Aya；Aya 需优先锁终面；Nina 希望提前看到 briefing……",
      riskLevel: RiskLevel.LOW,
      executionMode: ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
      requiresApproval: false,
      status: ActionStatus.EXECUTED,
      suggestedExecutionAt: todayAt(15, 20),
      dueDate: todayAt(16, 0),
      opportunityTitle: "GreenPeak VP Sales 职位委托",
      meetingTitle: "GreenPeak 职位推进同步",
      contactName: "Teresa Wang",
      ownerId: userMap["recruiter@demo.com"].id,
    },
    {
      title: "起草候选人 Leo 关系维护短信",
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      description: "以低压力方式保持长期关系。",
      aiReason: "虽然当前流失，但仍有未来职位匹配价值。",
      draftContent: "Leo，祝贺拿到新机会，后续如果你愿意，我们也想保持联系……",
      riskLevel: RiskLevel.MEDIUM,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.REJECTED,
      suggestedExecutionAt: subDays(todayAt(17, 0), 2),
      dueDate: subDays(todayAt(18, 0), 2),
      opportunityTitle: "Leo Sun 候选人补位",
      contactName: "Leo Sun",
      ownerId: userMap["recruiter@demo.com"].id,
    },
    {
      title: "创建 Acme 下周联合评审会议",
      actionType: ActionType.CREATE_MEETING,
      description: "面向客户 + 交付的联合评审会议。",
      aiReason: "采购评估进入关键节点，需要提前占位。",
      riskLevel: RiskLevel.HIGH,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.PENDING_APPROVAL,
      suggestedExecutionAt: todayAt(16, 0),
      dueDate: addDays(now, 3),
      opportunityTitle: "Acme 年度经营动作控制台试点",
      contactName: "Vivian Chen",
      ownerId: userMap["saleslead@demo.com"].id,
    },
  ];

  const createdActions: Record<string, Awaited<ReturnType<typeof prisma.actionItem.create>>> = {};

  for (const action of actionItems) {
    const created = await prisma.actionItem.create({
      data: {
        workspaceId: workspace.id,
        meetingId: action.meetingTitle ? meetingMap[action.meetingTitle].id : undefined,
        opportunityId: action.opportunityTitle ? opportunityMap[action.opportunityTitle].id : undefined,
        contactId: action.contactName ? contactMap[action.contactName].id : undefined,
        ownerId: action.ownerId,
        actionType: action.actionType,
        title: action.title,
        description: action.description,
        aiReason: action.aiReason,
        draftContent: action.draftContent,
        metadata: action.metadata,
        riskLevel: action.riskLevel,
        executionMode: action.executionMode,
        requiresApproval: action.requiresApproval,
        status: action.status,
        suggestedExecutionAt: action.suggestedExecutionAt,
        dueDate: action.dueDate,
      },
    });

    createdActions[action.title] = created;
  }

  const approvalConfigs = [
    ["发送 Acme 会后 ROI 跟进邮件", ApprovalStatus.PENDING],
    ["起草 Beacon 恢复试点邮件", ApprovalStatus.PENDING],
    ["更新内部优先级事项下一步", ApprovalStatus.PENDING],
    ["安排 Aya Nakamura 终面", ApprovalStatus.PENDING],
    ["给 Ben Carter 发送二面说明", ApprovalStatus.PENDING],
    ["发送 Atlas 合作 brief", ApprovalStatus.PENDING],
    ["修订 Beacon 截止时间", ApprovalStatus.PENDING],
    ["指派 Samuel 跟进 Acme 交付评估", ApprovalStatus.PENDING],
    ["起草候选人 Leo 关系维护短信", ApprovalStatus.REJECTED],
    ["创建 Acme 下周联合评审会议", ApprovalStatus.PENDING],
    ["发送内部纪要给产品与交付", ApprovalStatus.EXECUTED],
    ["创建 Delta 沙龙嘉宾画像待办", ApprovalStatus.EXECUTED],
  ] as const;

  for (const [title, status] of approvalConfigs) {
    const action = createdActions[title];
    await prisma.approvalTask.create({
      data: {
        workspaceId: workspace.id,
        actionItemId: action.id,
        approverId:
          title.includes("Aya") || title.includes("Ben") || title.includes("Leo")
            ? userMap["recruiter@demo.com"].id
            : userMap["founder@demo.com"].id,
        reviewedById: status === ApprovalStatus.PENDING ? undefined : userMap["founder@demo.com"].id,
        status,
        channel: action.actionType === ActionType.DRAFT_EXTERNAL_EMAIL ? "外发动作" : "内部动作",
        isHighRisk: ([RiskLevel.HIGH, RiskLevel.CRITICAL] as RiskLevel[]).includes(action.riskLevel),
        autoExecute: action.executionMode === ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
        contextSnapshot: `${action.title}\n${action.description ?? ""}`,
        reasoning: action.aiReason,
        editableContent: action.draftContent ?? action.description,
        resultPreview:
          title === "发送 Acme 会后 ROI 跟进邮件"
            ? "审批后将生成会后跟进记录，并把机会阶段更新为等待对方。"
            : title === "安排 Aya Nakamura 终面"
              ? "审批后将创建终面会议占位、生成待办并写入候选人时间线。"
              : "审批后将执行对应动作并写入审计日志。",
        reviewedAt: status === ApprovalStatus.PENDING ? undefined : subDays(now, 1),
      },
    });
  }

  const createdApprovalTasks = await prisma.approvalTask.findMany({
    where: { workspaceId: workspace.id },
    include: {
      actionItem: true,
    },
  });
  const approvalTaskMap = Object.fromEntries(createdApprovalTasks.map((task) => [task.actionItem.title, task]));

  const threadInputs = [
    {
      subject: "Acme ROI follow-up materials",
      counterpart: "Vivian Chen",
      summary: "采购评估开始，需要会后跟进材料。",
      status: ThreadStatus.WAITING_US,
      waitingOn: "我方",
      shouldReply: true,
      contactName: "Vivian Chen",
      companyName: "Acme Robotics",
      opportunityTitle: "Acme 年度经营动作控制台试点",
      messages: [
        {
          sender: "Vivian Chen",
          senderEmail: "vivian@acme.demo",
          body: "今天会后如果能把 ROI 框架发我，我可以尽快拉财务评估。",
          isInbound: true,
          sentAt: todayAt(10, 18),
        },
        {
          sender: "Helm Team",
          senderEmail: "saleslead@demo.com",
          body: "收到，我们会整理结构化版本，包含试点范围与收益假设。",
          isInbound: false,
          sentAt: todayAt(10, 25),
        },
      ],
    },
    {
      subject: "Beacon pilot rescue",
      counterpart: "Olivia Park",
      summary: "机会接近流失，但还有缩小试点窗口。",
      source: RecordSource.GMAIL,
      status: ThreadStatus.WAITING_US,
      waitingOn: "我方",
      shouldReply: true,
      contactName: "Olivia Park",
      companyName: "Beacon Retail",
      opportunityTitle: "Beacon 零售网络恢复单",
      messages: [
        {
          sender: "Olivia Park",
          senderEmail: "olivia@beacon.demo",
          body: "如果方案能更轻量，我们也许还可以内部再看一次。",
          isInbound: true,
          sentAt: todayAt(11, 25),
        },
      ],
    },
    {
      subject: "GreenPeak shortlist sync",
      counterpart: "Teresa Wang",
      summary: "客户希望尽快锁 Aya 终面。",
      source: RecordSource.GMAIL,
      status: ThreadStatus.WAITING_US,
      waitingOn: "我方",
      shouldReply: true,
      contactName: "Teresa Wang",
      companyName: "GreenPeak Health",
      opportunityTitle: "GreenPeak VP Sales 职位委托",
      messages: [
        {
          sender: "Teresa Wang",
          senderEmail: "teresa@greenpeak.demo",
          body: "如果 Aya 下周三可以，我们希望今天先把时间 hold 住。",
          isInbound: true,
          sentAt: todayAt(15, 8),
        },
      ],
    },
    {
      subject: "Ben Carter second interview",
      counterpart: "Ben Carter",
      summary: "候选人期待更清晰的下一轮安排。",
      status: ThreadStatus.WAITING_US,
      waitingOn: "我方",
      shouldReply: true,
      contactName: "Ben Carter",
      opportunityTitle: "Ben Carter 候选人推进",
      messages: [
        {
          sender: "Ben Carter",
          senderEmail: "ben.carter@candidate.demo",
          body: "想确认一下二面的时间窗口，也方便我协调现有工作安排。",
          isInbound: true,
          sentAt: addHours(subDays(now, 1), 4),
        },
      ],
    },
    {
      subject: "Atlas joint launch brief",
      counterpart: "Lena Zhou",
      summary: "合作意愿明确，等你方整理 brief。",
      source: RecordSource.IMPORT,
      status: ThreadStatus.WAITING_US,
      waitingOn: "我方",
      shouldReply: true,
      contactName: "Lena Zhou",
      companyName: "Atlas AI",
      opportunityTitle: "Atlas AI 联合解决方案合作",
      messages: [
        {
          sender: "Lena Zhou",
          senderEmail: "lena@atlas.demo",
          body: "今天聊得很好，等你们的合作 brief，我们下周可以继续推进。",
          isInbound: true,
          sentAt: todayAt(17, 20),
        },
      ],
    },
    {
      subject: "Delta salon outline",
      counterpart: "Mason Liu",
      summary: "活动合作需要一版嘉宾画像和议程框架。",
      status: ThreadStatus.OPEN,
      waitingOn: "双方",
      shouldReply: false,
      contactName: "Mason Liu",
      companyName: "Delta Capital",
      opportunityTitle: "Delta Capital 闭门沙龙共办",
      messages: [
        {
          sender: "Mason Liu",
          senderEmail: "mason@delta.demo",
          body: "如果你们能先给一版嘉宾画像，我们可以开始协调资源。",
          isInbound: true,
          sentAt: addHours(subDays(now, 1), 2),
        },
      ],
    },
    {
      subject: "Nimbus internal dependencies",
      counterpart: "Zack Han",
      summary: "客户在等你方法务与交付时间表。",
      status: ThreadStatus.WAITING_US,
      waitingOn: "我方",
      shouldReply: true,
      contactName: "Zack Han",
      companyName: "Nimbus Systems",
      opportunityTitle: "Nimbus 实施与法务联动项目",
      messages: [
        {
          sender: "Zack Han",
          senderEmail: "zack@nimbus.demo",
          body: "我们这边没问题，主要想知道你们法务和交付何时能一起同步。",
          isInbound: true,
          sentAt: subDays(now, 1),
        },
      ],
    },
    {
      subject: "Internal priority conflict",
      counterpart: "Iris Qiao",
      summary: "内部需要统一对外承诺边界。",
      status: ThreadStatus.OPEN,
      waitingOn: "双方",
      shouldReply: false,
      contactName: "Iris Qiao",
      opportunityTitle: "产品路线优先级冲突处理",
      messages: [
        {
          sender: "Iris Qiao",
          senderEmail: "iris@internal.demo",
          body: "如果这周继续答应新增功能，团队会非常被动。",
          isInbound: true,
          sentAt: subDays(now, 1),
        },
      ],
    },
  ];

  for (const thread of threadInputs) {
    const createdThread = await prisma.emailThread.create({
      data: {
        workspaceId: workspace.id,
        contactId: thread.contactName ? contactMap[thread.contactName].id : undefined,
        companyId: thread.companyName ? companyMap[thread.companyName].id : undefined,
        opportunityId: thread.opportunityTitle ? opportunityMap[thread.opportunityTitle].id : undefined,
        subject: thread.subject,
        counterpart: thread.counterpart,
        summary: thread.summary,
        participants: json([thread.counterpart, thread.companyName ?? "独立联系人"]),
        source: thread.source ?? RecordSource.DEMO,
        status: thread.status,
        waitingOn: thread.waitingOn,
        shouldReply: thread.shouldReply,
      },
    });

    await prisma.emailMessage.createMany({
      data: thread.messages.map((message) => ({
        threadId: createdThread.id,
        ...message,
      })),
    });
  }

  const memoryEntries = [
    ["Acme 采购要求偏向‘可审批、可审计’，这正是核心卖点。", "Vivian Chen", undefined, "Acme 年度经营动作控制台试点", "Acme Discovery 回顾", MemoryEntityType.OPPORTUNITY, MemoryType.RELATIONSHIP],
    ["Daniel 愿意做内部 champion，但会反复追问实施资源。", "Daniel Xu", "Acme Robotics", "Acme 年度经营动作控制台试点", undefined, MemoryEntityType.CONTACT, MemoryType.RELATIONSHIP],
    ["Beacon 当前最大问题不是价格，而是内部优先级下降。", "Olivia Park", "Beacon Retail", "Beacon 零售网络恢复单", "Beacon 恢复方案电话会", MemoryEntityType.OPPORTUNITY, MemoryType.RISK],
    ["Nimbus 机会的关键路径是售前、法务、交付联动。", "Zack Han", "Nimbus Systems", "Nimbus 实施与法务联动项目", undefined, MemoryEntityType.OPPORTUNITY, MemoryType.SUMMARY],
    ["Teresa 正在推动 shortlist，本周希望锁 Aya 终面。", "Teresa Wang", "GreenPeak Health", "GreenPeak VP Sales 职位委托", "GreenPeak 职位推进同步", MemoryEntityType.CONTACT, MemoryType.NEXT_STEP],
    ["Ben 对流程速度敏感，拖慢会影响候选人体验。", "Ben Carter", undefined, "Ben Carter 候选人推进", "Ben Carter 首轮复盘", MemoryEntityType.CONTACT, MemoryType.RISK],
    ["Aya 最适合的沟通方式是提前给 panel briefing。", "Aya Nakamura", undefined, "Aya Nakamura 候选人推进", "GreenPeak 职位推进同步", MemoryEntityType.CONTACT, MemoryType.NOTE],
    ["Leo 已流失，但关系无需断，可以做长期人才地图。", "Leo Sun", undefined, "Leo Sun 候选人补位", undefined, MemoryEntityType.CONTACT, MemoryType.SUMMARY],
    ["Lena 对合作品牌调性要求高，不喜欢模糊分工。", "Lena Zhou", "Atlas AI", "Atlas AI 联合解决方案合作", "Atlas 联名合作讨论", MemoryEntityType.CONTACT, MemoryType.RELATIONSHIP],
    ["Delta 的合作成功关键是嘉宾质量而不是活动规模。", "Mason Liu", "Delta Capital", "Delta Capital 闭门沙龙共办", "Delta 闭门沙龙方案回顾", MemoryEntityType.OPPORTUNITY, MemoryType.NOTE],
    ["Iris 和 Samuel 一致认为本周只能承接一个新试点。", "Iris Qiao", undefined, "产品路线优先级冲突处理", "经营优先级冲突复盘", MemoryEntityType.MEETING, MemoryType.DECISION],
    ["Samuel 需要在客户推进前拿到交付容量确认。", "Samuel Lee", undefined, "产品路线优先级冲突处理", "经营优先级冲突复盘", MemoryEntityType.CONTACT, MemoryType.NEXT_STEP],
    ["Acme 是本周最有可能推进到联合评审的大机会。", undefined, "Acme Robotics", "Acme 年度经营动作控制台试点", undefined, MemoryEntityType.COMPANY, MemoryType.SUMMARY],
    ["Beacon 如果本周没有新切口，建议正式标记流失。", undefined, "Beacon Retail", "Beacon 零售网络恢复单", undefined, MemoryEntityType.COMPANY, MemoryType.RISK],
    ["GreenPeak 对 VP Sales 职位的 urgency 很高。", undefined, "GreenPeak Health", "GreenPeak VP Sales 职位委托", undefined, MemoryEntityType.COMPANY, MemoryType.SUMMARY],
    ["Atlas 合作更适合先从内容联合而非活动切入。", undefined, "Atlas AI", "Atlas AI 联合解决方案合作", "Atlas 联名合作讨论", MemoryEntityType.COMPANY, MemoryType.DECISION],
    ["Delta 可以作为创始人圈层的长期转介绍入口。", undefined, "Delta Capital", "Delta Capital 闭门沙龙共办", undefined, MemoryEntityType.COMPANY, MemoryType.NOTE],
    ["产品路线冲突已经影响对外承诺，需要周内收口。", undefined, undefined, "产品路线优先级冲突处理", "经营优先级冲突复盘", MemoryEntityType.OPPORTUNITY, MemoryType.RISK],
    ["Acme 会议后需在 24 小时内完成 follow-up。", "Vivian Chen", "Acme Robotics", "Acme 年度经营动作控制台试点", "Acme 采购评估同步会", MemoryEntityType.MEETING, MemoryType.NEXT_STEP],
    ["Aya 终面动作一旦审批通过，应立即创建会议并通知客户。", "Aya Nakamura", "GreenPeak Health", "Aya Nakamura 候选人推进", "GreenPeak 职位推进同步", MemoryEntityType.MEETING, MemoryType.NEXT_STEP],
  ] as const;

  for (const [content, contactName, companyName, opportunityTitle, meetingTitle, entityType, memoryType] of memoryEntries) {
    await prisma.memoryEntry.create({
      data: {
        workspaceId: workspace.id,
        contactId: contactName ? contactMap[contactName].id : undefined,
        companyId: companyName ? companyMap[companyName].id : undefined,
        opportunityId: opportunityTitle ? opportunityMap[opportunityTitle].id : undefined,
        meetingId: meetingTitle ? meetingMap[meetingTitle].id : undefined,
        entityType,
        memoryType,
        title: content.slice(0, 24),
        content,
        source: meetingTitle ? `会议：${meetingTitle}` : "工作域记忆",
      },
    });
  }

  await prisma.memoryEntry.create({
    data: {
      workspaceId: workspace.id,
      contactId: contactMap["Vivian Chen"].id,
      companyId: companyMap["Acme Robotics"].id,
      opportunityId: opportunityMap["Acme 年度经营动作控制台试点"].id,
      entityType: MemoryEntityType.OPPORTUNITY,
      memoryType: MemoryType.NEXT_STEP,
      title: "CSV 导入补齐 Acme 线索",
      content: "通过 CSV 导入补齐了 Acme 采购线索、联系人映射和一条待跟进会后动作。",
      source: "CSV 导入",
    },
  });

  const memoryActor = {
    workspaceId: workspace.id,
    actorName: "Helm Memory Seeder",
    actorUserId: userMap["founder@demo.com"].id,
    actorType: ActorType.SYSTEM,
    sourcePage: "/seed",
    suppressEvolutionRefresh: true,
  } as const;

  for (const meetingTitle of [
    "Acme 采购评估同步会",
    "GreenPeak 职位推进同步",
    "Atlas 联名合作讨论",
    "经营优先级冲突复盘",
    "Ben Carter 首轮复盘",
  ]) {
    await hydrateMeetingMemoryFromNote({
      ...memoryActor,
      meetingId: meetingMap[meetingTitle].id,
    });
  }

  const createdSeedFacts = {
    acmePayment: await createMemoryFact({
      ...memoryActor,
      objectType: ObjectType.OPPORTUNITY,
      objectId: opportunityMap["Acme 年度经营动作控制台试点"].id,
      factType: MemoryFactType.PREFERENCE,
      title: "客户更关心付款周期",
      content: "Acme 当前更关心付款周期和采购节奏，而不是一次性总价。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["Acme 采购评估同步会"].id,
      confidence: 86,
      importance: 92,
      freshnessScore: 88,
    }),
    acmeChampion: await createMemoryFact({
      ...memoryActor,
      objectType: ObjectType.CONTACT,
      objectId: contactMap["Daniel Xu"].id,
      factType: MemoryFactType.RELATIONSHIP,
      title: "Daniel 愿意内部推动",
      content: "Daniel 愿意做内部 champion，但会持续追问实施资源是否稳妥。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["Acme 采购评估同步会"].id,
      confidence: 82,
      importance: 78,
      freshnessScore: 80,
    }),
    acmeNeedDraft: await createMemoryFact({
      ...memoryActor,
      objectType: ObjectType.CONTACT,
      objectId: contactMap["Vivian Chen"].id,
      factType: MemoryFactType.NEXT_STEP,
      title: "希望下周三前收到初稿",
      content: "Vivian 希望在下周三前收到结构化方案初稿，便于她拉内部评审。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["Acme 采购评估同步会"].id,
      confidence: 90,
      importance: 90,
      freshnessScore: 84,
    }),
    beaconBudget: await createMemoryFact({
      ...memoryActor,
      objectType: ObjectType.COMPANY,
      objectId: companyMap["Beacon Retail"].id,
      factType: MemoryFactType.RISK_SIGNAL,
      title: "Beacon 预算审批偏慢",
      content: "Beacon 内部预算审批通常需要更长周期，是当前试点恢复的首要风险。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["Beacon 恢复方案电话会"].id,
      confidence: 84,
      importance: 88,
      freshnessScore: 78,
    }),
    beaconReplySlow: await createMemoryFact({
      ...memoryActor,
      objectType: ObjectType.CONTACT,
      objectId: contactMap["Olivia Park"].id,
      factType: MemoryFactType.RISK_SIGNAL,
      title: "Olivia 最近回复变慢",
      content: "Olivia 过去一周回复明显变慢，说明机会热度正在下降。",
      sourceType: SourceType.EMAIL_THREAD,
      sourceId: "Beacon pilot rescue",
      confidence: 76,
      importance: 84,
      freshnessScore: 72,
    }),
    greenPeakUrgency: await createMemoryFact({
      ...memoryActor,
      objectType: ObjectType.OPPORTUNITY,
      objectId: opportunityMap["GreenPeak VP Sales 职位委托"].id,
      factType: MemoryFactType.NEXT_STEP,
      title: "客户希望 48 小时内推进下一步",
      content: "GreenPeak 希望在 48 小时内确认 shortlist 和下一轮安排，拖慢会显著影响候选人体感。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["GreenPeak 职位推进同步"].id,
      confidence: 88,
      importance: 90,
      freshnessScore: 86,
    }),
    ayaConcern: await createMemoryFact({
      ...memoryActor,
      objectType: ObjectType.CONTACT,
      objectId: contactMap["Aya Nakamura"].id,
      factType: MemoryFactType.OBJECTION,
      title: "Aya 希望提前收到 panel 信息",
      content: "Aya 更愿意先看到 panel 介绍和面试边界，再确认终面时间。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["GreenPeak 职位推进同步"].id,
      confidence: 80,
      importance: 76,
      freshnessScore: 78,
    }),
    atlasPositive: await createMemoryFact({
      ...memoryActor,
      objectType: ObjectType.CONTACT,
      objectId: contactMap["Lena Zhou"].id,
      factType: MemoryFactType.RELATIONSHIP,
      title: "Lena 对合作积极",
      content: "Lena 对联合内容和后续合作都很积极，只要路径足够轻量就愿意推进。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["Atlas 联名合作讨论"].id,
      confidence: 86,
      importance: 82,
      freshnessScore: 82,
    }),
    internalConflict: await createMemoryFact({
      ...memoryActor,
      objectType: ObjectType.OPPORTUNITY,
      objectId: opportunityMap["产品路线优先级冲突处理"].id,
      factType: MemoryFactType.BLOCKER,
      title: "内部资源冲突会影响对外承诺",
      content: "如果本周不先统一产品和交付资源，对外承诺会继续失真。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["经营优先级冲突复盘"].id,
      confidence: 92,
      importance: 94,
      freshnessScore: 90,
    }),
    deltaTradeoff: await createMemoryFact({
      ...memoryActor,
      objectType: ObjectType.OPPORTUNITY,
      objectId: opportunityMap["Delta Capital 闭门沙龙共办"].id,
      factType: MemoryFactType.ACTION_PATTERN,
      title: "顾问型合作价值高但挤压时间",
      content: "Delta 合作价值不低，但会明显占用创始人时间和当前交付注意力。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["Delta 闭门沙龙方案回顾"].id,
      confidence: 78,
      importance: 74,
      freshnessScore: 74,
    }),
  };

  const commitments = {
    acmeDraft: await createCommitment({
      ...memoryActor,
      title: "发送 Acme 方案初稿",
      commitmentText: "在下周三前向 Acme 发送结构化方案初稿。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["Acme 采购评估同步会"].id,
      relatedContactId: contactMap["Vivian Chen"].id,
      relatedCompanyId: companyMap["Acme Robotics"].id,
      relatedOpportunityId: opportunityMap["Acme 年度经营动作控制台试点"].id,
      relatedMeetingId: meetingMap["Acme 采购评估同步会"].id,
      ownerUserId: userMap["saleslead@demo.com"].id,
      dueDate: addDays(todayAt(18, 0), 3),
      priority: 92,
      confidence: 88,
    }),
    acmeInternal: await createCommitment({
      ...memoryActor,
      title: "确认 Acme 交付节奏",
      commitmentText: "内部两天内确认交付节奏和资源边界，再决定是否先发精简版方案。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["Acme 采购评估同步会"].id,
      relatedCompanyId: companyMap["Acme Robotics"].id,
      relatedOpportunityId: opportunityMap["Acme 年度经营动作控制台试点"].id,
      relatedMeetingId: meetingMap["Acme 采购评估同步会"].id,
      ownerUserId: userMap["founder@demo.com"].id,
      dueDate: addDays(now, 2),
      priority: 86,
      confidence: 80,
    }),
    beaconBudget: await createCommitment({
      ...memoryActor,
      title: "跟进 Beacon 预算进展",
      commitmentText: "在客户预算审批结论出来前，做一次温和跟进并确认真实时间点。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["Beacon 恢复方案电话会"].id,
      relatedContactId: contactMap["Olivia Park"].id,
      relatedCompanyId: companyMap["Beacon Retail"].id,
      relatedOpportunityId: opportunityMap["Beacon 零售网络恢复单"].id,
      ownerUserId: userMap["saleslead@demo.com"].id,
      dueDate: subDays(todayAt(17, 0), 1),
      priority: 84,
      confidence: 74,
    }),
    ayaFollowup: await createCommitment({
      ...memoryActor,
      title: "安排 Aya 终面并同步说明",
      commitmentText: "本周内安排 Aya 终面，并提前同步 panel briefing 给候选人。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["GreenPeak 职位推进同步"].id,
      relatedContactId: contactMap["Aya Nakamura"].id,
      relatedCompanyId: companyMap["GreenPeak Health"].id,
      relatedOpportunityId: opportunityMap["Aya Nakamura 候选人推进"].id,
      relatedMeetingId: meetingMap["GreenPeak 职位推进同步"].id,
      ownerUserId: userMap["recruiter@demo.com"].id,
      dueDate: addDays(now, 2),
      priority: 88,
      confidence: 82,
    }),
    atlasResponse: await createCommitment({
      ...memoryActor,
      title: "两天内回复 Atlas 下一步方案",
      commitmentText: "两天内给 Atlas 一个轻量合作方案，先稳住节奏再扩合作范围。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["Atlas 联名合作讨论"].id,
      relatedContactId: contactMap["Lena Zhou"].id,
      relatedCompanyId: companyMap["Atlas AI"].id,
      relatedOpportunityId: opportunityMap["Atlas AI 联合解决方案合作"].id,
      relatedMeetingId: meetingMap["Atlas 联名合作讨论"].id,
      ownerUserId: userMap["founder@demo.com"].id,
      dueDate: addDays(now, 2),
      priority: 90,
      confidence: 86,
    }),
    internalDecision: await createCommitment({
      ...memoryActor,
      title: "本周完成内部排期决策",
      commitmentText: "本周内完成内部排期决策，并把对外承诺边界同步到销售和交付。",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["经营优先级冲突复盘"].id,
      relatedOpportunityId: opportunityMap["产品路线优先级冲突处理"].id,
      relatedMeetingId: meetingMap["经营优先级冲突复盘"].id,
      ownerUserId: userMap["founder@demo.com"].id,
      dueDate: addDays(now, 4),
      priority: 94,
      confidence: 90,
    }),
  };

  await updateCommitmentStatus({
    ...memoryActor,
    commitmentId: commitments.beaconBudget.id,
    status: CommitmentStatus.OVERDUE,
    statusNote: "Beacon 预算跟进已逾期，需重新定义恢复策略。",
  });

  const blockers = {
    acmePayment: await createBlocker({
      ...memoryActor,
      title: "Acme 付款节奏未明确",
      blockerType: "payment_cycle",
      blockerText: "客户还未明确付款节奏和采购评估顺序，导致方案粒度难以最终收口。",
      severity: 76,
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["Acme 采购评估同步会"].id,
      relatedContactId: contactMap["Vivian Chen"].id,
      relatedCompanyId: companyMap["Acme Robotics"].id,
      relatedOpportunityId: opportunityMap["Acme 年度经营动作控制台试点"].id,
      relatedMeetingId: meetingMap["Acme 采购评估同步会"].id,
    }),
    beaconBudget: await createBlocker({
      ...memoryActor,
      title: "Beacon 预算审批未完成",
      blockerType: "budget",
      blockerText: "Beacon 内部预算审批仍未完成，且项目经理回复节奏变慢。",
      severity: 88,
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["Beacon 恢复方案电话会"].id,
      relatedContactId: contactMap["Olivia Park"].id,
      relatedCompanyId: companyMap["Beacon Retail"].id,
      relatedOpportunityId: opportunityMap["Beacon 零售网络恢复单"].id,
    }),
    ayaConfidence: await createBlocker({
      ...memoryActor,
      title: "Aya 需要更稳定的面试预期",
      blockerType: "process_confidence",
      blockerText: "Aya 对终面流程透明度有顾虑，若 panel 信息不清晰会拖慢确认速度。",
      severity: 74,
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["GreenPeak 职位推进同步"].id,
      relatedContactId: contactMap["Aya Nakamura"].id,
      relatedCompanyId: companyMap["GreenPeak Health"].id,
      relatedOpportunityId: opportunityMap["Aya Nakamura 候选人推进"].id,
      relatedMeetingId: meetingMap["GreenPeak 职位推进同步"].id,
    }),
    internalResources: await createBlocker({
      ...memoryActor,
      title: "内部产品资源冲突",
      blockerType: "resource_conflict",
      blockerText: "当前销售推进和产品交付资源冲突，如果不先裁决，会影响对外承诺兑现。",
      severity: 92,
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["经营优先级冲突复盘"].id,
      relatedContactId: contactMap["Iris Qiao"].id,
      relatedOpportunityId: opportunityMap["产品路线优先级冲突处理"].id,
      relatedMeetingId: meetingMap["经营优先级冲突复盘"].id,
    }),
    deltaGuests: await createBlocker({
      ...memoryActor,
      title: "Delta 嘉宾标准未明确",
      blockerType: "guest_quality",
      blockerText: "如果嘉宾画像和活动定位不够清晰，合作推进会反复。",
      severity: 62,
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meetingMap["Delta 闭门沙龙方案回顾"].id,
      relatedContactId: contactMap["Mason Liu"].id,
      relatedCompanyId: companyMap["Delta Capital"].id,
      relatedOpportunityId: opportunityMap["Delta Capital 闭门沙龙共办"].id,
      relatedMeetingId: meetingMap["Delta 闭门沙龙方案回顾"].id,
    }),
  };

  await resolveBlocker({
    ...memoryActor,
    blockerId: blockers.deltaGuests.id,
    resolutionNote: "已整理一版嘉宾画像与议程方向，Mason 接受先按创始人圈层推进。",
  });

  await prisma.memoryLink.createMany({
    data: [
      {
        workspaceId: workspace.id,
        fromFactId: createdSeedFacts.acmePayment.id,
        toFactId: createdSeedFacts.acmeNeedDraft.id,
        relationType: MemoryRelationType.INFLUENCES,
        weight: 82,
      },
      {
        workspaceId: workspace.id,
        fromFactId: createdSeedFacts.internalConflict.id,
        toFactId: createdSeedFacts.atlasPositive.id,
        relationType: MemoryRelationType.CONTRADICTS,
        weight: 74,
      },
      {
        workspaceId: workspace.id,
        fromFactId: createdSeedFacts.beaconBudget.id,
        toFactId: createdSeedFacts.beaconReplySlow.id,
        relationType: MemoryRelationType.SUPPORTS,
        weight: 78,
      },
    ],
  });

  const founderPriorityFact = await createMemoryFact({
    ...memoryActor,
    objectType: ObjectType.OPPORTUNITY,
    objectId: opportunityMap["Delta Capital 闭门沙龙共办"].id,
    factType: MemoryFactType.NEXT_STEP,
    title: "系统曾建议优先推进 Delta",
    content: "系统最初判断应优先接受 Delta 顾问型合作，以换取更快的品牌曝光。",
    sourceType: SourceType.SYSTEM_INFERENCE,
    sourceId: "seed-founder-priority",
    confidence: 58,
    importance: 62,
    freshnessScore: 60,
  });

  await correctMemoryFact({
    workspaceId: workspace.id,
    actorName: userMap["founder@demo.com"].name,
    actorUserId: userMap["founder@demo.com"].id,
    actorType: ActorType.USER,
    sourcePage: "/memory",
    memoryFactId: founderPriorityFact.id,
    correctionType: MemoryCorrectionType.CONTENT_UPDATE,
    afterValue: {
      content: "先稳住 Atlas AI 的合作窗口，再决定是否接受 Delta 的顾问型合作。",
      confidence: 86,
    },
    reason: "创始人判断当前更应先处理 Atlas 的外部合作窗口与内部资源冲突。",
  });

  await prisma.briefingSnapshot.updateMany({
    where: {
      workspaceId: workspace.id,
      objectType: ObjectType.MEETING,
      objectId: {
        in: [
          meetingMap["Acme 采购评估同步会"].id,
          meetingMap["GreenPeak 职位推进同步"].id,
          meetingMap["经营优先级冲突复盘"].id,
          meetingMap["Atlas 联名合作讨论"].id,
        ],
      },
      snapshotType: "pre_meeting_brief",
      expiresAt: null,
    },
    data: {
      expiresAt: new Date(),
    },
  });

  for (const meetingTitle of [
    "Acme 采购评估同步会",
    "GreenPeak 职位推进同步",
    "经营优先级冲突复盘",
    "Atlas 联名合作讨论",
  ]) {
    await generateMeetingBriefingSnapshot({
      ...memoryActor,
      meetingId: meetingMap[meetingTitle].id,
    });
  }

  const recommendationSets = await Promise.all([
    generateRecommendationsForObject({
      workspaceId: workspace.id,
      actorName: userMap["founder@demo.com"].name,
      actorUserId: userMap["founder@demo.com"].id,
      actorType: ActorType.SYSTEM,
      sourcePage: "/dashboard",
      objectType: ObjectType.OPPORTUNITY,
      objectId: opportunityMap["Atlas AI 联合解决方案合作"].id,
    }),
    generateRecommendationsForObject({
      workspaceId: workspace.id,
      actorName: userMap["saleslead@demo.com"].name,
      actorUserId: userMap["saleslead@demo.com"].id,
      actorType: ActorType.SYSTEM,
      sourcePage: `/opportunities?opportunityId=${opportunityMap["Acme 年度经营动作控制台试点"].id}`,
      objectType: ObjectType.OPPORTUNITY,
      objectId: opportunityMap["Acme 年度经营动作控制台试点"].id,
    }),
    generateRecommendationsForObject({
      workspaceId: workspace.id,
      actorName: userMap["recruiter@demo.com"].name,
      actorUserId: userMap["recruiter@demo.com"].id,
      actorType: ActorType.SYSTEM,
      sourcePage: `/contacts/${contactMap["Aya Nakamura"].id}`,
      objectType: ObjectType.CONTACT,
      objectId: contactMap["Aya Nakamura"].id,
    }),
    generateRecommendationsForObject({
      workspaceId: workspace.id,
      actorName: userMap["founder@demo.com"].name,
      actorUserId: userMap["founder@demo.com"].id,
      actorType: ActorType.SYSTEM,
      sourcePage: `/meetings/${meetingMap["Atlas 联名合作讨论"].id}`,
      objectType: ObjectType.MEETING,
      objectId: meetingMap["Atlas 联名合作讨论"].id,
    }),
  ]);

  const acmeRecommendation = recommendationSets
    .flat()
    .find((item) => item.objectId === opportunityMap["Acme 年度经营动作控制台试点"].id);
  const ayaRecommendation = recommendationSets
    .flat()
    .find((item) => item.objectId === contactMap["Aya Nakamura"].id);
  const atlasRecommendation = recommendationSets
    .flat()
    .find((item) => item.objectId === opportunityMap["Atlas AI 联合解决方案合作"].id);

  async function generateRecommendationByAction(args: {
    objectType: ObjectType;
    objectId: string;
    userEmail: keyof typeof userMap;
    actionType: ActionType;
    sourcePage: string;
  }) {
    const user = userMap[args.userEmail];
    const recommendations = await generateRecommendationsForObject({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: ActorType.SYSTEM,
      sourcePage: args.sourcePage,
      objectType: args.objectType,
      objectId: args.objectId,
      limit: 6,
    });

    return recommendations.find((item) => item.actionType === args.actionType) ?? recommendations[0] ?? null;
  }

  if (acmeRecommendation) {
    await submitRecommendationFeedback({
      workspaceId: workspace.id,
      recommendationId: acmeRecommendation.recommendationId,
      userId: userMap["saleslead@demo.com"].id,
      actorName: userMap["saleslead@demo.com"].name,
      actorType: ActorType.SYSTEM,
      suppressEvolutionRefresh: true,
      feedbackType: RecommendationFeedbackType.APPROVED,
      resultNote: "销售负责人认可这条建议，作为本周首要外发动作。",
      sourcePage: `/opportunities?opportunityId=${opportunityMap["Acme 年度经营动作控制台试点"].id}`,
    });
  }

  if (ayaRecommendation) {
    await submitRecommendationFeedback({
      workspaceId: workspace.id,
      recommendationId: ayaRecommendation.recommendationId,
      userId: userMap["recruiter@demo.com"].id,
      actorName: userMap["recruiter@demo.com"].name,
      actorType: ActorType.SYSTEM,
      suppressEvolutionRefresh: true,
      feedbackType: RecommendationFeedbackType.EDITED_AND_APPROVED,
      edited: true,
      resultNote: "招聘顾问将文案改短后采纳，用于稳定候选人体感。",
      sourcePage: `/contacts/${contactMap["Aya Nakamura"].id}`,
    });
  }

  if (atlasRecommendation) {
    await submitRecommendationFeedback({
      workspaceId: workspace.id,
      recommendationId: atlasRecommendation.recommendationId,
      userId: userMap["founder@demo.com"].id,
      actorName: userMap["founder@demo.com"].name,
      actorType: ActorType.SYSTEM,
      suppressEvolutionRefresh: true,
      feedbackType: RecommendationFeedbackType.REJECTED,
      resultNote: "创始人决定先解决内部优先级冲突，再回到外部合作推进。",
      sourcePage: "/dashboard",
    });
  }

  const salesEditedRecommendations = await Promise.all([
    generateRecommendationByAction({
      objectType: ObjectType.OPPORTUNITY,
      objectId: opportunityMap["Acme 年度经营动作控制台试点"].id,
      userEmail: "saleslead@demo.com",
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      sourcePage: `/opportunities?opportunityId=${opportunityMap["Acme 年度经营动作控制台试点"].id}`,
    }),
    generateRecommendationByAction({
      objectType: ObjectType.CONTACT,
      objectId: contactMap["Vivian Chen"].id,
      userEmail: "saleslead@demo.com",
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      sourcePage: `/contacts/${contactMap["Vivian Chen"].id}`,
    }),
    generateRecommendationByAction({
      objectType: ObjectType.OPPORTUNITY,
      objectId: opportunityMap["Beacon 零售网络恢复单"].id,
      userEmail: "saleslead@demo.com",
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      sourcePage: `/opportunities?opportunityId=${opportunityMap["Beacon 零售网络恢复单"].id}`,
    }),
  ]);

  for (const recommendation of salesEditedRecommendations.filter(Boolean)) {
    await submitRecommendationFeedback({
      workspaceId: workspace.id,
      recommendationId: recommendation!.recommendationId,
      userId: userMap["saleslead@demo.com"].id,
      actorName: userMap["saleslead@demo.com"].name,
      actorType: ActorType.SYSTEM,
      suppressEvolutionRefresh: true,
      feedbackType: RecommendationFeedbackType.EDITED_AND_APPROVED,
      edited: true,
      resultNote: "销售负责人将外发文案改得更短、更直接后采纳。",
      sourcePage: recommendation!.objectType === ObjectType.CONTACT ? `/contacts/${recommendation!.objectId}` : `/opportunities?opportunityId=${recommendation!.objectId}`,
    });
  }

  const founderApprovalRecommendations = await Promise.all([
    generateRecommendationByAction({
      objectType: ObjectType.OPPORTUNITY,
      objectId: opportunityMap["Delta Capital 闭门沙龙共办"].id,
      userEmail: "founder@demo.com",
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      sourcePage: `/opportunities?opportunityId=${opportunityMap["Delta Capital 闭门沙龙共办"].id}`,
    }),
    generateRecommendationByAction({
      objectType: ObjectType.OPPORTUNITY,
      objectId: opportunityMap["Atlas AI 联合解决方案合作"].id,
      userEmail: "founder@demo.com",
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      sourcePage: `/opportunities?opportunityId=${opportunityMap["Atlas AI 联合解决方案合作"].id}`,
    }),
    generateRecommendationByAction({
      objectType: ObjectType.CONTACT,
      objectId: contactMap["Mason Liu"].id,
      userEmail: "founder@demo.com",
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      sourcePage: `/contacts/${contactMap["Mason Liu"].id}`,
    }),
  ]);

  for (const recommendation of founderApprovalRecommendations.filter(Boolean)) {
    await submitRecommendationFeedback({
      workspaceId: workspace.id,
      recommendationId: recommendation!.recommendationId,
      userId: userMap["founder@demo.com"].id,
      actorName: userMap["founder@demo.com"].name,
      actorType: ActorType.SYSTEM,
      suppressEvolutionRefresh: true,
      feedbackType: RecommendationFeedbackType.APPROVED,
      resultNote: "创始人保留人工确认，但认可这条外发推进建议。",
      sourcePage: recommendation!.objectType === ObjectType.CONTACT
          ? `/contacts/${recommendation!.objectId}`
          : `/opportunities?opportunityId=${recommendation!.objectId}`,
    });
  }

  const recruiterMeetingRecommendations = await Promise.all([
    generateRecommendationByAction({
      objectType: ObjectType.MEETING,
      objectId: meetingMap["GreenPeak 职位推进同步"].id,
      userEmail: "recruiter@demo.com",
      actionType: ActionType.SEND_MEETING_SUMMARY,
      sourcePage: `/meetings/${meetingMap["GreenPeak 职位推进同步"].id}`,
    }),
    generateRecommendationByAction({
      objectType: ObjectType.MEETING,
      objectId: meetingMap["GreenPeak 职位推进同步"].id,
      userEmail: "recruiter@demo.com",
      actionType: ActionType.CREATE_TASK,
      sourcePage: `/meetings/${meetingMap["GreenPeak 职位推进同步"].id}`,
    }),
  ]);

  for (const recommendation of recruiterMeetingRecommendations.filter(Boolean)) {
    await submitRecommendationFeedback({
      workspaceId: workspace.id,
      recommendationId: recommendation!.recommendationId,
      userId: userMap["recruiter@demo.com"].id,
      actorName: userMap["recruiter@demo.com"].name,
      actorType: ActorType.SYSTEM,
      suppressEvolutionRefresh: true,
      feedbackType: RecommendationFeedbackType.APPROVED,
      resultNote: "招聘顾问在会后 24 小时窗口内采纳并推进。",
      sourcePage: `/meetings/${meetingMap["GreenPeak 职位推进同步"].id}`,
    });
  }

  await refreshEvolutionState({
    workspaceId: workspace.id,
    actorId: userMap["founder@demo.com"].id,
    actorType: ActorType.SYSTEM,
    sourcePage: "/seed",
    trigger: "seed_bootstrap",
  });

  await prisma.company.update({
    where: { id: companyMap["Acme Robotics"].id },
    data: { lastInteractionAt: todayAt(10, 15) },
  });
  await prisma.company.update({
    where: { id: companyMap["Beacon Retail"].id },
    data: { lastInteractionAt: todayAt(11, 30) },
  });
  await prisma.company.update({
    where: { id: companyMap["GreenPeak Health"].id },
    data: { lastInteractionAt: todayAt(15, 15) },
  });
  await prisma.company.update({
    where: { id: companyMap["Atlas AI"].id },
    data: { lastInteractionAt: todayAt(17, 15) },
  });

  const policyRules = [
    ["外发邮件默认审批", ActionType.DRAFT_EXTERNAL_EMAIL, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "外发动作"],
    ["内部纪要按规则发送", ActionType.DRAFT_INTERNAL_NOTE, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.HIGH, "内部动作"],
    ["创建会议自动执行", ActionType.CREATE_MEETING, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.MEDIUM, "日程类"],
    ["机会阶段更新默认自动", ActionType.UPDATE_OPPORTUNITY_STAGE, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.MEDIUM, "机会类"],
    ["创建待办默认自动", ActionType.CREATE_TASK, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.MEDIUM, "内部动作"],
    ["指派负责人需审批", ActionType.ASSIGN_OWNER, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "协同类"],
    ["修改截止时间需审批", ActionType.CHANGE_DUE_DATE, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "治理类"],
    ["安排面试默认审批", ActionType.SCHEDULE_INTERVIEW, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "招聘类"],
  ] as const;

  await prisma.policyRule.createMany({
    data: policyRules.map(([name, actionType, mode, riskThreshold, appliesTo]) => ({
      workspaceId: workspace.id,
      name,
      actionType,
      mode,
      riskThreshold,
      appliesTo,
      description: `${name}，超出阈值或高风险时强制审批。`,
    })),
  });

  const seededPolicies = await prisma.policyRule.findMany({
    where: { workspaceId: workspace.id },
  });
  const policyRuleMap = Object.fromEntries(seededPolicies.map((policy) => [policy.actionType, policy]));

  await prisma.budgetRule.createMany({
    data: [
      {
        workspaceId: workspace.id,
        name: "外发动作审批预算",
        scope: "外发动作",
        monthlyLimit: 120,
        spent: 47,
        warningThreshold: 80,
      },
      {
        workspaceId: workspace.id,
        name: "自动执行会议额度",
        scope: "会议与日程",
        monthlyLimit: 80,
        spent: 26,
        warningThreshold: 75,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        type: NotificationType.APPROVAL,
        title: "3 个高风险动作待你审批",
        body: "包括 Acme 跟进邮件、Aya 终面安排和 Atlas 合作 brief。",
        url: "/approvals",
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        type: NotificationType.REMINDER,
        title: "Acme 会后 24 小时窗口中",
        body: "请尽快确认跟进邮件和联合评审会议。",
        url: "/meetings",
      },
      {
        workspaceId: workspace.id,
        userId: userMap["recruiter@demo.com"].id,
        type: NotificationType.REMINDER,
        title: "Aya 终面安排待审批",
        body: "审批通过后会自动创建会议占位。",
        url: "/approvals",
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        actor: "Helm AI",
        actorType: ActorType.AI,
        actionType: "AI_SUGGESTED_ACTIONS",
        targetType: "Meeting",
        targetId: meetingMap["Acme 采购评估同步会"].id,
        summary: "为 Acme 会议生成了 briefing 与会后动作建议。",
        payload: json({ actions: ["发送 Acme 会后 ROI 跟进邮件", "更新 Acme 机会为等待对方"] }),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["recruiter@demo.com"].id,
        actor: "Helm AI",
        actorType: ActorType.AI,
        actionType: "AI_SUGGESTED_ACTIONS",
        targetType: "Meeting",
        targetId: meetingMap["GreenPeak 职位推进同步"].id,
        summary: "为 GreenPeak 职位同步会生成了后续动作。",
        payload: json({ actions: ["安排 Aya Nakamura 终面", "起草 GreenPeak 内部纪要"] }),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        actor: "系统",
        actorType: ActorType.SYSTEM,
        actionType: "AUTO_EXECUTED_ACTION",
        targetType: "ActionItem",
        targetId: createdActions["发送内部纪要给产品与交付"].id,
        summary: "内部纪要按策略自动执行。",
        payload: json({ policy: "内部纪要按规则发送" }),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        actor: "系统",
        actorType: ActorType.SYSTEM,
        actionType: "OPPORTUNITY_STAGE_CHANGED",
        targetType: "Opportunity",
        targetId: opportunityMap["Acme 年度经营动作控制台试点"].id,
        summary: "Acme 机会已更新为待推进。",
        payload: json({ stage: OpportunityStage.ADVANCING }),
      },
    ],
  });

  await prisma.connector.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        provider: ConnectorProvider.GMAIL,
        status: ConnectorStatus.CONNECTED,
        externalAccountEmail: "founder.mock@gmail.demo",
        lastSyncedAt: addHours(subDays(today, 2), 10),
        lastSyncStatus: "已载入本地 mock Gmail 数据",
        lastSyncMessage: "当前工作区已同步 3 条示例线程，可直接体验真实数据冷启动流程。",
      },
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        provider: ConnectorProvider.GOOGLE_CALENDAR,
        status: ConnectorStatus.PENDING,
        lastSyncStatus: "接口已预留",
        lastSyncMessage: "下一阶段会补 Google Calendar 只读同步。",
      },
    ],
  });

  const hubspotSource = await prisma.importSource.create({
    data: {
      workspaceId: workspace.id,
      userId: userMap["saleslead@demo.com"].id,
      sourceType: ImportSourceType.HUBSPOT,
      sourceName: "HubSpot",
      status: ImportSourceStatus.CONNECTED,
      authMode: "MOCK",
      externalAccountId: "mock-hubspot-portal",
      externalAccountLabel: "HubSpot 示例工作区",
      lastSyncedAt: addHours(subDays(today, 1), 9),
      configJson: json({ mock: true, objects: ["contacts", "companies", "deals", "notes", "associations"] }),
    },
  });

  const salesforceSource = await prisma.importSource.create({
    data: {
      workspaceId: workspace.id,
      userId: userMap["founder@demo.com"].id,
      sourceType: ImportSourceType.SALESFORCE,
      sourceName: "Salesforce",
      status: ImportSourceStatus.CONNECTED,
      authMode: "MOCK",
      externalAccountId: "mock-salesforce-org",
      externalAccountLabel: "Salesforce 示例 Org",
      lastSyncedAt: addHours(subDays(today, 1), 11),
      configJson: json({ mock: true, objects: ["accounts", "contacts", "opportunities", "events", "tasks"] }),
    },
  });

  const hubspotJob = await prisma.importJob.create({
    data: {
      workspaceId: workspace.id,
      sourceId: hubspotSource.id,
      createdByUserId: userMap["saleslead@demo.com"].id,
      jobType: ImportJobType.INITIAL_IMPORT,
      status: ImportJobStatus.COMPLETED_WITH_WARNINGS,
      totalRecords: 10,
      successRecords: 9,
      failedRecords: 0,
      warningRecords: 1,
      startedAt: addHours(subDays(today, 1), 9),
      finishedAt: addHours(subDays(today, 1), 9) ,
      summaryJson: json({
        importedCounts: {
          contacts: 2,
          companies: 2,
          opportunities: 2,
          meetings: 0,
          notes: 2,
          tasks: 0,
        },
        linkedCounts: {
          contactCompanyLinks: 2,
          opportunityCompanyLinks: 2,
          opportunityContactLinks: 2,
        },
        reviewCount: 1,
        createdActionCount: 0,
        generatedMeetingNotes: 2,
        warmup: {
          processedMeetings: 2,
          refreshedObjects: 6,
          generatedRecommendations: 10,
          detectedCommitments: 3,
          detectedBlockers: 2,
        },
      }),
    },
  });

  const salesforceJob = await prisma.importJob.create({
    data: {
      workspaceId: workspace.id,
      sourceId: salesforceSource.id,
      createdByUserId: userMap["founder@demo.com"].id,
      jobType: ImportJobType.INITIAL_IMPORT,
      status: ImportJobStatus.COMPLETED,
      totalRecords: 8,
      successRecords: 8,
      failedRecords: 0,
      warningRecords: 0,
      startedAt: addHours(subDays(today, 1), 11),
      finishedAt: addMinutes(addHours(subDays(today, 1), 11), 6),
      summaryJson: json({
        importedCounts: {
          contacts: 2,
          companies: 2,
          opportunities: 2,
          meetings: 2,
          notes: 0,
          tasks: 1,
        },
        linkedCounts: {
          contactCompanyLinks: 2,
          opportunityCompanyLinks: 2,
          opportunityContactLinks: 2,
        },
        reviewCount: 0,
        createdActionCount: 1,
        generatedMeetingNotes: 2,
        warmup: {
          processedMeetings: 2,
          refreshedObjects: 7,
          generatedRecommendations: 11,
          detectedCommitments: 4,
          detectedBlockers: 2,
        },
      }),
    },
  });

  const hubspotConflictItem = await prisma.importItem.create({
    data: {
      workspaceId: workspace.id,
      importJobId: hubspotJob.id,
      externalType: "CONTACT",
      externalId: "hubspot-contact-daniel-review",
      mappedObjectType: "Contact",
      mappedObjectId: contactMap["Daniel Xu"].id,
      matchStatus: ImportMatchStatus.NEEDS_REVIEW,
      conflictStatus: ImportConflictStatus.NEEDS_REVIEW,
      normalizedPayload: json({ name: "Daniel Xu", company: "Acme Robotics" }),
      warningMessage: "联系人姓名接近且公司一致，但缺少邮箱级强标识，需要人工确认是否合并。",
    },
  });

  await prisma.importItem.createMany({
    data: [
      {
        workspaceId: workspace.id,
        importJobId: hubspotJob.id,
        externalType: "COMPANY",
        externalId: "hubspot-company-acme",
        mappedObjectType: "Company",
        mappedObjectId: companyMap["Acme Robotics"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: hubspotJob.id,
        externalType: "COMPANY",
        externalId: "hubspot-company-delta",
        mappedObjectType: "Company",
        mappedObjectId: companyMap["Delta Capital"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: hubspotJob.id,
        externalType: "CONTACT",
        externalId: "hubspot-contact-vivian",
        mappedObjectType: "Contact",
        mappedObjectId: contactMap["Vivian Chen"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: hubspotJob.id,
        externalType: "CONTACT",
        externalId: "hubspot-contact-mason",
        mappedObjectType: "Contact",
        mappedObjectId: contactMap["Mason Liu"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: hubspotJob.id,
        externalType: "DEAL",
        externalId: "hubspot-deal-acme",
        mappedObjectType: "Opportunity",
        mappedObjectId: opportunityMap["Acme 年度经营动作控制台试点"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: hubspotJob.id,
        externalType: "DEAL",
        externalId: "hubspot-deal-delta",
        mappedObjectType: "Opportunity",
        mappedObjectId: opportunityMap["Delta Capital 闭门沙龙共办"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: hubspotJob.id,
        externalType: "NOTE",
        externalId: "hubspot-note-acme-discovery",
        mappedObjectType: "Meeting",
        mappedObjectId: meetingMap["Acme Discovery 回顾"].id,
        matchStatus: ImportMatchStatus.LINKED,
      },
      {
        workspaceId: workspace.id,
        importJobId: hubspotJob.id,
        externalType: "NOTE",
        externalId: "hubspot-note-delta-salon",
        mappedObjectType: "Meeting",
        mappedObjectId: meetingMap["Delta 闭门沙龙方案回顾"].id,
        matchStatus: ImportMatchStatus.LINKED,
      },
      {
        workspaceId: workspace.id,
        importJobId: salesforceJob.id,
        externalType: "ACCOUNT",
        externalId: "sf-account-greenpeak",
        mappedObjectType: "Company",
        mappedObjectId: companyMap["GreenPeak Health"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: salesforceJob.id,
        externalType: "ACCOUNT",
        externalId: "sf-account-atlas",
        mappedObjectType: "Company",
        mappedObjectId: companyMap["Atlas AI"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: salesforceJob.id,
        externalType: "CONTACT",
        externalId: "sf-contact-aya",
        mappedObjectType: "Contact",
        mappedObjectId: contactMap["Aya Nakamura"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: salesforceJob.id,
        externalType: "CONTACT",
        externalId: "sf-contact-lena",
        mappedObjectType: "Contact",
        mappedObjectId: contactMap["Lena Zhou"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: salesforceJob.id,
        externalType: "OPPORTUNITY",
        externalId: "sf-opp-greenpeak",
        mappedObjectType: "Opportunity",
        mappedObjectId: opportunityMap["GreenPeak VP Sales 职位委托"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: salesforceJob.id,
        externalType: "OPPORTUNITY",
        externalId: "sf-opp-atlas",
        mappedObjectType: "Opportunity",
        mappedObjectId: opportunityMap["Atlas AI 联合解决方案合作"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: salesforceJob.id,
        externalType: "EVENT",
        externalId: "sf-event-greenpeak-sync",
        mappedObjectType: "Meeting",
        mappedObjectId: meetingMap["GreenPeak 职位推进同步"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: salesforceJob.id,
        externalType: "EVENT",
        externalId: "sf-event-atlas-partnership",
        mappedObjectType: "Meeting",
        mappedObjectId: meetingMap["Atlas 联名合作讨论"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: salesforceJob.id,
        externalType: "TASK",
        externalId: "sf-task-aya-followup",
        mappedObjectType: "ActionItem",
        mappedObjectId: createdActions["安排 Aya Nakamura 终面"].id,
        matchStatus: ImportMatchStatus.CREATED,
      },
    ],
  });

  await prisma.identityMatch.createMany({
    data: [
      {
        workspaceId: workspace.id,
        sourceId: hubspotSource.id,
        importItemId: hubspotConflictItem.id,
        externalType: "CONTACT",
        externalId: "hubspot-contact-daniel-review",
        internalObjectType: "Contact",
        internalObjectId: contactMap["Daniel Xu"].id,
        matchScore: 68,
        matchReason: "联系人姓名接近且公司一致，但缺少邮箱级强标识。",
        status: IdentityMatchStatus.NEEDS_REVIEW,
      },
      {
        workspaceId: workspace.id,
        sourceId: hubspotSource.id,
        externalType: "DEAL",
        externalId: "hubspot-deal-acme",
        internalObjectType: "Opportunity",
        internalObjectId: opportunityMap["Acme 年度经营动作控制台试点"].id,
        matchScore: 100,
        matchReason: "外部对象 ID 精确匹配。",
        status: IdentityMatchStatus.EXACT,
      },
      {
        workspaceId: workspace.id,
        sourceId: salesforceSource.id,
        externalType: "EVENT",
        externalId: "sf-event-greenpeak-sync",
        internalObjectType: "Meeting",
        internalObjectId: meetingMap["GreenPeak 职位推进同步"].id,
        matchScore: 100,
        matchReason: "Salesforce Event 已绑定到 Helm Meeting。",
        status: IdentityMatchStatus.EXACT,
      },
    ],
  });

  const usageSnapshots = [
    {
      workspaceId: workspace.id,
      userId: userMap["founder@demo.com"].id,
      date: subDays(today, 6),
      loginCount: 1,
      dashboardViewCount: 2,
      meetingViewCount: 1,
      actionItemsGenerated: 1,
      approvalsSubmitted: 1,
      approvalsApproved: 1,
      approvalsRejected: 0,
      opportunityStageChanges: 1,
      followupDraftsGenerated: 1,
      policyChanges: 0,
    },
    {
      workspaceId: workspace.id,
      userId: userMap["saleslead@demo.com"].id,
      date: subDays(today, 5),
      loginCount: 1,
      dashboardViewCount: 1,
      meetingViewCount: 1,
      actionItemsGenerated: 0,
      approvalsSubmitted: 1,
      approvalsApproved: 0,
      approvalsRejected: 1,
      opportunityStageChanges: 2,
      followupDraftsGenerated: 2,
      policyChanges: 0,
    },
    {
      workspaceId: workspace.id,
      userId: userMap["recruiter@demo.com"].id,
      date: subDays(today, 4),
      loginCount: 1,
      dashboardViewCount: 1,
      meetingViewCount: 2,
      actionItemsGenerated: 1,
      approvalsSubmitted: 1,
      approvalsApproved: 1,
      approvalsRejected: 0,
      opportunityStageChanges: 1,
      followupDraftsGenerated: 1,
      policyChanges: 0,
    },
    {
      workspaceId: workspace.id,
      userId: userMap["founder@demo.com"].id,
      date: subDays(today, 3),
      loginCount: 1,
      dashboardViewCount: 2,
      meetingViewCount: 1,
      actionItemsGenerated: 1,
      approvalsSubmitted: 1,
      approvalsApproved: 1,
      approvalsRejected: 0,
      opportunityStageChanges: 1,
      followupDraftsGenerated: 0,
      policyChanges: 1,
    },
    {
      workspaceId: workspace.id,
      userId: userMap["saleslead@demo.com"].id,
      date: subDays(today, 2),
      loginCount: 1,
      dashboardViewCount: 2,
      meetingViewCount: 1,
      actionItemsGenerated: 1,
      approvalsSubmitted: 2,
      approvalsApproved: 1,
      approvalsRejected: 0,
      opportunityStageChanges: 2,
      followupDraftsGenerated: 2,
      policyChanges: 0,
    },
    {
      workspaceId: workspace.id,
      userId: userMap["recruiter@demo.com"].id,
      date: subDays(today, 1),
      loginCount: 1,
      dashboardViewCount: 1,
      meetingViewCount: 2,
      actionItemsGenerated: 1,
      approvalsSubmitted: 1,
      approvalsApproved: 1,
      approvalsRejected: 0,
      opportunityStageChanges: 1,
      followupDraftsGenerated: 1,
      policyChanges: 0,
    },
    {
      workspaceId: workspace.id,
      userId: userMap["founder@demo.com"].id,
      date: today,
      loginCount: 1,
      dashboardViewCount: 3,
      meetingViewCount: 1,
      actionItemsGenerated: 1,
      approvalsSubmitted: 2,
      approvalsApproved: 1,
      approvalsRejected: 0,
      opportunityStageChanges: 1,
      followupDraftsGenerated: 1,
      policyChanges: 1,
    },
  ];

  for (const snapshot of usageSnapshots) {
    await prisma.dailyUsageSnapshot.upsert({
      where: {
        workspaceId_userId_date: {
          workspaceId: snapshot.workspaceId,
          userId: snapshot.userId,
          date: snapshot.date,
        },
      },
      create: snapshot,
      update: snapshot,
    });
  }

  await prisma.eventLog.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        eventName: "daily_login",
        eventCategory: "auth",
        targetType: "User",
        targetId: userMap["founder@demo.com"].id,
        sourcePage: "/login",
        createdAt: addHours(subDays(today, 6), 9),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        eventName: "dashboard_opened",
        eventCategory: "page_view",
        targetType: "Page",
        targetId: "/dashboard",
        sourcePage: "/dashboard",
        createdAt: addHours(subDays(today, 6), 9),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        eventName: "meeting_opened",
        eventCategory: "page_view",
        targetType: "Meeting",
        targetId: meetingMap["Acme 采购评估同步会"].id,
        sourcePage: `/meetings/${meetingMap["Acme 采购评估同步会"].id}`,
        createdAt: addHours(subDays(today, 6), 10),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        eventName: "action_items_generated",
        eventCategory: "ai_action",
        targetType: "Meeting",
        targetId: meetingMap["Acme 采购评估同步会"].id,
        metadata: json({ createdCount: 2 }),
        sourcePage: `/meetings/${meetingMap["Acme 采购评估同步会"].id}`,
        createdAt: addHours(subDays(today, 6), 10),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        eventName: "approval_submitted",
        eventCategory: "approval",
        targetType: "ApprovalTask",
        targetId: approvalTaskMap["发送 Acme 会后 ROI 跟进邮件"].id,
        metadata: json({ actionType: ActionType.DRAFT_EXTERNAL_EMAIL, riskLevel: RiskLevel.HIGH }),
        sourcePage: "/approvals",
        createdAt: addHours(subDays(today, 6), 10),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        eventName: "followup_draft_generated",
        eventCategory: "ai_action",
        targetType: "ActionItem",
        targetId: createdActions["起草 Beacon 恢复试点邮件"].id,
        sourcePage: "/opportunities",
        createdAt: addHours(subDays(today, 5), 11),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        eventName: "opportunity_stage_changed",
        eventCategory: "opportunity",
        targetType: "Opportunity",
        targetId: opportunityMap["Acme 年度经营动作控制台试点"].id,
        metadata: json({ from: OpportunityStage.CONTACTED, to: OpportunityStage.ADVANCING }),
        sourcePage: "/opportunities",
        createdAt: addHours(subDays(today, 5), 12),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        eventName: "approval_rejected",
        eventCategory: "approval",
        targetType: "ApprovalTask",
        targetId: approvalTaskMap["起草候选人 Leo 关系维护短信"].id,
        metadata: json({ reason: "当前时机不合适" }),
        sourcePage: "/approvals",
        createdAt: addHours(subDays(today, 5), 13),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["recruiter@demo.com"].id,
        eventName: "meeting_opened",
        eventCategory: "page_view",
        targetType: "Meeting",
        targetId: meetingMap["GreenPeak 职位推进同步"].id,
        sourcePage: `/meetings/${meetingMap["GreenPeak 职位推进同步"].id}`,
        createdAt: addHours(subDays(today, 4), 14),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["recruiter@demo.com"].id,
        eventName: "approval_approved",
        eventCategory: "approval",
        targetType: "ApprovalTask",
        targetId: approvalTaskMap["安排 Aya Nakamura 终面"].id,
        sourcePage: "/approvals",
        createdAt: addHours(subDays(today, 4), 15),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        eventName: "policy_rule_changed",
        eventCategory: "policy",
        targetType: "PolicyRule",
        targetId: policyRuleMap[ActionType.DRAFT_EXTERNAL_EMAIL].id,
        metadata: json({ before: { mode: ActionExecutionMode.REQUIRES_APPROVAL }, after: { mode: ActionExecutionMode.AUTO_WITHIN_THRESHOLD } }),
        sourcePage: "/settings",
        createdAt: addHours(subDays(today, 3), 16),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        eventName: "connector_connected",
        eventCategory: "connector",
        targetType: "Connector",
        targetId: "seed-gmail",
        metadata: json({ provider: ConnectorProvider.GMAIL, usedMock: true }),
        sourcePage: "/settings",
        createdAt: addHours(subDays(today, 2), 10),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        eventName: "connector_sync_triggered",
        eventCategory: "connector",
        targetType: "Connector",
        targetId: "seed-gmail",
        metadata: json({ syncedThreads: 3 }),
        sourcePage: "/settings",
        createdAt: addHours(subDays(today, 2), 10),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        eventName: "contact_opened",
        eventCategory: "page_view",
        targetType: "Contact",
        targetId: contactMap["Vivian Chen"].id,
        sourcePage: `/contacts/${contactMap["Vivian Chen"].id}`,
        createdAt: addHours(subDays(today, 2), 11),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        eventName: "company_opened",
        eventCategory: "page_view",
        targetType: "Company",
        targetId: companyMap["Acme Robotics"].id,
        sourcePage: `/companies/${companyMap["Acme Robotics"].id}`,
        createdAt: addHours(subDays(today, 2), 11),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        eventName: "csv_import_completed",
        eventCategory: "import",
        targetType: "Import",
        targetId: "contacts",
        metadata: json({ importedCount: 4, failedCount: 1 }),
        sourcePage: "/imports",
        createdAt: addHours(subDays(today, 1), 17),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["founder@demo.com"].id,
        eventName: "weekly_report_viewed",
        eventCategory: "report",
        targetType: "Page",
        targetId: "/reports",
        sourcePage: "/reports",
        createdAt: addHours(today, 9),
      },
    ],
  });

  const captureSessionMap = {
    sales: await prisma.captureSession.create({
      data: {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        linkedMeetingId: meetingMap["Acme Discovery 回顾"].id,
        title: "星桥科技付款节奏现场记录",
        status: CaptureSessionStatus.COMPLETED,
        sourceType: CaptureSourceType.MANUAL_CAPTURE,
        objectType: ObjectType.OPPORTUNITY,
        objectId: opportunityMap["Acme 年度经营动作控制台试点"].id,
        startedAt: addHours(subDays(today, 1), 14),
        endedAt: addMinutes(addHours(subDays(today, 1), 14), 32),
        durationSeconds: 32 * 60,
        transcriptStatus: CaptureProcessingStatus.COMPLETED,
        processingStatus: CaptureProcessingStatus.COMPLETED,
      },
    }),
    recruiting: await prisma.captureSession.create({
      data: {
        workspaceId: workspace.id,
        userId: userMap["recruiter@demo.com"].id,
        linkedMeetingId: meetingMap["GreenPeak 职位推进同步"].id,
        title: "刘然候选人反馈记录",
        status: CaptureSessionStatus.COMPLETED,
        sourceType: CaptureSourceType.MANUAL_CAPTURE,
        objectType: ObjectType.CONTACT,
        objectId: contactMap["Aya Nakamura"].id,
        startedAt: addHours(subDays(today, 1), 16),
        endedAt: addMinutes(addHours(subDays(today, 1), 16), 26),
        durationSeconds: 26 * 60,
        transcriptStatus: CaptureProcessingStatus.COMPLETED,
        processingStatus: CaptureProcessingStatus.COMPLETED,
      },
    }),
  };

  await prisma.conversationTranscript.createMany({
    data: [
      {
        workspaceId: workspace.id,
        captureSessionId: captureSessionMap.sales.id,
        fullText:
          "客户这次更关心付款周期，而非总价。对方希望下周三前先收到一版精简方案结构。采购侧还在等预算和财务口径确认，我们内部也要在两天内确认交付排期。",
        segments: json([
          { speaker: "我方", startedAt: 0, endedAt: 11, text: "客户这次更关心付款周期，而非总价。" },
          { speaker: "对方", startedAt: 12, endedAt: 22, text: "希望下周三前先收到一版精简方案结构。" },
          { speaker: "我方", startedAt: 23, endedAt: 34, text: "采购侧还在等预算和财务口径确认。" },
          { speaker: "对方", startedAt: 35, endedAt: 46, text: "我们内部也要在两天内确认交付排期。" },
        ]),
        speakerSeparated: true,
        language: "zh-CN",
        confidence: 84,
      },
      {
        workspaceId: workspace.id,
        captureSessionId: captureSessionMap.recruiting.id,
        fullText:
          "候选人认可岗位方向，但对薪资区间还有顾虑。客户倾向继续推进，希望 48 小时内同步反馈。如果本周不能把下一轮安排收口，候选人流失风险会上升。",
        segments: json([
          { speaker: "我方", startedAt: 0, endedAt: 9, text: "候选人认可岗位方向，但对薪资区间还有顾虑。" },
          { speaker: "对方", startedAt: 10, endedAt: 19, text: "客户倾向继续推进，希望 48 小时内同步反馈。" },
          { speaker: "我方", startedAt: 20, endedAt: 31, text: "如果本周不能把下一轮安排收口，候选人流失风险会上升。" },
        ]),
        speakerSeparated: true,
        language: "zh-CN",
        confidence: 82,
      },
    ],
  });

  await prisma.conversationInsight.createMany({
    data: [
      {
        workspaceId: workspace.id,
        captureSessionId: captureSessionMap.sales.id,
        insightType: ConversationInsightType.FACT,
        title: "客户更关心付款周期",
        content: "客户这次更关心付款周期，而非总价本身。",
        confidence: 86,
        relatedCompanyId: companyMap["Acme Robotics"].id,
        relatedOpportunityId: opportunityMap["Acme 年度经营动作控制台试点"].id,
        relatedMeetingId: meetingMap["Acme Discovery 回顾"].id,
        sourceSegmentRefs: json([0]),
      },
      {
        workspaceId: workspace.id,
        captureSessionId: captureSessionMap.sales.id,
        insightType: ConversationInsightType.COMMITMENT,
        title: "下周三前发送精简方案结构",
        content: "下周三前先发一版精简方案结构，帮助客户内部先过一轮。",
        confidence: 84,
        relatedCompanyId: companyMap["Acme Robotics"].id,
        relatedOpportunityId: opportunityMap["Acme 年度经营动作控制台试点"].id,
        relatedMeetingId: meetingMap["Acme Discovery 回顾"].id,
        sourceSegmentRefs: json([1]),
      },
      {
        workspaceId: workspace.id,
        captureSessionId: captureSessionMap.sales.id,
        insightType: ConversationInsightType.BLOCKER,
        title: "预算与财务口径未收口",
        content: "采购侧仍在等预算和财务口径确认。",
        confidence: 82,
        relatedCompanyId: companyMap["Acme Robotics"].id,
        relatedOpportunityId: opportunityMap["Acme 年度经营动作控制台试点"].id,
        relatedMeetingId: meetingMap["Acme Discovery 回顾"].id,
        sourceSegmentRefs: json([2]),
      },
      {
        workspaceId: workspace.id,
        captureSessionId: captureSessionMap.sales.id,
        insightType: ConversationInsightType.NEXT_ACTION,
        title: "先发结构草稿再收口排期",
        content: "建议先发精简版方案结构，再同步内部确认交付排期。",
        confidence: 79,
        relatedCompanyId: companyMap["Acme Robotics"].id,
        relatedOpportunityId: opportunityMap["Acme 年度经营动作控制台试点"].id,
        relatedMeetingId: meetingMap["Acme Discovery 回顾"].id,
        sourceSegmentRefs: json([1, 3]),
      },
      {
        workspaceId: workspace.id,
        captureSessionId: captureSessionMap.recruiting.id,
        insightType: ConversationInsightType.FACT,
        title: "候选人认可岗位方向",
        content: "候选人对岗位方向认可，但还没有完全收口。",
        confidence: 81,
        relatedContactId: contactMap["Aya Nakamura"].id,
        relatedOpportunityId: opportunityMap["Aya Nakamura 候选人推进"].id,
        relatedMeetingId: meetingMap["GreenPeak 职位推进同步"].id,
        sourceSegmentRefs: json([0]),
      },
      {
        workspaceId: workspace.id,
        captureSessionId: captureSessionMap.recruiting.id,
        insightType: ConversationInsightType.BLOCKER,
        title: "薪资区间存在顾虑",
        content: "候选人对薪资区间仍有顾虑。",
        confidence: 83,
        relatedContactId: contactMap["Aya Nakamura"].id,
        relatedOpportunityId: opportunityMap["Aya Nakamura 候选人推进"].id,
        relatedMeetingId: meetingMap["GreenPeak 职位推进同步"].id,
        sourceSegmentRefs: json([0]),
      },
      {
        workspaceId: workspace.id,
        captureSessionId: captureSessionMap.recruiting.id,
        insightType: ConversationInsightType.COMMITMENT,
        title: "48 小时内同步反馈",
        content: "客户希望 48 小时内同步面试反馈。",
        confidence: 84,
        relatedContactId: contactMap["Aya Nakamura"].id,
        relatedOpportunityId: opportunityMap["Aya Nakamura 候选人推进"].id,
        relatedMeetingId: meetingMap["GreenPeak 职位推进同步"].id,
        sourceSegmentRefs: json([1]),
      },
      {
        workspaceId: workspace.id,
        captureSessionId: captureSessionMap.recruiting.id,
        insightType: ConversationInsightType.RISK,
        title: "超 48 小时不反馈会增加流失风险",
        content: "如果本周不能把下一轮安排收口，候选人流失风险会上升。",
        confidence: 85,
        relatedContactId: contactMap["Aya Nakamura"].id,
        relatedOpportunityId: opportunityMap["Aya Nakamura 候选人推进"].id,
        relatedMeetingId: meetingMap["GreenPeak 职位推进同步"].id,
        sourceSegmentRefs: json([2]),
      },
    ],
  });

  await Promise.all([
    generateRecommendationsForObject({
      workspaceId: workspace.id,
      actorName: "Helm Capture Seeder",
      actorUserId: userMap["saleslead@demo.com"].id,
      actorType: ActorType.SYSTEM,
      sourcePage: "/capture",
      objectType: ObjectType.MEETING,
      objectId: meetingMap["Acme Discovery 回顾"].id,
      limit: 2,
      persist: true,
      captureTelemetry: false,
    }),
    generateRecommendationsForObject({
      workspaceId: workspace.id,
      actorName: "Helm Capture Seeder",
      actorUserId: userMap["saleslead@demo.com"].id,
      actorType: ActorType.SYSTEM,
      sourcePage: "/capture",
      objectType: ObjectType.OPPORTUNITY,
      objectId: opportunityMap["Acme 年度经营动作控制台试点"].id,
      limit: 3,
      persist: true,
      captureTelemetry: false,
    }),
    generateRecommendationsForObject({
      workspaceId: workspace.id,
      actorName: "Helm Capture Seeder",
      actorUserId: userMap["recruiter@demo.com"].id,
      actorType: ActorType.SYSTEM,
      sourcePage: "/capture",
      objectType: ObjectType.CONTACT,
      objectId: contactMap["Aya Nakamura"].id,
      limit: 3,
      persist: true,
      captureTelemetry: false,
    }),
  ]);

  await prisma.auditLog.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        actor: userMap["saleslead@demo.com"].name,
        actorType: ActorType.USER,
        actionType: "CAPTURE_STARTED",
        targetType: "CaptureSession",
        targetId: captureSessionMap.sales.id,
        summary: "开始了一次销售现场记录",
        payload: json({ sourceType: CaptureSourceType.MANUAL_CAPTURE, objectType: ObjectType.OPPORTUNITY, objectId: opportunityMap["Acme 年度经营动作控制台试点"].id }),
        sourcePage: `/opportunities?opportunityId=${opportunityMap["Acme 年度经营动作控制台试点"].id}`,
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        actor: "Helm AI",
        actorType: ActorType.AI,
        actionType: "CONVERSATION_CAPTURE_PROCESSED",
        targetType: "CaptureSession",
        targetId: captureSessionMap.sales.id,
        summary: "完成现场记录处理：星桥科技付款节奏现场记录",
        payload: json({ linkedMeetingId: meetingMap["Acme Discovery 回顾"].id, createdInsightCount: 4 }),
        sourcePage: "/capture",
        relatedObjectType: "Opportunity",
        relatedObjectId: opportunityMap["Acme 年度经营动作控制台试点"].id,
      },
    ],
  });

  await prisma.eventLog.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        eventName: "capture_started",
        eventCategory: "conversation_capture",
        targetType: "CaptureSession",
        targetId: captureSessionMap.sales.id,
        metadata: json({ objectType: ObjectType.OPPORTUNITY, objectId: opportunityMap["Acme 年度经营动作控制台试点"].id }),
        sourcePage: `/opportunities?opportunityId=${opportunityMap["Acme 年度经营动作控制台试点"].id}`,
        createdAt: addHours(subDays(today, 1), 14),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        eventName: "conversation_capture_opened",
        eventCategory: "page_view",
        targetType: "Page",
        targetId: "/capture",
        sourcePage: "/capture",
        createdAt: addHours(subDays(today, 1), 15),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        eventName: "capture_processing_started",
        eventCategory: "conversation_capture",
        targetType: "CaptureSession",
        targetId: captureSessionMap.sales.id,
        metadata: json({ hasAudioFile: false, hasTranscriptDraft: false, objectType: ObjectType.OPPORTUNITY, objectId: opportunityMap["Acme 年度经营动作控制台试点"].id }),
        sourcePage: "/capture",
        createdAt: addHours(subDays(today, 1), 15),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        eventName: "transcript_generated",
        eventCategory: "conversation_capture",
        targetType: "CaptureSession",
        targetId: captureSessionMap.sales.id,
        metadata: json({ segmentsCount: 4, confidence: 84 }),
        sourcePage: "/capture",
        createdAt: addHours(subDays(today, 1), 15),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        eventName: "capture_memory_written",
        eventCategory: "conversation_capture",
        targetType: "CaptureSession",
        targetId: captureSessionMap.sales.id,
        metadata: json({ createdFactCount: 1, createdCommitmentCount: 1, createdBlockerCount: 1 }),
        sourcePage: "/capture",
        createdAt: addHours(subDays(today, 1), 15),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        eventName: "capture_recommendations_refreshed",
        eventCategory: "conversation_capture",
        targetType: "CaptureSession",
        targetId: captureSessionMap.sales.id,
        metadata: json({ refreshedRecommendationObjectCount: 2, refreshedRecommendationCount: 2, approvalCount: 1 }),
        sourcePage: "/capture",
        createdAt: addHours(subDays(today, 1), 15),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        eventName: "capture_actions_created",
        eventCategory: "conversation_capture",
        targetType: "CaptureSession",
        targetId: captureSessionMap.sales.id,
        metadata: json({ createdActionCount: 1, approvalCount: 1 }),
        sourcePage: "/capture",
        createdAt: addHours(subDays(today, 1), 15),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        eventName: "capture_processing_completed",
        eventCategory: "conversation_capture",
        targetType: "CaptureSession",
        targetId: captureSessionMap.sales.id,
        metadata: json({ transcriptId: "seed-sales-transcript", meetingId: meetingMap["Acme Discovery 回顾"].id, insightCount: 4, createdActionCount: 1, refreshedRecommendationObjectCount: 2 }),
        sourcePage: "/capture",
        createdAt: addHours(subDays(today, 1), 15),
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        eventName: "conversation_insights_generated",
        eventCategory: "conversation_capture",
        targetType: "CaptureSession",
        targetId: captureSessionMap.sales.id,
        metadata: json({ insightCount: 4, linkedMeetingId: meetingMap["Acme Discovery 回顾"].id }),
        sourcePage: "/capture",
        createdAt: addHours(subDays(today, 1), 15),
      },
    ],
  });

  await prisma.weeklyReport.create({
    data: {
      workspaceId: workspace.id,
      weekStart: startOfDay(subDays(today, 6)),
      weekEnd: addDays(startOfDay(subDays(today, 6)), 6),
      summaryText: "过去一周系统识别出 8 次机会推进动作，其中 6 次已经形成明确下一步，当前仍有 3 个跟进逾期。AI 共生成 11 条建议动作，5 条已被批准执行，目前还有 4 个高风险事项待处理。",
      opportunitiesAdvancedCount: 8,
      overdueFollowupsCount: 3,
      aiSuggestionsCount: 11,
      approvalsApprovedCount: 5,
      openHighRiskCount: 4,
      payload: json({
        meetingsCount: 7,
        newOpportunitiesCount: 3,
        rejectedActionsCount: 1,
        mostActiveUser: { name: "林舟", score: 12 },
        overdueItems: [
          { id: opportunityMap["Beacon 零售网络恢复单"].id, title: "Beacon 零售网络恢复单", companyName: "Beacon Retail" },
          { id: opportunityMap["Delta Capital 闭门沙龙共办"].id, title: "Delta Capital 闭门沙龙共办", companyName: "Delta Capital" },
        ],
        highRiskItems: [
          { id: opportunityMap["Nimbus 实施与法务联动项目"].id, title: "Nimbus 实施与法务联动项目", companyName: "Nimbus Systems", riskLevel: RiskLevel.HIGH },
          { id: opportunityMap["Aya Nakamura 候选人推进"].id, title: "Aya Nakamura 候选人推进", companyName: "GreenPeak Health", riskLevel: RiskLevel.CRITICAL },
        ],
        evolutionInsights: [
          {
            id: "seed-stalled-opportunity",
            title: "系统观察到 ADVANCING 阶段的机会超过 5 天未推进时更容易掉速",
            summary: "Ben Carter 候选人推进和 Delta Capital 闭门沙龙共办都出现了长时间未推进信号，系统会把这类机会提前。",
            confidence: 76,
          },
          {
            id: "seed-contact-cooling",
            title: "系统观察到温关系超过 7 天未触达时更容易降温",
            summary: "Olivia、Zack 和 Mason 都已经进入关系恢复窗口，相关 follow-up 会更早进入 recommendation。",
            confidence: 72,
          },
        ],
        recentAdoptions: [
          {
            id: "seed-meeting-followup-adoption",
            title: "已把会后跟进窗口收紧到 24 小时",
            summary: "系统已经把近期稳定出现的会后推进规律收敛到默认 timing signal。",
          },
        ],
        governanceMetrics: {
          auditEventsCount: 18,
          llmFallbackCount: 1,
          averageApprovalTurnaroundHours: 3.5,
          acceptedStrategyCount: 1,
        },
        integrationMetrics: {
          connectorHealth: {
            connectedCount: 1,
            errorCount: 0,
          },
          unboundThreads: 1,
        },
      }),
    },
  });

  await refreshEvolutionState({
    workspaceId: workspace.id,
    actorId: userMap["founder@demo.com"].id,
    actorType: ActorType.SYSTEM,
    sourcePage: "/seed",
    trigger: "seed_finalize",
  });

  const meetingFollowupSuggestion = await prisma.strategySuggestion.findFirst({
    where: {
      workspaceId: workspace.id,
      status: "OPEN",
      targetPolicyKey: "meeting_followup",
    },
    orderBy: {
      confidence: "desc",
    },
  });

  if (meetingFollowupSuggestion) {
    await acceptStrategySuggestion({
      workspaceId: workspace.id,
      suggestionId: meetingFollowupSuggestion.id,
      userId: userMap["founder@demo.com"].id,
      actorName: userMap["founder@demo.com"].name,
    });
  }

  await seedSettlementOperationsProofPack({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    workspaceLabel: workspace.name,
    startedAt: subDays(now, 12),
  });

  await seedSalesWorkspaceDemo({ userMap });
  await seedRecruiterWorkspaceDemo({ userMap });

  console.log("Seed complete");
}

type DemoUserMap = Record<string, { id: string; name: string }>;

async function seedDefaultPolicies(workspaceId: string) {
  const policyRules = [
    ["外发邮件默认审批", ActionType.DRAFT_EXTERNAL_EMAIL, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "外发动作"],
    ["内部纪要按规则发送", ActionType.DRAFT_INTERNAL_NOTE, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.HIGH, "内部动作"],
    ["创建会议自动执行", ActionType.CREATE_MEETING, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.MEDIUM, "日程类"],
    ["机会阶段更新默认自动", ActionType.UPDATE_OPPORTUNITY_STAGE, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.MEDIUM, "机会类"],
    ["创建待办默认自动", ActionType.CREATE_TASK, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.MEDIUM, "内部动作"],
    ["指派负责人需审批", ActionType.ASSIGN_OWNER, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "协同类"],
    ["修改截止时间需审批", ActionType.CHANGE_DUE_DATE, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "治理类"],
    ["安排面试默认审批", ActionType.SCHEDULE_INTERVIEW, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "招聘类"],
  ] as const;

  await prisma.policyRule.createMany({
    data: policyRules.map(([name, actionType, mode, riskThreshold, appliesTo]) => ({
      workspaceId,
      name,
      actionType,
      mode,
      riskThreshold,
      appliesTo,
      description: `${name}，超出阈值或高风险时强制审批。`,
    })),
  });
}

async function seedSalesWorkspaceDemo({ userMap }: { userMap: DemoUserMap }) {
  const workspace = await prisma.workspace.create({
    data: {
      name: "中国企业软件销售转化 Demo",
      slug: "helm-sales-demo",
      description: "面向中国 B2B 软件、AI 服务和企业服务团队的转化演示工作区",
      profileType: "商务负责人",
      connectedSources: json([
        { name: "HubSpot", status: "connected" },
        { name: "Gmail", status: "connected" },
        { name: "上传历史纪要", status: "connected" },
      ]),
      focusAreas: json(["大客户试点", "会后推进", "外发复核", "CRM 信号转经营动作"]),
      defaultStrategies: json([
        "外发跟进默认审批",
        "内部同步和建会可自动执行",
        "高风险机会优先进入首页",
      ]),
      defaultLLMProvider: "qwen",
      defaultLLMModel: process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      extractionModel: process.env.LLM_EXTRACTION_MODEL || process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      briefingModel: process.env.LLM_BRIEFING_MODEL || process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      reasoningModel: process.env.LLM_REASONING_MODEL || process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      llmBudgetTier: "pilot",
      llmEnabled: process.env.LLM_ENABLED !== "false",
      defaultLocale: "zh-CN",
      pilotMode: true,
      featureFlagsJson: json(defaultWorkspaceFeatureFlags),
      dataRetentionDays: 90,
      captureConsentRequired: true,
      configuration: json({
        demoMode: "sales",
        workspaceLabel: "中国企业软件销售转化",
        operatingModel: "大客户推进、会后动作与外发复核前台",
      }),
    },
  });
  await seedWorkspaceCommercialFoundation(workspace.id, subDays(now, 9), workspace.defaultLocale ?? "zh-CN");

  await prisma.membership.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        role: WorkspaceRole.REVIEWER,
        title: "商务负责人",
        persona: "商务负责人",
      },
      {
        workspaceId: workspace.id,
        userId: userMap["ops@demo.com"].id,
        role: WorkspaceRole.OPERATOR,
        title: "销售运营",
        persona: "顾问 / 服务商",
      },
    ],
  });

  const companies = await Promise.all([
    prisma.company.create({
      data: {
        workspaceId: workspace.id,
        name: "华东智造集团",
        industry: "装备制造",
        website: "https://huadong-zhizao.demo",
        description: "正在评估用 Helm 做大客户会后推进和经营复盘试点。",
        maturityScore: 79,
        cooperationMaturity: "进入采购评估",
        recommendedPath: "先把 ROI、采购流程和联合评审节奏锁住。",
        tags: json(["商务转化", "HubSpot 主线"]),
        lastInteractionAt: subDays(now, 1),
      },
    }),
    prisma.company.create({
      data: {
        workspaceId: workspace.id,
        name: "星河连锁",
        industry: "连锁零售",
        website: "https://xinghe-retail.demo",
        description: "旧单恢复机会，内部预算更谨慎，窗口正在关闭。",
        maturityScore: 45,
        cooperationMaturity: "恢复窗口短",
        recommendedPath: "先做缩小版试点，避免再陷入价格拉扯。",
        tags: json(["高风险", "恢复单"]),
        lastInteractionAt: subDays(now, 4),
      },
    }),
    prisma.company.create({
      data: {
        workspaceId: workspace.id,
        name: "安域云科",
        industry: "企业云服务",
        website: "https://anyu-cloud.demo",
        description: "技术认可，但交付、安全评审和法务节奏卡住推进。",
        maturityScore: 63,
        cooperationMaturity: "需内部协同",
        recommendedPath: "先把安全评审和交付时间表一次性对齐。",
        tags: json(["内部协同", "复杂实施"]),
        lastInteractionAt: subDays(now, 3),
      },
    }),
  ]);
  const companyMap = Object.fromEntries(companies.map((company) => [company.name, company]));

  const contacts = await Promise.all([
    prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        companyId: companyMap["华东智造集团"].id,
        ownerId: userMap["saleslead@demo.com"].id,
        name: "赵敏",
        title: "财务负责人",
        email: "zhaomin@huadong.demo",
        tags: json(["采购关键人", "ROI"]),
        notes: "更关心财务回报、付款节奏和可审计材料，不喜欢模糊承诺。",
        relationshipStage: "active",
        relationshipTemperature: 84,
        relationshipWarmth: RelationshipWarmth.HOT,
        lastInteractionAt: subDays(now, 1),
      },
    }),
    prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        companyId: companyMap["华东智造集团"].id,
        ownerId: userMap["saleslead@demo.com"].id,
        name: "陈嘉伟",
        title: "数字化负责人",
        email: "jiawei@huadong.demo",
        tags: json(["内部推动人"]),
        notes: "愿意推动试点，但会反复确认实施工作量。",
        relationshipStage: "champion",
        relationshipTemperature: 92,
        relationshipWarmth: RelationshipWarmth.CHAMPION,
        lastInteractionAt: subDays(now, 2),
      },
    }),
    prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        companyId: companyMap["星河连锁"].id,
        ownerId: userMap["saleslead@demo.com"].id,
        name: "宋岚",
        title: "增长负责人",
        email: "songlan@xinghe.demo",
        tags: json(["恢复单", "预算谨慎"]),
        notes: "现在不排斥继续评估，但回复节奏明显变慢。",
        relationshipStage: "cooling",
        relationshipTemperature: 48,
        relationshipWarmth: RelationshipWarmth.WARM,
        lastInteractionAt: subDays(now, 8),
      },
    }),
    prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        companyId: companyMap["安域云科"].id,
        ownerId: userMap["saleslead@demo.com"].id,
        name: "陆晨",
        title: "技术负责人",
        email: "luchen@anyu.demo",
        tags: json(["安全评审", "交付依赖"]),
        notes: "产品方向认可，但安全评审与法务要一次性说清。",
        relationshipStage: "warming",
        relationshipTemperature: 66,
        relationshipWarmth: RelationshipWarmth.WARM,
        lastInteractionAt: subDays(now, 5),
      },
    }),
  ]);
  const contactMap = Object.fromEntries(contacts.map((contact) => [contact.name, contact]));

  const northBridge = await prisma.opportunity.create({
    data: {
      workspaceId: workspace.id,
      companyId: companyMap["华东智造集团"].id,
      ownerId: userMap["saleslead@demo.com"].id,
      title: "华东智造经营推进试点",
      description: "围绕大客户会后推进、跨部门协同和经营复盘做第一期试点。",
      type: OpportunityType.CLIENT,
      stage: OpportunityStage.ADVANCING,
      riskLevel: RiskLevel.MEDIUM,
      nextAction: "发送会后 ROI 跟进邮件并确认联合评审窗口",
      nextStepSummary: "先收口 ROI 和采购评估",
      dueDate: addDays(now, 1),
      lastProgressAt: subDays(now, 1),
      priorityScore: 94,
      contacts: { connect: [{ id: contactMap["赵敏"].id }, { id: contactMap["陈嘉伟"].id }] },
    },
  });
  const cedar = await prisma.opportunity.create({
    data: {
      workspaceId: workspace.id,
      companyId: companyMap["星河连锁"].id,
      ownerId: userMap["saleslead@demo.com"].id,
      title: "星河连锁恢复试点",
      description: "恢复单，需要用更轻量的切入方式重新建立内部兴趣。",
      type: OpportunityType.CLIENT,
      stage: OpportunityStage.WAITING_THEM,
      riskLevel: RiskLevel.HIGH,
      nextAction: "发送更克制的恢复跟进，重定义试点范围",
      nextStepSummary: "重定义价值而不是继续压价格",
      dueDate: todayAt(14, 30),
      lastProgressAt: subDays(now, 7),
      priorityScore: 83,
      contacts: { connect: [{ id: contactMap["宋岚"].id }] },
    },
  });
  const apex = await prisma.opportunity.create({
    data: {
      workspaceId: workspace.id,
      companyId: companyMap["安域云科"].id,
      ownerId: userMap["saleslead@demo.com"].id,
      title: "安域云科安全评审扩展包",
      description: "技术上愿意推进，但要先把安全评审、法务和交付时间表接起来。",
      type: OpportunityType.CLIENT,
      stage: OpportunityStage.INTERNAL_SYNC,
      riskLevel: RiskLevel.HIGH,
      nextAction: "组织一次售前、法务、交付三方同步",
      nextStepSummary: "先打通内部交付路径",
      dueDate: addDays(now, 2),
      lastProgressAt: subDays(now, 6),
      priorityScore: 85,
      contacts: { connect: [{ id: contactMap["陆晨"].id }] },
    },
  });
  const meetings = await Promise.all([
    prisma.meeting.create({
      data: {
        workspaceId: workspace.id,
        companyId: companyMap["华东智造集团"].id,
        opportunityId: northBridge.id,
        ownerId: userMap["saleslead@demo.com"].id,
        title: "华东智造采购推进同步会",
        agenda: "确认 ROI、采购顺序和下一轮联合评审时间窗",
        location: "Zoom",
        status: MeetingStatus.SCHEDULED,
        startsAt: todayAt(10, 0),
        endsAt: todayAt(10, 45),
        contacts: { connect: [{ id: contactMap["赵敏"].id }, { id: contactMap["陈嘉伟"].id }] },
      },
    }),
    prisma.meeting.create({
      data: {
        workspaceId: workspace.id,
        companyId: companyMap["星河连锁"].id,
        opportunityId: cedar.id,
        ownerId: userMap["saleslead@demo.com"].id,
        title: "星河连锁恢复窗口复盘",
        agenda: "确认最小试点是否还有恢复空间",
        location: "Meet",
        status: MeetingStatus.COMPLETED,
        startsAt: subDays(todayAt(16, 0), 1),
        endsAt: subDays(todayAt(16, 35), 1),
        contacts: { connect: [{ id: contactMap["宋岚"].id }] },
      },
    }),
    prisma.meeting.create({
      data: {
        workspaceId: workspace.id,
        companyId: companyMap["安域云科"].id,
        opportunityId: apex.id,
        ownerId: userMap["saleslead@demo.com"].id,
        title: "安域云科内部交付对齐会",
        agenda: "把安全评审、法务时间表和交付边界一次性说清",
        location: "War Room",
        status: MeetingStatus.SCHEDULED,
        startsAt: todayAt(15, 0),
        endsAt: todayAt(15, 40),
        contacts: { connect: [{ id: contactMap["陆晨"].id }] },
      },
    }),
  ]);
  const meetingMap = Object.fromEntries(meetings.map((meeting) => [meeting.title, meeting]));

  const salesNotes = [
    {
      meetingTitle: "华东智造采购推进同步会",
      attendeesSummary: "赵敏更关心 ROI 与付款节奏，陈嘉伟愿意内部推动。",
      relationshipSummary: "关系处于升温期，客户已经接受试点方向。",
      previousConclusion: "客户认可价值，但需要更结构化的会后材料带回采购流程。",
      meetingGoal: "确认采购顺序、付款节奏和下一轮联合评审窗口。",
      recommendedQuestions: "如果 2 周内启动试点，采购前必须再确认哪三项？\n赵敏最想看到的 ROI 证明形式是什么？",
      riskAlerts: "如果会后 24 小时内没有结构化跟进，这个窗口会迅速冷下来。",
      liveTranscript: "10:08 赵敏: 我们要先看 ROI 和付款节奏。\n10:19 陈嘉伟: 我可以推动试点，但需要你们先给一版联合评审方案。\n10:31 你方: 会后 24 小时内给到结构化跟进。",
      summary: "客户已经进入采购推进窗口，关键动作是 24 小时内发出 ROI 材料和联合评审安排。",
      keyDecisions: "赵敏负责带采购。\n陈嘉伟愿意内部推动。\n下轮要做联合评审。",
      confirmations: "发送 ROI 跟进。\n安排联合评审准备。",
    },
    {
      meetingTitle: "星河连锁恢复窗口复盘",
      attendeesSummary: "宋岚独立参会，预算压力明显。",
      relationshipSummary: "关系在降温，但仍未彻底关闭窗口。",
      previousConclusion: "继续追原方案和原预算没有意义。",
      meetingGoal: "确认更轻量的试点切口是否还有恢复空间。",
      recommendedQuestions: "如果把试点缩成单一区域，还会不会内部再看一次？\n现在最大阻力是预算还是团队注意力？",
      riskAlerts: "如果本周没有新切口，建议在系统里正式进入流失复盘。",
      liveTranscript: "16:10 宋岚: 预算比以前更紧，但如果范围更小，还可以再试一次。\n16:24 你方: 我们回去整理一版更轻的恢复方案。",
      summary: "机会尚未完全关闭，但必须换打法，否则会继续下滑。",
      keyDecisions: "提交缩小版试点。\n若无回应，进入 lost 复盘。",
      confirmations: "起草一封更克制的恢复邮件。",
    },
    {
      meetingTitle: "安域云科内部交付对齐会",
      attendeesSummary: "陆晨认可方向，但内部安全评审和法务要一次性对齐。",
      relationshipSummary: "客户态度稳定，但项目推进被内部协同拖住。",
      previousConclusion: "技术方向没问题，卡点在内部协同节奏。",
      meetingGoal: "把交付、法务和安全评审时间表一次性对齐。",
      recommendedQuestions: "安全评审最晚什么时候必须给答复？\n如果交付和法务一起进会，最想一次解决什么？",
      riskAlerts: "如果内部路径不清晰，客户会重新评估推进优先级。",
      liveTranscript: "15:06 陆晨: 真正卡住的是安全评审和法务答复时间。\n15:18 你方: 我们会组织内部三方同步，把时间表和边界一起锁住。",
      summary: "当前最重要的不是继续外推，而是先完成内部交付对齐。",
      keyDecisions: "先组织内部同步。\n再回到客户侧推进。",
      confirmations: "创建内部协同会。\n锁定安全评审时间。",
    },
  ];

  for (const note of salesNotes) {
    await prisma.meetingNote.create({
      data: {
        workspaceId: workspace.id,
        meetingId: meetingMap[note.meetingTitle].id,
        attendeesSummary: note.attendeesSummary,
        relationshipSummary: note.relationshipSummary,
        previousConclusion: note.previousConclusion,
        meetingGoal: note.meetingGoal,
        recommendedQuestions: note.recommendedQuestions,
        riskAlerts: note.riskAlerts,
        liveTranscript: note.liveTranscript,
        summary: note.summary,
        keyDecisions: note.keyDecisions,
        confirmations: note.confirmations,
      },
    });
  }

  const actor = {
    workspaceId: workspace.id,
    actorName: "Sales Demo Seeder",
    actorUserId: userMap["saleslead@demo.com"].id,
    actorType: ActorType.SYSTEM,
    sourcePage: "/seed",
    suppressEvolutionRefresh: true,
  } as const;

  for (const meetingTitle of Object.keys(meetingMap)) {
    await hydrateMeetingMemoryFromNote({
      ...actor,
      meetingId: meetingMap[meetingTitle].id,
    });
  }

  await generateMeetingBriefingSnapshot({
    ...actor,
    meetingId: meetingMap["华东智造采购推进同步会"].id,
  });

  await createCommitment({
    ...actor,
    title: "24 小时内发华东智造 ROI 材料",
    commitmentText: "在 24 小时内发华东智造 ROI 材料，并锁一版联合评审准备项。",
    sourceType: SourceType.MEETING_NOTE,
    sourceId: meetingMap["华东智造采购推进同步会"].id,
    relatedContactId: contactMap["赵敏"].id,
    relatedCompanyId: companyMap["华东智造集团"].id,
    relatedOpportunityId: northBridge.id,
    relatedMeetingId: meetingMap["华东智造采购推进同步会"].id,
    ownerUserId: userMap["saleslead@demo.com"].id,
    dueDate: addDays(now, 1),
    priority: 92,
    confidence: 88,
  });

  await createCommitment({
    ...actor,
    title: "确认安域云科安全评审时间表",
    commitmentText: "两天内确认安域云科安全评审和法务同步时间表。",
    sourceType: SourceType.MEETING_NOTE,
    sourceId: meetingMap["安域云科内部交付对齐会"].id,
    relatedContactId: contactMap["陆晨"].id,
    relatedCompanyId: companyMap["安域云科"].id,
    relatedOpportunityId: apex.id,
    relatedMeetingId: meetingMap["安域云科内部交付对齐会"].id,
    ownerUserId: userMap["saleslead@demo.com"].id,
    dueDate: addDays(now, 2),
    priority: 84,
    confidence: 82,
  });

  const cedarCommitment = await createCommitment({
    ...actor,
    title: "重新定义星河连锁恢复方案",
    commitmentText: "在客户窗口彻底关闭前给出一版更轻量的恢复方案。",
    sourceType: SourceType.MEETING_NOTE,
    sourceId: meetingMap["星河连锁恢复窗口复盘"].id,
    relatedContactId: contactMap["宋岚"].id,
    relatedCompanyId: companyMap["星河连锁"].id,
    relatedOpportunityId: cedar.id,
    relatedMeetingId: meetingMap["星河连锁恢复窗口复盘"].id,
    ownerUserId: userMap["saleslead@demo.com"].id,
    dueDate: subDays(todayAt(17, 30), 1),
    priority: 80,
    confidence: 72,
  });
  await updateCommitmentStatus({
    ...actor,
    commitmentId: cedarCommitment.id,
    status: CommitmentStatus.OVERDUE,
    statusNote: "恢复方案已逾期，机会继续掉速。",
  });

  await createBlocker({
    ...actor,
    title: "华东智造付款节奏未明确",
    blockerType: "payment_cycle",
    blockerText: "客户仍未明确付款节奏和采购评估顺序，会影响最终方案粒度。",
    severity: 74,
    sourceType: SourceType.MEETING_NOTE,
    sourceId: meetingMap["华东智造采购推进同步会"].id,
    relatedContactId: contactMap["赵敏"].id,
    relatedCompanyId: companyMap["华东智造集团"].id,
    relatedOpportunityId: northBridge.id,
    relatedMeetingId: meetingMap["华东智造采购推进同步会"].id,
  });

  await createBlocker({
    ...actor,
    title: "安域云科安全评审时间未知",
    blockerType: "security_review",
    blockerText: "安全评审和法务答复时间仍未锁定，会拖慢客户侧决策。",
    severity: 82,
    sourceType: SourceType.MEETING_NOTE,
    sourceId: meetingMap["安域云科内部交付对齐会"].id,
    relatedContactId: contactMap["陆晨"].id,
    relatedCompanyId: companyMap["安域云科"].id,
    relatedOpportunityId: apex.id,
    relatedMeetingId: meetingMap["安域云科内部交付对齐会"].id,
  });

  await createMemoryFact({
    ...actor,
    objectType: ObjectType.CONTACT,
    objectId: contactMap["赵敏"].id,
    factType: MemoryFactType.PREFERENCE,
    title: "赵敏更关心 ROI 与付款节奏",
    content: "赵敏更看重 ROI 证明和付款节奏，而不是一开始就看全量功能。",
    sourceType: SourceType.MEETING_NOTE,
    sourceId: meetingMap["华东智造采购推进同步会"].id,
    confidence: 88,
    importance: 90,
    freshnessScore: 86,
  });

  const actionByTitle: Record<string, string> = {};
  for (const action of [
    {
      title: "发送华东智造会后 ROI 材料",
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      description: "基于今天的采购推进会生成一封结构化跟进材料。",
      aiReason: "客户采购窗口已经打开，24 小时内发 ROI 材料最能稳住节奏。",
      draftContent: "赵敏你好，基于今天的讨论，我把 ROI 框架、付款节奏假设和联合评审准备项整理如下……",
      riskLevel: RiskLevel.HIGH,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.PENDING_APPROVAL,
      suggestedExecutionAt: addMinutes(todayAt(10, 45), 15),
      dueDate: todayAt(13, 0),
      opportunityId: northBridge.id,
      meetingId: meetingMap["华东智造采购推进同步会"].id,
      contactId: contactMap["赵敏"].id,
      ownerId: userMap["saleslead@demo.com"].id,
    },
    {
      title: "起草星河连锁恢复邮件",
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      description: "输出一封更克制的恢复跟进邮件。",
      aiReason: "当前机会的关键不是继续追原报价，而是先证明更轻量方案可行。",
      draftContent: "宋岚你好，我们把恢复方案压缩成更轻的一版，希望你们可以更容易内部再看一次……",
      riskLevel: RiskLevel.HIGH,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.PENDING_APPROVAL,
      suggestedExecutionAt: todayAt(11, 30),
      dueDate: todayAt(17, 30),
      opportunityId: cedar.id,
      meetingId: meetingMap["星河连锁恢复窗口复盘"].id,
      contactId: contactMap["宋岚"].id,
      ownerId: userMap["saleslead@demo.com"].id,
    },
    {
      title: "安排安域云科内部三方同步",
      actionType: ActionType.CREATE_MEETING,
      description: "让售前、法务、交付一起对齐安全评审和交付边界。",
      aiReason: "内部协同是当前最大卡点，不先打通就不适合继续外推。",
      riskLevel: RiskLevel.MEDIUM,
      executionMode: ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
      requiresApproval: false,
      status: ActionStatus.EXECUTED,
      suggestedExecutionAt: addDays(now, 1),
      dueDate: addDays(now, 1),
      opportunityId: apex.id,
      meetingId: meetingMap["安域云科内部交付对齐会"].id,
      contactId: contactMap["陆晨"].id,
      ownerId: userMap["saleslead@demo.com"].id,
    },
  ]) {
    const created = await prisma.actionItem.create({
      data: {
        workspaceId: workspace.id,
        opportunityId: action.opportunityId,
        meetingId: action.meetingId,
        contactId: action.contactId,
        ownerId: action.ownerId,
        actionType: action.actionType,
        title: action.title,
        description: action.description,
        aiReason: action.aiReason,
        draftContent: action.draftContent,
        riskLevel: action.riskLevel,
        executionMode: action.executionMode,
        requiresApproval: action.requiresApproval,
        status: action.status,
        suggestedExecutionAt: action.suggestedExecutionAt,
        dueDate: action.dueDate,
      },
    });
    actionByTitle[action.title] = created.id;
  }

  for (const title of ["发送华东智造会后 ROI 材料", "起草星河连锁恢复邮件"]) {
    await prisma.approvalTask.create({
      data: {
        workspaceId: workspace.id,
        actionItemId: actionByTitle[title],
        approverId: userMap["saleslead@demo.com"].id,
        status: ApprovalStatus.PENDING,
        channel: "外发动作",
        isHighRisk: true,
        autoExecute: false,
        contextSnapshot: title,
        reasoning: title === "发送华东智造会后 ROI 材料" ? "采购推进窗口短，建议今天批掉并发出。" : "恢复窗口正在关闭，需要由商务负责人控制口径。",
        editableContent: title === "发送华东智造会后 ROI 材料" ? "华东智造 ROI 材料草稿" : "星河连锁恢复邮件草稿",
        resultPreview: "批准后会写入时间线、更新推荐依据并推进机会状态。",
      },
    });
  }

  for (const thread of [
    {
      subject: "华东智造 ROI 跟进材料",
      counterpart: "赵敏",
      summary: "客户在等 ROI 跟进材料和联合评审准备项。",
      contactId: contactMap["赵敏"].id,
      companyId: companyMap["华东智造集团"].id,
      opportunityId: northBridge.id,
      status: ThreadStatus.WAITING_US,
      messages: [
        { sender: "赵敏", senderEmail: "zhaomin@huadong.demo", body: "如果今天能把 ROI 版本发我，我可以马上拉采购一起看。", isInbound: true, sentAt: todayAt(10, 42) },
      ],
    },
    {
      subject: "星河连锁恢复范围",
      counterpart: "宋岚",
      summary: "恢复单窗口还没完全关闭，但需要更轻量的方案。",
      contactId: contactMap["宋岚"].id,
      companyId: companyMap["星河连锁"].id,
      opportunityId: cedar.id,
      status: ThreadStatus.WAITING_US,
      messages: [
        { sender: "宋岚", senderEmail: "songlan@xinghe.demo", body: "如果范围再轻一点，也许我们内部还能再看一次。", isInbound: true, sentAt: subDays(todayAt(16, 40), 1) },
      ],
    },
    {
      subject: "安域云科安全评审时间",
      counterpart: "陆晨",
      summary: "客户在等安全评审和交付时间表。",
      contactId: contactMap["陆晨"].id,
      companyId: companyMap["安域云科"].id,
      opportunityId: apex.id,
      status: ThreadStatus.WAITING_US,
      messages: [
        { sender: "陆晨", senderEmail: "luchen@anyu.demo", body: "我们现在主要在等你们把安全评审和法务节奏对齐。", isInbound: true, sentAt: subDays(now, 1) },
      ],
    },
  ]) {
    const createdThread = await prisma.emailThread.create({
      data: {
        workspaceId: workspace.id,
        contactId: thread.contactId,
        companyId: thread.companyId,
        opportunityId: thread.opportunityId,
        subject: thread.subject,
        counterpart: thread.counterpart,
        summary: thread.summary,
        participants: json([thread.counterpart]),
        source: RecordSource.IMPORT,
        status: thread.status,
        waitingOn: "我方",
        shouldReply: true,
      },
    });
    await prisma.emailMessage.createMany({
      data: thread.messages.map((message) => ({
        threadId: createdThread.id,
        ...message,
      })),
    });
  }

  await seedDefaultPolicies(workspace.id);

  const hubspotSource = await prisma.importSource.create({
    data: {
      workspaceId: workspace.id,
      userId: userMap["saleslead@demo.com"].id,
      sourceType: ImportSourceType.HUBSPOT,
      sourceName: "HubSpot",
      status: ImportSourceStatus.CONNECTED,
      authMode: "MOCK",
      externalAccountId: "hubspot-sales-demo",
      externalAccountLabel: "华东智造 / 星河连锁 HubSpot 示例工作区",
      lastSyncedAt: addHours(subDays(today, 1), 9),
      configJson: json({ mock: true, objects: ["contacts", "companies", "deals", "notes", "associations"] }),
    },
  });

  const hubspotJob = await prisma.importJob.create({
    data: {
      workspaceId: workspace.id,
      sourceId: hubspotSource.id,
      createdByUserId: userMap["saleslead@demo.com"].id,
      jobType: ImportJobType.INITIAL_IMPORT,
      status: ImportJobStatus.COMPLETED_WITH_WARNINGS,
      totalRecords: 9,
      successRecords: 8,
      failedRecords: 0,
      warningRecords: 1,
      startedAt: addHours(subDays(today, 1), 9),
      finishedAt: addMinutes(addHours(subDays(today, 1), 9), 4),
      summaryJson: json({
        importedCounts: { contacts: 3, companies: 3, opportunities: 3, notes: 2, associations: 5 },
        warmup: { refreshedObjects: 6, generatedRecommendations: 8, detectedCommitments: 3, detectedBlockers: 2 },
      }),
    },
  });

  await prisma.company.update({
    where: { id: companyMap["华东智造集团"].id },
    data: {
      externalSource: ImportSourceType.HUBSPOT,
      externalObjectType: "COMPANY",
      externalObjectId: "hubspot-company-huadong",
      externalOwnerId: "hubspot-owner-sales-demo",
      externalSyncedAt: subDays(now, 1),
    },
  });
  await prisma.contact.update({
    where: { id: contactMap["赵敏"].id },
    data: {
      externalSource: ImportSourceType.HUBSPOT,
      externalObjectType: "CONTACT",
      externalObjectId: "hubspot-contact-zhaomin",
      externalOwnerId: "hubspot-owner-sales-demo",
      externalSyncedAt: subDays(now, 1),
    },
  });
  await prisma.opportunity.update({
    where: { id: northBridge.id },
    data: {
      externalSource: ImportSourceType.HUBSPOT,
      externalObjectType: "DEAL",
      externalObjectId: "hubspot-deal-huadong",
      externalOwnerId: "hubspot-owner-sales-demo",
      externalSyncedAt: subDays(now, 1),
    },
  });

  const reviewItem = await prisma.importItem.create({
    data: {
      workspaceId: workspace.id,
      importJobId: hubspotJob.id,
      externalType: "CONTACT",
      externalId: "hubspot-contact-jiawei-review",
      mappedObjectType: "Contact",
      mappedObjectId: contactMap["陈嘉伟"].id,
      matchStatus: ImportMatchStatus.NEEDS_REVIEW,
      conflictStatus: ImportConflictStatus.NEEDS_REVIEW,
      normalizedPayload: json({ name: "陈嘉伟", company: "华东智造集团" }),
      warningMessage: "联系人公司匹配成功，但邮箱别名不同，需要人工确认是否合并。",
    },
  });
  await prisma.identityMatch.create({
    data: {
      workspaceId: workspace.id,
      sourceId: hubspotSource.id,
      importItemId: reviewItem.id,
      externalType: "CONTACT",
      externalId: "hubspot-contact-jiawei-review",
      internalObjectType: "Contact",
      internalObjectId: contactMap["陈嘉伟"].id,
      matchScore: 62,
      matchReason: "姓名和公司匹配，但邮箱别名不一致，需确认是否与现有联系人合并。",
      status: IdentityMatchStatus.NEEDS_REVIEW,
    },
  });
  await prisma.importItem.createMany({
    data: [
      {
        workspaceId: workspace.id,
        importJobId: hubspotJob.id,
        externalType: "COMPANY",
        externalId: "hubspot-company-huadong",
        mappedObjectType: "Company",
        mappedObjectId: companyMap["华东智造集团"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: hubspotJob.id,
        externalType: "DEAL",
        externalId: "hubspot-deal-huadong",
        mappedObjectType: "Opportunity",
        mappedObjectId: northBridge.id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        type: NotificationType.REMINDER,
        title: "华东智造会后 24 小时窗口中",
        body: "现在最值得看的是 ROI 材料、付款节奏阻塞，以及为什么要先复核这封外发邮件。",
        url: "/dashboard",
      },
      {
        workspaceId: workspace.id,
        userId: userMap["saleslead@demo.com"].id,
        type: NotificationType.REMINDER,
        title: "HubSpot 导入已完成",
        body: "客户、公司、机会和记录已写回判断建议与今日重点。",
        url: "/imports/crm",
      },
    ],
  });

  await generateRecommendationsForObject({
    workspaceId: workspace.id,
    actorName: userMap["saleslead@demo.com"].name,
    actorUserId: userMap["saleslead@demo.com"].id,
    actorType: ActorType.SYSTEM,
    sourcePage: "/dashboard",
    objectType: ObjectType.OPPORTUNITY,
    objectId: northBridge.id,
  });
  await generateRecommendationsForObject({
    workspaceId: workspace.id,
    actorName: userMap["saleslead@demo.com"].name,
    actorUserId: userMap["saleslead@demo.com"].id,
    actorType: ActorType.SYSTEM,
    sourcePage: `/contacts/${contactMap["赵敏"].id}`,
    objectType: ObjectType.CONTACT,
    objectId: contactMap["赵敏"].id,
  });
  await generateRecommendationsForObject({
    workspaceId: workspace.id,
    actorName: userMap["saleslead@demo.com"].name,
    actorUserId: userMap["saleslead@demo.com"].id,
    actorType: ActorType.SYSTEM,
    sourcePage: `/meetings/${meetingMap["华东智造采购推进同步会"].id}`,
    objectType: ObjectType.MEETING,
    objectId: meetingMap["华东智造采购推进同步会"].id,
  });

  await prisma.weeklyReport.create({
    data: {
      workspaceId: workspace.id,
      weekStart: startOfDay(subDays(today, 6)),
      weekEnd: addDays(startOfDay(subDays(today, 6)), 6),
      summaryText: "本周销售转化模式里最值得推进的是华东智造，星河连锁进入恢复窗口，安域云科则被内部协同拖慢。HubSpot 导入已经让首页、风险卡点和建议依据都长出了真实内容。",
      opportunitiesAdvancedCount: 5,
      overdueFollowupsCount: 1,
      aiSuggestionsCount: 6,
      approvalsApprovedCount: 0,
      openHighRiskCount: 3,
      payload: json({
        managementPrompt: "最适合用来讲：Helm 不替换 HubSpot，而是补会后推进、审批和掉单风险判断。",
        governanceMetrics: {
          pendingApprovals: 2,
          overdueCommitments: 1,
          approvalRequiredExternalActions: 2,
        },
        integrationMetrics: {
          crmSource: "HubSpot",
          importedCompanies: 3,
          importedDeals: 3,
          needsReviewMatches: 1,
        },
      }),
    },
  });

  await refreshEvolutionState({
    workspaceId: workspace.id,
    actorId: userMap["saleslead@demo.com"].id,
    actorType: ActorType.SYSTEM,
    sourcePage: "/seed",
    trigger: "sales_demo_bootstrap",
  });

  await seedSettlementOperationsProofPack({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    workspaceLabel: workspace.name,
    startedAt: subDays(now, 9),
  });
}

async function seedRecruiterWorkspaceDemo({ userMap }: { userMap: DemoUserMap }) {
  const workspace = await prisma.workspace.create({
    data: {
      name: "猎头顾问交付工作台 Demo",
      slug: "helm-recruiter-demo",
      description: "面向猎头顾问和招聘交付团队的专属 Demo 工作区",
      profileType: "猎头顾问",
      connectedSources: json([
        { name: "Salesforce", status: "connected" },
        { name: "Calendar", status: "connected" },
        { name: "上传历史纪要", status: "connected" },
      ]),
      focusAreas: json(["职位推进", "候选人体验", "面试安排", "交付节奏"]),
      defaultStrategies: json([
        "候选人-facing 动作默认审批",
        "内部 shortlist 纪要自动执行",
        "会后 24 小时动作优先进入首页",
      ]),
      defaultLLMProvider: "qwen",
      defaultLLMModel: process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      extractionModel: process.env.LLM_EXTRACTION_MODEL || process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      briefingModel: process.env.LLM_BRIEFING_MODEL || process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      reasoningModel: process.env.LLM_REASONING_MODEL || process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      llmBudgetTier: "pilot",
      llmEnabled: process.env.LLM_ENABLED !== "false",
      defaultLocale: "zh-CN",
      pilotMode: true,
      featureFlagsJson: json(defaultWorkspaceFeatureFlags),
      dataRetentionDays: 90,
      captureConsentRequired: true,
      configuration: json({
        demoMode: "recruiter",
        workspaceLabel: "猎头顾问交付工作台",
        operatingModel: "职位推进、候选人体验与面试控制前台",
      }),
    },
  });
  await seedWorkspaceCommercialFoundation(workspace.id, subDays(now, 6), workspace.defaultLocale ?? "zh-CN");

  await prisma.membership.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: userMap["recruiter@demo.com"].id,
        role: WorkspaceRole.REVIEWER,
        title: "招聘顾问",
        persona: "猎头顾问",
      },
      {
        workspaceId: workspace.id,
        userId: userMap["ops@demo.com"].id,
        role: WorkspaceRole.OPERATOR,
        title: "交付协调",
        persona: "顾问 / 服务商",
      },
    ],
  });

  const company = await prisma.company.create({
    data: {
      workspaceId: workspace.id,
      name: "Helio Health",
      industry: "数字健康",
      website: "https://helio-health.demo",
      description: "正在招 VP Marketing，需要同时兼顾品牌与增长。",
      maturityScore: 73,
      cooperationMaturity: "职位推进中",
      recommendedPath: "先稳住 shortlist，再控制候选人体验与面试速度。",
      tags: json(["招聘模式", "Salesforce 主线"]),
      lastInteractionAt: subDays(now, 1),
    },
  });

  const contacts = await Promise.all([
    prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        companyId: company.id,
        ownerId: userMap["recruiter@demo.com"].id,
        name: "Mila Tan",
        title: "Talent Director",
        email: "mila@helio.demo",
        tags: json(["职位 owner"]),
        notes: "希望本周锁定终面时间，特别在意候选人体验。",
        relationshipStage: "active",
        relationshipTemperature: 84,
        relationshipWarmth: RelationshipWarmth.HOT,
        lastInteractionAt: subDays(now, 1),
      },
    }),
    prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        companyId: company.id,
        ownerId: userMap["recruiter@demo.com"].id,
        name: "Nora Xu",
        title: "CPO",
        email: "nora@helio.demo",
        tags: json(["终面 panel"]),
        notes: "希望提前看到候选人摘要和 panel briefing。",
        relationshipStage: "warming",
        relationshipTemperature: 68,
        relationshipWarmth: RelationshipWarmth.WARM,
        lastInteractionAt: subDays(now, 2),
      },
    }),
    prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        ownerId: userMap["recruiter@demo.com"].id,
        name: "Maya Patel",
        title: "候选人",
        email: "maya@candidate.demo",
        tags: json(["finalist"]),
        notes: "对终面节奏和 package 透明度都很敏感。",
        relationshipStage: "active",
        relationshipTemperature: 80,
        relationshipWarmth: RelationshipWarmth.HOT,
        lastInteractionAt: subDays(now, 1),
      },
    }),
    prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        ownerId: userMap["recruiter@demo.com"].id,
        name: "Julian Chen",
        title: "候选人",
        email: "julian@candidate.demo",
        tags: json(["backup", "risk"]),
        notes: "希望更早确认薪资带宽，否则容易流失。",
        relationshipStage: "warming",
        relationshipTemperature: 58,
        relationshipWarmth: RelationshipWarmth.WARM,
        lastInteractionAt: subDays(now, 4),
      },
    }),
  ]);
  const contactMap = Object.fromEntries(contacts.map((contact) => [contact.name, contact]));

  const role = await prisma.opportunity.create({
    data: {
      workspaceId: workspace.id,
      companyId: company.id,
      ownerId: userMap["recruiter@demo.com"].id,
      title: "Helio VP Marketing Search",
      description: "核心职位，需要在本周内完成 shortlist 推进与终面安排。",
      type: OpportunityType.RECRUITING,
      stage: OpportunityStage.ADVANCING,
      riskLevel: RiskLevel.MEDIUM,
      nextAction: "锁定 Maya 的终面时间，并向 Nora 发送 panel briefing。",
      nextStepSummary: "先稳住 finalist，再控制候选人体验。",
      dueDate: todayAt(17, 0),
      lastProgressAt: subDays(now, 1),
      priorityScore: 91,
      contacts: { connect: [{ id: contactMap["Mila Tan"].id }, { id: contactMap["Nora Xu"].id }] },
    },
  });
  const mayaOpp = await prisma.opportunity.create({
    data: {
      workspaceId: workspace.id,
      companyId: company.id,
      ownerId: userMap["recruiter@demo.com"].id,
      title: "Maya Patel 终面推进",
      description: "目前最有希望的候选人，需要尽快锁定终面与说明材料。",
      type: OpportunityType.RECRUITING,
      stage: OpportunityStage.ADVANCING,
      riskLevel: RiskLevel.MEDIUM,
      nextAction: "安排 Maya 终面并提前发送 panel briefing。",
      nextStepSummary: "锁时间、稳体验、控制落地速度。",
      dueDate: addDays(now, 1),
      lastProgressAt: subDays(now, 2),
      priorityScore: 89,
      contacts: { connect: [{ id: contactMap["Maya Patel"].id }, { id: contactMap["Mila Tan"].id }, { id: contactMap["Nora Xu"].id }] },
    },
  });
  const julianOpp = await prisma.opportunity.create({
    data: {
      workspaceId: workspace.id,
      companyId: company.id,
      ownerId: userMap["recruiter@demo.com"].id,
      title: "Julian Chen 候选人修复",
      description: "Backup 候选人仍有机会，但流程透明度不够。",
      type: OpportunityType.RECRUITING,
      stage: OpportunityStage.CONTACTED,
      riskLevel: RiskLevel.HIGH,
      nextAction: "明确薪资带宽和流程预期，再决定是否继续推进。",
      nextStepSummary: "先修复流程透明度，再谈下一轮。",
      dueDate: todayAt(16, 0),
      lastProgressAt: subDays(now, 6),
      priorityScore: 78,
      contacts: { connect: [{ id: contactMap["Julian Chen"].id }, { id: contactMap["Mila Tan"].id }] },
    },
  });

  const meetings = await Promise.all([
    prisma.meeting.create({
      data: {
        workspaceId: workspace.id,
        companyId: company.id,
        opportunityId: role.id,
        ownerId: userMap["recruiter@demo.com"].id,
        title: "Helio shortlist 评估会",
        agenda: "确认 finalist、终面 panel 和本周时间窗",
        location: "Zoom",
        status: MeetingStatus.SCHEDULED,
        startsAt: todayAt(14, 0),
        endsAt: todayAt(14, 45),
        contacts: { connect: [{ id: contactMap["Mila Tan"].id }, { id: contactMap["Nora Xu"].id }, { id: contactMap["Maya Patel"].id }] },
      },
    }),
    prisma.meeting.create({
      data: {
        workspaceId: workspace.id,
        companyId: company.id,
        opportunityId: mayaOpp.id,
        ownerId: userMap["recruiter@demo.com"].id,
        title: "Maya Patel 终面复盘",
        agenda: "确认 Maya 的终面安排与 panel briefing 重点",
        location: "Meet",
        status: MeetingStatus.COMPLETED,
        startsAt: subDays(todayAt(17, 0), 1),
        endsAt: subDays(todayAt(17, 35), 1),
        contacts: { connect: [{ id: contactMap["Maya Patel"].id }, { id: contactMap["Mila Tan"].id }] },
      },
    }),
    prisma.meeting.create({
      data: {
        workspaceId: workspace.id,
        companyId: company.id,
        opportunityId: julianOpp.id,
        ownerId: userMap["recruiter@demo.com"].id,
        title: "Julian 候选人修复校准会",
        agenda: "明确 Julian 的薪资预期和流程透明度问题",
        location: "Zoom",
        status: MeetingStatus.SCHEDULED,
        startsAt: todayAt(16, 30),
        endsAt: todayAt(17, 0),
        contacts: { connect: [{ id: contactMap["Julian Chen"].id }, { id: contactMap["Mila Tan"].id }] },
      },
    }),
  ]);
  const meetingMap = Object.fromEntries(meetings.map((meeting) => [meeting.title, meeting]));

  for (const note of [
    {
      meetingTitle: "Helio shortlist 评估会",
      attendeesSummary: "Mila 关注本周推进节奏，Nora 需要提前看到 panel briefing。",
      relationshipSummary: "客户紧迫度高，但不希望候选人体验变差。",
      previousConclusion: "优先稳住 Maya，再决定 backup 节奏。",
      meetingGoal: "锁 Maya 终面时间，并统一 panel 关注点。",
      recommendedQuestions: "本周必须锁时间还是先发 briefing？\nNora 最担心 Maya 在终面里哪一项能力？",
      riskAlerts: "如果今天不锁时间，Maya 容易转向其他流程。",
      liveTranscript: "14:08 Mila: 我们最好今天就把 Maya 的终面时间定住。\n14:18 Nora: 我希望先看到一版 panel briefing。\n14:32 你方: 可以先生成终面安排动作并送审。",
      summary: "最关键的动作是今天就把 Maya 的终面安排送审并准备 briefing。",
      keyDecisions: "Maya 仍是首位 finalist。\nNora 需要 panel briefing。",
      confirmations: "生成 Maya 终面动作。\n准备 Nora 的 briefing。",
    },
    {
      meetingTitle: "Maya Patel 终面复盘",
      attendeesSummary: "Maya 对节奏稳定性敏感，但愿意继续推进。",
      relationshipSummary: "候选人兴趣仍在，但不喜欢反复改时间。",
      previousConclusion: "如果终面节奏足够稳定，Maya 愿意继续。",
      meetingGoal: "确认候选人体验风险和后续动作。",
      recommendedQuestions: "Maya 最在意的是速度还是透明度？\n在终面前需要补充哪些说明？",
      riskAlerts: "如果流程再变，候选人很容易失去耐心。",
      liveTranscript: "17:10 Maya: 我希望至少提前看到 panel 和时间安排。\n17:22 你方: 会在今天把终面安排和说明整理好。",
      summary: "需要尽快锁终面并把 panel briefing 发给候选人。",
      keyDecisions: "终面需要尽快安排。\n候选人体验要更稳定。",
      confirmations: "安排 Maya 终面。\n发送 panel briefing。",
    },
    {
      meetingTitle: "Julian 候选人修复校准会",
      attendeesSummary: "Julian 仍有兴趣，但流程透明度和薪资带宽不清晰。",
      relationshipSummary: "如果再拖一轮，候选人关系会继续降温。",
      previousConclusion: "Julian 不是 lost，但必须先修复预期。",
      meetingGoal: "明确薪资带宽和下一轮是否还值得推进。",
      recommendedQuestions: "如果把薪资带宽说清，Julian 是否愿意继续？\n当前更大的摩擦是流程还是 package？",
      riskAlerts: "若今天没有清楚答复，Julian 会继续掉温。",
      liveTranscript: "16:35 Julian: 我最想知道的是薪资带宽和流程大概会怎么走。\n16:47 你方: 我们会先把流程透明度和薪资范围说清楚。",
      summary: "这条线现在最重要的不是推进面试，而是先修复信任和透明度。",
      keyDecisions: "先回薪资和流程。\n再决定是否继续推进。",
      confirmations: "起草一条更透明的候选人跟进。",
    },
  ]) {
    await prisma.meetingNote.create({
      data: {
        workspaceId: workspace.id,
        meetingId: meetingMap[note.meetingTitle].id,
        attendeesSummary: note.attendeesSummary,
        relationshipSummary: note.relationshipSummary,
        previousConclusion: note.previousConclusion,
        meetingGoal: note.meetingGoal,
        recommendedQuestions: note.recommendedQuestions,
        riskAlerts: note.riskAlerts,
        liveTranscript: note.liveTranscript,
        summary: note.summary,
        keyDecisions: note.keyDecisions,
        confirmations: note.confirmations,
      },
    });
  }

  const actor = {
    workspaceId: workspace.id,
    actorName: "Recruiting Demo Seeder",
    actorUserId: userMap["recruiter@demo.com"].id,
    actorType: ActorType.SYSTEM,
    sourcePage: "/seed",
    suppressEvolutionRefresh: true,
  } as const;

  for (const meetingTitle of Object.keys(meetingMap)) {
    await hydrateMeetingMemoryFromNote({
      ...actor,
      meetingId: meetingMap[meetingTitle].id,
    });
  }

  await generateMeetingBriefingSnapshot({
    ...actor,
    meetingId: meetingMap["Helio shortlist 评估会"].id,
  });

  await createCommitment({
    ...actor,
    title: "今天把 Maya 终面送审",
    commitmentText: "今天内把 Maya 终面安排动作送审，并把 panel briefing 附上。",
    sourceType: SourceType.MEETING_NOTE,
    sourceId: meetingMap["Helio shortlist 评估会"].id,
    relatedContactId: contactMap["Maya Patel"].id,
    relatedCompanyId: company.id,
    relatedOpportunityId: mayaOpp.id,
    relatedMeetingId: meetingMap["Helio shortlist 评估会"].id,
    ownerUserId: userMap["recruiter@demo.com"].id,
    dueDate: todayAt(18, 0),
    priority: 90,
    confidence: 86,
  });
  const julianCommitment = await createCommitment({
    ...actor,
    title: "给 Julian 回流程与薪资边界",
    commitmentText: "在今天内把 Julian 的薪资带宽和流程透明度说明清楚。",
    sourceType: SourceType.MEETING_NOTE,
    sourceId: meetingMap["Julian 候选人修复校准会"].id,
    relatedContactId: contactMap["Julian Chen"].id,
    relatedCompanyId: company.id,
    relatedOpportunityId: julianOpp.id,
    relatedMeetingId: meetingMap["Julian 候选人修复校准会"].id,
    ownerUserId: userMap["recruiter@demo.com"].id,
    dueDate: subDays(todayAt(17, 30), 1),
    priority: 82,
    confidence: 72,
  });
  await updateCommitmentStatus({
    ...actor,
    commitmentId: julianCommitment.id,
    status: CommitmentStatus.OVERDUE,
    statusNote: "候选人已经等待超过预期，需要先修复透明度。",
  });

  await createBlocker({
    ...actor,
    title: "Helio panel 时间未锁定",
    blockerType: "panel_alignment",
    blockerText: "如果 panel 时间今天锁不下来，Maya 的终面推进会掉速。",
    severity: 78,
    sourceType: SourceType.MEETING_NOTE,
    sourceId: meetingMap["Helio shortlist 评估会"].id,
    relatedContactId: contactMap["Mila Tan"].id,
    relatedCompanyId: company.id,
    relatedOpportunityId: role.id,
    relatedMeetingId: meetingMap["Helio shortlist 评估会"].id,
  });
  await createBlocker({
    ...actor,
    title: "Julian 对薪资透明度不放心",
    blockerType: "salary_band",
    blockerText: "Julian 现在最在意薪资带宽和流程透明度，不先说清楚会继续降温。",
    severity: 84,
    sourceType: SourceType.MEETING_NOTE,
    sourceId: meetingMap["Julian 候选人修复校准会"].id,
    relatedContactId: contactMap["Julian Chen"].id,
    relatedCompanyId: company.id,
    relatedOpportunityId: julianOpp.id,
    relatedMeetingId: meetingMap["Julian 候选人修复校准会"].id,
  });

  await createMemoryFact({
    ...actor,
    objectType: ObjectType.CONTACT,
    objectId: contactMap["Maya Patel"].id,
    factType: MemoryFactType.PREFERENCE,
    title: "Maya 需要稳定的终面节奏",
    content: "Maya 对终面节奏和 panel 信息透明度很敏感，反复改时间会明显影响体验。",
    sourceType: SourceType.MEETING_NOTE,
    sourceId: meetingMap["Maya Patel 终面复盘"].id,
    confidence: 86,
    importance: 88,
    freshnessScore: 84,
  });

  const actionByTitle: Record<string, string> = {};
  for (const action of [
    {
      title: "安排 Maya Patel 终面",
      actionType: ActionType.SCHEDULE_INTERVIEW,
      description: "创建 Maya 的终面会议并附 panel briefing。",
      aiReason: "当前最关键的是锁住 Maya 的节奏，避免候选人流失。",
      draftContent: "建议下周三 15:00 安排终面，panel 为 Nora + Mila，附件含候选人摘要。",
      riskLevel: RiskLevel.HIGH,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.PENDING_APPROVAL,
      suggestedExecutionAt: todayAt(15, 0),
      dueDate: todayAt(18, 0),
      opportunityId: mayaOpp.id,
      meetingId: meetingMap["Helio shortlist 评估会"].id,
      contactId: contactMap["Maya Patel"].id,
      ownerId: userMap["recruiter@demo.com"].id,
    },
    {
      title: "发送 Helio shortlist 内部纪要",
      actionType: ActionType.DRAFT_INTERNAL_NOTE,
      description: "把 shortlist 决策和 panel 关注点整理为内部纪要。",
      aiReason: "内部纪要默认自动执行，能减少交付漏项。",
      draftContent: "本轮 shortlist 结论：Maya 为首位 finalist，今天优先锁终面和 briefing；Julian 先修复薪资与流程透明度。",
      riskLevel: RiskLevel.LOW,
      executionMode: ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
      requiresApproval: false,
      status: ActionStatus.EXECUTED,
      suggestedExecutionAt: todayAt(14, 50),
      dueDate: todayAt(15, 30),
      opportunityId: role.id,
      meetingId: meetingMap["Helio shortlist 评估会"].id,
      contactId: contactMap["Mila Tan"].id,
      ownerId: userMap["recruiter@demo.com"].id,
    },
    {
      title: "起草 Julian 候选人修复跟进",
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      description: "起草一条更透明的流程与薪资说明。",
      aiReason: "Julian 现在最需要的不是继续推进，而是先修复信任和流程透明度。",
      draftContent: "Julian，你好，先和你说明目前 Helio 这边的薪资带宽、流程节奏和下一轮决策方式……",
      riskLevel: RiskLevel.HIGH,
      executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
      requiresApproval: true,
      status: ActionStatus.PENDING_APPROVAL,
      suggestedExecutionAt: todayAt(17, 10),
      dueDate: todayAt(18, 30),
      opportunityId: julianOpp.id,
      meetingId: meetingMap["Julian 候选人修复校准会"].id,
      contactId: contactMap["Julian Chen"].id,
      ownerId: userMap["recruiter@demo.com"].id,
    },
  ]) {
    const created = await prisma.actionItem.create({
      data: {
        workspaceId: workspace.id,
        opportunityId: action.opportunityId,
        meetingId: action.meetingId,
        contactId: action.contactId,
        ownerId: action.ownerId,
        actionType: action.actionType,
        title: action.title,
        description: action.description,
        aiReason: action.aiReason,
        draftContent: action.draftContent,
        riskLevel: action.riskLevel,
        executionMode: action.executionMode,
        requiresApproval: action.requiresApproval,
        status: action.status,
        suggestedExecutionAt: action.suggestedExecutionAt,
        dueDate: action.dueDate,
      },
    });
    actionByTitle[action.title] = created.id;
  }

  for (const title of ["安排 Maya Patel 终面", "起草 Julian 候选人修复跟进"]) {
    await prisma.approvalTask.create({
      data: {
        workspaceId: workspace.id,
        actionItemId: actionByTitle[title],
        approverId: userMap["recruiter@demo.com"].id,
        status: ApprovalStatus.PENDING,
        channel: title.includes("Maya") ? "招聘类" : "外发动作",
        isHighRisk: true,
        autoExecute: false,
        contextSnapshot: title,
        reasoning: title.includes("Maya") ? "锁住 finalist 的节奏比继续等待更重要。" : "当前应该先修复 Julian 的流程透明度，而不是盲目推进下一轮。",
        editableContent: title,
        resultPreview: "批准后会写入候选人时间线、机会推进和 recommendation 依据。",
      },
    });
  }

  for (const thread of [
    {
      subject: "Helio shortlist timing",
      counterpart: "Mila Tan",
      summary: "客户希望今天锁定 Maya 的终面时间。",
      contactId: contactMap["Mila Tan"].id,
      opportunityId: role.id,
      status: ThreadStatus.WAITING_US,
      message: "如果今天能把 Maya 的终面时间 hold 住，我们就能继续往下推进。",
      senderEmail: "mila@helio.demo",
    },
    {
      subject: "Maya final interview expectations",
      counterpart: "Maya Patel",
      summary: "候选人想更早看到 panel briefing。",
      contactId: contactMap["Maya Patel"].id,
      opportunityId: mayaOpp.id,
      status: ThreadStatus.WAITING_US,
      message: "如果 panel 和时间安排能提前说清楚，我这边比较好协调现在的工作。",
      senderEmail: "maya@candidate.demo",
    },
    {
      subject: "Julian process transparency",
      counterpart: "Julian Chen",
      summary: "候选人需要更明确的薪资带宽和流程边界。",
      contactId: contactMap["Julian Chen"].id,
      opportunityId: julianOpp.id,
      status: ThreadStatus.WAITING_US,
      message: "我主要想确认薪资带宽和流程大概会怎么走，再决定要不要继续。",
      senderEmail: "julian@candidate.demo",
    },
  ]) {
    const createdThread = await prisma.emailThread.create({
      data: {
        workspaceId: workspace.id,
        contactId: thread.contactId,
        companyId: company.id,
        opportunityId: thread.opportunityId,
        subject: thread.subject,
        counterpart: thread.counterpart,
        summary: thread.summary,
        participants: json([thread.counterpart]),
        source: RecordSource.IMPORT,
        status: thread.status,
        waitingOn: "我方",
        shouldReply: true,
      },
    });
    await prisma.emailMessage.create({
      data: {
        threadId: createdThread.id,
        sender: thread.counterpart,
        senderEmail: thread.senderEmail,
        body: thread.message,
        isInbound: true,
        sentAt: subDays(now, 1),
      },
    });
  }

  await seedDefaultPolicies(workspace.id);

  const salesforceSource = await prisma.importSource.create({
    data: {
      workspaceId: workspace.id,
      userId: userMap["recruiter@demo.com"].id,
      sourceType: ImportSourceType.SALESFORCE,
      sourceName: "Salesforce",
      status: ImportSourceStatus.CONNECTED,
      authMode: "MOCK",
      externalAccountId: "salesforce-recruit-demo",
      externalAccountLabel: "Helio Recruiting Salesforce Org",
      lastSyncedAt: addHours(subDays(today, 1), 11),
      configJson: json({ mock: true, objects: ["accounts", "contacts", "opportunities", "events", "tasks"] }),
    },
  });

  const salesforceJob = await prisma.importJob.create({
    data: {
      workspaceId: workspace.id,
      sourceId: salesforceSource.id,
      createdByUserId: userMap["recruiter@demo.com"].id,
      jobType: ImportJobType.INITIAL_IMPORT,
      status: ImportJobStatus.COMPLETED,
      totalRecords: 8,
      successRecords: 8,
      failedRecords: 0,
      warningRecords: 0,
      startedAt: addHours(subDays(today, 1), 11),
      finishedAt: addMinutes(addHours(subDays(today, 1), 11), 5),
      summaryJson: json({
        importedCounts: { accounts: 1, contacts: 4, opportunities: 3, events: 2, tasks: 1 },
        warmup: { refreshedObjects: 5, generatedRecommendations: 7, detectedCommitments: 3, detectedBlockers: 2 },
      }),
    },
  });

  await prisma.company.update({
    where: { id: company.id },
    data: {
      externalSource: ImportSourceType.SALESFORCE,
      externalObjectType: "ACCOUNT",
      externalObjectId: "sf-account-helio",
      externalOwnerId: "sf-owner-recruit-demo",
      externalSyncedAt: subDays(now, 1),
    },
  });
  await prisma.contact.update({
    where: { id: contactMap["Mila Tan"].id },
    data: {
      externalSource: ImportSourceType.SALESFORCE,
      externalObjectType: "CONTACT",
      externalObjectId: "sf-contact-mila",
      externalOwnerId: "sf-owner-recruit-demo",
      externalSyncedAt: subDays(now, 1),
    },
  });
  await prisma.opportunity.update({
    where: { id: role.id },
    data: {
      externalSource: ImportSourceType.SALESFORCE,
      externalObjectType: "OPPORTUNITY",
      externalObjectId: "sf-opp-helio-vp-marketing",
      externalOwnerId: "sf-owner-recruit-demo",
      externalSyncedAt: subDays(now, 1),
    },
  });
  await prisma.meeting.update({
    where: { id: meetingMap["Helio shortlist 评估会"].id },
    data: {
      externalSource: ImportSourceType.SALESFORCE,
      externalObjectType: "EVENT",
      externalObjectId: "sf-event-helio-shortlist",
      externalOwnerId: "sf-owner-recruit-demo",
      externalSyncedAt: subDays(now, 1),
    },
  });

  await prisma.importItem.createMany({
    data: [
      {
        workspaceId: workspace.id,
        importJobId: salesforceJob.id,
        externalType: "ACCOUNT",
        externalId: "sf-account-helio",
        mappedObjectType: "Company",
        mappedObjectId: company.id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: salesforceJob.id,
        externalType: "CONTACT",
        externalId: "sf-contact-mila",
        mappedObjectType: "Contact",
        mappedObjectId: contactMap["Mila Tan"].id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: salesforceJob.id,
        externalType: "OPPORTUNITY",
        externalId: "sf-opp-helio-vp-marketing",
        mappedObjectType: "Opportunity",
        mappedObjectId: role.id,
        matchStatus: ImportMatchStatus.UPDATED,
      },
      {
        workspaceId: workspace.id,
        importJobId: salesforceJob.id,
        externalType: "EVENT",
        externalId: "sf-event-helio-shortlist",
        mappedObjectType: "Meeting",
        mappedObjectId: meetingMap["Helio shortlist 评估会"].id,
        matchStatus: ImportMatchStatus.LINKED,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: userMap["recruiter@demo.com"].id,
        type: NotificationType.REMINDER,
        title: "Maya 终面安排待你确认",
        body: "现在最适合讲的是候选人体验、面试节奏和 approval 边界。",
        url: "/approvals",
      },
      {
        workspaceId: workspace.id,
        userId: userMap["recruiter@demo.com"].id,
        type: NotificationType.REMINDER,
        title: "Salesforce 导入已完成",
        body: "Accounts、Contacts、Opportunities、Events 和 Tasks 已接进经营判断层。",
        url: "/imports/crm",
      },
    ],
  });

  await generateRecommendationsForObject({
    workspaceId: workspace.id,
    actorName: userMap["recruiter@demo.com"].name,
    actorUserId: userMap["recruiter@demo.com"].id,
    actorType: ActorType.SYSTEM,
    sourcePage: "/dashboard",
    objectType: ObjectType.OPPORTUNITY,
    objectId: role.id,
  });
  await generateRecommendationsForObject({
    workspaceId: workspace.id,
    actorName: userMap["recruiter@demo.com"].name,
    actorUserId: userMap["recruiter@demo.com"].id,
    actorType: ActorType.SYSTEM,
    sourcePage: `/contacts/${contactMap["Maya Patel"].id}`,
    objectType: ObjectType.CONTACT,
    objectId: contactMap["Maya Patel"].id,
  });
  await generateRecommendationsForObject({
    workspaceId: workspace.id,
    actorName: userMap["recruiter@demo.com"].name,
    actorUserId: userMap["recruiter@demo.com"].id,
    actorType: ActorType.SYSTEM,
    sourcePage: `/meetings/${meetingMap["Helio shortlist 评估会"].id}`,
    objectType: ObjectType.MEETING,
    objectId: meetingMap["Helio shortlist 评估会"].id,
  });

  await prisma.weeklyReport.create({
    data: {
      workspaceId: workspace.id,
      weekStart: startOfDay(subDays(today, 6)),
      weekEnd: addDays(startOfDay(subDays(today, 6)), 6),
      summaryText: "这套猎头顾问模式重点展示 shortlist 推进、候选人体验、面试安排审批和 Salesforce 活动导入。当前最值得推进的是 Maya 终面，其次是 Julian 的透明度修复。",
      opportunitiesAdvancedCount: 4,
      overdueFollowupsCount: 1,
      aiSuggestionsCount: 5,
      approvalsApprovedCount: 0,
      openHighRiskCount: 2,
      payload: json({
        managementPrompt: "最适合用来讲：Helm 不替代 ATS 或 Salesforce，而是补最后一公里的交付节奏和审批控制。",
        governanceMetrics: {
          pendingApprovals: 2,
          overdueCommitments: 1,
          interviewApprovalCoverage: 1,
        },
        integrationMetrics: {
          crmSource: "Salesforce",
          importedAccounts: 1,
          importedOpportunities: 3,
          importedEvents: 1,
        },
      }),
    },
  });

  await refreshEvolutionState({
    workspaceId: workspace.id,
    actorId: userMap["recruiter@demo.com"].id,
    actorType: ActorType.SYSTEM,
    sourcePage: "/seed",
    trigger: "recruiting_demo_bootstrap",
  });

  await seedSettlementOperationsProofPack({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    workspaceLabel: workspace.name,
    startedAt: subDays(now, 6),
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
