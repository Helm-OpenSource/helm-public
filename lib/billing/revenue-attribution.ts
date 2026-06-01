import {
  ActorType,
  CustomEngagementStatus,
  PublisherProfileStatus,
  RevenueBeneficiaryType,
  RevenueLedgerStatus,
  RevenueRuleCadence,
  RevenueRuleStatus,
  RevenueRuleValueType,
  RevenueSourceType,
  SalesReferralStatus,
} from "@prisma/client";
import { BILLING_CURRENCY, ensureWorkspaceCommercialFoundation } from "@/lib/billing/foundation";
import { db } from "@/lib/db";
import { assertWorkspaceReservedCommercialRegistryServiceAccess } from "@/lib/auth/service-governance";

export const HELM_PLATFORM_BENEFICIARY_LABEL = "Helm platform";
export const HELM_FIRST_PARTY_PUBLISHER_KEY = "helm_first_party";
export const HELM_FIRST_PARTY_PUBLISHER_LABEL = "Helm first-party worker publisher";
export const REVENUE_PERCENT_BASE = 10_000;

export type RevenueRuleMathLike = {
  valueType: RevenueRuleValueType;
  percentBps: number | null;
  fixedAmountCents: number | null;
};

export type RevenueRuleViewLike = {
  id: string;
  ruleKey: string;
  name: string;
  sourceType: RevenueSourceType;
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryLabel: string;
  cadence: RevenueRuleCadence;
  valueType: RevenueRuleValueType;
  percentBps: number | null;
  fixedAmountCents: number | null;
  currency: string;
  reverseOnCancel: boolean;
  workerKey: string | null;
  notes: string | null;
  status: RevenueRuleStatus;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  workerPublisherProfileId: string | null;
  salesReferralId: string | null;
  customEngagementId: string | null;
};

type RevenueAttributionGovernanceInput = {
  userId?: string | null;
  actorType?: ActorType | null;
  english?: boolean;
};

type DefaultRevenueRuleSeed = Omit<
  RevenueRuleViewLike,
  "id" | "name" | "status" | "effectiveFrom" | "effectiveTo"
> & {
  name: string;
};

function getDefaultRevenueRuleSeeds(workerPublisherProfileId: string): DefaultRevenueRuleSeed[] {
  return [
    {
      ruleKey: "platform_org_base_recurring_percent",
      name: "Platform org base recurring split",
      sourceType: RevenueSourceType.ORGANIZATION_BASE_FEE,
      beneficiaryType: RevenueBeneficiaryType.PLATFORM,
      beneficiaryLabel: HELM_PLATFORM_BENEFICIARY_LABEL,
      cadence: RevenueRuleCadence.RECURRING,
      valueType: RevenueRuleValueType.FIXED_PERCENT,
      percentBps: REVENUE_PERCENT_BASE,
      fixedAmountCents: null,
      currency: BILLING_CURRENCY,
      reverseOnCancel: true,
      workerKey: null,
      notes: "Default recurring attribution for the organization base fee.",
      workerPublisherProfileId: null,
      salesReferralId: null,
      customEngagementId: null,
    },
    {
      ruleKey: "platform_active_seat_recurring_percent",
      name: "Platform active seat recurring split",
      sourceType: RevenueSourceType.ACTIVE_SEAT,
      beneficiaryType: RevenueBeneficiaryType.PLATFORM,
      beneficiaryLabel: HELM_PLATFORM_BENEFICIARY_LABEL,
      cadence: RevenueRuleCadence.RECURRING,
      valueType: RevenueRuleValueType.FIXED_PERCENT,
      percentBps: REVENUE_PERCENT_BASE,
      fixedAmountCents: null,
      currency: BILLING_CURRENCY,
      reverseOnCancel: true,
      workerKey: null,
      notes: "Default recurring attribution for additional active seats.",
      workerPublisherProfileId: null,
      salesReferralId: null,
      customEngagementId: null,
    },
    {
      ruleKey: "first_party_add_on_worker_monthly_percent",
      name: "First-party add-on worker monthly split",
      sourceType: RevenueSourceType.ADD_ON_WORKER,
      beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
      beneficiaryLabel: HELM_FIRST_PARTY_PUBLISHER_LABEL,
      cadence: RevenueRuleCadence.RECURRING,
      valueType: RevenueRuleValueType.FIXED_PERCENT,
      percentBps: REVENUE_PERCENT_BASE,
      fixedAmountCents: null,
      currency: BILLING_CURRENCY,
      reverseOnCancel: true,
      workerKey: "deal_desk_worker",
      notes: "Default recurring attribution for future monthly worker add-ons.",
      workerPublisherProfileId,
      salesReferralId: null,
      customEngagementId: null,
    },
    {
      ruleKey: "first_party_add_on_worker_per_use_percent",
      name: "First-party add-on worker per-use split",
      sourceType: RevenueSourceType.ADD_ON_WORKER,
      beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
      beneficiaryLabel: HELM_FIRST_PARTY_PUBLISHER_LABEL,
      cadence: RevenueRuleCadence.ONE_TIME,
      valueType: RevenueRuleValueType.FIXED_PERCENT,
      percentBps: REVENUE_PERCENT_BASE,
      fixedAmountCents: null,
      currency: BILLING_CURRENCY,
      reverseOnCancel: true,
      workerKey: "specialist_review_worker",
      notes: "Default one-time attribution for future per-use worker add-ons.",
      workerPublisherProfileId,
      salesReferralId: null,
      customEngagementId: null,
    },
    {
      ruleKey: "platform_custom_implementation_one_time_percent",
      name: "Platform custom implementation split",
      sourceType: RevenueSourceType.CUSTOM_IMPLEMENTATION,
      beneficiaryType: RevenueBeneficiaryType.PLATFORM,
      beneficiaryLabel: HELM_PLATFORM_BENEFICIARY_LABEL,
      cadence: RevenueRuleCadence.ONE_TIME,
      valueType: RevenueRuleValueType.FIXED_PERCENT,
      percentBps: REVENUE_PERCENT_BASE,
      fixedAmountCents: null,
      currency: BILLING_CURRENCY,
      reverseOnCancel: true,
      workerKey: null,
      notes: "Default one-time attribution for custom implementation revenue.",
      workerPublisherProfileId: null,
      salesReferralId: null,
      customEngagementId: null,
    },
    {
      ruleKey: "platform_custom_maintenance_recurring_percent",
      name: "Platform custom maintenance split",
      sourceType: RevenueSourceType.CUSTOM_MAINTENANCE,
      beneficiaryType: RevenueBeneficiaryType.PLATFORM,
      beneficiaryLabel: HELM_PLATFORM_BENEFICIARY_LABEL,
      cadence: RevenueRuleCadence.RECURRING,
      valueType: RevenueRuleValueType.FIXED_PERCENT,
      percentBps: REVENUE_PERCENT_BASE,
      fixedAmountCents: null,
      currency: BILLING_CURRENCY,
      reverseOnCancel: true,
      workerKey: null,
      notes: "Default recurring attribution for custom maintenance revenue.",
      workerPublisherProfileId: null,
      salesReferralId: null,
      customEngagementId: null,
    },
  ];
}

