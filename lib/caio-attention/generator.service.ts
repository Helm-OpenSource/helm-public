import "server-only";

import { MembershipStatus, Prisma, type PrismaClient } from "@prisma/client";

import { db } from "@/lib/db";
import { isWriteConflictError, runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";

import { evaluateCaioAttentionSuggestEligibility, type CaioAttentionEvaluationRecord, type CaioAttentionSuggestBlock } from "./consecutive-buckets";
import {
  CAIO_ATTENTION_SEVERITIES, parseCaioAttentionEnterpriseSuffix, parseCaioAttentionRouteConfig,
  type CaioAttentionRouteConfig, type CaioAttentionRouteRule, type CaioAttentionSeverity,
} from "./contracts";
import { planCaioAttentionGeneration } from "./generator-plan";
import { readCaioAttentionIntakeGate } from "./intake-gate.service";
import {
  findCaioAttentionRouteRule, getRegisteredCaioAttentionPack, resolveCaioAttentionEnterpriseScope, type CaioAttentionPack,
} from "./registry";
import { resolveCaioAttentionPrefill, type CaioAttentionEnterpriseScope } from "./routing";
import { caioAttentionSuggestFields, suggestCaioAttentionCommittedDueAt } from "./schedule";

/**
 * Attention suggestion generator (design v4 §4, v6 §1.4). Runs on the quick-check host after a tick completes; its
 * failure never changes the tick. It only writes SUGGESTED cases and their append-only events: no notification,
 * no dispatch, no update of an existing case. Per OPEN candidate, one SERIALIZABLE transaction takes the locks in
 * the design order — Control FOR SHARE (entry gate), candidate FOR UPDATE (serialises against the next tick's
 * clear and against a second generator), then reads cases and inserts. Unique keys (originCandidateId,
 * workspaceId+activeKey, workspaceId+shortNo, event keys) back the plan; a duplicate or conflict retries.
 */

const ROUTED_SEVERITIES: readonly string[] = CAIO_ATTENTION_SEVERITIES;
const TRANSACTION_OPTIONS = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 } as const;

type Client = Pick<PrismaClient, "$transaction" | "caioAnomalyCandidate" | "caioAttentionRouteConfigHead" | "caioAttentionRouteConfig" | "membership">;

export type CaioAttentionGeneratorSkip = CaioAttentionSuggestBlock | "candidate_not_open" | "already_attached" | "candidate_consumed" | "failed";
export type CaioAttentionGeneratorResult =
  | { status: "not_configured" }
  | { status: "completed" | "intake_closed"; created: number; recurred: number; severityRaised: number; skipped: Partial<Record<CaioAttentionGeneratorSkip, number>> };

type Context = Readonly<{
  workspaceId: string; tickId: string; latestBucketStart: Date; bucketMinutes: number; now: Date; pack: CaioAttentionPack;
  config: CaioAttentionRouteConfig | null; configVersion: number | null; isActive: (userId: string) => boolean;
}>;
type Target = Readonly<{ id: string; rule: CaioAttentionRouteRule; slug: string | null; scope: CaioAttentionEnterpriseScope }>;
type Outcome = { kind: "intake_closed" } | { kind: "skip"; reason: CaioAttentionGeneratorSkip } | { kind: "created" } | { kind: "attached"; recur: boolean; raise: boolean };

