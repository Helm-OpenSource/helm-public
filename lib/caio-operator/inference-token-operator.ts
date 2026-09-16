import "server-only";

import { ActorType, MembershipStatus, WorkspaceRole } from "@prisma/client";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";
import { caioSourceIpSchema } from "@/lib/caio-access-gateway/token-contracts";
import { createCaioAccessTokenService } from "@/lib/caio-access-gateway/token-store.service";
import { createPrismaCaioAccessTokenPersistence } from "@/lib/caio-access-gateway/token-store.prisma";
import { db } from "@/lib/db";

import { ref } from "./schema-primitives";

/**
 * Controlled CLI entry for pull inference access material. A worker token is a credential, so it has no web
 * entry and no server action: an operator with database access issues it, hands it to the device once, and
 * revokes it here. The raw material is returned exactly once by issuance and is never stored, logged or
 * echoed by this module; only the caller's own console prints it.
 *
 * Nothing under app/, features/*\/actions or any "use server" module may import this file.
 */
export const CAIO_INFERENCE_TOKEN_OPERATIONS = ["issue", "revoke", "list"] as const;
export type CaioInferenceTokenOperation = (typeof CAIO_INFERENCE_TOKEN_OPERATIONS)[number];

export const CAIO_INFERENCE_TOKEN_ERROR_CODES = [
  "not_owner",
  "input_invalid",
  "token_conflict",
  "token_rejected",
  "unavailable",
] as const;
export type CaioInferenceTokenErrorCode = (typeof CAIO_INFERENCE_TOKEN_ERROR_CODES)[number];

export const issueInferenceTokenSchema = z.object({
  userRef: ref,
  deviceRef: ref,
  approvedSourceIp: caioSourceIpSchema,
}).strict();

export const revokeInferenceTokenSchema = z.object({ tokenId: ref }).strict();

export const listInferenceTokensSchema = z.object({}).strict();

export const CAIO_INFERENCE_TOKEN_TEMPLATES: Readonly<
  Record<CaioInferenceTokenOperation, Readonly<Record<string, unknown>>>
> = Object.freeze({
  issue: Object.freeze({
    userRef: "user:inference-worker",
    deviceRef: "device:replace-me",
    approvedSourceIp: "replace-with-the-device-source-ip",
  }),
  revoke: Object.freeze({ tokenId: "token-id" }),
  list: Object.freeze({}),
});

export type CaioInferenceTokenSummary = Readonly<{
  tokenId?: string;
  tokenPrefix?: string;
  status?: string;
  expiresAt?: string;
  alreadyRevoked?: boolean;
  tokens?: ReadonlyArray<
    Readonly<{
      tokenId: string;
      tokenPrefix: string;
      deviceRef: string;
      userRef: string;
      status: string;
      createdAt: string;
      expiresAt: string;
    }>
  >;
}>;

export type CaioInferenceTokenResult =
  | Readonly<{
      ok: true;
      applied: boolean;
      value: CaioInferenceTokenSummary;
      /** Present only on an applied issuance; the caller must hand it over once and never persist it. */
      rawToken?: string;
    }>
  | Readonly<{ ok: false; code: CaioInferenceTokenErrorCode }>;

const SCHEMAS: Readonly<Record<CaioInferenceTokenOperation, z.ZodTypeAny>> = Object.freeze({
  issue: issueInferenceTokenSchema,
  revoke: revokeInferenceTokenSchema,
  list: listInferenceTokensSchema,
});

export function isCaioInferenceTokenOperation(value: string): value is CaioInferenceTokenOperation {
  return (CAIO_INFERENCE_TOKEN_OPERATIONS as readonly string[]).includes(value);
}

