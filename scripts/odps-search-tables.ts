#!/usr/bin/env tsx
import { executeOdpsSqlQuery } from "@/lib/bi-report-skill/query-adapters/odps";

function extractInfo(payload: unknown): string {
  if (Array.isArray(payload) && payload[0] && typeof payload[0] === "object") {
    const info = (payload[0] as { Info?: string }).Info;
    if (typeof info === "string") return info;
  }
  return "";
}

function parseTables(info: string): string[] {
  return info
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.includes(":") ? line.split(":").slice(1).join(":") : line));
}

async function showTablesLike(pattern: string) {
  const payload = await executeOdpsSqlQuery({ sql: `SHOW TABLES LIKE '*${pattern}*'` });
  return parseTables(extractInfo(payload));
}

async function main() {
  const patterns = [
    "outsource",
    "duns",
    "partner",
    "task_package",
    "package_commission",
    "lw_neicui",
    "lw_wei",
    "lw_wai",
    "oyx_nc",
    "neicui",
    "weicui",
  ];

  const all = new Map<string, string[]>();
  for (const pattern of patterns) {
    try {
      const tables = await showTablesLike(pattern);
      all.set(pattern, tables);
      console.log(`\n=== *${pattern}* (${tables.length}) ===`);
      for (const t of tables) {
        console.log(`  ${t}`);
      }
    } catch (error) {
      console.log(`\n=== *${pattern}* ERROR ===`, error instanceof Error ? error.message : error);
    }
  }

  const outsourceRelated = new Set<string>();
  for (const [pattern, tables] of all) {
    if (["outsource", "duns", "partner", "task_package", "package_commission", "weicui", "lw_wei", "lw_wai"].includes(pattern)) {
      for (const t of tables) outsourceRelated.add(t);
    }
  }

  console.log(`\n=== Union 委外候选表 (${outsourceRelated.size}) ===`);
  for (const t of [...outsourceRelated].sort()) {
    console.log(`  ${t}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
