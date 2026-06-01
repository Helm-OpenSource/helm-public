#!/usr/bin/env tsx

import { config as loadDotenv } from "dotenv";
import { loadBiReportSkillPack } from "@/lib/bi-report-skill/skill-loader";
import { buildBiReportQueryInput } from "@/lib/bi-report-skill/sql-template";
import { queryBiReportRowsFromOdps } from "@/lib/bi-report-skill/query-adapters/odps";

loadDotenv({ path: ".env" });
loadDotenv({ path: ".env.local", override: true });

async function main() {
  const workspaceId = process.argv.find((arg) => arg.startsWith("--workspace-id="))?.split("=")[1]?.trim() ||
    "cmo13r8lu00067nr8epxf8r5m";
  const bizDate = process.argv.find((arg) => arg.startsWith("--biz-date="))?.split("=")[1]?.trim() ||
    "2026-05-18";
  const take = Number(process.argv.find((arg) => arg.startsWith("--take="))?.split("=")[1] ?? "3");
  const extensionKey = process.argv.find((arg) => arg.startsWith("--extension-key="))?.split("=")[1]?.trim() ||
    process.env.BI_REPORT_EXTENSION_KEY;

  if (!extensionKey) {
    throw new Error("BI_REPORT_EXTENSION_KEY environment variable must be set or --extension-key must be provided");
  }

  const skillKey = "bi_collection_operating_signal_daily";
  const skill = await loadBiReportSkillPack({
    extensionKey,
    skillKey,
  });
  const subscription = {
    name: "dryrun",
    skillKey,
    skillVersion: "v1",
    enabled: true,
    scheduleCron: "0 9 * * *",
    timezone: "Asia/Shanghai",
    sqlParams: { biz_date: bizDate },
    deliveryTargets: [],
    dedupeWindowMinutes: 0,
  };

  const query = buildBiReportQueryInput({ skill, subscription: subscription as never });
  const rows = await queryBiReportRowsFromOdps({
    workspaceId,
    skill,
    subscription: subscription as never,
    sql: query.sql,
    sqlParams: query.sqlParams,
  });

  const sample = rows.slice(0, Number.isFinite(take) ? take : 3);
  console.log(JSON.stringify({
    ok: true,
    workspaceId,
    skillKey,
    bizDate: query.sqlParams.biz_date,
    rowCount: rows.length,
    sample,
  }, null, 2));
}

void main().catch((error) => {
  console.error(
    "odps-dryrun-collection-operating-sql failed",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});

