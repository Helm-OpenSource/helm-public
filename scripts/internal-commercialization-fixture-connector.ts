#!/usr/bin/env tsx

import { ActorType } from "@prisma/client";
import { safeWriteAuditLog } from "@/lib/audit";
import { INTERNAL_COMMERCIALIZATION_FIXTURE_CONNECTOR_ID } from "@/lib/internal-commercialization/contract";
import { runInternalCommercializationFixtureConnector } from "@/lib/internal-commercialization/fixture-connector";
import { resolveHelmReservedWorkspace } from "@/lib/workspace-reserved";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const allowedArgs = new Set(["--apply"]);

async function main() {
  const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg));
  if (unknownArgs.length > 0) {
    throw new Error(
      `Unknown internal commercialization fixture connector arg(s): ${unknownArgs.join(", ")}`,
    );
  }

  const workspace = await resolveHelmReservedWorkspace();
  if (!workspace) {
    throw new Error("Helm reserved workspace is not available.");
  }

  if (apply && process.env.HELM_INTERNAL_COMMERCIALIZATION_APPLY !== "1") {
    throw new Error(
      "Refusing to apply internal commercialization fixture connector without HELM_INTERNAL_COMMERCIALIZATION_APPLY=1.",
    );
  }

  const result = await runInternalCommercializationFixtureConnector({
    workspaceId: workspace.id,
    dryRun: !apply,
  });

  if (apply) {
    await safeWriteAuditLog({
      workspaceId: workspace.id,
      actor: "system",
      actorType: ActorType.SYSTEM,
      actionType: "INTERNAL_COMMERCIALIZATION_FIXTURE_IMPORTED",
      targetType: "InternalCommercializationRun",
      targetId: INTERNAL_COMMERCIALIZATION_FIXTURE_CONNECTOR_ID,
      summary: "Imported alias-only internal commercialization lifecycle runs via gated CLI",
      payload: {
        connectorId: result.connectorId,
        importedCount: result.importedCount,
        candidateCount: result.candidateCount,
        dryRun: result.dryRun,
      },
      sourcePage: "scripts/internal-commercialization-fixture-connector.ts",
    });
  }

  console.log(
    JSON.stringify(
      {
        connectorId: result.connectorId,
        dryRun: result.dryRun,
        importedCount: result.importedCount,
        candidateCount: result.candidateCount,
        workspaceId: workspace.id,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
