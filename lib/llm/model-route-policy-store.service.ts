import "server-only";

import {
  ActorType,
  MembershipStatus,
  Prisma,
  WorkspaceRole,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import {
  WORKSPACE_CAPABILITIES,
  workspaceRoleHasCapability,
} from "@/lib/auth/authorization";
import { assertWorkspacePolicyServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import {
  computeModelRoutePolicyApprovalReceiptHash,
  computeModelRoutePolicyApprovalReceiptRef,
  readinessReceiptMatchesRoute,
  validateModelRoutePolicyApprovalReceipt,
  validateProviderAdapterReadinessReceipt,
  validateTenantModelRoutePolicy,
  type ModelRoutePolicyApprovalReceipt,
  type ProviderAdapterReadinessReceipt,
  type TenantModelRoutePolicy,
} from "@/lib/llm/model-route-contracts";
import { jsonStringify, safeParseJson } from "@/lib/utils";

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

type ReadinessRow = Prisma.ProviderAdapterReadinessReceiptGetPayload<object>;
type PolicyRow = Prisma.TenantModelRoutePolicyGetPayload<object>;
type PolicyApprovalRow =
  Prisma.ModelRoutePolicyApprovalReceiptGetPayload<object>;

export const GOVERNED_MODEL_READINESS_AUTHORITY: unique symbol =
  Symbol("helm-governed-model-readiness/v1");
export type GovernedModelReadinessAuthority =
  typeof GOVERNED_MODEL_READINESS_AUTHORITY;

export class ModelRoutePolicyStoreError extends Error {
  readonly reasons: readonly string[];

  constructor(message: string, reasons: readonly string[] = []) {
    super(reasons.length > 0 ? `${message}: ${reasons.join("; ")}` : message);
    this.name = "ModelRoutePolicyStoreError";
    this.reasons = reasons;
  }
}

function nonEmpty(value: string, reason: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ModelRoutePolicyStoreError(reason);
  return normalized;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    jsonStringify(uniqueSorted(left)) ===
    jsonStringify(uniqueSorted(right))
  );
}

function parseStringArray(value: string): string[] | null {
  const parsed = safeParseJson<unknown>(value, null);
  return Array.isArray(parsed) &&
    parsed.every((item) => typeof item === "string")
    ? parsed
    : null;
}

async function assertPolicyAccess(input: {
  workspaceId: string;
  actorUserId: string;
  english?: boolean;
}): Promise<void> {
  nonEmpty(input.actorUserId, "signed_in_human_actor_required");
  await assertWorkspacePolicyServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });
}

async function assertPolicyAccessInTransaction(
  tx: Tx,
  input: {
    workspaceId: string;
    actorUserId: string;
  },
): Promise<void> {
  const membership = await tx.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
      },
    },
    select: {
      role: true,
      status: true,
    },
  });
  if (
    !membership ||
    membership.status !== MembershipStatus.ACTIVE ||
    !workspaceRoleHasCapability(
      membership.role,
      WORKSPACE_CAPABILITIES.MANAGE_POLICIES,
    )
  ) {
    throw new ModelRoutePolicyStoreError("workspace_policy_access_lost");
  }
}

async function assertOwnerApprovalAccessInTransaction(
  tx: Tx,
  input: {
    workspaceId: string;
    actorUserId: string;
  },
): Promise<void> {
  const membership = await tx.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
      },
    },
    select: {
      role: true,
      status: true,
    },
  });
  if (
    !membership ||
    membership.status !== MembershipStatus.ACTIVE ||
    membership.role !== WorkspaceRole.OWNER
  ) {
    throw new ModelRoutePolicyStoreError(
      "workspace_owner_approval_required",
    );
  }
}

