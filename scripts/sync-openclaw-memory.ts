import { syncOpenClawMemory } from "@/lib/integrations/openclaw-memory";
import { db } from "@/lib/db";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const hit = args.find((arg) => arg.startsWith(`--${name}=`));
    if (!hit) return undefined;
    return hit.slice(name.length + 3);
  };

  const workspaceId = get("workspace-id");
  const allWorkspacesRaw = get("all-workspaces");
  const allWorkspaces =
    allWorkspacesRaw == null
      ? true
      : !["0", "false", "no"].includes(allWorkspacesRaw.trim().toLowerCase());
  const sourceMode = get("source-mode");
  const maxItemsRaw = get("max-items");
  const maxItems = maxItemsRaw ? Number(maxItemsRaw) : undefined;

  const normalizedSourceMode: "lancedb" | "backup_jsonl" =
    sourceMode === "backup_jsonl" ? "backup_jsonl" : "lancedb";

  return {
    workspaceId,
    allWorkspaces,
    sourceMode: normalizedSourceMode,
    maxItems:
      typeof maxItems === "number" && Number.isFinite(maxItems) && maxItems > 0
        ? Math.floor(maxItems)
        : undefined,
  };
}

async function resolveWorkspaceIds(input?: string, allWorkspaces = true) {
  if (input) {
    return [input];
  }

  if (allWorkspaces) {
    const workspaces = await db.workspace.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (workspaces.length === 0) {
      throw new Error("No workspace found for OpenClaw sync");
    }

    return workspaces.map((workspace) => workspace.id);
  }

  const workspace = await db.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!workspace) {
    throw new Error("No workspace found for OpenClaw sync");
  }

  return [workspace.id];
}

async function main() {
  const args = parseArgs();
  const workspaceIds = await resolveWorkspaceIds(args.workspaceId, args.allWorkspaces);
  const results: Array<{ workspaceId: string; imported: number; updated: number; skipped: number; quarantined: number; failed: number; processed: number; lastCursor: unknown }> = [];

  for (const workspaceId of workspaceIds) {
    const stats = await syncOpenClawMemory({
      workspaceId,
      trigger: "scheduled",
      sourcePage: "/memory",
      sourceMode: args.sourceMode,
      maxItems: args.maxItems,
      actorName: "OpenClaw Memory Cron",
    });
    results.push({ workspaceId, ...stats });
  }

  console.log(JSON.stringify(results.length === 1 ? results[0] : { results }, null, 2));
}

main().catch((error) => {
  console.error("sync-openclaw-memory failed", error instanceof Error ? error.message : error);
  process.exit(1);
});
