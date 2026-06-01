import { ActorType, Prisma, WorkspaceClass } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveHelmReservedWorkspace } from "@/lib/workspace-reserved";
import { jsonStringify } from "@/lib/utils";

const backfillWorkspaceSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  defaultLocale: true,
  workspaceClass: true,
  systemKey: true,
} satisfies Prisma.WorkspaceSelect;

type BackfillWorkspace = Prisma.WorkspaceGetPayload<{
  select: typeof backfillWorkspaceSelect;
}>;

type BackfillDbClient = Pick<
  typeof db,
  | "workspace"
  | "workerPublisherProfile"
  | "salesReferral"
  | "customEngagement"
  | "revenueRule"
  | "revenueAttributionLedger"
  | "payoutLedger"
  | "beneficiaryPayoutProfile"
  | "participantPortalAccess"
  | "partnerProgram"
  | "programTermsVersion"
  | "programApplication"
  | "settlementBatch"
  | "settlementBatchLine"
  | "capabilityCatalogEntry"
  | "skillSuggestion"
  | "auditLog"
  | "eventLog"
>;

const RESERVED_WORKSPACE_BACKFILL_AUDIT_ACTOR = "Helm Reserved Workspace Backfill Tool";
const RESERVED_WORKSPACE_BACKFILL_SOURCE_PAGE = "/internal/backfill/reserved-workspace";

export const HELM_RESERVED_WORKSPACE_BACKFILL_MIGRATABLE_MODELS = [
  "workerPublisherProfile",
  "salesReferral",
  "customEngagement",
  "revenueRule",
  "revenueAttributionLedger",
  "payoutLedger",
  "beneficiaryPayoutProfile",
  "participantPortalAccess",
  "partnerProgram",
  "programTermsVersion",
  "programApplication",
  "settlementBatch",
  "settlementBatchLine",
] as const;

export const HELM_RESERVED_WORKSPACE_BACKFILL_REVIEW_ONLY_MODELS = [
  "capabilityCatalogEntry",
  "formalSkillReviewSignal",
] as const;

export type HelmReservedWorkspaceBackfillMigratableModel =
  (typeof HELM_RESERVED_WORKSPACE_BACKFILL_MIGRATABLE_MODELS)[number];

export type HelmReservedWorkspaceBackfillReviewOnlyModel =
  (typeof HELM_RESERVED_WORKSPACE_BACKFILL_REVIEW_ONLY_MODELS)[number];

export type HelmReservedWorkspaceBackfillCounts = Record<
  HelmReservedWorkspaceBackfillMigratableModel,
  number
>;

export type HelmReservedWorkspaceBackfillReviewOnlyCounts = Record<
  HelmReservedWorkspaceBackfillReviewOnlyModel,
  number
>;

export type HelmReservedWorkspaceBackfillConflict = {
  model:
    | "workerPublisherProfile"
    | "salesReferral"
    | "customEngagement"
    | "revenueRule"
    | "beneficiaryPayoutProfile"
    | "participantPortalAccess"
    | "partnerProgram"
    | "settlementBatch";
  keyLabel: string;
  keyValue: string;
  targetRecordId: string;
};

export type HelmReservedWorkspaceBackfillIntegrityIssue = {
  model:
    | "revenueRule"
    | "revenueAttributionLedger"
    | "payoutLedger"
    | "beneficiaryPayoutProfile"
    | "participantPortalAccess"
    | "programTermsVersion"
    | "programApplication"
    | "settlementBatchLine";
  count: number;
  summary: string;
};

export type HelmReservedWorkspaceBackfillAssessment = {
  totalMigratableRecords: number;
  totalReviewOnlySignals: number;
  canApply: boolean;
  applyBlockedReasons: string[];
};

export type HelmReservedWorkspaceBackfillWorkspaceInventory = {
  sourceWorkspace: BackfillWorkspace;
  migratableCounts: HelmReservedWorkspaceBackfillCounts;
  reviewOnlyCounts: HelmReservedWorkspaceBackfillReviewOnlyCounts;
  totalMigratableRecords: number;
  totalReviewOnlySignals: number;
  conflicts: HelmReservedWorkspaceBackfillConflict[];
  integrityIssues: HelmReservedWorkspaceBackfillIntegrityIssue[];
  canApply: boolean;
  applyBlockedReasons: string[];
};

export type HelmReservedWorkspaceBackfillSummary = {
  sourceWorkspaceCount: number;
  workspacesWithMigratableRecords: number;
  workspacesWithReviewOnlySignals: number;
  workspacesWithConflicts: number;
  workspacesWithIntegrityIssues: number;
  totalMigratableRecords: number;
  totalReviewOnlySignals: number;
};

