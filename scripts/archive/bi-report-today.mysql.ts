import { PrismaClient } from "@prisma/client";

function shanghaiDayToUtcRange(input: { y: number; m: number; d: number }) {
  // Shanghai is UTC+8 with no DST.
  const startUtcMs = Date.UTC(input.y, input.m - 1, input.d, -8, 0, 0, 0);
  const endUtcMs = Date.UTC(input.y, input.m - 1, input.d + 1, -8, 0, 0, 0);
  return { start: new Date(startUtcMs), end: new Date(endUtcMs) };
}

type CountRow = { key: string; cnt: bigint };

function toNum(v: unknown) {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  return Number(v);
}

async function main() {
  const dayArgIndex = process.argv.findIndex((v) => v === "--day");
  const dayArg = dayArgIndex >= 0 ? process.argv[dayArgIndex + 1] : null;
  const day = typeof dayArg === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dayArg) ? dayArg : "2026-05-20";
  const [y, m, d] = day.split("-").map((v) => Number(v));
  const range = shanghaiDayToUtcRange({ y, m, d });
  const db = new PrismaClient();

  const workspaces = await db.workspace.findMany({
    select: { id: true, slug: true, name: true },
  });
  const wsById = new Map(workspaces.map((w) => [w.id, w]));

  const signalsToday = await db.biReportBusinessSignal.findMany({
    where: { createdAt: { gte: range.start, lt: range.end } },
    select: {
      id: true,
      workspaceId: true,
      skillKey: true,
      signalType: true,
      signalKey: true,
      severity: true,
      status: true,
      ownerUserId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const notificationsToday = await db.biReportSignalNotification.findMany({
    where: { createdAt: { gte: range.start, lt: range.end } },
    select: {
      id: true,
      workspaceId: true,
      signalId: true,
      channel: true,
      status: true,
      targetUserId: true,
      createdAt: true,
      updatedAt: true,
      errorMessage: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const deliveriesToday = await db.biReportDelivery.findMany({
    where: { createdAt: { gte: range.start, lt: range.end } },
    select: { id: true, workspaceId: true, runId: true, channel: true, status: true, createdAt: true },
  });

  const decisionsToday = await db.biReportBusinessHandoffDecision.findMany({
    where: { createdAt: { gte: range.start, lt: range.end } },
    select: {
      id: true,
      workspaceId: true,
      signalId: true,
      targetType: true,
      status: true,
      reviewedByUserId: true,
      reviewedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const executionLogsToday = await db.biReportHandoffExecutionLog.findMany({
    where: { createdAt: { gte: range.start, lt: range.end } },
    select: {
      id: true,
      workspaceId: true,
      signalId: true,
      decisionId: true,
      actionItemId: true,
      approvalTaskId: true,
      stage: true,
      isEffective: true,
      followUpNeeded: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const signalCountsByWorkspace = (await db.$queryRaw<CountRow[]>`
    SELECT workspaceId AS \`key\`, COUNT(*) AS cnt
    FROM bireportbusinesssignal
    WHERE createdAt >= ${range.start} AND createdAt < ${range.end}
    GROUP BY workspaceId
    ORDER BY cnt DESC
  `).map((r) => ({ key: r.key, cnt: toNum(r.cnt) }));

  const signalCountsByType = (await db.$queryRaw<CountRow[]>`
    SELECT signalType AS \`key\`, COUNT(*) AS cnt
    FROM bireportbusinesssignal
    WHERE createdAt >= ${range.start} AND createdAt < ${range.end}
    GROUP BY signalType
    ORDER BY cnt DESC
    LIMIT 50
  `).map((r) => ({ key: r.key, cnt: toNum(r.cnt) }));

  const notificationCountsByChannelStatus = (await db.$queryRaw<
    Array<{ channel: string; status: string; cnt: bigint }>
  >`
    SELECT channel, status, COUNT(*) AS cnt
    FROM bireportsignalnotification
    WHERE createdAt >= ${range.start} AND createdAt < ${range.end}
    GROUP BY channel, status
    ORDER BY cnt DESC
  `).map((r) => ({ channel: r.channel, status: r.status, cnt: toNum(r.cnt) }));

  const decisionCountsByStatus = (await db.$queryRaw<CountRow[]>`
    SELECT status AS \`key\`, COUNT(*) AS cnt
    FROM bireportbusinesshandoffdecision
    WHERE createdAt >= ${range.start} AND createdAt < ${range.end}
    GROUP BY status
    ORDER BY cnt DESC
  `).map((r) => ({ key: r.key, cnt: toNum(r.cnt) }));

  const executionCountsByStage = (await db.$queryRaw<CountRow[]>`
    SELECT stage AS \`key\`, COUNT(*) AS cnt
    FROM bireporthandoffexecutionlog
    WHERE createdAt >= ${range.start} AND createdAt < ${range.end}
    GROUP BY stage
    ORDER BY cnt DESC
  `).map((r) => ({ key: r.key, cnt: toNum(r.cnt) }));

  const topErrorNotifications = notificationsToday
    .filter((n) => n.status === "FAILED")
    .slice(0, 50)
    .map((n) => ({
      workspaceId: n.workspaceId,
      workspace: wsById.get(n.workspaceId)?.slug ?? wsById.get(n.workspaceId)?.name ?? n.workspaceId,
      channel: n.channel,
      targetUserId: n.targetUserId,
      signalId: n.signalId,
      errorMessage: n.errorMessage,
      createdAt: n.createdAt.toISOString(),
    }));

  const summary = {
    day,
    timezone: "Asia/Shanghai",
    rangeUtc: { start: range.start.toISOString(), end: range.end.toISOString() },
    totals: {
      signals: signalsToday.length,
      notifications: notificationsToday.length,
      deliveries: deliveriesToday.length,
      decisions: decisionsToday.length,
      executionLogs: executionLogsToday.length,
    },
    signalCountsByWorkspace: signalCountsByWorkspace.slice(0, 20).map((r) => ({
      workspaceId: r.key,
      workspace: wsById.get(r.key)?.slug ?? wsById.get(r.key)?.name ?? r.key,
      cnt: r.cnt,
    })),
    signalCountsByType,
    notificationCountsByChannelStatus,
    decisionCountsByStatus,
    executionCountsByStage,
    topErrorNotifications,
  };

  console.log(JSON.stringify(summary, null, 2));
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