export function validateRevenueRuleMath(rule: RevenueRuleMathLike) {
  if (rule.valueType === RevenueRuleValueType.FIXED_PERCENT) {
    if (rule.percentBps === null || Number.isNaN(rule.percentBps)) {
      throw new Error("Revenue rule percent is required for FIXED_PERCENT");
    }

    if (rule.percentBps < 0 || rule.percentBps > REVENUE_PERCENT_BASE) {
      throw new Error("Revenue rule percent must stay between 0 and 10000 bps");
    }

    return;
  }

  if (rule.fixedAmountCents === null || Number.isNaN(rule.fixedAmountCents)) {
    throw new Error("Revenue rule fixed amount is required for FIXED_AMOUNT");
  }

  if (rule.fixedAmountCents < 0) {
    throw new Error("Revenue rule fixed amount must stay non-negative");
  }
}

export function resolveAttributedAmountCents(input: {
  grossAmountCents: number;
  rule: RevenueRuleMathLike;
}) {
  validateRevenueRuleMath(input.rule);

  if (input.grossAmountCents < 0) {
    throw new Error("Gross revenue cannot be negative");
  }

  if (input.rule.valueType === RevenueRuleValueType.FIXED_PERCENT) {
    return Math.round((input.grossAmountCents * (input.rule.percentBps ?? 0)) / REVENUE_PERCENT_BASE);
  }

  return Math.min(input.grossAmountCents, input.rule.fixedAmountCents ?? 0);
}

async function assertWorkspaceRevenueAttributionFoundationAccess(
  workspaceId: string,
  governance?: RevenueAttributionGovernanceInput,
) {
  await assertWorkspaceReservedCommercialRegistryServiceAccess({
    workspaceId,
    userId: governance?.userId,
    actorType: governance?.actorType,
    english: governance?.english ?? false,
  });
}

