import { db } from "@/lib/db";
import { syncBiReportSignalToOperatingClosure } from "@/lib/bi-report-skill/operating-closure-kernel";
import { mapBiReportBusinessSignalRow } from "@/lib/bi-report-skill/business-signal";

type Args = {
  workspaceId?: string;
  extensionKey?: string | null;
  take: number;
};

function parseArgs(argv: string[]): Args {
  const result: Args = {
    take: 500,
  };
  for (const raw of argv) {
    if (raw.startsWith("--workspace-id=")) {
      result.workspaceId = raw.slice("--workspace-id=".length).trim() || undefined;
      continue;
    }
    if (raw.startsWith("--extension-key=")) {
      result.extensionKey = raw.slice("--extension-key=".length).trim() || null;
      continue;
    }
    if (raw.startsWith("--take=")) {
      const parsed = Number(raw.slice("--take=".length));
      if (Number.isFinite(parsed) && parsed > 0) {
        result.take = Math.min(Math.trunc(parsed), 5000);
      }
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = await db.biReportBusinessSignal.findMany({
    where: {
      ...(args.workspaceId ? { workspaceId: args.workspaceId } : {}),
      status: {
        in: ["open", "triaged", "actioned"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: args.take,
  });

  let processed = 0;
  let blocked = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const summary = await syncBiReportSignalToOperatingClosure({
        signal: mapBiReportBusinessSignalRow(row),
        extensionKey: args.extensionKey ?? null,
      });
      processed += 1;
      if (summary.guardBlocked) {
        blocked += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(
        `[backfill-bi-signal-operating-closure] failed signal=${row.id} workspace=${row.workspaceId}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  console.log(
    `[backfill-bi-signal-operating-closure] done total=${rows.length} processed=${processed} blocked=${blocked} failed=${failed}`,
  );
}

main().catch((error) => {
  console.error(
    "[backfill-bi-signal-operating-closure] fatal",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
