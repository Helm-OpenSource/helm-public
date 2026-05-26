import {
  MemoryEntityType,
  MemoryFactType,
  MemoryStatus,
  MemoryType,
  ObjectType,
  SourceType,
} from "@prisma/client";
import { db } from "@/lib/db";
import { bridgeDingTalkSignalsToWorkflow } from "@/lib/connectors/dingtalk-workflow-bridge";
import { classifyDingTalkSignal } from "@/lib/connectors/signal-classification";
import { jsonStringify, trimText } from "@/lib/utils";

type DingTalkScope =
  | "CALENDAR"
  | "MEETINGS"
  | "TODO"
  | "PROJECTS"
  | "MANAGEMENT"
  | "WORK"
  | "MESSAGE_NOTIFICATIONS";

function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    workspaceId: string | null;
    dryRun: boolean;
    createActions: boolean;
  } = {
    workspaceId: null,
    dryRun: false,
    createActions: false,
  };

  for (const arg of args) {
    if (arg.startsWith("--workspace=")) {
      options.workspaceId = arg.slice("--workspace=".length).trim() || null;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--create-actions") {
      options.createActions = true;
    }
  }

  return options;
}

function safeParseJson(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toScope(sourceScope: string): DingTalkScope | null {
  const [, suffix] = sourceScope.split(":");
  if (!suffix) {
    return null;
  }
  const normalized = suffix.trim().toUpperCase();
  if (
    normalized === "CALENDAR" ||
    normalized === "MEETINGS" ||
    normalized === "TODO" ||
    normalized === "PROJECTS" ||
    normalized === "MANAGEMENT" ||
    normalized === "WORK" ||
    normalized === "MESSAGE_NOTIFICATIONS"
  ) {
    return normalized;
  }
  return null;
}

function parseReportPayload(payload: Record<string, unknown>, fallbackSourceId: string) {
  const readString = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  const toTimestamp = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 10_000_000_000 ? value : value * 1000;
    }
    if (typeof value !== "string") {
      return null;
    }
    const asNumber = Number(value.trim());
    if (Number.isFinite(asNumber)) {
      return asNumber > 10_000_000_000 ? asNumber : asNumber * 1000;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const contents = Array.isArray(payload.contents)
    ? payload.contents.filter((item) => item && typeof item === "object")
    : [];
  const getContentByKey = (matcher: RegExp) =>
    contents
      .map((item) => item as Record<string, unknown>)
      .find((item) => matcher.test(readString(item.key) ?? ""))?.value;

  const completed = readString(getContentByKey(/本周完成|已完成|完成工作|完成事项/));
  const nextPlan = readString(getContentByKey(/下周工作计划|计划|下一步|待推进/));
  const needHelp = readString(getContentByKey(/需协调与帮助|风险|阻塞|问题/));
  const summary = readString(getContentByKey(/本周工作总结|总结/));

  return {
    reportId: readString(payload.report_id) ?? readString(payload.reportId) ?? fallbackSourceId,
    createdAtMs: toTimestamp(payload.create_time) ?? toTimestamp(payload.createdAt) ?? null,
    templateName: readString(payload.template_name) ?? readString(payload.templateName),
    summary,
    completed,
    nextPlan,
    needHelp,
  };
}

async function main() {
  const options = parseArgs();
  const where = {
    boundaryNote: { contains: "DingTalk" },
    ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
  };

  const records = await db.connectorIngestionRecord.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      workspaceId: true,
      sourceType: true,
      sourceId: true,
      sourceScope: true,
      sourceSummary: true,
      meetingId: true,
      opportunityId: true,
      companyId: true,
      createdAt: true,
      updatedAt: true,
      draftPayload: true,
      objectRefs: true,
      evidenceRef: true,
    },
  });

  let updatedClassificationCount = 0;
  let updatedExtractedFieldsCount = 0;
  let memoryEntryCount = 0;
  let memoryFactCount = 0;
  let opportunityProgressUpdatedCount = 0;
  const simulatedOpportunityState = new Map<
    string,
    {
      lastProgressAt: Date | null;
      nextStepSummary: string | null;
    }
  >();

  const workflowSignals: Array<{
    workspaceId: string;
    scope: DingTalkScope;
    sourceId: string;
    sourceType: string;
    label: string;
    summary: string;
    opportunityId: string | null;
    meetingId: string | null;
    companyId: string | null;
    objectLinkState: "matched" | "unmatched";
    objectLinkReason: string | null;
    extractedFields: {
      owner?: string | null;
      creator?: string | null;
      dept?: string | null;
      status?: string | null;
      priority?: string | null;
      time?: string | null;
    };
  }> = [];

  for (const record of records) {
    const scope = toScope(record.sourceScope);
    if (!scope) {
      continue;
    }
    const draft = safeParseJson(record.draftPayload);
    const payload = draft && typeof draft.payload === "object" && draft.payload
      ? (draft.payload as Record<string, unknown>)
      : {};

    const readString = (value: unknown) =>
      typeof value === "string" && value.trim() ? value.trim() : null;
    const extractedFields = {
      owner:
        readString(payload.owner) ??
        readString(payload.ownerName) ??
        readString(payload.owner_name),
      creator:
        readString(payload.creator) ??
        readString(payload.creator_name) ??
        readString(payload.creatorName),
      dept:
        readString(payload.dept_name) ??
        readString(payload.deptName) ??
        readString(payload.department_name) ??
        readString(payload.departmentName),
      status: readString(payload.status),
      priority: readString(payload.priority) ?? readString(payload.priority_name),
      time:
        readString(payload.startTime) ??
        readString(payload.start_time) ??
        readString(payload.create_time),
    };

    const classification = classifyDingTalkSignal({
      scope,
      sourceType: record.sourceType,
    });

    const nextDraft = {
      ...(draft ?? {}),
      payload,
      classification,
      extractedFields,
    };

    const hadClassification = Boolean(draft && "classification" in draft);
    const hadExtractedFields = Boolean(draft && "extractedFields" in draft);

    if (!options.dryRun && (!hadClassification || !hadExtractedFields)) {
      await db.connectorIngestionRecord.update({
        where: { id: record.id },
        data: {
          draftPayload: jsonStringify(nextDraft),
        },
      });
    }

    if (!hadClassification) {
      updatedClassificationCount += 1;
    }
    if (!hadExtractedFields) {
      updatedExtractedFieldsCount += 1;
    }

    const objectRefs = safeParseJson(record.objectRefs);
    const objectLinkReason =
      (objectRefs && typeof objectRefs.linkReason === "string"
        ? objectRefs.linkReason
        : null) ?? null;

    workflowSignals.push({
      workspaceId: record.workspaceId,
      scope,
      sourceId: record.sourceId,
      sourceType: record.sourceType,
      label: trimText(record.sourceSummary || `${scope} ${record.sourceType}`, 120),
      summary: trimText(record.sourceSummary || record.evidenceRef || record.sourceId, 480),
      opportunityId: record.opportunityId,
      meetingId: record.meetingId,
      companyId: record.companyId,
      objectLinkState:
        record.meetingId || record.opportunityId || record.companyId
          ? "matched"
          : "unmatched",
      objectLinkReason,
      extractedFields,
    });

    if (scope !== "WORK") {
      continue;
    }
    if (!record.opportunityId && !record.meetingId) {
      continue;
    }

    const parsed = parseReportPayload(payload, record.sourceId);
    const sourceKeyBase = `dingtalk-report:${parsed.reportId}`;
    const summaryText = trimText(
      [
        parsed.summary ?? record.sourceSummary,
        parsed.completed ? `本周完成：${parsed.completed}` : null,
        parsed.nextPlan ? `下周计划：${parsed.nextPlan}` : null,
        parsed.needHelp ? `需协调：${parsed.needHelp}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      1800,
    );

    if (record.meetingId) {
      const existingMeetingEntry = await db.memoryEntry.findFirst({
        where: {
          workspaceId: record.workspaceId,
          meetingId: record.meetingId,
          entityType: MemoryEntityType.MEETING,
          source: sourceKeyBase,
        },
        select: { id: true },
      });

      if (!existingMeetingEntry) {
        if (!options.dryRun) {
          await db.memoryEntry.create({
            data: {
              workspaceId: record.workspaceId,
              meetingId: record.meetingId,
              opportunityId: record.opportunityId ?? undefined,
              companyId: record.companyId ?? undefined,
              entityType: MemoryEntityType.MEETING,
              memoryType: MemoryType.SUMMARY,
              title: parsed.templateName ? `钉钉汇报：${parsed.templateName}` : "钉钉工作汇报摘要",
              content: summaryText,
              source: sourceKeyBase,
            },
          });
        }
        memoryEntryCount += 1;
      }

      const meetingFactSourceId = `${sourceKeyBase}:meeting:${record.meetingId}:summary`;
      const existingMeetingFact = await db.memoryFact.findFirst({
        where: {
          workspaceId: record.workspaceId,
          objectType: ObjectType.MEETING,
          objectId: record.meetingId,
          sourceType: SourceType.SYSTEM_INFERENCE,
          sourceId: meetingFactSourceId,
        },
        select: { id: true },
      });

      if (!existingMeetingFact) {
        if (!options.dryRun) {
          await db.memoryFact.create({
            data: {
              workspaceId: record.workspaceId,
              objectType: ObjectType.MEETING,
              objectId: record.meetingId,
              factType: MemoryFactType.SUMMARY,
              title: "钉钉工作汇报摘要信号",
              content: summaryText,
              sourceType: SourceType.SYSTEM_INFERENCE,
              sourceId: meetingFactSourceId,
              confidence: 75,
              importance: 70,
              freshnessScore: 75,
              status: MemoryStatus.OBSERVED,
              createdBySystem: true,
            },
          });
        }
        memoryFactCount += 1;
      }
    }

    if (record.opportunityId) {
      const existingOpportunityEntry = await db.memoryEntry.findFirst({
        where: {
          workspaceId: record.workspaceId,
          opportunityId: record.opportunityId,
          entityType: MemoryEntityType.OPPORTUNITY,
          source: sourceKeyBase,
        },
        select: { id: true },
      });

      if (!existingOpportunityEntry) {
        if (!options.dryRun) {
          await db.memoryEntry.create({
            data: {
              workspaceId: record.workspaceId,
              opportunityId: record.opportunityId,
              meetingId: record.meetingId ?? undefined,
              companyId: record.companyId ?? undefined,
              entityType: MemoryEntityType.OPPORTUNITY,
              memoryType: MemoryType.NEXT_STEP,
              title: "钉钉周报推进信号",
              content: summaryText,
              source: sourceKeyBase,
            },
          });
        }
        memoryEntryCount += 1;
      }

      const opportunitySummaryFactSourceId = `${sourceKeyBase}:opportunity:${record.opportunityId}:summary`;
      const existingOpportunitySummaryFact = await db.memoryFact.findFirst({
        where: {
          workspaceId: record.workspaceId,
          objectType: ObjectType.OPPORTUNITY,
          objectId: record.opportunityId,
          sourceType: SourceType.SYSTEM_INFERENCE,
          sourceId: opportunitySummaryFactSourceId,
        },
        select: { id: true },
      });

      if (!existingOpportunitySummaryFact) {
        if (!options.dryRun) {
          await db.memoryFact.create({
            data: {
              workspaceId: record.workspaceId,
              objectType: ObjectType.OPPORTUNITY,
              objectId: record.opportunityId,
              factType: MemoryFactType.SUMMARY,
              title: "钉钉工作汇报摘要信号",
              content: summaryText,
              sourceType: SourceType.SYSTEM_INFERENCE,
              sourceId: opportunitySummaryFactSourceId,
              confidence: 78,
              importance: 72,
              freshnessScore: 78,
              status: MemoryStatus.OBSERVED,
              createdBySystem: true,
            },
          });
        }
        memoryFactCount += 1;
      }

      if (parsed.nextPlan) {
        const nextStepFactSourceId = `${sourceKeyBase}:opportunity:${record.opportunityId}:next_step`;
        const existingNextStepFact = await db.memoryFact.findFirst({
          where: {
            workspaceId: record.workspaceId,
            objectType: ObjectType.OPPORTUNITY,
            objectId: record.opportunityId,
            sourceType: SourceType.SYSTEM_INFERENCE,
            sourceId: nextStepFactSourceId,
          },
          select: { id: true },
        });

        if (!existingNextStepFact) {
          if (!options.dryRun) {
            await db.memoryFact.create({
              data: {
                workspaceId: record.workspaceId,
                objectType: ObjectType.OPPORTUNITY,
                objectId: record.opportunityId,
                factType: MemoryFactType.NEXT_STEP,
                title: "钉钉周报下周计划",
                content: parsed.nextPlan,
                sourceType: SourceType.SYSTEM_INFERENCE,
                sourceId: nextStepFactSourceId,
                confidence: 80,
                importance: 80,
                freshnessScore: 80,
                status: MemoryStatus.ACTIVE,
                createdBySystem: true,
              },
            });
          }
          memoryFactCount += 1;
        }
      }

      const nextProgressAt = parsed.createdAtMs
        ? new Date(parsed.createdAtMs)
        : record.createdAt;
      const nextSummary = parsed.nextPlan
        ? trimText(`钉钉周报下一步：${parsed.nextPlan}`, 500)
        : null;
      let currentOpportunity:
        | {
            lastProgressAt: Date | null;
            nextStepSummary: string | null;
          }
        | null = simulatedOpportunityState.get(record.opportunityId) ?? null;
      if (currentOpportunity === null) {
        const persistedOpportunity = await db.opportunity.findUnique({
          where: { id: record.opportunityId },
          select: {
            lastProgressAt: true,
            nextStepSummary: true,
          },
        });
        currentOpportunity = persistedOpportunity
          ? {
              lastProgressAt: persistedOpportunity.lastProgressAt,
              nextStepSummary: persistedOpportunity.nextStepSummary ?? null,
            }
          : null;
      }
      const needsUpdate =
        currentOpportunity !== null &&
        ((currentOpportunity.lastProgressAt === null &&
          (nextSummary !== null || nextProgressAt.getTime() > 0)) ||
          (currentOpportunity.lastProgressAt !== null &&
            nextProgressAt.getTime() > currentOpportunity.lastProgressAt.getTime()) ||
          (currentOpportunity.lastProgressAt !== null &&
            nextProgressAt.getTime() === currentOpportunity.lastProgressAt.getTime() &&
            (currentOpportunity.nextStepSummary ?? null) !== nextSummary));
      if (needsUpdate) {
        if (!options.dryRun) {
          await db.opportunity.update({
            where: { id: record.opportunityId },
            data: {
              lastProgressAt: nextProgressAt,
              nextStepSummary: nextSummary,
            },
          });
        }
        simulatedOpportunityState.set(record.opportunityId, {
          lastProgressAt: nextProgressAt,
          nextStepSummary: nextSummary,
        });
        opportunityProgressUpdatedCount += 1;
      } else if (currentOpportunity !== null) {
        simulatedOpportunityState.set(record.opportunityId, currentOpportunity);
      }
    }
  }

  const bridgeByWorkspace = new Map<
    string,
    Array<{
      scope: DingTalkScope;
      sourceId: string;
      sourceType: string;
      label: string;
      summary: string;
      opportunityId: string | null;
      meetingId: string | null;
      companyId: string | null;
      objectLinkState: "matched" | "unmatched";
      objectLinkReason: string | null;
      extractedFields: {
        owner?: string | null;
        creator?: string | null;
        dept?: string | null;
        status?: string | null;
        priority?: string | null;
        time?: string | null;
      };
    }>
  >();

  for (const signal of workflowSignals) {
    const current = bridgeByWorkspace.get(signal.workspaceId) ?? [];
    current.push({
      scope: signal.scope,
      sourceId: signal.sourceId,
      sourceType: signal.sourceType,
      label: signal.label,
      summary: signal.summary,
      opportunityId: signal.opportunityId,
      meetingId: signal.meetingId,
      companyId: signal.companyId,
      objectLinkState: signal.objectLinkState,
      objectLinkReason: signal.objectLinkReason,
      extractedFields: signal.extractedFields,
    });
    bridgeByWorkspace.set(signal.workspaceId, current);
  }

  let bridgeRunCount = 0;
  let bridgeActionCreatedCount = 0;
  let bridgeApprovalEnqueuedCount = 0;
  let bridgeDedupSkippedCount = 0;

  if (options.createActions && !options.dryRun) {
    for (const [workspaceId, signals] of bridgeByWorkspace.entries()) {
      const bridgeResult = await bridgeDingTalkSignalsToWorkflow({
        workspaceId,
        actorName: "dingtalk-offline-backfill",
        actorUserId: null,
        english: false,
        sourcePage: "/scripts/dingtalk-backfill-from-ingestion",
        autoCreateActions: true,
        signals,
      });
      bridgeRunCount += 1;
      bridgeActionCreatedCount += bridgeResult.actionCreatedCount;
      bridgeApprovalEnqueuedCount += bridgeResult.approvalEnqueuedCount;
      bridgeDedupSkippedCount += bridgeResult.dedupSkippedCount;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: options.dryRun ? "dry-run" : "apply",
        workspace: options.workspaceId ?? "ALL",
        scannedRecordCount: records.length,
        updatedClassificationCount,
        updatedExtractedFieldsCount,
        memoryEntryCreatedCount: memoryEntryCount,
        memoryFactCreatedCount: memoryFactCount,
        opportunityProgressUpdatedCount,
        bridge: {
          enabled: options.createActions && !options.dryRun,
          workspaceRuns: bridgeRunCount,
          actionCreatedCount: bridgeActionCreatedCount,
          approvalEnqueuedCount: bridgeApprovalEnqueuedCount,
          dedupSkippedCount: bridgeDedupSkippedCount,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[dingtalk-backfill] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