export async function ensureWorkspaceRevenueAttributionFoundation(
  workspaceId: string,
  now = new Date(),
  governance?: RevenueAttributionGovernanceInput,
) {
  await assertWorkspaceRevenueAttributionFoundationAccess(workspaceId, governance);
  await ensureWorkspaceCommercialFoundation(workspaceId, now);

  const workerPublisherProfile = await db.workerPublisherProfile.upsert({
    where: {
      workspaceId_publisherKey: {
        workspaceId,
        publisherKey: HELM_FIRST_PARTY_PUBLISHER_KEY,
      },
    },
    update: {},
    create: {
      workspaceId,
      publisherKey: HELM_FIRST_PARTY_PUBLISHER_KEY,
      displayName: HELM_FIRST_PARTY_PUBLISHER_LABEL,
      status: PublisherProfileStatus.ACTIVE,
      notes: "Internal first-party publisher profile for add-on worker revenue attribution.",
    },
  });

  const defaultRules = getDefaultRevenueRuleSeeds(workerPublisherProfile.id);

  await Promise.all(
    defaultRules.map((rule) =>
      db.revenueRule.upsert({
        where: {
          workspaceId_ruleKey: {
            workspaceId,
            ruleKey: rule.ruleKey,
          },
        },
        update: {},
        create: {
          workspaceId,
          ruleKey: rule.ruleKey,
          name: rule.name,
          sourceType: rule.sourceType,
          beneficiaryType: rule.beneficiaryType,
          beneficiaryLabel: rule.beneficiaryLabel,
          cadence: rule.cadence,
          valueType: rule.valueType,
          percentBps: rule.percentBps,
          fixedAmountCents: rule.fixedAmountCents,
          currency: rule.currency,
          reverseOnCancel: rule.reverseOnCancel,
          workerKey: rule.workerKey,
          notes: rule.notes,
          workerPublisherProfileId: rule.workerPublisherProfileId,
          salesReferralId: rule.salesReferralId,
          customEngagementId: rule.customEngagementId,
          status: RevenueRuleStatus.ACTIVE,
          effectiveFrom: now,
        },
      }),
    ),
  );

  return db.revenueRule.findMany({
    where: { workspaceId },
    orderBy: [{ sourceType: "asc" }, { ruleKey: "asc" }],
  });
}

async function getRevenueRuleForRecording(input: {
  workspaceId: string;
  revenueRuleId?: string;
  ruleKey?: string;
}) {
  if (!input.revenueRuleId && !input.ruleKey) {
    throw new Error("Revenue attribution requires revenueRuleId or ruleKey");
  }

  return db.revenueRule.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.revenueRuleId,
      ruleKey: input.ruleKey,
    },
    include: {
      workerPublisherProfile: true,
      salesReferral: true,
      customEngagement: true,
    },
  });
}

export async function recordRevenueAttribution(input: {
  workspaceId: string;
  revenueRuleId?: string;
  ruleKey?: string;
  sourceLabel: string;
  sourceReference?: string | null;
  grossAmountCents: number;
  currency?: string;
  recognizedAt?: Date;
  metadata?: Record<string, unknown> | null;
  payableAfter?: Date | null;
  governance?: RevenueAttributionGovernanceInput;
}) {
  await ensureWorkspaceRevenueAttributionFoundation(
    input.workspaceId,
    input.recognizedAt ?? new Date(),
    input.governance,
  );
  const rule = await getRevenueRuleForRecording(input);

  if (!rule) {
    throw new Error("Revenue rule not found for this workspace");
  }

  if (rule.status !== RevenueRuleStatus.ACTIVE) {
    throw new Error("Revenue rule is not active");
  }

  const attributedAmountCents = resolveAttributedAmountCents({
    grossAmountCents: input.grossAmountCents,
    rule,
  });

  return db.$transaction(async (tx) => {
    const attribution = await tx.revenueAttributionLedger.create({
      data: {
        workspaceId: input.workspaceId,
        revenueRuleId: rule.id,
        sourceType: rule.sourceType,
        beneficiaryType: rule.beneficiaryType,
        sourceLabel: input.sourceLabel,
        sourceReference: input.sourceReference ?? undefined,
        beneficiaryLabel: rule.beneficiaryLabel,
        grossAmountCents: input.grossAmountCents,
        attributedAmountCents,
        currency: input.currency ?? rule.currency,
        status: RevenueLedgerStatus.PENDING,
        recognizedAt: input.recognizedAt ?? new Date(),
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
        workerPublisherProfileId: rule.workerPublisherProfileId ?? undefined,
        salesReferralId: rule.salesReferralId ?? undefined,
        customEngagementId: rule.customEngagementId ?? undefined,
      },
    });

    const payout = await tx.payoutLedger.create({
      data: {
        workspaceId: input.workspaceId,
        revenueAttributionLedgerId: attribution.id,
        beneficiaryType: rule.beneficiaryType,
        beneficiaryLabel: rule.beneficiaryLabel,
        payableAmountCents: attributedAmountCents,
        currency: input.currency ?? rule.currency,
        status: RevenueLedgerStatus.PENDING,
        payableAfter: input.payableAfter ?? undefined,
        workerPublisherProfileId: rule.workerPublisherProfileId ?? undefined,
        salesReferralId: rule.salesReferralId ?? undefined,
        customEngagementId: rule.customEngagementId ?? undefined,
      },
    });

    return { rule, attribution, payout };
  });
}