export async function lockModelEgressWorkspace(
  tx: Tx,
  workspaceId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Workspace WHERE id = ${workspaceId} FOR UPDATE`;
  if (rows.length !== 1) {
    throw new ModelRoutePolicyStoreError("workspace_not_found");
  }
}

export function parseStoredProviderReadiness(
  row: ReadinessRow,
): ProviderAdapterReadinessReceipt {
  const receipt = safeParseJson<ProviderAdapterReadinessReceipt | null>(
    row.receiptJson,
    null,
  );
  const capabilityRefs = parseStringArray(row.capabilityRefs);
  const evidenceRefs = parseStringArray(row.evidenceRefs);
  if (!receipt || !capabilityRefs || !evidenceRefs) {
    throw new ModelRoutePolicyStoreError(
      "stored_readiness_receipt_json_invalid",
    );
  }
  const validation = validateProviderAdapterReadinessReceipt(receipt);
  if (!validation.valid) {
    throw new ModelRoutePolicyStoreError(
      "stored_readiness_receipt_invalid",
      validation.errors,
    );
  }
  if (
    receipt.receiptId !== row.id ||
    receipt.workspaceRef !== `workspace:${row.workspaceId}` ||
    receipt.provider !== row.provider ||
    receipt.modelId !== row.modelId ||
    receipt.modelVersion !== row.modelVersion ||
    receipt.adapterKey !== row.adapterKey ||
    receipt.adapterVersion !== row.adapterVersion ||
    receipt.adapterRegistrationRef !==
      row.adapterRegistrationRef ||
    receipt.adapterRegistrationHash !==
      row.adapterRegistrationHash ||
    receipt.deploymentForm.toUpperCase() !== row.deploymentForm ||
    receipt.jurisdiction.toUpperCase() !== row.jurisdiction ||
    receipt.region !== row.region ||
    receipt.endpointFingerprint !== row.endpointFingerprint ||
    receipt.credentialRef !== row.credentialRef ||
    receipt.adapterRegistered !== row.adapterRegistered ||
    receipt.credentialConfigured !==
      row.credentialConfigured ||
    receipt.modelProbeStatus.toUpperCase() !== row.modelProbeStatus ||
    !sameStrings(receipt.capabilityRefs, capabilityRefs) ||
    receipt.checkedAt !== row.checkedAt.toISOString() ||
    receipt.expiresAt !== row.expiresAt.toISOString() ||
    !sameStrings(receipt.evidenceRefs, evidenceRefs) ||
    receipt.rawCredentialIncluded !== row.rawCredentialIncluded ||
    receipt.contentHash !== row.contentHash
  ) {
    throw new ModelRoutePolicyStoreError(
      "stored_readiness_receipt_binding_invalid",
    );
  }
  return receipt;
}

export function parseStoredModelRoutePolicyApprovalReceipt(
  row: PolicyApprovalRow,
): ModelRoutePolicyApprovalReceipt {
  const receipt =
    safeParseJson<ModelRoutePolicyApprovalReceipt | null>(
      row.receiptJson,
      null,
    );
  if (!receipt) {
    throw new ModelRoutePolicyStoreError(
      "stored_policy_approval_receipt_json_invalid",
    );
  }
  const validation =
    validateModelRoutePolicyApprovalReceipt(receipt);
  if (!validation.valid) {
    throw new ModelRoutePolicyStoreError(
      "stored_policy_approval_receipt_invalid",
      validation.errors,
    );
  }
  if (
    receipt.receiptId !== row.id ||
    receipt.workspaceRef !==
      `workspace:${row.workspaceId}` ||
    receipt.policyRef !== row.policyId ||
    receipt.policyHash !== row.policyHash ||
    receipt.policyKey !== row.policyKey ||
    receipt.policyRevision !== row.policyRevision ||
    receipt.approvedByUserRef !==
      `user:${row.approvedByUserId}` ||
    receipt.expectedHeadVersion !==
      row.expectedHeadVersion ||
    receipt.approvedAt !== row.approvedAt.toISOString() ||
    receipt.contentHash !== row.contentHash
  ) {
    throw new ModelRoutePolicyStoreError(
      "stored_policy_approval_receipt_binding_invalid",
    );
  }
  return receipt;
}

export function parseStoredTenantModelRoutePolicy(
  row: PolicyRow,
): TenantModelRoutePolicy {
  const stored = safeParseJson<TenantModelRoutePolicy | null>(
    row.policyJson,
    null,
  );
  if (!stored) {
    throw new ModelRoutePolicyStoreError("stored_model_policy_json_invalid");
  }
  const policy: TenantModelRoutePolicy = {
    ...stored,
    status: row.status.toLowerCase() as TenantModelRoutePolicy["status"],
  };
  const validation = validateTenantModelRoutePolicy(policy);
  if (!validation.valid) {
    throw new ModelRoutePolicyStoreError(
      "stored_model_policy_invalid",
      validation.errors,
    );
  }
  if (
    policy.policyId !== row.id ||
    policy.workspaceRef !== `workspace:${row.workspaceId}` ||
    policy.policyKey !== row.policyKey ||
    policy.revision !== row.revision ||
    policy.validFrom !== row.validFrom.toISOString() ||
    policy.validUntil !== row.validUntil.toISOString() ||
    policy.approvalRef !== row.approvalRef ||
    policy.approvedByRef !== row.approvedByRef ||
    policy.createdAt !== row.createdAt.toISOString() ||
    policy.policyHash !== row.policyHash
  ) {
    throw new ModelRoutePolicyStoreError(
      "stored_model_policy_binding_invalid",
    );
  }
  return policy;
}

export async function recordProviderAdapterReadinessReceipt(input: {
  authority: GovernedModelReadinessAuthority;
  workspaceId: string;
  actorUserId: string;
  idempotencyKey: string;
  receipt: ProviderAdapterReadinessReceipt;
  english?: boolean;
}) {
  if (input.authority !== GOVERNED_MODEL_READINESS_AUTHORITY) {
    throw new ModelRoutePolicyStoreError(
      "governed_model_readiness_authority_required",
    );
  }
  await assertPolicyAccess(input);
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const validation = validateProviderAdapterReadinessReceipt(input.receipt);
  if (!validation.valid) {
    throw new ModelRoutePolicyStoreError(
      "readiness_receipt_invalid",
      validation.errors,
    );
  }
  if (input.receipt.workspaceRef !== `workspace:${input.workspaceId}`) {
    throw new ModelRoutePolicyStoreError("readiness_workspace_mismatch");
  }

  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockModelEgressWorkspace(tx, input.workspaceId);
        await assertPolicyAccessInTransaction(tx, input);
        const replay =
          await tx.providerAdapterReadinessReceipt.findUnique({
            where: {
              workspaceId_idempotencyKey: {
                workspaceId: input.workspaceId,
                idempotencyKey,
              },
            },
          });
        if (replay) {
          const receipt = parseStoredProviderReadiness(replay);
          if (
            receipt.receiptId !== input.receipt.receiptId ||
            receipt.contentHash !== input.receipt.contentHash
          ) {
            throw new ModelRoutePolicyStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          return { receipt, replayed: true };
        }
        const sameId =
          await tx.providerAdapterReadinessReceipt.findUnique({
            where: { id: input.receipt.receiptId },
          });
        if (sameId) {
          throw new ModelRoutePolicyStoreError(
            "readiness_receipt_id_conflict",
          );
        }
        await tx.providerAdapterReadinessReceipt.create({
          data: {
            id: input.receipt.receiptId,
            workspaceId: input.workspaceId,
            idempotencyKey,
            provider: input.receipt.provider,
            modelId: input.receipt.modelId,
            modelVersion: input.receipt.modelVersion,
            adapterKey: input.receipt.adapterKey,
            adapterVersion: input.receipt.adapterVersion,
            adapterRegistrationRef:
              input.receipt.adapterRegistrationRef,
            adapterRegistrationHash:
              input.receipt.adapterRegistrationHash,
            deploymentForm: input.receipt.deploymentForm.toUpperCase(),
            jurisdiction: input.receipt.jurisdiction.toUpperCase(),
            region: input.receipt.region,
            endpointFingerprint: input.receipt.endpointFingerprint,
            credentialRef: input.receipt.credentialRef,
            adapterRegistered: input.receipt.adapterRegistered,
            credentialConfigured:
              input.receipt.credentialConfigured,
            modelProbeStatus: input.receipt.modelProbeStatus.toUpperCase(),
            capabilityRefs: jsonStringify(input.receipt.capabilityRefs),
            checkedAt: new Date(input.receipt.checkedAt),
            expiresAt: new Date(input.receipt.expiresAt),
            evidenceRefs: jsonStringify(input.receipt.evidenceRefs),
            rawCredentialIncluded: false,
            receiptJson: jsonStringify(input.receipt),
            contentHash: input.receipt.contentHash,
          },
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            actor: input.actorUserId,
            actorType: ActorType.USER,
            actionType: "MODEL_ADAPTER_READINESS_RECORDED",
            targetType: "ProviderAdapterReadinessReceipt",
            targetId: input.receipt.receiptId,
            summary:
              "Recorded immutable provider adapter readiness evidence",
            payload: {
              provider: input.receipt.provider,
              modelId: input.receipt.modelId,
              modelVersion: input.receipt.modelVersion,
              region: input.receipt.region,
              contentHash: input.receipt.contentHash,
              rawCredentialIncluded: false,
            },
          },
          { client: tx },
        );
        return { receipt: input.receipt, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export async function createTenantModelRoutePolicyDraft(input: {
  workspaceId: string;
  actorUserId: string;
  policy: TenantModelRoutePolicy;
  english?: boolean;
}) {
  await assertPolicyAccess(input);
  const validation = validateTenantModelRoutePolicy(input.policy);
  if (!validation.valid) {
    throw new ModelRoutePolicyStoreError(
      "model_route_policy_invalid",
      validation.errors,
    );
  }
  if (
    input.policy.workspaceRef !== `workspace:${input.workspaceId}` ||
    input.policy.status !== "draft"
  ) {
    throw new ModelRoutePolicyStoreError(
      "new_model_route_policy_must_be_workspace_draft",
    );
  }

  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockModelEgressWorkspace(tx, input.workspaceId);
        await assertPolicyAccessInTransaction(tx, input);
        const replay = await tx.tenantModelRoutePolicy.findUnique({
          where: {
            workspaceId_policyKey_revision: {
              workspaceId: input.workspaceId,
              policyKey: input.policy.policyKey,
              revision: input.policy.revision,
            },
          },
        });
        if (replay) {
          const policy = parseStoredTenantModelRoutePolicy(replay);
          if (
            policy.policyId !== input.policy.policyId ||
            policy.policyHash !== input.policy.policyHash
          ) {
            throw new ModelRoutePolicyStoreError(
              "policy_revision_payload_conflict",
            );
          }
          return { policy, replayed: true };
        }
        const sameId = await tx.tenantModelRoutePolicy.findUnique({
          where: { id: input.policy.policyId },
        });
        if (sameId) {
          throw new ModelRoutePolicyStoreError("policy_id_conflict");
        }
        await tx.tenantModelRoutePolicy.create({
          data: {
            id: input.policy.policyId,
            workspaceId: input.workspaceId,
            policyKey: input.policy.policyKey,
            revision: input.policy.revision,
            status: "DRAFT",
            validFrom: new Date(input.policy.validFrom),
            validUntil: new Date(input.policy.validUntil),
            approvalRef: input.policy.approvalRef,
            approvedByRef: input.policy.approvedByRef,
            createdByUserId: input.actorUserId,
            policyJson: jsonStringify(input.policy),
            policyHash: input.policy.policyHash,
            createdAt: new Date(input.policy.createdAt),
          },
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            actor: input.actorUserId,
            actorType: ActorType.USER,
            actionType: "MODEL_ROUTE_POLICY_DRAFTED",
            targetType: "TenantModelRoutePolicy",
            targetId: input.policy.policyId,
            summary:
              "Created immutable tenant model route policy draft",
            payload: {
              policyKey: input.policy.policyKey,
              revision: input.policy.revision,
              policyHash: input.policy.policyHash,
              routeCount: input.policy.routes.length,
            },
          },
          { client: tx },
        );
        return { policy: input.policy, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

async function assertRouteReadinessAtActivation(input: {
  tx: Tx;
  workspaceId: string;
  policy: TenantModelRoutePolicy;
  now: Date;
}): Promise<void> {
  const receiptIds = uniqueSorted(
    input.policy.routes.map((route) => route.readinessReceiptRef),
  );
  const rows =
    await input.tx.providerAdapterReadinessReceipt.findMany({
      where: {
        workspaceId: input.workspaceId,
        id: { in: receiptIds },
      },
    });
  const byId = new Map(
    rows.map((row) => [row.id, parseStoredProviderReadiness(row)]),
  );
  const errors: string[] = [];
  for (const route of input.policy.routes) {
    const receipt = byId.get(route.readinessReceiptRef);
    if (!receipt) {
      errors.push(`readiness_missing:${route.routeId}`);
      continue;
    }
    const match = readinessReceiptMatchesRoute({
      receipt,
      route,
      now: input.now,
    });
    match.errors.forEach((reason) =>
      errors.push(`route:${route.routeId}:${reason}`),
    );
  }
  if (errors.length > 0) {
    throw new ModelRoutePolicyStoreError(
      "policy_route_readiness_invalid",
      errors,
    );
  }
}

function buildModelRoutePolicyApprovalReceipt(input: {
  policy: TenantModelRoutePolicy;
  actorUserId: string;
  expectedHeadVersion: number | null;
  approvedAt: Date;
}): ModelRoutePolicyApprovalReceipt {
  const approvedByUserRef = `user:${input.actorUserId}`;
  const expectedReceiptRef =
    computeModelRoutePolicyApprovalReceiptRef({
      workspaceRef: input.policy.workspaceRef,
      policyId: input.policy.policyId,
      policyKey: input.policy.policyKey,
      revision: input.policy.revision,
      approvedByRef: approvedByUserRef,
    });
  if (
    input.policy.approvedByRef !== approvedByUserRef ||
    input.policy.approvalRef !== expectedReceiptRef
  ) {
    throw new ModelRoutePolicyStoreError(
      "policy_owner_approval_binding_invalid",
    );
  }
  const candidate: ModelRoutePolicyApprovalReceipt = {
    schemaVersion:
      "helm.model-route-policy-approval-receipt/v1",
    receiptId: expectedReceiptRef,
    workspaceRef: input.policy.workspaceRef,
    policyRef: input.policy.policyId,
    policyHash: input.policy.policyHash,
    policyKey: input.policy.policyKey,
    policyRevision: input.policy.revision,
    approvedByUserRef,
    expectedHeadVersion: input.expectedHeadVersion,
    approvedAt: input.approvedAt.toISOString(),
    authorityEffect:
      "model_route_policy_activation_only",
    contentHash: "sha256:pending",
  };
  return {
    ...candidate,
    contentHash:
      computeModelRoutePolicyApprovalReceiptHash(candidate),
  };
}

export async function requireModelRoutePolicyOwnerApproval(
  tx: Tx,
  input: {
    workspaceId: string;
    policy: TenantModelRoutePolicy;
  },
): Promise<ModelRoutePolicyApprovalReceipt> {
  const row =
    await tx.modelRoutePolicyApprovalReceipt.findFirst({
      where: {
        id: input.policy.approvalRef,
        workspaceId: input.workspaceId,
        policyId: input.policy.policyId,
      },
    });
  if (!row) {
    throw new ModelRoutePolicyStoreError(
      "model_route_policy_owner_approval_missing",
    );
  }
  const receipt =
    parseStoredModelRoutePolicyApprovalReceipt(row);
  if (
    receipt.policyHash !== input.policy.policyHash ||
    receipt.policyKey !== input.policy.policyKey ||
    receipt.policyRevision !== input.policy.revision ||
    receipt.approvedByUserRef !==
      input.policy.approvedByRef
  ) {
    throw new ModelRoutePolicyStoreError(
      "model_route_policy_owner_approval_mismatch",
    );
  }
  return receipt;
}

export async function activateTenantModelRoutePolicy(input: {
  workspaceId: string;
  actorUserId: string;
  policyId: string;
  expectedHeadVersion: number | null;
  now?: Date;
  english?: boolean;
}) {
  await assertPolicyAccess(input);
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockModelEgressWorkspace(tx, input.workspaceId);
        await assertOwnerApprovalAccessInTransaction(tx, input);
        const row = await tx.tenantModelRoutePolicy.findFirst({
          where: {
            id: input.policyId,
            workspaceId: input.workspaceId,
          },
        });
        if (!row) throw new ModelRoutePolicyStoreError("policy_not_found");
        const policy = parseStoredTenantModelRoutePolicy(row);
        const head = await tx.tenantModelRoutePolicyHead.findUnique({
          where: {
            workspaceId_policyKey: {
              workspaceId: input.workspaceId,
              policyKey: policy.policyKey,
            },
          },
        });
        if (
          row.status === "ACTIVE" &&
          head?.activePolicyId === row.id
        ) {
          const approvalReceipt =
            await requireModelRoutePolicyOwnerApproval(tx, {
              workspaceId: input.workspaceId,
              policy,
            });
          return {
            policy,
            head,
            approvalReceipt,
            replayed: true,
          };
        }
        if (row.status !== "DRAFT") {
          throw new ModelRoutePolicyStoreError(
            "only_draft_policy_can_be_activated",
          );
        }
        if (
          row.validFrom.getTime() > now.getTime() ||
          row.validUntil.getTime() <= now.getTime()
        ) {
          throw new ModelRoutePolicyStoreError(
            "policy_outside_validity_window",
          );
        }
        if (
          (head?.version ?? null) !== input.expectedHeadVersion
        ) {
          throw new ModelRoutePolicyStoreError(
            "policy_head_version_conflict",
          );
        }
        await assertRouteReadinessAtActivation({
          tx,
          workspaceId: input.workspaceId,
          policy,
          now,
        });
        const approvalReceipt =
          buildModelRoutePolicyApprovalReceipt({
            policy,
            actorUserId: input.actorUserId,
            expectedHeadVersion: input.expectedHeadVersion,
            approvedAt: now,
          });
        const approvalValidation =
          validateModelRoutePolicyApprovalReceipt(
            approvalReceipt,
          );
        if (!approvalValidation.valid) {
          throw new ModelRoutePolicyStoreError(
            "computed_policy_approval_receipt_invalid",
            approvalValidation.errors,
          );
        }
        const existingApproval =
          await tx.modelRoutePolicyApprovalReceipt.findUnique({
            where: { policyId: row.id },
          });
        if (existingApproval) {
          throw new ModelRoutePolicyStoreError(
            "policy_approval_receipt_already_exists",
          );
        }
        await tx.modelRoutePolicyApprovalReceipt.create({
          data: {
            id: approvalReceipt.receiptId,
            workspaceId: input.workspaceId,
            policyId: row.id,
            policyHash: approvalReceipt.policyHash,
            policyKey: approvalReceipt.policyKey,
            policyRevision:
              approvalReceipt.policyRevision,
            approvedByUserId: input.actorUserId,
            expectedHeadVersion:
              approvalReceipt.expectedHeadVersion,
            approvedAt: now,
            receiptJson: jsonStringify(approvalReceipt),
            contentHash: approvalReceipt.contentHash,
          },
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            actor: input.actorUserId,
            actorType: ActorType.USER,
            actionType:
              "MODEL_ROUTE_POLICY_OWNER_APPROVAL_RECORDED",
            targetType:
              "ModelRoutePolicyApprovalReceipt",
            targetId: approvalReceipt.receiptId,
            summary:
              "Recorded owner-bound approval for an exact model route policy",
            payload: {
              policyId: policy.policyId,
              policyHash: policy.policyHash,
              policyKey: policy.policyKey,
              revision: policy.revision,
              expectedHeadVersion:
                approvalReceipt.expectedHeadVersion,
            },
          },
          { client: tx },
        );

        if (head && head.activePolicyId !== row.id) {
          await tx.tenantModelRoutePolicy.updateMany({
            where: {
              id: head.activePolicyId,
              workspaceId: input.workspaceId,
              status: "ACTIVE",
            },
            data: {
              status: "SUPERSEDED",
              supersededAt: now,
            },
          });
        }
        const activated = await tx.tenantModelRoutePolicy.updateMany({
          where: {
            id: row.id,
            workspaceId: input.workspaceId,
            status: "DRAFT",
          },
          data: {
            status: "ACTIVE",
            activatedAt: now,
          },
        });
        if (activated.count !== 1) {
          throw new ModelRoutePolicyStoreError(
            "policy_activation_concurrent_update",
          );
        }

        let nextHead;
        if (!head) {
          nextHead = await tx.tenantModelRoutePolicyHead.create({
            data: {
              workspaceId: input.workspaceId,
              policyKey: policy.policyKey,
              activePolicyId: row.id,
              version: 1,
              revocationEpoch: 0,
            },
          });
        } else {
          const updated =
            await tx.tenantModelRoutePolicyHead.updateMany({
              where: {
                id: head.id,
                workspaceId: input.workspaceId,
                activePolicyId: head.activePolicyId,
                version: head.version,
                revocationEpoch: head.revocationEpoch,
              },
              data: {
                activePolicyId: row.id,
                version: { increment: 1 },
              },
            });
          if (updated.count !== 1) {
            throw new ModelRoutePolicyStoreError(
              "policy_head_concurrent_update",
            );
          }
          nextHead =
            await tx.tenantModelRoutePolicyHead.findUniqueOrThrow({
              where: { id: head.id },
            });
        }
        const activeRow =
          await tx.tenantModelRoutePolicy.findUniqueOrThrow({
            where: { id: row.id },
          });
        const activePolicy =
          parseStoredTenantModelRoutePolicy(activeRow);
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            actor: input.actorUserId,
            actorType: ActorType.USER,
            actionType: "MODEL_ROUTE_POLICY_ACTIVATED",
            targetType: "TenantModelRoutePolicy",
            targetId: row.id,
            summary:
              "Activated tenant model route policy after readiness validation",
            payload: {
              policyKey: policy.policyKey,
              revision: policy.revision,
              policyHash: policy.policyHash,
              headVersion: nextHead.version,
              revocationEpoch: nextHead.revocationEpoch,
            },
          },
          { client: tx },
        );
        return {
          policy: activePolicy,
          head: nextHead,
          approvalReceipt,
          replayed: false,
        };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export async function revokeTenantModelRoutePolicy(input: {
  workspaceId: string;
  actorUserId: string;
  policyId: string;
  expectedHeadVersion: number;
  reason: string;
  now?: Date;
  english?: boolean;
}) {
  await assertPolicyAccess(input);
  const reason = nonEmpty(input.reason, "revocation_reason_required");
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockModelEgressWorkspace(tx, input.workspaceId);
        await assertPolicyAccessInTransaction(tx, input);
        const row = await tx.tenantModelRoutePolicy.findFirst({
          where: {
            id: input.policyId,
            workspaceId: input.workspaceId,
          },
        });
        if (!row) throw new ModelRoutePolicyStoreError("policy_not_found");
        const policy = parseStoredTenantModelRoutePolicy(row);
        const head = await tx.tenantModelRoutePolicyHead.findUnique({
          where: {
            workspaceId_policyKey: {
              workspaceId: input.workspaceId,
              policyKey: policy.policyKey,
            },
          },
        });
        if (
          row.status === "REVOKED" &&
          row.revokedByRef === input.actorUserId &&
          row.revocationReason === reason &&
          head?.activePolicyId === row.id
        ) {
          return { policy, head, replayed: true };
        }
        if (
          row.status !== "ACTIVE" ||
          !head ||
          head.activePolicyId !== row.id
        ) {
          throw new ModelRoutePolicyStoreError(
            "only_current_active_policy_can_be_revoked",
          );
        }
        if (head.version !== input.expectedHeadVersion) {
          throw new ModelRoutePolicyStoreError(
            "policy_head_version_conflict",
          );
        }
        const revoked = await tx.tenantModelRoutePolicy.updateMany({
          where: {
            id: row.id,
            workspaceId: input.workspaceId,
            status: "ACTIVE",
          },
          data: {
            status: "REVOKED",
            revokedAt: now,
            revokedByRef: input.actorUserId,
            revocationReason: reason,
          },
        });
        const advanced =
          await tx.tenantModelRoutePolicyHead.updateMany({
            where: {
              id: head.id,
              workspaceId: input.workspaceId,
              activePolicyId: row.id,
              version: head.version,
              revocationEpoch: head.revocationEpoch,
            },
            data: {
              version: { increment: 1 },
              revocationEpoch: { increment: 1 },
            },
          });
        if (revoked.count !== 1 || advanced.count !== 1) {
          throw new ModelRoutePolicyStoreError(
            "policy_revocation_concurrent_update",
          );
        }
        const revokedRow =
          await tx.tenantModelRoutePolicy.findUniqueOrThrow({
            where: { id: row.id },
          });
        const nextHead =
          await tx.tenantModelRoutePolicyHead.findUniqueOrThrow({
            where: { id: head.id },
          });
        const revokedPolicy =
          parseStoredTenantModelRoutePolicy(revokedRow);
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            actor: input.actorUserId,
            actorType: ActorType.USER,
            actionType: "MODEL_ROUTE_POLICY_REVOKED",
            targetType: "TenantModelRoutePolicy",
            targetId: row.id,
            summary:
              "Revoked tenant model route policy and advanced revocation epoch",
            payload: {
              policyKey: policy.policyKey,
              policyHash: policy.policyHash,
              headVersion: nextHead.version,
              revocationEpoch: nextHead.revocationEpoch,
              reason,
            },
          },
          { client: tx },
        );
        return {
          policy: revokedPolicy,
          head: nextHead,
          replayed: false,
        };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}
