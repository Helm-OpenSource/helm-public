import {
  applyHelmReservedWorkspaceBackfill,
  inventoryHelmReservedWorkspaceBackfill,
} from "@/lib/workspace-reserved-backfill";

type BackfillCliArgs = {
  apply: boolean;
  help: boolean;
  includeEmpty: boolean;
  sourceWorkspaceId?: string;
};

function parseArgs(): BackfillCliArgs {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const hit = args.find((arg) => arg.startsWith(`--${name}=`));
    if (!hit) {
      return undefined;
    }
    return hit.slice(name.length + 3);
  };

  const includeEmptyRaw = get("include-empty");
  const includeEmpty =
    includeEmptyRaw == null
      ? false
      : !["0", "false", "no"].includes(includeEmptyRaw.trim().toLowerCase());

  return {
    apply: args.includes("--apply"),
    help: args.includes("--help"),
    includeEmpty,
    sourceWorkspaceId: get("source-workspace-id"),
  };
}

function printUsage() {
  console.log(`Helm reserved workspace backfill defaults to dry-run inventory.

Usage:
  npm run backfill:helm-reserved:inventory
  npm run backfill:helm-reserved:inventory -- --source-workspace-id=<workspaceId>
  npm run backfill:helm-reserved:inventory -- --include-empty=true
  npm run backfill:helm-reserved:apply -- --source-workspace-id=<workspaceId>

Rules:
  - Inventory is the default mode. Nothing is migrated unless --apply is present.
  - Apply requires an explicit --source-workspace-id=<workspaceId>.
  - The tool only auto-migrates commercial / program / portal / settlement records.
  - CapabilityCatalogEntry and SkillSuggestion formal review stay inventory-only in reserved backfill.
  - Every apply run performs target-key collision and cross-workspace integrity preflight first.
`);
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    printUsage();
    return;
  }

  if (args.apply && !args.sourceWorkspaceId) {
    throw new Error(
      "Reserved workspace backfill apply mode requires --source-workspace-id=<workspaceId>.",
    );
  }

  const result = args.apply
    ? await applyHelmReservedWorkspaceBackfill({
        sourceWorkspaceId: args.sourceWorkspaceId!,
      })
    : await inventoryHelmReservedWorkspaceBackfill({
        sourceWorkspaceId: args.sourceWorkspaceId,
        includeEmpty: args.includeEmpty,
      });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(
    "backfill-helm-reserved-workspace failed",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
