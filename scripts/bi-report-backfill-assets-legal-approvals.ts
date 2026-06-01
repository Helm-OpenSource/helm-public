import { db } from "@/lib/db";
import { materializeAcceptedBiReportHandoff } from "@/lib/bi-report-skill/handoff-action";
import {
  createBiReportBusinessHandoffDecision,
  listBiReportBusinessHandoffDecisions,
} from "@/lib/bi-report-skill/handoff-decision";
import { mapBiReportBusinessSignalRow } from "@/lib/bi-report-skill/business-signal";

async function main() {
  const workspaceId = process.env.WORKSPACE_ID?.trim() || "";
  if (!workspaceId) {
    throw new Error("missing WORKSPACE_ID");
  }

  const take = Number(process.env.TAKE ?? 5) || 5;

  const signals = await db.biReportBusinessSignal.findMany({
    where: {
      workspaceId,
      signalType: "assets_legal_funnel_risk",
      status: { in: ["open", "triaged", "actioned"] },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  let upgraded = 0;
  let materialized = 0;

  for (const row of signals) {
    if (row.severity !== "CRITICAL") {
      await db.biReportBusinessSignal.update({
        where: { id: row.id },
        data: { severity: "CRITICAL" },
      });
      upgraded += 1;
    }

    const signal = {
      ...mapBiReportBusinessSignalRow(row as never),
      severity: "CRITICAL" as const,
    };

    const existingAcceptedDecision = (
      await listBiReportBusinessHandoffDecisions({
        workspaceId,
        signalId: signal.id,
        take: 20,
      })
    ).find((decision) => decision.targetType === "approval" && decision.status === "accepted");

    const decision =
      existingAcceptedDecision ??
      (await createBiReportBusinessHandoffDecision({
        workspaceId,
        signalId: signal.id,
        targetType: "approval",
        status: "accepted",
        reviewComment: "backfill: promote assets_legal signal to CRITICAL and create approval.",
      }));

    if (!decision) continue;

    const result = await materializeAcceptedBiReportHandoff({
      workspaceId,
      actorUserId: null,
      actorName: "BI Signal Engine (backfill)",
      signal,
      decision,
    });

    if (result) {
      materialized += 1;
    }
  }

  console.log(
    JSON.stringify(
      { workspaceId, scanned: signals.length, upgraded, materialized },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
