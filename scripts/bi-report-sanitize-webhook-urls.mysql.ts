import { PrismaClient } from "@prisma/client";

type DeliveryTarget = {
  channel: string;
  targetType: string;
  targetKey: string;
};

function parseArgs(argv: string[]) {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith("--")) {
      result[key] = value;
      i += 1;
      continue;
    }
    result[key] = true;
  }
  return result;
}

function isDingTalkRobotWebhookUrl(value: string) {
  const raw = value.trim();
  return raw.startsWith("https://oapi.dingtalk.com/robot/send?access_token=");
}

function safeParseTargetsJson(raw: string | null | undefined): DeliveryTarget[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DeliveryTarget[]) : [];
  } catch {
    return [];
  }
}

function summarizeWorkspace(workspace: { id: string; slug: string | null; name: string }) {
  return workspace.slug ? `${workspace.slug}(${workspace.id})` : `${workspace.name}(${workspace.id})`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = args.apply === true;
  const workspaceId = typeof args.workspaceId === "string" ? args.workspaceId : null;
  const replacementEnv =
    typeof args.replacementEnv === "string"
      ? args.replacementEnv
      : "BI_REPORT_DINGTALK_FINANCE_OPS_WEBHOOK_URL";

  const db = new PrismaClient();

  const candidates = await db.biReportSubscription.findMany({
    where: {
      enabled: true,
      ...(workspaceId ? { workspaceId } : {}),
      // Fast coarse filter; exact matching done in JS after parsing.
      deliveryTargetsJson: {
        contains: "oapi.dingtalk.com/robot/send?access_token=",
      },
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      skillKey: true,
      deliveryTargetsJson: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const workspaceIds = Array.from(new Set(candidates.map((c) => c.workspaceId)));
  const workspaces = await db.workspace.findMany({
    where: { id: { in: workspaceIds } },
    select: { id: true, slug: true, name: true },
  });
  const wsById = new Map(workspaces.map((w) => [w.id, w]));

  const updated: Array<{
    subscriptionId: string;
    workspaceId: string;
    name: string;
    skillKey: string;
    replacedCount: number;
  }> = [];

  for (const sub of candidates) {
    const targets = safeParseTargetsJson(sub.deliveryTargetsJson);
    if (targets.length === 0) continue;

    let replacedCount = 0;
    const nextTargets = targets.map((t) => {
      if (t.channel !== "DINGTALK_GROUP_WEBHOOK") return t;
      if (t.targetType !== "webhook") return t;
      if (!isDingTalkRobotWebhookUrl(t.targetKey)) return t;
      replacedCount += 1;
      return {
        ...t,
        targetKey: `env:${replacementEnv}`,
      };
    });

    if (replacedCount === 0) continue;

    updated.push({
      subscriptionId: sub.id,
      workspaceId: sub.workspaceId,
      name: sub.name,
      skillKey: sub.skillKey,
      replacedCount,
    });

    if (apply) {
      await db.biReportSubscription.update({
        where: { id: sub.id },
        data: {
          deliveryTargetsJson: JSON.stringify(nextTargets),
        },
      });
    }
  }

  const output = {
    apply,
    workspaceScope: workspaceId ?? "ALL",
    replacementEnv,
    affected: updated.length,
    details: updated.map((row) => ({
      subscriptionId: row.subscriptionId,
      workspace: wsById.get(row.workspaceId)
        ? summarizeWorkspace(wsById.get(row.workspaceId)!)
        : row.workspaceId,
      name: row.name,
      skillKey: row.skillKey,
      replacedCount: row.replacedCount,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

