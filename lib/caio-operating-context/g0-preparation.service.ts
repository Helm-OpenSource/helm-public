import "server-only";

import { randomUUID } from "node:crypto";

import {
  ActorType,
  ArtifactBundleStatus,
  MemoryFactType,
  MembershipStatus,
  ObjectType,
  SourceType,
  WorkspaceRole,
} from "@prisma/client";

import { assertWorkspacePolicyServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { CAIO_INITIALIZATION_ARTIFACT_TYPES } from "@/lib/stage1-owner-loop/caio-initialization-artifacts";
import { computeCaioInitializationMemoryFactHash } from "@/lib/stage1-owner-loop/caio-initialization-assessment-projector";
import {
  DataAssetCatalogConflictError,
  recordDataAssetInitializationReceipt,
} from "@/lib/stage1-owner-loop/data-asset-catalog.service";
import type { ObservationSensitivity } from "@/lib/stage1-owner-loop/types";
import { jsonStringify, safeParseJson } from "@/lib/utils";

import { buildCaioG0BaselineProjectionInput, type CaioContextRunRow } from "./context-builder";
import {
  buildCaioG0EvidenceTraceArtifacts,
  buildCaioG0MemoryRebuildReceiptArtifact,
  buildCaioG0SchemaMappingArtifact,
  buildCaioG0TemporalContextArtifact,
} from "./g0-artifacts";

/**
 * Prepares the CAIO G0 initialization inputs from live quick-check observation (owner decisions D-2/D-3,
 * 2026-09-16). For every connected, authorized catalog asset it takes the latest successful quick-check
 * run of its bound source and produces: evidence traces, a schema mapping, one system-generated company
 * memory fact (catalog and template metadata only, no customer records), a memory rebuild receipt, and a
 * baseline tenant live shadow temporal context. With apply it writes them and records each asset's
 * initialization receipt through the existing catalog service. Assessment and CEO acceptance stay on
 * their existing entry points. Validation only unless apply is set.
 */

const QUICK_CHECK_EXECUTION_PREFIX = "caio-quick-check:";
const EVIDENCE_TRACE_BUDGET = 50;
const G0_ARTIFACT_TYPES = Object.values(CAIO_INITIALIZATION_ARTIFACT_TYPES);

export type CaioG0PreparationResult =
  | {
      ok: true;
      summary: {
        assets: number;
        traces: number;
        memoryFacts: number;
        temporalContextRef: string | null;
        initializationReceipts: number;
        validated: boolean;
      };
    }
  | {
      ok: false;
      code: "not_owner" | "no_connected_assets" | "no_successful_run" | "context_build_rejected" | "catalog_conflict" | "unavailable";
      assetRefs?: string[];
    };

type PreparedAsset = {
  asset: {
    id: string; version: number; displayName: string; businessDomain: string; sourceKind: string; purpose: string;
    freshnessSlaMinutes: number; authorizationReceiptRef: string; connectionReceiptRef: string; catalogEntryId: string;
  };
  source: { id: string; sensitivity: string };
  run: { id: string; windowStart: Date; windowEnd: Date; observedAt: Date; summaryHash: string; status: string };
  observations: { templateId: string; sourceKey: string; domain: string; windowStart: Date; windowEnd: Date; observedAt: Date; contentHash: string; evidenceRef: string; valueKeys: string[] }[];
};

async function loadPreparedAssets(workspaceId: string): Promise<{ prepared: PreparedAsset[]; missing: string[]; connected: number }> {
  const assets = await db.dataAssetCatalogEntry.findMany({
    where: { workspaceId, connectionStatus: "CONNECTED", authorizationStatus: "AUTHORIZED" },
    orderBy: { id: "asc" },
  });
  const prepared: PreparedAsset[] = [];
  const missing: string[] = [];
  for (const asset of assets) {
    const source = await db.observationSource.findFirst({
      where: { workspaceId, catalogEntryId: asset.id, status: "ACTIVE" },
      select: { id: true, sensitivity: true },
      orderBy: { createdAt: "desc" },
    });
    const run = source
      ? await db.observationSourceRun.findFirst({
          where: { workspaceId, sourceId: source.id, status: "SUCCEEDED", executionKey: { startsWith: QUICK_CHECK_EXECUTION_PREFIX } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        })
      : null;
    const observations = run
      ? await db.caioMetricObservation.findMany({
          where: { workspaceId, observationRunId: run.id, status: "ok" },
          orderBy: { templateId: "asc" },
        })
      : [];
    const usable = observations.filter((row) => row.contentHash && row.evidenceRef);
    if (!source || !run || !run.observedAt || !run.summaryHash || usable.length === 0 || !asset.authorizationReceiptRef || !asset.connectionReceiptRef) {
      missing.push(asset.id);
      continue;
    }
    prepared.push({
      asset: {
        id: asset.id, version: asset.version, displayName: asset.displayName, businessDomain: asset.businessDomain,
        sourceKind: asset.sourceKind, purpose: asset.purpose, freshnessSlaMinutes: asset.freshnessSlaMinutes,
        authorizationReceiptRef: asset.authorizationReceiptRef, connectionReceiptRef: asset.connectionReceiptRef, catalogEntryId: asset.id,
      },
      source,
      run: { id: run.id, windowStart: run.windowStart, windowEnd: run.windowEnd, observedAt: run.observedAt, summaryHash: run.summaryHash, status: run.status },
      observations: usable.map((row) => ({
        templateId: row.templateId, sourceKey: row.sourceKey, domain: row.domain, windowStart: row.windowStart, windowEnd: row.windowEnd,
        observedAt: row.observedAt, contentHash: row.contentHash!, evidenceRef: row.evidenceRef!,
        valueKeys: Object.keys(safeParseJson<Record<string, unknown>>(row.valuesJson, {})).sort(),
      })),
    });
  }
  return { prepared, missing, connected: assets.length };
}

function memoryFactContent(item: PreparedAsset): { title: string; content: string } {
  const templates = item.observations.map((row) => `${row.templateId}（${row.valueKeys.join("、") || "无数值键"}）`).join("；");
  return {
    title: `CAIO 数据资产：${item.asset.displayName}`,
    content: [
      `业务域：${item.asset.businessDomain}`,
      `来源类型：${item.asset.sourceKind}`,
      `观察用途：${item.asset.purpose}`,
      `新鲜度 SLA：${item.asset.freshnessSlaMinutes} 分钟`,
      `快检模板与指标键：${templates}`,
      "本事实由 G0 准备命令依据数据资产目录与模板元数据生成，不含任何客户记录。",
    ].join("\n"),
  };
}

export async function prepareCaioG0FromLiveObservation(input: {
  workspaceId: string;
  actorUserId: string;
  actorName: string;
  apply: boolean;
  now?: Date;
}): Promise<CaioG0PreparationResult> {
  const now = input.now ?? new Date();
  const membership = await db.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.actorUserId } },
    select: { role: true, status: true },
  });
  if (!membership || membership.status !== MembershipStatus.ACTIVE || membership.role !== WorkspaceRole.OWNER) {
    return { ok: false, code: "not_owner" };
  }
  try {
    await assertWorkspacePolicyServiceAccess({ workspaceId: input.workspaceId, userId: input.actorUserId, actorType: ActorType.USER, english: false });
  } catch {
    return { ok: false, code: "not_owner" };
  }

  const { prepared, missing, connected } = await loadPreparedAssets(input.workspaceId);
  if (connected === 0) return { ok: false, code: "no_connected_assets" };
  if (missing.length > 0) return { ok: false, code: "no_successful_run", assetRefs: missing };

  const runs: CaioContextRunRow[] = prepared.map((item) => ({
    id: item.run.id, status: item.run.status, windowStart: item.run.windowStart, windowEnd: item.run.windowEnd,
    observedAt: item.run.observedAt, summaryHash: item.run.summaryHash, catalogEntryId: item.asset.catalogEntryId,
    authorizationReceiptId: item.asset.authorizationReceiptRef, connectionReceiptId: item.asset.connectionReceiptRef,
  }));
  const windowStart = new Date(Math.min(...prepared.map((item) => item.run.windowStart.getTime())));
  const baseline = buildCaioG0BaselineProjectionInput({
    workspaceId: input.workspaceId,
    asOf: now,
    windowStart,
    observations: prepared.flatMap((item) => item.observations.map((row) => ({ ...row, observationRunId: item.run.id }))),
    runs,
  });
  const contextArtifactId = `caio-g0-context-${randomUUID()}`;
  const temporal = baseline.ok
    ? buildCaioG0TemporalContextArtifact({ artifactId: contextArtifactId, workspaceId: input.workspaceId, projectionInput: baseline.input })
    : null;
  if (!temporal || !temporal.ok) return { ok: false, code: "context_build_rejected" };

  const perAssetTraceLimit = Math.max(1, Math.floor(EVIDENCE_TRACE_BUDGET / prepared.length));
  const plans = prepared.map((item) => {
    const initializationReceiptId = `caio-g0-init-${randomUUID()}`;
    return {
      item,
      initializationReceiptId,
      mappingArtifactId: `caio-g0-mapping-${randomUUID()}`,
      traces: buildCaioG0EvidenceTraceArtifacts({
        assetId: item.asset.id,
        sourceId: item.source.id,
        runId: item.run.id,
        authorizationReceiptRef: item.asset.authorizationReceiptRef,
        connectionReceiptRef: item.asset.connectionReceiptRef,
        initializationReceiptRef: initializationReceiptId,
        sensitivity: item.source.sensitivity.toLowerCase() as ObservationSensitivity,
        observations: item.observations.map((row) => ({ evidenceRef: row.evidenceRef, observedAt: row.observedAt })),
        limit: perAssetTraceLimit,
      }),
    };
  });
  const traceCount = plans.reduce((sum, plan) => sum + plan.traces.length, 0);

  if (!input.apply) {
    return {
      ok: true,
      summary: { assets: prepared.length, traces: traceCount, memoryFacts: prepared.length, temporalContextRef: null, initializationReceipts: 0, validated: true },
    };
  }

  try {
    const memoryRefs = await db.$transaction(async (tx) => {
      // Earlier G0 preparations are superseded: their traces would bind runs no longer in the receipts.
      await tx.artifactBundle.updateMany({
        where: {
          workspaceId: input.workspaceId,
          artifactType: { in: G0_ARTIFACT_TYPES },
          status: { in: [ArtifactBundleStatus.CONFIRMED, ArtifactBundleStatus.CONSUMED] },
        },
        data: { status: ArtifactBundleStatus.REJECTED },
      });
      const refs = new Map<string, { ref: string; contentHash: string }>();
      for (const plan of plans) {
        const { title, content } = memoryFactContent(plan.item);
        const fact = await tx.memoryFact.create({
          data: {
            workspaceId: input.workspaceId,
            objectType: ObjectType.COMPANY,
            objectId: `company:caio-g0-asset:${plan.item.asset.id}`,
            factType: MemoryFactType.SUMMARY,
            title,
            content,
            sourceType: SourceType.SYSTEM_INFERENCE,
            sourceId: plan.item.asset.id,
            confidence: 100,
            importance: 60,
            freshnessScore: 100,
            createdBySystem: true,
          },
        });
        refs.set(plan.item.asset.id, {
          ref: `memory-fact:${fact.id}`,
          contentHash: computeCaioInitializationMemoryFactHash({
            id: fact.id, objectType: String(fact.objectType), objectId: fact.objectId, factType: String(fact.factType),
            title: fact.title, content: fact.content, normalizedValue: fact.normalizedValue, sourceType: String(fact.sourceType),
            sourceId: fact.sourceId, confidence: fact.confidence, importance: fact.importance, freshnessScore: fact.freshnessScore,
            status: String(fact.status), confirmedByUser: fact.confirmedByUser, createdBySystem: fact.createdBySystem,
            createdAt: fact.createdAt.toISOString(), updatedAt: fact.updatedAt.toISOString(),
          }),
        });
      }
      const memoryArtifactId = `caio-g0-memory-${randomUUID()}`;
      const bundles = [
        {
          id: memoryArtifactId,
          artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.memoryRebuildReceipt,
          title: "CAIO G0 memory rebuild receipt",
          payload: buildCaioG0MemoryRebuildReceiptArtifact({ artifactId: memoryArtifactId, workspaceId: input.workspaceId, bindings: [...refs.values()], rebuiltAt: now }),
        },
        { id: contextArtifactId, artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.temporalContext, title: "CAIO G0 live baseline context", payload: temporal.artifact },
        ...plans.map((plan) => ({
          id: plan.mappingArtifactId,
          artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.schemaMapping,
          title: "CAIO G0 schema mapping",
          payload: buildCaioG0SchemaMappingArtifact({
            artifactId: plan.mappingArtifactId,
            assetId: plan.item.asset.id,
            generatedAt: now,
            templates: plan.item.observations.map((row) => ({ templateId: row.templateId, valueKeys: row.valueKeys })),
          }),
        })),
        ...plans.flatMap((plan) => plan.traces.map((trace) => ({
          id: `caio-g0-trace-${randomUUID()}`,
          artifactType: CAIO_INITIALIZATION_ARTIFACT_TYPES.evidenceTrace,
          title: "CAIO G0 evidence trace",
          payload: trace,
        }))),
      ];
      for (const bundle of bundles) {
        await tx.artifactBundle.create({
          data: {
            id: bundle.id,
            workspaceId: input.workspaceId,
            artifactType: bundle.artifactType,
            title: bundle.title,
            status: ArtifactBundleStatus.CONFIRMED,
            artifactsJson: jsonStringify(bundle.payload),
            systemOfRecordWrite: false,
          },
        });
      }
      return refs;
    });

    let initializationReceipts = 0;
    for (const plan of plans) {
      await recordDataAssetInitializationReceipt({
        workspaceId: input.workspaceId,
        assetId: plan.item.asset.id,
        receiptId: plan.initializationReceiptId,
        idempotencyKey: `caio-g0-prepare:${plan.initializationReceiptId}`,
        expectedVersion: plan.item.asset.version,
        initializationStatus: "initialized",
        connectionReceiptRef: plan.item.asset.connectionReceiptRef,
        observationRunRefs: [plan.item.run.id],
        schemaMappingRefs: [`artifact-bundle:${plan.mappingArtifactId}`],
        companyMemoryRefs: [memoryRefs.get(plan.item.asset.id)!.ref],
        temporalContextSnapshotRef: `artifact-bundle:${contextArtifactId}`,
        // Receipt reason codes become catalog blocker codes; a clean initialization carries none.
        reasonCodes: [],
        evidenceRefs: [`artifact-bundle:${contextArtifactId}`],
        actorName: input.actorName,
        actorUserId: input.actorUserId,
        now,
      });
      initializationReceipts += 1;
    }
    return {
      ok: true,
      summary: {
        assets: prepared.length, traces: traceCount, memoryFacts: memoryRefs.size,
        temporalContextRef: `artifact-bundle:${contextArtifactId}`, initializationReceipts, validated: true,
      },
    };
  } catch (error) {
    if (error instanceof DataAssetCatalogConflictError) return { ok: false, code: "catalog_conflict" };
    return { ok: false, code: "unavailable" };
  }
}