export type HelmReservedWorkspaceBackfillInventoryReport = {
  mode: "inventory";
  generatedAt: string;
  reservedWorkspace: BackfillWorkspace;
  sources: HelmReservedWorkspaceBackfillWorkspaceInventory[];
  summary: HelmReservedWorkspaceBackfillSummary;
};

export type HelmReservedWorkspaceBackfillApplyReport = {
  mode: "apply";
  generatedAt: string;
  reservedWorkspace: BackfillWorkspace;
  sources: [HelmReservedWorkspaceBackfillWorkspaceInventory];
  summary: HelmReservedWorkspaceBackfillSummary;
  appliedMigration: {
    sourceWorkspaceId: string;
    targetWorkspaceId: string;
    updatedCounts: HelmReservedWorkspaceBackfillCounts;
    totalUpdatedRecords: number;
    auditLogId: string;
    eventLogId: string;
  };
};

const formalSkillReviewSignalWhere: Prisma.SkillSuggestionWhereInput = {
  OR: [
    {
      formalReviewStatus: {
        not: "NOT_READY",
      },
    },
    {
      formalReviewDecision: {
        not: "NONE",
      },
    },
    {
      formalReviewQueuedAt: {
        not: null,
      },
    },
    {
      formalReviewDecisionAt: {
        not: null,
      },
    },
    {
      formalReviewQueuedByUserId: {
        not: null,
      },
    },
    {
      formalReviewDecisionByUserId: {
        not: null,
      },
    },
  ],
};

function buildZeroMigratableCounts(): HelmReservedWorkspaceBackfillCounts {
  return {
    workerPublisherProfile: 0,
    salesReferral: 0,
    customEngagement: 0,
    revenueRule: 0,
    revenueAttributionLedger: 0,
    payoutLedger: 0,
    beneficiaryPayoutProfile: 0,
    participantPortalAccess: 0,
    partnerProgram: 0,
    programTermsVersion: 0,
    programApplication: 0,
    settlementBatch: 0,
    settlementBatchLine: 0,
  };
}

function sumCounts(counts: Record<string, number>) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function formatBeneficiaryCompositeKey(beneficiaryType: string, beneficiaryReference: string) {
  return `${beneficiaryType}:${beneficiaryReference}`;
}

async function requireHelmReservedWorkspace() {
  const reservedWorkspace = await resolveHelmReservedWorkspace();

  if (!reservedWorkspace) {
    throw new Error(
      "Helm reserved workspace not found or not operational. Seed or backfill the reserved host before running reserved workspace migration tools.",
    );
  }

  return reservedWorkspace;
}