export async function reverseRevenueAttributionEntry(input: {
  attributionId: string;
  reason: string;
  reversedAt?: Date;
  governance?: RevenueAttributionGovernanceInput;
}) {
  const attribution = await db.revenueAttributionLedger.findUnique({
    where: { id: input.attributionId },
    include: {
      revenueRule: true,
      payoutEntry: true,
    },
  });

  if (!attribution) {
    throw new Error("Revenue attribution entry not found");
  }

  await assertWorkspaceRevenueAttributionFoundationAccess(attribution.workspaceId, input.governance);

  if (attribution.status === RevenueLedgerStatus.REVERSED) {
    return { attribution, reversal: null };
  }

  if (attribution.revenueRule && !attribution.revenueRule.reverseOnCancel) {
    throw new Error("Revenue rule does not allow reversal on refund or cancel");
  }

  const reversedAt = input.reversedAt ?? new Date();

  return db.$transaction(async (tx) => {
    const updatedAttribution = await tx.revenueAttributionLedger.update({
      where: { id: attribution.id },
      data: {
        status: RevenueLedgerStatus.REVERSED,
        reversalReason: input.reason,
      },
    });

    if (attribution.payoutEntry) {
      await tx.payoutLedger.update({
        where: { revenueAttributionLedgerId: attribution.id },
        data: {
          status: RevenueLedgerStatus.REVERSED,
          reversedAt,
          notes: input.reason,
        },
      });
    }

    const reversal = await tx.revenueAttributionLedger.create({
      data: {
        workspaceId: attribution.workspaceId,
        revenueRuleId: attribution.revenueRuleId ?? undefined,
        sourceType: attribution.sourceType,
        beneficiaryType: attribution.beneficiaryType,
        sourceLabel: `${attribution.sourceLabel} · reversal`,
        sourceReference: attribution.sourceReference ?? undefined,
        beneficiaryLabel: attribution.beneficiaryLabel,
        grossAmountCents: -Math.abs(attribution.grossAmountCents),
        attributedAmountCents: -Math.abs(attribution.attributedAmountCents),
        currency: attribution.currency,
        status: RevenueLedgerStatus.REVERSED,
        recognizedAt: reversedAt,
        reversalOfId: attribution.id,
        reversalReason: input.reason,
        metadata: attribution.metadata,
        workerPublisherProfileId: attribution.workerPublisherProfileId ?? undefined,
        salesReferralId: attribution.salesReferralId ?? undefined,
        customEngagementId: attribution.customEngagementId ?? undefined,
      },
    });

    return { attribution: updatedAttribution, reversal };
  });
}

export async function getWorkspaceRevenueAttributionSnapshot(
  workspaceId: string,
  governance?: RevenueAttributionGovernanceInput,
) {
  await ensureWorkspaceRevenueAttributionFoundation(workspaceId, new Date(), governance);

  const [workerPublisherProfiles, salesReferrals, customEngagements, revenueRules, revenueAttributionEntries, payoutEntries] =
    await Promise.all([
      db.workerPublisherProfile.findMany({
        where: { workspaceId },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      }),
      db.salesReferral.findMany({
        where: { workspaceId, status: { in: [SalesReferralStatus.ACTIVE, SalesReferralStatus.INACTIVE] } },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      }),
      db.customEngagement.findMany({
        where: { workspaceId, status: { in: [CustomEngagementStatus.ACTIVE, CustomEngagementStatus.COMPLETED] } },
        orderBy: [{ engagementType: "asc" }, { createdAt: "asc" }],
      }),
      db.revenueRule.findMany({
        where: { workspaceId },
        include: {
          workerPublisherProfile: true,
          salesReferral: true,
          customEngagement: true,
        },
        orderBy: [{ sourceType: "asc" }, { ruleKey: "asc" }],
      }),
      db.revenueAttributionLedger.findMany({
        where: { workspaceId },
        include: {
          revenueRule: true,
        },
        orderBy: [{ recognizedAt: "desc" }, { createdAt: "desc" }],
        take: 12,
      }),
      db.payoutLedger.findMany({
        where: { workspaceId },
        include: {
          revenueAttributionLedger: {
            include: {
              revenueRule: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 12,
      }),
    ]);

  return {
    workerPublisherProfiles,
    salesReferrals,
    customEngagements,
    revenueRules,
    revenueAttributionEntries,
    payoutEntries,
  };
}