export async function runCaioInferenceTokenOperation(args: {
  operation: CaioInferenceTokenOperation;
  workspaceId: string;
  actorUserId: string;
  rawInput: unknown;
  apply: boolean;
  now?: Date;
  client?: typeof db;
}): Promise<CaioInferenceTokenResult> {
  const client = args.client ?? db;
  const parsed = SCHEMAS[args.operation].safeParse(args.rawInput);
  if (!parsed.success) return { ok: false, code: "input_invalid" };

  const membership = await client.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: args.workspaceId, userId: args.actorUserId } },
    select: { role: true, status: true },
  });
  if (membership?.status !== MembershipStatus.ACTIVE || membership.role !== WorkspaceRole.OWNER) {
    return { ok: false, code: "not_owner" };
  }

  const now = args.now ?? new Date();
  const service = createCaioAccessTokenService({
    persistence: createPrismaCaioAccessTokenPersistence(client),
  });

  try {
    if (args.operation === "list") {
      const rows = await client.caioAccessToken.findMany({
        where: { workspaceId: args.workspaceId, audience: "inference" },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true, tokenPrefix: true, deviceRef: true, userRef: true, status: true,
          createdAt: true, expiresAt: true,
        },
      });
      return {
        ok: true,
        applied: false,
        value: {
          tokens: rows.map((row) => ({
            tokenId: row.id,
            tokenPrefix: row.tokenPrefix,
            deviceRef: row.deviceRef,
            userRef: row.userRef,
            status: row.status,
            createdAt: row.createdAt.toISOString(),
            expiresAt: row.expiresAt.toISOString(),
          })),
        },
      };
    }

    // Validation-only mode never touches the token store, so a dry run can never issue or revoke material.
    if (!args.apply) {
      return { ok: true, applied: false, value: {} };
    }

    if (args.operation === "issue") {
      const input = parsed.data as z.infer<typeof issueInferenceTokenSchema>;
      const issued = await service.issueCaioInferenceToken({
        workspaceId: args.workspaceId,
        userRef: input.userRef,
        deviceRef: input.deviceRef,
        approvedSourceIp: input.approvedSourceIp,
        now,
      });
      await writeAuditLog({
        workspaceId: args.workspaceId,
        userId: args.actorUserId,
        actor: args.actorUserId,
        actorType: ActorType.USER,
        actionType: "CAIO_INFERENCE_TOKEN_ISSUED",
        targetType: "CaioAccessToken",
        targetId: issued.record.id,
        summary: "CAIO pull inference access material issued for one device binding",
        // Metadata only: the raw material and its hash never enter the audit trail.
        payload: {
          audience: issued.record.audience,
          clientType: issued.record.clientType,
          deviceRef: issued.record.deviceRef,
          tokenPrefix: issued.record.tokenPrefix,
          expiresAt: issued.record.expiresAt.toISOString(),
        },
      });
      return {
        ok: true,
        applied: true,
        value: {
          tokenId: issued.record.id,
          tokenPrefix: issued.record.tokenPrefix,
          status: issued.record.status,
          expiresAt: issued.record.expiresAt.toISOString(),
        },
        rawToken: issued.rawToken,
      };
    }

    const input = parsed.data as z.infer<typeof revokeInferenceTokenSchema>;
    const existing = await client.caioAccessToken.findFirst({
      where: { id: input.tokenId, workspaceId: args.workspaceId, audience: "inference" },
      select: { id: true },
    });
    if (!existing) return { ok: false, code: "token_rejected" };
    const revoked = await service.revokeCaioToken({
      workspaceId: args.workspaceId,
      tokenId: input.tokenId,
      now,
    });
    await writeAuditLog({
      workspaceId: args.workspaceId,
      userId: args.actorUserId,
      actor: args.actorUserId,
      actorType: ActorType.USER,
      actionType: "CAIO_INFERENCE_TOKEN_REVOKED",
      targetType: "CaioAccessToken",
      targetId: revoked.tokenId,
      summary: "CAIO pull inference access material revoked",
      payload: { alreadyRevoked: revoked.alreadyRevoked },
    });
    return {
      ok: true,
      applied: true,
      value: { tokenId: revoked.tokenId, status: revoked.status, alreadyRevoked: revoked.alreadyRevoked },
    };
  } catch (error) {
    if (error instanceof CaioAccessGatewayError) {
      return { ok: false, code: error.code === "active_token_exists" ? "token_conflict" : "token_rejected" };
    }
    return { ok: false, code: "unavailable" };
  }
}

export function parseCaioInferenceTokenCliArgs(argv: readonly string[]):
  | Readonly<{ mode: "template"; operation: CaioInferenceTokenOperation }>
  | Readonly<{
      mode: "run";
      operation: CaioInferenceTokenOperation;
      workspaceId: string;
      actorUserId: string;
      inputFile: string | null;
      apply: boolean;
    }>
  | Readonly<{ mode: "invalid"; reason: string }> {
  const values = new Map<string, string>();
  let apply = false;
  for (const entry of argv) {
    if (entry === "--apply") {
      apply = true;
      continue;
    }
    const match = /^--([a-z-]+)=(.*)$/u.exec(entry);
    if (!match) return { mode: "invalid", reason: "unknown_argument" };
    values.set(match[1]!, match[2]!);
  }
  const template = values.get("template");
  if (template !== undefined) {
    if (!isCaioInferenceTokenOperation(template)) return { mode: "invalid", reason: "unknown_operation" };
    return { mode: "template", operation: template };
  }
  const operation = values.get("operation");
  if (operation === undefined || !isCaioInferenceTokenOperation(operation)) {
    return { mode: "invalid", reason: "unknown_operation" };
  }
  const workspaceId = values.get("workspace-id");
  const actorUserId = values.get("actor-user-id");
  if (!workspaceId || !actorUserId) return { mode: "invalid", reason: "workspace_and_actor_required" };
  const inputFile = values.get("input-file") ?? null;
  if (operation !== "list" && !inputFile) return { mode: "invalid", reason: "input_file_required" };
  return { mode: "run", operation, workspaceId, actorUserId, inputFile, apply };
}