async function resolveSourceWorkspaces(
  client: BackfillDbClient,
  sourceWorkspaceId?: string,
) {
  if (sourceWorkspaceId) {
    const sourceWorkspace = await client.workspace.findUnique({
      where: {
        id: sourceWorkspaceId,
      },
      select: backfillWorkspaceSelect,
    });

    if (!sourceWorkspace) {
      throw new Error(`Source workspace not found: ${sourceWorkspaceId}`);
    }

    if (sourceWorkspace.workspaceClass === WorkspaceClass.HELM_RESERVED) {
      throw new Error(
        `Source workspace ${sourceWorkspace.id} is already marked as HELM_RESERVED and is not eligible for reserved host backfill.`,
      );
    }

    return [sourceWorkspace];
  }

  return client.workspace.findMany({
    where: {
      workspaceClass: {
        not: WorkspaceClass.HELM_RESERVED,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: backfillWorkspaceSelect,
  });
}

async function collectMigratableCounts(
  client: BackfillDbClient,
  workspaceId: string,
): Promise<HelmReservedWorkspaceBackfillCounts> {
  const [
    workerPublisherProfile,
    salesReferral,
    customEngagement,
    revenueRule,
    revenueAttributionLedger,
    payoutLedger,
    beneficiaryPayoutProfile,
    participantPortalAccess,
    partnerProgram,
    programTermsVersion,
    programApplication,
    settlementBatch,
    settlementBatchLine,
  ] = await Promise.all([
    client.workerPublisherProfile.count({ where: { workspaceId } }),
    client.salesReferral.count({ where: { workspaceId } }),
    client.customEngagement.count({ where: { workspaceId } }),
    client.revenueRule.count({ where: { workspaceId } }),
    client.revenueAttributionLedger.count({ where: { workspaceId } }),
    client.payoutLedger.count({ where: { workspaceId } }),
    client.beneficiaryPayoutProfile.count({ where: { workspaceId } }),
    client.participantPortalAccess.count({ where: { workspaceId } }),
    client.partnerProgram.count({ where: { workspaceId } }),
    client.programTermsVersion.count({ where: { workspaceId } }),
    client.programApplication.count({ where: { workspaceId } }),
    client.settlementBatch.count({ where: { workspaceId } }),
    client.settlementBatchLine.count({ where: { workspaceId } }),
  ]);

  return {
    workerPublisherProfile,
    salesReferral,
    customEngagement,
    revenueRule,
    revenueAttributionLedger,
    payoutLedger,
    beneficiaryPayoutProfile,
    participantPortalAccess,
    partnerProgram,
    programTermsVersion,
    programApplication,
    settlementBatch,
    settlementBatchLine,
  };
}

async function collectReviewOnlyCounts(
  client: BackfillDbClient,
  workspaceId: string,
): Promise<HelmReservedWorkspaceBackfillReviewOnlyCounts> {
  const [capabilityCatalogEntry, formalSkillReviewSignal] = await Promise.all([
    client.capabilityCatalogEntry.count({
      where: {
        workspaceId,
      },
    }),
    client.skillSuggestion.count({
      where: {
        workspaceId,
        ...formalSkillReviewSignalWhere,
      },
    }),
  ]);

  return {
    capabilityCatalogEntry,
    formalSkillReviewSignal,
  };
}

async function collectConflicts(
  client: BackfillDbClient,
  sourceWorkspaceId: string,
  reservedWorkspaceId: string,
): Promise<HelmReservedWorkspaceBackfillConflict[]> {
  const conflicts: HelmReservedWorkspaceBackfillConflict[] = [];

  const sourceWorkerPublisherProfiles = await client.workerPublisherProfile.findMany({
    where: {
      workspaceId: sourceWorkspaceId,
    },
    select: {
      publisherKey: true,
    },
  });
  const publisherKeys = dedupeStrings(
    sourceWorkerPublisherProfiles.map((record) => record.publisherKey),
  );

  if (publisherKeys.length > 0) {
    const targetConflicts = await client.workerPublisherProfile.findMany({
      where: {
        workspaceId: reservedWorkspaceId,
        publisherKey: {
          in: publisherKeys,
        },
      },
      select: {
        id: true,
        publisherKey: true,
      },
    });

    conflicts.push(
      ...targetConflicts.map((record) => ({
        model: "workerPublisherProfile" as const,
        keyLabel: "publisherKey",
        keyValue: record.publisherKey,
        targetRecordId: record.id,
      })),
    );
  }

  const sourceSalesReferrals = await client.salesReferral.findMany({
    where: {
      workspaceId: sourceWorkspaceId,
    },
    select: {
      referralKey: true,
    },
  });
  const referralKeys = dedupeStrings(
    sourceSalesReferrals.map((record) => record.referralKey),
  );

  if (referralKeys.length > 0) {
    const targetConflicts = await client.salesReferral.findMany({
      where: {
        workspaceId: reservedWorkspaceId,
        referralKey: {
          in: referralKeys,
        },
      },
      select: {
        id: true,
        referralKey: true,
      },
    });

    conflicts.push(
      ...targetConflicts.map((record) => ({
        model: "salesReferral" as const,
        keyLabel: "referralKey",
        keyValue: record.referralKey,
        targetRecordId: record.id,
      })),
    );
  }

  const sourceCustomEngagements = await client.customEngagement.findMany({
    where: {
      workspaceId: sourceWorkspaceId,
    },
    select: {
      engagementKey: true,
    },
  });
  const engagementKeys = dedupeStrings(
    sourceCustomEngagements.map((record) => record.engagementKey),
  );

  if (engagementKeys.length > 0) {
    const targetConflicts = await client.customEngagement.findMany({
      where: {
        workspaceId: reservedWorkspaceId,
        engagementKey: {
          in: engagementKeys,
        },
      },
      select: {
        id: true,
        engagementKey: true,
      },
    });

    conflicts.push(
      ...targetConflicts.map((record) => ({
        model: "customEngagement" as const,
        keyLabel: "engagementKey",
        keyValue: record.engagementKey,
        targetRecordId: record.id,
      })),
    );
  }

  const sourceRevenueRules = await client.revenueRule.findMany({
    where: {
      workspaceId: sourceWorkspaceId,
    },
    select: {
      ruleKey: true,
    },
  });
  const ruleKeys = dedupeStrings(sourceRevenueRules.map((record) => record.ruleKey));

  if (ruleKeys.length > 0) {
    const targetConflicts = await client.revenueRule.findMany({
      where: {
        workspaceId: reservedWorkspaceId,
        ruleKey: {
          in: ruleKeys,
        },
      },
      select: {
        id: true,
        ruleKey: true,
      },
    });

    conflicts.push(
      ...targetConflicts.map((record) => ({
        model: "revenueRule" as const,
        keyLabel: "ruleKey",
        keyValue: record.ruleKey,
        targetRecordId: record.id,
      })),
    );
  }

  const sourceBeneficiaryPayoutProfiles = await client.beneficiaryPayoutProfile.findMany({
    where: {
      workspaceId: sourceWorkspaceId,
    },
    select: {
      beneficiaryType: true,
      beneficiaryReference: true,
    },
  });

  if (sourceBeneficiaryPayoutProfiles.length > 0) {
    const targetConflicts = await client.beneficiaryPayoutProfile.findMany({
      where: {
        workspaceId: reservedWorkspaceId,
        OR: sourceBeneficiaryPayoutProfiles.map((record) => ({
          beneficiaryType: record.beneficiaryType,
          beneficiaryReference: record.beneficiaryReference,
        })),
      },
      select: {
        id: true,
        beneficiaryType: true,
        beneficiaryReference: true,
      },
    });

    conflicts.push(
      ...targetConflicts.map((record) => ({
        model: "beneficiaryPayoutProfile" as const,
        keyLabel: "beneficiaryType+beneficiaryReference",
        keyValue: formatBeneficiaryCompositeKey(
          record.beneficiaryType,
          record.beneficiaryReference,
        ),
        targetRecordId: record.id,
      })),
    );
  }

  const sourceParticipantPortalAccesses = await client.participantPortalAccess.findMany({
    where: {
      workspaceId: sourceWorkspaceId,
    },
    select: {
      beneficiaryType: true,
      beneficiaryReference: true,
    },
  });

  if (sourceParticipantPortalAccesses.length > 0) {
    const targetConflicts = await client.participantPortalAccess.findMany({
      where: {
        workspaceId: reservedWorkspaceId,
        OR: sourceParticipantPortalAccesses.map((record) => ({
          beneficiaryType: record.beneficiaryType,
          beneficiaryReference: record.beneficiaryReference,
        })),
      },
      select: {
        id: true,
        beneficiaryType: true,
        beneficiaryReference: true,
      },
    });

    conflicts.push(
      ...targetConflicts.map((record) => ({
        model: "participantPortalAccess" as const,
        keyLabel: "beneficiaryType+beneficiaryReference",
        keyValue: formatBeneficiaryCompositeKey(
          record.beneficiaryType,
          record.beneficiaryReference,
        ),
        targetRecordId: record.id,
      })),
    );
  }

  const sourcePartnerPrograms = await client.partnerProgram.findMany({
    where: {
      workspaceId: sourceWorkspaceId,
    },
    select: {
      programKey: true,
      slug: true,
    },
  });
  const programKeys = dedupeStrings(sourcePartnerPrograms.map((record) => record.programKey));
  const programSlugs = dedupeStrings(sourcePartnerPrograms.map((record) => record.slug));

  if (programKeys.length > 0) {
    const targetConflicts = await client.partnerProgram.findMany({
      where: {
        workspaceId: reservedWorkspaceId,
        programKey: {
          in: programKeys,
        },
      },
      select: {
        id: true,
        programKey: true,
      },
    });

    conflicts.push(
      ...targetConflicts.map((record) => ({
        model: "partnerProgram" as const,
        keyLabel: "programKey",
        keyValue: record.programKey,
        targetRecordId: record.id,
      })),
    );
  }

  if (programSlugs.length > 0) {
    const targetConflicts = await client.partnerProgram.findMany({
      where: {
        workspaceId: reservedWorkspaceId,
        slug: {
          in: programSlugs,
        },
      },
      select: {
        id: true,
        slug: true,
      },
    });

    conflicts.push(
      ...targetConflicts.map((record) => ({
        model: "partnerProgram" as const,
        keyLabel: "slug",
        keyValue: record.slug,
        targetRecordId: record.id,
      })),
    );
  }

  const sourceSettlementBatches = await client.settlementBatch.findMany({
    where: {
      workspaceId: sourceWorkspaceId,
    },
    select: {
      batchKey: true,
    },
  });
  const batchKeys = dedupeStrings(sourceSettlementBatches.map((record) => record.batchKey));

  if (batchKeys.length > 0) {
    const targetConflicts = await client.settlementBatch.findMany({
      where: {
        workspaceId: reservedWorkspaceId,
        batchKey: {
          in: batchKeys,
        },
      },
      select: {
        id: true,
        batchKey: true,
      },
    });

    conflicts.push(
      ...targetConflicts.map((record) => ({
        model: "settlementBatch" as const,
        keyLabel: "batchKey",
        keyValue: record.batchKey,
        targetRecordId: record.id,
      })),
    );
  }

  return conflicts;
}

async function collectIntegrityIssues(
  client: BackfillDbClient,
  workspaceId: string,
): Promise<HelmReservedWorkspaceBackfillIntegrityIssue[]> {
  const [
    revenueRule,
    revenueAttributionLedger,
    payoutLedger,
    beneficiaryPayoutProfile,
    participantPortalAccess,
    programTermsVersion,
    programApplication,
    settlementBatchLine,
  ] = await Promise.all([
    client.revenueRule.count({
      where: {
        workspaceId,
        OR: [
          {
            workerPublisherProfile: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            salesReferral: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            customEngagement: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
        ],
      },
    }),
    client.revenueAttributionLedger.count({
      where: {
        workspaceId,
        OR: [
          {
            revenueRule: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            workerPublisherProfile: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            salesReferral: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            customEngagement: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            reversalOf: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
        ],
      },
    }),
    client.payoutLedger.count({
      where: {
        workspaceId,
        OR: [
          {
            revenueAttributionLedger: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            workerPublisherProfile: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            salesReferral: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            customEngagement: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
        ],
      },
    }),
    client.beneficiaryPayoutProfile.count({
      where: {
        workspaceId,
        OR: [
          {
            workerPublisherProfile: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            salesReferral: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            customEngagement: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
        ],
      },
    }),
    client.participantPortalAccess.count({
      where: {
        workspaceId,
        OR: [
          {
            workerPublisherProfile: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            salesReferral: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            customEngagement: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
        ],
      },
    }),
    client.programTermsVersion.count({
      where: {
        workspaceId,
        partnerProgram: {
          is: {
            workspaceId: {
              not: workspaceId,
            },
          },
        },
      },
    }),
    client.programApplication.count({
      where: {
        workspaceId,
        OR: [
          {
            partnerProgram: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            programTermsVersion: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            participantPortalAccess: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            workerPublisherProfile: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            salesReferral: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            customEngagement: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
        ],
      },
    }),
    client.settlementBatchLine.count({
      where: {
        workspaceId,
        OR: [
          {
            settlementBatch: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            payoutLedger: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
          {
            beneficiaryPayoutProfile: {
              is: {
                workspaceId: {
                  not: workspaceId,
                },
              },
            },
          },
        ],
      },
    }),
  ]);

  const issues: HelmReservedWorkspaceBackfillIntegrityIssue[] = [];

  if (revenueRule > 0) {
    issues.push({
      model: "revenueRule",
      count: revenueRule,
      summary:
        "Revenue rules reference contributor or engagement records outside the source workspace.",
    });
  }

  if (revenueAttributionLedger > 0) {
    issues.push({
      model: "revenueAttributionLedger",
      count: revenueAttributionLedger,
      summary:
        "Revenue attribution entries reference rules, beneficiaries or reversal records outside the source workspace.",
    });
  }

  if (payoutLedger > 0) {
    issues.push({
      model: "payoutLedger",
      count: payoutLedger,
      summary:
        "Payout ledger entries reference attribution or beneficiary records outside the source workspace.",
    });
  }

  if (beneficiaryPayoutProfile > 0) {
    issues.push({
      model: "beneficiaryPayoutProfile",
      count: beneficiaryPayoutProfile,
      summary:
        "Beneficiary payout profiles reference contributor or engagement records outside the source workspace.",
    });
  }

  if (participantPortalAccess > 0) {
    issues.push({
      model: "participantPortalAccess",
      count: participantPortalAccess,
      summary:
        "Participant portal access rows reference contributor or engagement records outside the source workspace.",
    });
  }

  if (programTermsVersion > 0) {
    issues.push({
      model: "programTermsVersion",
      count: programTermsVersion,
      summary:
        "Program terms versions reference partner programs outside the source workspace.",
    });
  }

  if (programApplication > 0) {
    issues.push({
      model: "programApplication",
      count: programApplication,
      summary:
        "Program applications reference program, terms, portal or beneficiary records outside the source workspace.",
    });
  }

  if (settlementBatchLine > 0) {
    issues.push({
      model: "settlementBatchLine",
      count: settlementBatchLine,
      summary:
        "Settlement batch lines reference batch, payout or payout profile records outside the source workspace.",
    });
  }

  return issues;
}

export function buildHelmReservedWorkspaceBackfillAssessment(input: {
  migratableCounts: HelmReservedWorkspaceBackfillCounts;
  reviewOnlyCounts: HelmReservedWorkspaceBackfillReviewOnlyCounts;
  conflicts: HelmReservedWorkspaceBackfillConflict[];
  integrityIssues: HelmReservedWorkspaceBackfillIntegrityIssue[];
}): HelmReservedWorkspaceBackfillAssessment {
  const totalMigratableRecords = sumCounts(input.migratableCounts);
  const totalReviewOnlySignals = sumCounts(input.reviewOnlyCounts);
  const applyBlockedReasons: string[] = [];

  if (totalMigratableRecords === 0) {
    applyBlockedReasons.push(
      "No migratable commercial / program / portal / settlement records were found in the source workspace.",
    );
  }

  if (input.conflicts.length > 0) {
    applyBlockedReasons.push(
      `Preflight found ${input.conflicts.length} target-key collision(s) in the Helm reserved workspace.`,
    );
  }

  if (input.integrityIssues.length > 0) {
    applyBlockedReasons.push(
      `Preflight found ${input.integrityIssues.length} cross-workspace integrity issue group(s).`,
    );
  }

  return {
    totalMigratableRecords,
    totalReviewOnlySignals,
    canApply: applyBlockedReasons.length === 0,
    applyBlockedReasons,
  };
}

async function buildWorkspaceInventory(
  client: BackfillDbClient,
  sourceWorkspace: BackfillWorkspace,
  reservedWorkspaceId: string,
): Promise<HelmReservedWorkspaceBackfillWorkspaceInventory> {
  const [migratableCounts, reviewOnlyCounts, conflicts, integrityIssues] = await Promise.all([
    collectMigratableCounts(client, sourceWorkspace.id),
    collectReviewOnlyCounts(client, sourceWorkspace.id),
    collectConflicts(client, sourceWorkspace.id, reservedWorkspaceId),
    collectIntegrityIssues(client, sourceWorkspace.id),
  ]);

  const assessment = buildHelmReservedWorkspaceBackfillAssessment({
    migratableCounts,
    reviewOnlyCounts,
    conflicts,
    integrityIssues,
  });

  return {
    sourceWorkspace,
    migratableCounts,
    reviewOnlyCounts,
    totalMigratableRecords: assessment.totalMigratableRecords,
    totalReviewOnlySignals: assessment.totalReviewOnlySignals,
    conflicts,
    integrityIssues,
    canApply: assessment.canApply,
    applyBlockedReasons: assessment.applyBlockedReasons,
  };
}

function buildBackfillSummary(
  sources: HelmReservedWorkspaceBackfillWorkspaceInventory[],
): HelmReservedWorkspaceBackfillSummary {
  return {
    sourceWorkspaceCount: sources.length,
    workspacesWithMigratableRecords: sources.filter((source) => source.totalMigratableRecords > 0)
      .length,
    workspacesWithReviewOnlySignals: sources.filter((source) => source.totalReviewOnlySignals > 0)
      .length,
    workspacesWithConflicts: sources.filter((source) => source.conflicts.length > 0).length,
    workspacesWithIntegrityIssues: sources.filter((source) => source.integrityIssues.length > 0)
      .length,
    totalMigratableRecords: sources.reduce(
      (total, source) => total + source.totalMigratableRecords,
      0,
    ),
    totalReviewOnlySignals: sources.reduce(
      (total, source) => total + source.totalReviewOnlySignals,
      0,
    ),
  };
}

function shouldKeepInventoryRow(
  inventory: HelmReservedWorkspaceBackfillWorkspaceInventory,
  includeEmpty: boolean,
) {
  if (includeEmpty) {
    return true;
  }

  return (
    inventory.totalMigratableRecords > 0 ||
    inventory.totalReviewOnlySignals > 0 ||
    inventory.conflicts.length > 0 ||
    inventory.integrityIssues.length > 0
  );
}

export function buildHelmReservedWorkspaceBackfillApplyAuditPayload(input: {
  sourceWorkspace: BackfillWorkspace;
  reservedWorkspace: BackfillWorkspace;
  inventory: HelmReservedWorkspaceBackfillWorkspaceInventory;
  updatedCounts: HelmReservedWorkspaceBackfillCounts;
  totalUpdatedRecords: number;
}) {
  return {
    sourceWorkspace: {
      id: input.sourceWorkspace.id,
      name: input.sourceWorkspace.name,
      slug: input.sourceWorkspace.slug,
      workspaceClass: input.sourceWorkspace.workspaceClass,
    },
    targetWorkspace: {
      id: input.reservedWorkspace.id,
      name: input.reservedWorkspace.name,
      slug: input.reservedWorkspace.slug,
      workspaceClass: input.reservedWorkspace.workspaceClass,
      systemKey: input.reservedWorkspace.systemKey,
    },
    preflight: {
      totalMigratableRecords: input.inventory.totalMigratableRecords,
      totalReviewOnlySignals: input.inventory.totalReviewOnlySignals,
      conflicts: input.inventory.conflicts,
      integrityIssues: input.inventory.integrityIssues,
    },
    updatedCounts: input.updatedCounts,
    totalUpdatedRecords: input.totalUpdatedRecords,
  };
}

export function buildHelmReservedWorkspaceBackfillApplySummary(input: {
  sourceWorkspace: BackfillWorkspace;
  reservedWorkspace: BackfillWorkspace;
  totalUpdatedRecords: number;
}) {
  return `Migrated ${input.totalUpdatedRecords} Helm first-party commercial/program/portal/settlement record(s) from ${input.sourceWorkspace.slug} into reserved host ${input.reservedWorkspace.slug}.`;
}

export async function inventoryHelmReservedWorkspaceBackfill(options?: {
  sourceWorkspaceId?: string;
  includeEmpty?: boolean;
}): Promise<HelmReservedWorkspaceBackfillInventoryReport> {
  const reservedWorkspace = await requireHelmReservedWorkspace();
  const sourceWorkspaces = await resolveSourceWorkspaces(db, options?.sourceWorkspaceId);
  const inventories = await Promise.all(
    sourceWorkspaces.map((sourceWorkspace) =>
      buildWorkspaceInventory(db, sourceWorkspace, reservedWorkspace.id),
    ),
  );
  const keepEmpty = Boolean(options?.sourceWorkspaceId) || (options?.includeEmpty ?? false);
  const filteredInventories = inventories.filter((inventory) =>
    shouldKeepInventoryRow(inventory, keepEmpty),
  );

  return {
    mode: "inventory",
    generatedAt: new Date().toISOString(),
    reservedWorkspace,
    sources: filteredInventories,
    summary: buildBackfillSummary(filteredInventories),
  };
}

async function performBackfillUpdates(
  client: BackfillDbClient,
  sourceWorkspaceId: string,
  reservedWorkspaceId: string,
): Promise<HelmReservedWorkspaceBackfillCounts> {
  const updatedCounts = buildZeroMigratableCounts();

  updatedCounts.workerPublisherProfile = (
    await client.workerPublisherProfile.updateMany({
      where: {
        workspaceId: sourceWorkspaceId,
      },
      data: {
        workspaceId: reservedWorkspaceId,
      },
    })
  ).count;
  updatedCounts.salesReferral = (
    await client.salesReferral.updateMany({
      where: {
        workspaceId: sourceWorkspaceId,
      },
      data: {
        workspaceId: reservedWorkspaceId,
      },
    })
  ).count;
  updatedCounts.customEngagement = (
    await client.customEngagement.updateMany({
      where: {
        workspaceId: sourceWorkspaceId,
      },
      data: {
        workspaceId: reservedWorkspaceId,
      },
    })
  ).count;
  updatedCounts.revenueRule = (
    await client.revenueRule.updateMany({
      where: {
        workspaceId: sourceWorkspaceId,
      },
      data: {
        workspaceId: reservedWorkspaceId,
      },
    })
  ).count;
  updatedCounts.revenueAttributionLedger = (
    await client.revenueAttributionLedger.updateMany({
      where: {
        workspaceId: sourceWorkspaceId,
      },
      data: {
        workspaceId: reservedWorkspaceId,
      },
    })
  ).count;
  updatedCounts.payoutLedger = (
    await client.payoutLedger.updateMany({
      where: {
        workspaceId: sourceWorkspaceId,
      },
      data: {
        workspaceId: reservedWorkspaceId,
      },
    })
  ).count;
  updatedCounts.beneficiaryPayoutProfile = (
    await client.beneficiaryPayoutProfile.updateMany({
      where: {
        workspaceId: sourceWorkspaceId,
      },
      data: {
        workspaceId: reservedWorkspaceId,
      },
    })
  ).count;
  updatedCounts.participantPortalAccess = (
    await client.participantPortalAccess.updateMany({
      where: {
        workspaceId: sourceWorkspaceId,
      },
      data: {
        workspaceId: reservedWorkspaceId,
      },
    })
  ).count;
  updatedCounts.partnerProgram = (
    await client.partnerProgram.updateMany({
      where: {
        workspaceId: sourceWorkspaceId,
      },
      data: {
        workspaceId: reservedWorkspaceId,
      },
    })
  ).count;
  updatedCounts.programTermsVersion = (
    await client.programTermsVersion.updateMany({
      where: {
        workspaceId: sourceWorkspaceId,
      },
      data: {
        workspaceId: reservedWorkspaceId,
      },
    })
  ).count;
  updatedCounts.programApplication = (
    await client.programApplication.updateMany({
      where: {
        workspaceId: sourceWorkspaceId,
      },
      data: {
        workspaceId: reservedWorkspaceId,
      },
    })
  ).count;
  updatedCounts.settlementBatch = (
    await client.settlementBatch.updateMany({
      where: {
        workspaceId: sourceWorkspaceId,
      },
      data: {
        workspaceId: reservedWorkspaceId,
      },
    })
  ).count;
  updatedCounts.settlementBatchLine = (
    await client.settlementBatchLine.updateMany({
      where: {
        workspaceId: sourceWorkspaceId,
      },
      data: {
        workspaceId: reservedWorkspaceId,
      },
    })
  ).count;

  return updatedCounts;
}

export async function applyHelmReservedWorkspaceBackfill(input: {
  sourceWorkspaceId: string;
}): Promise<HelmReservedWorkspaceBackfillApplyReport> {
  const reservedWorkspace = await requireHelmReservedWorkspace();

  return db.$transaction(async (tx) => {
    const sourceWorkspaces = await resolveSourceWorkspaces(tx, input.sourceWorkspaceId);
    const sourceWorkspace = sourceWorkspaces[0];

    if (!sourceWorkspace) {
      throw new Error(`Source workspace not found: ${input.sourceWorkspaceId}`);
    }

    const inventory = await buildWorkspaceInventory(tx, sourceWorkspace, reservedWorkspace.id);

    if (!inventory.canApply) {
      throw new Error(
        [
          `Reserved workspace backfill cannot apply for source workspace ${sourceWorkspace.id}.`,
          ...inventory.applyBlockedReasons,
        ].join(" "),
      );
    }

    const updatedCounts = await performBackfillUpdates(tx, sourceWorkspace.id, reservedWorkspace.id);
    const totalUpdatedRecords = sumCounts(updatedCounts);
    const generatedAt = new Date();

    if (totalUpdatedRecords !== inventory.totalMigratableRecords) {
      throw new Error(
        `Reserved workspace backfill updated ${totalUpdatedRecords} records, but preflight expected ${inventory.totalMigratableRecords}.`,
      );
    }

    const auditPayload = buildHelmReservedWorkspaceBackfillApplyAuditPayload({
      sourceWorkspace,
      reservedWorkspace,
      inventory,
      updatedCounts,
      totalUpdatedRecords,
    });
    const summary = buildHelmReservedWorkspaceBackfillApplySummary({
      sourceWorkspace,
      reservedWorkspace,
      totalUpdatedRecords,
    });
    const auditLog = await tx.auditLog.create({
      data: {
        workspaceId: reservedWorkspace.id,
        actor: RESERVED_WORKSPACE_BACKFILL_AUDIT_ACTOR,
        actorType: ActorType.SYSTEM,
        actionType: "RESERVED_WORKSPACE_BACKFILL_APPLIED",
        targetType: "Workspace",
        targetId: sourceWorkspace.id,
        summary,
        payload: jsonStringify(auditPayload),
        sourcePage: RESERVED_WORKSPACE_BACKFILL_SOURCE_PAGE,
        relatedObjectType: "Workspace",
        relatedObjectId: reservedWorkspace.id,
      },
    });
    const eventLog = await tx.eventLog.create({
      data: {
        workspaceId: reservedWorkspace.id,
        eventName: "reserved_workspace_backfill_applied",
        eventCategory: "migration",
        targetType: "Workspace",
        targetId: sourceWorkspace.id,
        metadata: JSON.stringify(auditPayload),
        sourcePage: RESERVED_WORKSPACE_BACKFILL_SOURCE_PAGE,
        createdAt: generatedAt,
      },
    });

    return {
      mode: "apply" as const,
      generatedAt: generatedAt.toISOString(),
      reservedWorkspace,
      sources: [inventory] as [HelmReservedWorkspaceBackfillWorkspaceInventory],
      summary: buildBackfillSummary([inventory]),
      appliedMigration: {
        sourceWorkspaceId: sourceWorkspace.id,
        targetWorkspaceId: reservedWorkspace.id,
        updatedCounts,
        totalUpdatedRecords,
        auditLogId: auditLog.id,
        eventLogId: eventLog.id,
      },
    };
  });
}
