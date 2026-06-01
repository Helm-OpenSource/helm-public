import { PrismaClient, RiskLevel } from "@prisma/client";
import dotenv from "dotenv";

import { buildBiReportHandoffActionItemMetadata } from "../lib/bi-report-skill/action-item-closure";
import type {
  BiReportBusinessHandoffDecisionRecord,
  BiReportBusinessSignalRecord,
} from "../lib/bi-report-skill/types";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`));
    if (!hit) return undefined;
    return hit.slice(name.length + 3);
  };

  return {
    workspaceId: get("workspace-id"),
    dryRun: (get("dry-run") ?? "1") !== "0",
    take: Number(get("take") ?? "200"),
  };
}

function isValidJsonObject(value: string | null) {
  if (!value || value.trim() === "") return true;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object";
  } catch {
    return false;
  }
}

const prisma = new PrismaClient();

async function main() {
  const args = parseArgs();
  const workspaceId = args.workspaceId?.trim();
  if (!workspaceId) throw new Error("Missing --workspace-id.");

  const actionItems = await prisma.actionItem.findMany({
    where: { workspaceId, sourceId: { startsWith: "bi-report-handoff:" } },
    select: { id: true, sourceId: true, metadata: true },
    orderBy: { updatedAt: "desc" },
    take: args.take,
  });

  const broken = actionItems.filter((item) => !isValidJsonObject(item.metadata));
  const results = { scanned: actionItems.length, broken: broken.length, fixed: 0, skipped: 0 };

  for (const item of broken) {
    const decisionId = item.sourceId?.split("bi-report-handoff:")[1]?.trim();
    if (!decisionId) {
      results.skipped += 1;
      continue;
    }

    const decision = await prisma.biReportBusinessHandoffDecision.findFirst({
      where: { id: decisionId, workspaceId },
      include: { signal: true },
    });

    if (!decision?.signal) {
      results.skipped += 1;
      continue;
    }

    const riskLevel: RiskLevel = decision.targetType === "approval" ? RiskLevel.CRITICAL : RiskLevel.MEDIUM;
    const { metadata } = buildBiReportHandoffActionItemMetadata({
      signal: decision.signal as unknown as BiReportBusinessSignalRecord,
      decision: decision as unknown as BiReportBusinessHandoffDecisionRecord,
      sourceId: item.sourceId ?? `bi-report-handoff:${decision.id}`,
      handoffTargetType: decision.targetType,
      riskLevel,
    });

    if (!args.dryRun) {
      await prisma.actionItem.update({
        where: { id: item.id },
        data: { metadata: JSON.stringify(metadata) },
      });
    }

    results.fixed += 1;
  }

  console.log(
    JSON.stringify(
      {
        ...results,
        dryRun: args.dryRun,
        note:
          "Fixes ActionItem.metadata invalid JSON for bi-report-handoff approvals (often caused by DB column truncation).",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
