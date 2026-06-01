import {
  loadBiReportRowsFromFile,
  loadBiReportSkillPack,
  loadBiReportSubscriptionFromFile,
  resolveBiReportSkillLocation,
  resolveBiReportSubscriptionFile,
} from "@/lib/bi-report-skill/skill-loader";
import { sendBiReportToDingTalkDeliveryTarget } from "@/lib/bi-report-skill/delivery/dingtalk-delivery";
import { buildBiReportBusinessSignalInput, createBiReportBusinessSignal } from "@/lib/bi-report-skill/business-signal";
import { listRecentBiReportFeedbackMemories } from "@/lib/bi-report-skill/feedback-memory";
import { queryBiReportRowsFromOdps } from "@/lib/bi-report-skill/query-adapters/odps";
import {
  completeBiReportRunPersistence,
  failBiReportRunPersistence,
  recordBiReportDeliveries,
  startBiReportRunPersistence,
} from "@/lib/bi-report-skill/run-persistence";
import { listRecentBiReportRunMemories, recordBiReportRunMemory } from "@/lib/bi-report-skill/run-memory";
import { prepareBiReportDryRun, resolveBiReportSendDecision } from "@/lib/bi-report-skill/run-service";
import { persistBiReportRowLevelSignals } from "@/lib/bi-report-skill/row-level-signal-postprocessor";
import { resolveBiReportSignalOwner } from "@/lib/bi-report-skill/signal-routing";
import { createBiReportSignalNotification } from "@/lib/bi-report-skill/signal-notification";
import { isBiReportSignalNotificationSendEnabled } from "@/lib/bi-report-skill/signal-notification-policy";
import { buildBiReportQueryInput } from "@/lib/bi-report-skill/sql-template";
import type { BiReportSubscriptionConfig } from "@/lib/bi-report-skill/types";
import {
  normalizeP0OwnerNotificationTarget,
  resolveP0OwnerNotificationTargetKey,
} from "@/lib/bi-report-skill/p0-owner-notification";
import { getBiReportP0ProcessSkillKey } from "@/lib/extensions/registry";
import { checkWorkspaceSolutionExtensionEnabled } from "@/lib/solution-extensions";
import { findTenantExtensionManifestByExtensionKey } from "@/lib/solution-extension-manifests";

/**
 * R1 review fix: enforce the extension manifest's `maxEffectMode` as authoritative
 * runtime contract. When the manifest declares `read_only`, all delivery targets are
 * forced to dryRun regardless of subscription / `shouldSend`. This prevents the bug
 * where the manifest claims read_only but DingTalk send still happens at runtime.
 *
 * Returns true if the runtime must force dryRun.
 */
function shouldForceDryRunByManifest(extensionKey: string | null | undefined): boolean {
  // Local/dev override: allow exercising delivery paths without changing extension manifests.
  if (process.env.BI_REPORT_DEV_DISABLE_MANIFEST_DRY_RUN?.trim().toLowerCase() === "true") {
    return false;
  }
  if (!extensionKey) return false;
  try {
    const manifest = findTenantExtensionManifestByExtensionKey(extensionKey);
    return manifest.capabilityManifest.maxEffectMode === "read_only";
  } catch {
    // Missing manifest — be conservative, force dryRun.
    return true;
  }
}

export type ExecuteBiReportPushInput = {
  extension?: string;
  tenantKey?: string;
  extensionSlug?: string;
  skill: string;
  skillDir?: string;
  subscriptionFile?: string;
  subscription?: BiReportSubscriptionConfig;
  inputFile?: string;
  sql?: string;
  workspaceId: string;
  useLLM?: boolean;
  dryRun?: boolean;
  userId?: string | null;
};

export type ExecuteBiReportPushResult = {
  dryRun: boolean;
  skillKey: string;
  skillVersion: string;
  subscriptionName: string;
  workspaceId: string;
  extensionKey: string | null;
  tenantKey: string | null;
  extensionSlug: string | null;
  assetSource: string;
  queryMode: "sample_input" | "custom_sql" | "odps";
  sql: string;
  sqlParams: Record<string, string>;
  queryKnowledgeLint: {
    matchedAliases: string[];
    matchedPhysicalTables: string[];
    warnings: string[];
  };
  rows: number;
  severity: string;
  shouldSend: boolean;
  sendDecisionReason: string;
  dedupeWindowMinutes: number;
  windowLabel: string;
  analysisGenerationMode: string | null;
  llmMeta: Record<string, unknown> | null;
  continuityStatus: string | null;
  historicalContext: string | null;
  feedbackContext: string | null;
  findings: string[];
  deliveryPreviews: Awaited<ReturnType<typeof sendBiReportToDingTalkDeliveryTarget>>[];
  message: string;
  persistedRunId: string | null;
  persistedSubscriptionId: string | null;
};

