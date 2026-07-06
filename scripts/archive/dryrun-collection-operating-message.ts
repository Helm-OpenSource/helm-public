#!/usr/bin/env tsx

import { config as loadDotenv } from "dotenv";
import { loadBiReportSkillPack } from "@/lib/bi-report-skill/skill-loader";
import { buildBiReportQueryInput } from "@/lib/bi-report-skill/sql-template";
import { queryBiReportRowsFromOdps } from "@/lib/bi-report-skill/query-adapters/odps";
import { prepareBiReportDryRun } from "@/lib/bi-report-skill/run-service";

loadDotenv({ path: ".env" });
loadDotenv({ path: ".env.local", override: true });

function getArg(name: string) {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

async function main() {
  const workspaceId = (getArg("workspace-id") ?? "cmo13r8lu00067nr8epxf8r5m").trim();
  const bizDate = (getArg("biz-date") ?? "2026-05-24").trim();
  const json = process.argv.includes("--json");

  const skillKey = "bi_collection_operating_signal_daily";
  const extensionKey = getArg("extension-key") ?? process.env.BI_REPORT_EXTENSION_KEY;
  
  if (!extensionKey) {
    throw new Error("BI_REPORT_EXTENSION_KEY environment variable must be set or --extension-key must be provided");
  }

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
    signalRouting: undefined,
  };

  const query = buildBiReportQueryInput({ skill, subscription: subscription as never });
  const rows = await queryBiReportRowsFromOdps({
    workspaceId,
    skill,
    subscription: subscription as never,
    sql: query.sql,
    sqlParams: query.sqlParams,
  });

  const prepared = await prepareBiReportDryRun({
    workspaceId,
    skill,
    subscription: subscription as never,
    resolvedSqlParams: query.sqlParams,
    rows,
    useLLM: false,
    recentRuns: [],
    recentFeedbacks: [],
  });

  if (json) {
    console.log(JSON.stringify({
      ok: true,
      workspaceId,
      skillKey,
      sqlParams: query.sqlParams,
      rowCount: prepared.rows.length,
      severity: prepared.evaluation.severity,
      shouldSend: prepared.evaluation.shouldSend,
      topFindings: prepared.evaluation.topFindings,
      summaryMetrics: prepared.computed.summaryMetrics,
      message: prepared.message,
    }, null, 2));
    return;
  }

  console.log(prepared.message);
}

void main().catch((error) => {
  console.error(
    "dryrun-collection-operating-message failed",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});

