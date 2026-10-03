import "server-only";

import type { PrismaClient } from "@prisma/client";
import {
  installReviewedOrdinaryPaidComposition,
} from "@/lib/llm/ordinary-paid-composition.service";
import {
  type OrdinaryPaidPayload,
  type OrdinaryPaidOutput,
} from "@/lib/llm/ordinary-paid-adapter-bridge.service";
import {
  createGovernedModelGatewayForChargeClient,
} from "@/lib/llm/governed-model-gateway.service";
import type { GovernedSpendAuthority } from "@/lib/llm/model-egress-store.service";

/** A private deployment must review and supply every port. Core has no
 * production price/FX issuer, adapter registration, projection issuer or
 * terminal usage attestor, so it never calls this bootstrap by default. */
export async function installOrdinaryPaidServerBootstrap(input: {
  operationWriterClient: PrismaClient;
  chargeClient: PrismaClient;
  policyKey: string;
  spendAuthority: GovernedSpendAuthority;
  adapters: NonNullable<Parameters<
    typeof createGovernedModelGatewayForChargeClient<OrdinaryPaidPayload, OrdinaryPaidOutput>
  >[0]["adapters"]>;
  issueProjection: (input: { workspaceId: string; operationId: string;
    projectedPayload: OrdinaryPaidPayload; projectedPayloadHash: string;
  }) => Promise<string>;
}) {
  const charge = input.chargeClient;
  const gateway = createGovernedModelGatewayForChargeClient<OrdinaryPaidPayload, OrdinaryPaidOutput>({
    client: charge,
    spendAuthority: input.spendAuthority,
    adapters: input.adapters,
  });
  await installReviewedOrdinaryPaidComposition({
    operationWriterClient: input.operationWriterClient,
    chargeClient: charge,
    policyKey: input.policyKey,
    gateway,
    issueProjection: input.issueProjection,
  });
}
