#!/usr/bin/env tsx

import { executeOdpsSqlQuery } from "@/lib/bi-report-skill/query-adapters/odps";
import { jsonStringify } from "@/lib/utils";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const hit = args.find((arg) => arg.startsWith(`--${name}=`));
    if (!hit) return undefined;
    return hit.slice(name.length + 3);
  };

  return {
    sql: get("sql") ?? "SHOW TABLES",
    json: args.includes("--json"),
  };
}

async function main() {
  const args = parseArgs();
  const payload = await executeOdpsSqlQuery({
    sql: args.sql,
  });

  if (args.json) {
    console.log(jsonStringify(payload));
    return;
  }

  const rows = extractRows(payload);
  console.log("[bi-report odps smoke]");
  console.log(
    jsonStringify({
      sql: args.sql,
      rowCount: rows.length,
      sampleRows: rows.slice(0, 5),
    }),
  );
}

function extractRows(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as { rows?: unknown; data?: unknown };
    if (Array.isArray(record.rows)) {
      return record.rows;
    }
    if (Array.isArray(record.data)) {
      return record.data;
    }
  }

  return [];
}

main().catch((error) => {
  console.error("test-bi-report-odps failed", error instanceof Error ? error.message : error);
  process.exit(1);
});