export async function executeBiReportPush(input: ExecuteBiReportPushInput): Promise<ExecuteBiReportPushResult> {
  const dryRun = input.dryRun ?? true;
  const skillLocation = resolveBiReportSkillLocation({
    extensionKey: input.extension,
    tenantKey: input.tenantKey,
    extensionSlug: input.extensionSlug,
    skillKey: input.skill,
    skillDir: input.skillDir,
  });
  const subscriptionFile = input.subscription
    ? null
    : resolveBiReportSubscriptionFile({
        extensionKey: input.extension,
        tenantKey: input.tenantKey,
        extensionSlug: input.extensionSlug,
        skillKey: input.skill,
        skillDir: input.skillDir,
        subscriptionFile: input.subscriptionFile,
      });

  let workspaceMissing = false;

  if (skillLocation.extensionKey) {
    const extensionCheck = await checkWorkspaceSolutionExtensionEnabled({
      workspaceId: input.workspaceId,
      extensionKey: skillLocation.extensionKey,
    });
    if (!extensionCheck.ok) {
      throw new Error(
        `workspace ${input.workspaceId} has not enabled solution extension ${skillLocation.extensionKey} (${extensionCheck.reason})`,
      );
    }
    if (extensionCheck.reason === "workspace_missing") {
      workspaceMissing = true;
      console.warn(
        `[bi-report] workspace ${input.workspaceId} is not present in Prisma; skipping extension enablement enforcement for dry-run.`,
      );
    }
  }

  const [skill, subscription] = await Promise.all([
    loadBiReportSkillPack({
      extensionKey: skillLocation.extensionKey ?? input.extension,
      tenantKey: skillLocation.tenantKey ?? input.tenantKey,
      extensionSlug: skillLocation.extensionSlug ?? input.extensionSlug,
      skillKey: input.skill,
      skillDir: input.skillDir,
    }),
    input.subscription ? Promise.resolve(input.subscription) : loadBiReportSubscriptionFromFile(subscriptionFile!),
  ]);

  const query = buildBiReportQueryInput({
    skill,
    subscription,
  });
  const effectiveSql = input.sql?.trim() || query.sql;
  const queryMode = input.inputFile ? "sample_input" : input.sql ? "custom_sql" : "odps";
  const persistedRun = workspaceMissing || dryRun
    ? null
    : await startBiReportRunPersistence({
        workspaceId: input.workspaceId,
        extensionKey: skillLocation.extensionKey,
        userId: input.userId ?? null,
        skillKey: skill.manifest.skillKey,
        skillVersion: skill.manifest.version,
        subscription,
      });

  try {
    const [recentRuns, recentFeedbacks] = workspaceMissing
      ? [[], []]
      : await Promise.all([
          listRecentBiReportRunMemories({
            workspaceId: input.workspaceId,
            extensionKey: skillLocation.extensionKey,
            skillKey: skill.manifest.skillKey,
            take: 5,
          }),
          listRecentBiReportFeedbackMemories({
            workspaceId: input.workspaceId,
            extensionKey: skillLocation.extensionKey,
            skillKey: skill.manifest.skillKey,
            take: 5,
          }),
        ]);
    const rows = input.inputFile
      ? await loadBiReportRowsFromFile(input.inputFile)
      : await queryBiReportRowsFromOdps({
          workspaceId: input.workspaceId,
          skill,
          subscription,
          sql: effectiveSql,
          sqlParams: query.sqlParams,
        });

    const prepared = await prepareBiReportDryRun({
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      skill,
      subscription,
      resolvedSqlParams: query.sqlParams,
      rows,
      useLLM: input.useLLM ?? false,
      recentRuns,
      recentFeedbacks,
    });
    const sendDecision = resolveBiReportSendDecision({
      subscription,
      evaluation: prepared.evaluation,
      recentRuns,
      continuityStatus: prepared.recentRunContext.continuityStatus,
    });
    const preparedForDelivery = {
      ...prepared,
      evaluation: {
        ...prepared.evaluation,
        shouldSend: sendDecision.shouldSend,
      },
    };

    if (!workspaceMissing) {
      await recordBiReportRunMemory({
        workspaceId: input.workspaceId,
        extensionKey: skillLocation.extensionKey,
        skillKey: skill.manifest.skillKey,
        skillVersion: skill.manifest.version,
        windowLabel: preparedForDelivery.windowLabel,
        severity: preparedForDelivery.evaluation.severity,
        shouldSend: preparedForDelivery.evaluation.shouldSend,
        summaryMetrics: preparedForDelivery.computed.summaryMetrics,
        topFindings: preparedForDelivery.evaluation.topFindings,
        analysisSummary: preparedForDelivery.analysis.summary,
        continuityStatus: preparedForDelivery.recentRunContext.continuityStatus,
        historicalContext: preparedForDelivery.recentRunContext.historicalContext,
      });
    }

    // R1 review fix: enforce manifest's maxEffectMode as authoritative runtime contract.
    // If the extension declares read_only, every delivery target is forced to dryRun.
    const manifestForcesDryRun = shouldForceDryRunByManifest(skillLocation.extensionKey);
    const effectiveDryRunBaseline = dryRun || manifestForcesDryRun;

    const deliveryPreviews = await Promise.all(
      subscription.deliveryTargets.map((target) => {
        switch (target.channel) {
          case "DINGTALK_GROUP_WEBHOOK":
            return sendBiReportToDingTalkDeliveryTarget({
              channel: "DINGTALK_GROUP_WEBHOOK",
              targetType: target.targetType,
              targetKey: target.targetKey,
              message: preparedForDelivery.message,
              dryRun: effectiveDryRunBaseline || !preparedForDelivery.evaluation.shouldSend,
            });
          case "DINGTALK_APP_MESSAGE":
            return sendBiReportToDingTalkDeliveryTarget({
              channel: "DINGTALK_APP_MESSAGE",
              targetType: target.targetType,
              targetKey: target.targetKey,
              message: preparedForDelivery.message,
              dryRun: effectiveDryRunBaseline || !preparedForDelivery.evaluation.shouldSend,
            });
          default:
            throw new Error(`Unsupported BI report delivery channel: ${String(target.channel)}`);
        }
      }),
    );

    if (persistedRun) {
      const signalOwner = await resolveBiReportSignalOwner({
        workspaceId: input.workspaceId,
        skillKey: skill.manifest.skillKey,
        severity: preparedForDelivery.evaluation.severity,
        signalType: `${skill.manifest.skillKey}.anomaly`,
        signalRouting: subscription.signalRouting,
      });

      await recordBiReportDeliveries({
        runId: persistedRun.runId,
        workspaceId: input.workspaceId,
        extensionKey: skillLocation.extensionKey,
        deliveryPreviews,
      });
      await completeBiReportRunPersistence({
        runId: persistedRun.runId,
        queryMode,
        effectiveSql,
        sqlParams: query.sqlParams,
        queryWarnings: query.knowledgeLint.warnings,
        assetSource: skillLocation.source,
        prepared: preparedForDelivery,
        sendDecision,
        deliveryPreviews,
      });
      const signal = await createBiReportBusinessSignal(
        buildBiReportBusinessSignalInput({
          workspaceId: input.workspaceId,
          sourceRunId: persistedRun.runId,
          extensionKey: skillLocation.extensionKey ?? null,
          prepared: preparedForDelivery,
          queryWarnings: query.knowledgeLint.warnings,
          ownerUserId: signalOwner?.userId ?? null,
          ownerUserName: signalOwner?.name ?? null,
          ownerUserEmail: signalOwner?.email ?? null,
        }),
      );

      await persistBiReportRowLevelSignals({
        workspaceId: input.workspaceId,
        sourceRunId: persistedRun.runId,
        prepared: preparedForDelivery,
      });

      if (
        signal &&
        signalOwner &&
        isBiReportSignalNotificationSendEnabled()
      ) {
        const isP0 = skill.manifest.skillKey === getBiReportP0ProcessSkillKey();
        if (isP0) {
          const rawTargetKey = resolveP0OwnerNotificationTargetKey({
            signalRouting: subscription.signalRouting,
            ownerEmail: signalOwner.email,
          });
          if (rawTargetKey) {
            const normalized = normalizeP0OwnerNotificationTarget(rawTargetKey);
            await createBiReportSignalNotification({
              workspaceId: input.workspaceId,
              signalId: signal.id,
              targetUserId: signalOwner.userId,
              channel: normalized.channel,
              targetKey: normalized.targetKey,
              status: "pending",
            });
          }
        } else {
          await createBiReportSignalNotification({
            workspaceId: input.workspaceId,
            signalId: signal.id,
            targetUserId: signalOwner.userId,
            channel: "DINGTALK_APP_MESSAGE",
            targetKey: signalOwner.email,
            status: "pending",
          });
        }
      }
    }

    return {
      dryRun,
      skillKey: skill.manifest.skillKey,
      skillVersion: skill.manifest.version,
      subscriptionName: subscription.name,
      workspaceId: input.workspaceId,
      extensionKey: skillLocation.extensionKey,
      tenantKey: skillLocation.tenantKey,
      extensionSlug: skillLocation.extensionSlug,
      assetSource: skillLocation.source,
      queryMode,
      sql: effectiveSql,
      sqlParams: query.sqlParams,
      queryKnowledgeLint: query.knowledgeLint,
      rows: preparedForDelivery.rows.length,
      severity: preparedForDelivery.evaluation.severity,
      shouldSend: preparedForDelivery.evaluation.shouldSend,
      sendDecisionReason: sendDecision.reason,
      dedupeWindowMinutes: sendDecision.dedupeWindowMinutes,
      windowLabel: preparedForDelivery.windowLabel,
      analysisGenerationMode: preparedForDelivery.analysis.generationMode ?? null,
      llmMeta: preparedForDelivery.analysis.llmMeta ?? null,
      continuityStatus: preparedForDelivery.analysis.continuityStatus ?? null,
      historicalContext: preparedForDelivery.analysis.historicalContext ?? null,
      feedbackContext: preparedForDelivery.analysis.feedbackContext ?? null,
      findings: preparedForDelivery.analysis.findings,
      deliveryPreviews,
      message: preparedForDelivery.message,
      persistedRunId: persistedRun?.runId ?? null,
      persistedSubscriptionId: persistedRun?.subscriptionId ?? null,
    };
  } catch (error) {
    if (persistedRun) {
      await failBiReportRunPersistence({
        runId: persistedRun.runId,
        errorSummary: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}