const isRetryable = (error: unknown) =>
  (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") || isWriteConflictError(error);

function parseJson(json: string | null | undefined): unknown {
  try { return json ? JSON.parse(json) : null; } catch { return null; }
}
const parseMergeKeys = (json: string) => { const value = parseJson(json); return Array.isArray(value) ? value.filter((key) => typeof key === "string") : []; };

async function loadRouteConfig(client: Client, workspaceId: string) {
  const head = await client.caioAttentionRouteConfigHead.findUnique({ where: { workspaceId }, select: { activeVersion: true } });
  if (!head) return { config: null, configVersion: null };
  const where = { workspaceId_version: { workspaceId, version: head.activeVersion } };
  const row = await client.caioAttentionRouteConfig.findUnique({ where, select: { configJson: true } });
  const parsed = parseCaioAttentionRouteConfig(parseJson(row?.configJson));
  return { config: parsed.ok ? parsed.config : null, configVersion: head.activeVersion };
}

async function processCandidate(client: Client, ctx: Context, target: Target): Promise<Outcome> {
  return client.$transaction(async (tx) => {
    if (!(await readCaioAttentionIntakeGate(tx)).open) return { kind: "intake_closed" };
    const [candidate] = await tx.$queryRaw<Array<{
      id: string; detectorId: string; mergeKey: string; objectKey: string; severity: string; reasonCode: string; status: string; lastSeenAt: Date;
    }>>`SELECT id, detectorId, mergeKey, objectKey, severity, reasonCode, status, lastSeenAt FROM CaioAnomalyCandidate
      WHERE id = ${target.id} AND workspaceId = ${ctx.workspaceId} FOR UPDATE`;
    if (candidate?.status !== "OPEN" || !ROUTED_SEVERITIES.includes(candidate.severity)) return { kind: "skip", reason: "candidate_not_open" };
    const severity = candidate.severity as CaioAttentionSeverity;
    const [{ rule }, { pack }] = [target, ctx];
    const bucketMs = ctx.bucketMinutes * 60_000;
    const evaluations = await tx.caioDetectorEvaluation.findMany({
      where: {
        workspaceId: ctx.workspaceId, detectorId: candidate.detectorId,
        bucketStart: { gte: new Date(ctx.latestBucketStart.getTime() - (pack.policy.consecutiveBuckets[severity] - 1) * bucketMs), lte: ctx.latestBucketStart },
      },
      select: { bucketStart: true, outcome: true, ruleVersion: true, hitMergeKeysJson: true },
    });
    const eligibility = evaluateCaioAttentionSuggestEligibility({
      intakeOpen: true,
      applicable: pack.applicableAt?.({ detectorId: candidate.detectorId, reasonCode: candidate.reasonCode, now: ctx.now }) ?? true,
      severity, mergeKey: candidate.mergeKey, candidateLastSeenAt: candidate.lastSeenAt, latestBucketStart: ctx.latestBucketStart,
      bucketMinutes: ctx.bucketMinutes, compatibleRuleVersions: rule.compatibleRuleVersions, now: ctx.now, policy: pack.policy,
      evaluations: evaluations.map((row) => ({
        bucketStart: row.bucketStart, outcome: row.outcome as CaioAttentionEvaluationRecord["outcome"], ruleVersion: row.ruleVersion, hitMergeKeys: parseMergeKeys(row.hitMergeKeysJson),
      })),
    });
    if (!eligibility.ok) return { kind: "skip", reason: eligibility.reason };

    const activeKey = `${candidate.detectorId}:${candidate.mergeKey}`;
    const live = await tx.caioAttentionCase.findFirst({
      where: { workspaceId: ctx.workspaceId, activeKey }, select: { id: true, originCandidateId: true, effectiveSeverity: true },
    });
    const eventExists = async (where: Prisma.CaioAttentionCaseEventWhereInput) =>
      (await tx.caioAttentionCaseEvent.findFirst({ where, select: { id: true } })) !== null;
    const plan = planCaioAttentionGeneration({
      candidateId: candidate.id, severity,
      liveCase: live && {
        ...live,
        candidateRecurred: await eventExists({ caseId: live.id, kind: "RECURRED", candidateId: candidate.id }),
        severityRaisePending: await eventExists({ caseId: live.id, kind: "SEVERITY_RAISED", dedupeKey: "critical" }),
      },
      candidateConsumed: !live && (
        (await tx.caioAttentionCase.findUnique({ where: { originCandidateId: candidate.id }, select: { id: true } })) !== null
        || await eventExists({ kind: "RECURRED", candidateId: candidate.id })),
    });
    if (plan.kind === "skip") return { kind: "skip", reason: plan.reason };
    const signal = { severity, mergeKey: candidate.mergeKey, objectKey: candidate.objectKey, tickId: ctx.tickId, bucketStart: ctx.latestBucketStart };
    if (plan.kind === "attach") {
      if (plan.recur) {
        await tx.caioAttentionCaseEvent.create({ data: { caseId: plan.caseId, kind: "RECURRED", candidateId: candidate.id, payloadJson: JSON.stringify(signal) } });
      }
      if (plan.raise) {
        await tx.caioAttentionCaseEvent.create({ data: {
          caseId: plan.caseId, kind: "SEVERITY_RAISED", dedupeKey: "critical",
          payloadJson: JSON.stringify({ ...signal, from: "warning", candidateId: candidate.id, raisedAt: ctx.now }),
        } });
      }
      return { kind: "attached", recur: plan.recur, raise: plan.raise };
    }

    const prefill = resolveCaioAttentionPrefill({
      rule, config: ctx.config, enterpriseSlug: target.slug, enterpriseScope: target.scope, isActive: ctx.isActive,
    });
    const suggestedDueAt = suggestCaioAttentionCommittedDueAt(severity, ctx.now, rule.committedDue, pack.policy);
    const last = await tx.caioAttentionCase.findFirst({ where: { workspaceId: ctx.workspaceId }, orderBy: { shortNo: "desc" }, select: { shortNo: true } });
    const previous = await tx.caioAttentionCase.findFirst({
      where: { workspaceId: ctx.workspaceId, detectorId: candidate.detectorId, mergeKey: candidate.mergeKey },
      orderBy: { createdAt: "desc" }, select: { id: true },
    });
    const created = await tx.caioAttentionCase.create({
      data: {
        workspaceId: ctx.workspaceId, shortNo: (last?.shortNo ?? 0) + 1, detectorId: candidate.detectorId, mergeKey: candidate.mergeKey,
        objectKey: candidate.objectKey, enterpriseSlug: target.slug, category: rule.category, originCandidateId: candidate.id, activeKey,
        previousCaseId: previous?.id ?? null, routeConfigVersion: ctx.configVersion, routingBlocked: prefill.blocks.length > 0,
        routingBlockedReasonsJson: prefill.blocks.length > 0 ? JSON.stringify(prefill.blocks) : null, status: "SUGGESTED",
        primaryUserId: prefill.primaryUserId, ccUserIdsJson: JSON.stringify(prefill.ccUserIds), escalationUserId: prefill.escalationUserId,
        reviewerSuggestedUserId: prefill.reviewerUserIds[0] ?? null, reviewerUserIdsJson: JSON.stringify(prefill.reviewerUserIds),
        severityAtSuggest: severity, effectiveSeverity: severity, reminderPolicy: severity, ...caioAttentionSuggestFields(severity, ctx.now),
      },
      select: { id: true },
    });
    await tx.caioAttentionCaseEvent.create({ data: {
      caseId: created.id, kind: "SUGGESTED", candidateId: candidate.id,
      payloadJson: JSON.stringify({
        ...signal, routeConfigVersion: ctx.configVersion, compatibleRuleVersions: rule.compatibleRuleVersions,
        prefill: { primaryUserId: prefill.primaryUserId, ccUserIds: prefill.ccUserIds, escalationUserId: prefill.escalationUserId,
          reviewerUserIds: prefill.reviewerUserIds, suggestedDueAt },
        blocks: prefill.blocks, notes: prefill.notes,
      }),
    } });
    return { kind: "created" };
  }, TRANSACTION_OPTIONS);
}

export async function runCaioAttentionGenerator(input: Readonly<{
  workspaceId: string; tickId: string; latestBucketStart: Date; bucketMinutes: number; now: Date; client?: Client;
}>): Promise<CaioAttentionGeneratorResult> {
  const pack = getRegisteredCaioAttentionPack();
  if (!pack) return { status: "not_configured" };
  const client = input.client ?? db;
  const counts = { created: 0, recurred: 0, severityRaised: 0, skipped: {} as Partial<Record<CaioAttentionGeneratorSkip, number>> };
  const skip = (reason: CaioAttentionGeneratorSkip) => { counts.skipped[reason] = (counts.skipped[reason] ?? 0) + 1; };

  const open = await client.caioAnomalyCandidate.findMany({
    where: { workspaceId: input.workspaceId, status: "OPEN", severity: { in: [...ROUTED_SEVERITIES] } },
    orderBy: [{ firstSeenAt: "asc" }, { id: "asc" }], select: { id: true, detectorId: true, reasonCode: true, mergeKey: true },
  });
  const targets: Target[] = [];
  for (const candidate of open) {
    // Detectors without a route rule are not monitored for attention at all.
    const rule = findCaioAttentionRouteRule(pack.rules, candidate.detectorId, candidate.reasonCode);
    if (!rule) continue;
    const slug = parseCaioAttentionEnterpriseSuffix(candidate.mergeKey)?.slug ?? null;
    // The overlay hook runs here, outside any transaction, so no row lock is held across tenant code.
    targets.push({ id: candidate.id, rule, slug, scope: await resolveCaioAttentionEnterpriseScope(pack, input.workspaceId, slug) });
  }
  if (targets.length === 0) return { status: "completed", ...counts };

  const { config, configVersion } = await loadRouteConfig(client, input.workspaceId);
  const boundIds = config ? [...new Set([config.roleBindings, ...Object.values(config.enterpriseOverrides)].flatMap((b) => Object.values(b).flat()))] : [];
  const active = new Set((boundIds.length === 0 ? [] : await client.membership.findMany({
    where: { workspaceId: input.workspaceId, status: MembershipStatus.ACTIVE, userId: { in: boundIds } }, select: { userId: true },
  })).map((row) => row.userId));
  const ctx: Context = { ...input, pack, config, configVersion, isActive: (userId) => active.has(userId) };

  for (const target of targets) {
    let outcome: Outcome;
    try {
      outcome = await runWithWriteConflictRetry(() => processCandidate(client, ctx, target), { maxAttempts: 4, retryDelayMs: 50, isConflict: isRetryable });
    } catch {
      // One bad candidate never blocks the others; the watchdog sees it stay unattached.
      skip("failed");
      continue;
    }
    if (outcome.kind === "intake_closed") return { status: "intake_closed", ...counts };
    if (outcome.kind === "skip") skip(outcome.reason);
    if (outcome.kind === "created") counts.created += 1;
    if (outcome.kind === "attached") { counts.recurred += Number(outcome.recur); counts.severityRaised += Number(outcome.raise); }
  }
  return { status: "completed", ...counts };
}
