import "server-only";

import type { PrismaClient } from "@prisma/client";
import type { OrdinaryPaidPayload, OrdinaryPaidOutput } from "@/lib/llm/ordinary-paid-adapter-bridge.service";
import type { GovernedModelGatewayInput, GovernedModelGatewayResult } from "@/lib/llm/governed-model-gateway.service";

type ReviewedComposition = Readonly<{
  operationWriterClient: PrismaClient;
  chargeClient: PrismaClient;
  policyKey: string;
  gateway: (request: GovernedModelGatewayInput<OrdinaryPaidPayload>) =>
    Promise<GovernedModelGatewayResult<OrdinaryPaidOutput>>;
  issueProjection: (input: { workspaceId: string; operationId: string;
    projectedPayload: OrdinaryPaidPayload; projectedPayloadHash: string;
  }) => Promise<string>;
}>;

let installed: ReviewedComposition | null = null;

/**
 * The public Core has no production writer, price/FX issuer, adapter or usage
 * attestor. A deployment's reviewed server bootstrap may install these ports
 * once; no task input, CLI flag or environment amount can select either DB
 * identity. Both must resolve to the same deployment database under distinct
 * principals. Grants remain the database's responsibility.
 */
export async function installReviewedOrdinaryPaidComposition(input: ReviewedComposition) {
  if (installed || input.operationWriterClient === input.chargeClient) {
    throw new Error("ordinary_paid_composition_ambiguous");
  }
  const [writer] = await input.operationWriterClient.$queryRaw<
    Array<{ databaseName: string | null; principal: string; serverUuid: string }>
  >`SELECT DATABASE() AS databaseName, CURRENT_USER() AS principal, @@server_uuid AS serverUuid`;
  const [charge] = await input.chargeClient.$queryRaw<
    Array<{ databaseName: string | null; principal: string; serverUuid: string }>
  >`SELECT DATABASE() AS databaseName, CURRENT_USER() AS principal, @@server_uuid AS serverUuid`;
  if (!writer?.databaseName || writer.databaseName !== charge?.databaseName ||
      !writer.serverUuid || writer.serverUuid !== charge.serverUuid ||
      !writer.principal || !charge.principal || writer.principal === charge.principal) {
    throw new Error("ordinary_paid_composition_realm_invalid");
  }
  // Two installers may have passed the preflight concurrently while their DB
  // reads were pending. No await occurs between this check and assignment.
  if (installed) throw new Error("ordinary_paid_composition_ambiguous");
  installed = Object.freeze({ ...input });
}

export function ordinaryPaidWriterClient(): PrismaClient | null {
  return installed?.operationWriterClient ?? null;
}

export function reviewedOrdinaryPaidComposition(): ReviewedComposition | null {
  return installed;
}
