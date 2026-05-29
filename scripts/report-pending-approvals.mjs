#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name) => {
    const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`));
    if (!hit) return undefined;
    return hit.slice(name.length + 3);
  };
  return {
    workspaceId: get("workspace-id"),
    take: Number(get("take") ?? "30"),
  };
}

const prisma = new PrismaClient();

async function main() {
  const args = parseArgs();
  const workspaceId = args.workspaceId?.trim();
  if (!workspaceId) throw new Error("Missing --workspace-id.");

  const totalPending = await prisma.approvalTask.count({
    where: { workspaceId, status: "PENDING" },
  });

  const byChannel = await prisma.approvalTask.groupBy({
    by: ["channel"],
    where: { workspaceId, status: "PENDING" },
    _count: { id: true },
    orderBy: [{ _count: { id: "desc" } }],
    take: 50,
  });

  const bySourceBucket = await prisma.$queryRaw`
    SELECT
      CASE
        WHEN ai.sourceId LIKE 'bi-report-handoff:%' THEN 'bi-report-handoff'
        WHEN ai.sourceId IS NULL OR ai.sourceId = '' THEN 'no_sourceId'
        ELSE 'other'
      END AS bucket,
      COUNT(1) AS cnt
    FROM ApprovalTask at
    JOIN ActionItem ai ON ai.id = at.actionItemId
    WHERE at.workspaceId = ${workspaceId}
      AND at.status = 'PENDING'
    GROUP BY bucket
    ORDER BY cnt DESC
  `;

  const normalizeBigInt = (value) => (typeof value === "bigint" ? Number(value) : value);
  const normalizeRow = (row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      const mapped = {};
      for (const [key, val] of Object.entries(row)) mapped[key] = normalizeBigInt(val);
      return mapped;
    }
    return row;
  };

  const topPending = await prisma.approvalTask.findMany({
    where: { workspaceId, status: "PENDING" },
    select: {
      id: true,
      channel: true,
      createdAt: true,
      actionItem: {
        select: {
          id: true,
          title: true,
          actionType: true,
          sourceId: true,
          sourceType: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(args.take) ? args.take : 30,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        workspaceId,
        pending: totalPending,
        byChannel: byChannel.map((row) => ({ channel: row.channel ?? null, count: row._count.id })),
        bySourceBucket: Array.isArray(bySourceBucket) ? bySourceBucket.map(normalizeRow) : bySourceBucket,
        topPending: topPending.map((row) => ({
          approvalTaskId: row.id,
          channel: row.channel ?? null,
          createdAt: row.createdAt.toISOString(),
          actionItemId: row.actionItem.id,
          title: row.actionItem.title,
          actionType: row.actionItem.actionType,
          sourceType: row.actionItem.sourceType,
          sourceId: row.actionItem.sourceId,
        })),
      },
      null,
      2,
    ),
  );
}

await main()
  .catch((error) => {
    console.error("report-pending-approvals failed", error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
