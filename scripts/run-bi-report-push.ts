#!/usr/bin/env tsx

import { executeBiReportPush } from "@/lib/bi-report-skill/run-executor";
import { resolveBiReportPushWorkspaceIdFromRegistry } from "@/lib/extensions/registry";
import { jsonStringify } from "@/lib/utils";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`));
    if (!hit) return undefined;
    return hit.slice(name.length + 3);
  };

  return {
    extension: get("extension"),
    tenantKey: get("tenant-key"),
    extensionSlug: get("extension-slug"),
    skill: get("skill") ?? "bi_revenue_daily",
    skillDir: get("skill-dir"),
    subscriptionFile: get("subscription-file"),
    inputFile: get("input-file"),
    sql: get("sql"),
    workspaceId: get("workspace-id"),
    useLLM: parseBoolean(get("use-llm"), false),
    json: args.includes("--json") || parseBoolean(get("json"), false),
    dryRun: args.includes("--dry-run") || parseBoolean(get("dry-run"), true),
  };
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;
  return !["0", "false", "no"].includes(value.trim().toLowerCase());
}

async function main() {
  const args = parseArgs();
  const workspaceId = await resolveBiReportPushWorkspaceIdFromRegistry({
    workspaceId: args.workspaceId,
  });
  const payload = await executeBiReportPush({
    extension: args.extension,
    tenantKey: args.tenantKey,
    extensionSlug: args.extensionSlug,
    skill: args.skill,
    skillDir: args.skillDir,
    subscriptionFile: args.subscriptionFile,
    inputFile: args.inputFile,
    sql: args.sql,
    workspaceId,
    useLLM: args.useLLM,
    dryRun: args.dryRun,
  });

  if (args.json) {
    console.log(jsonStringify(payload));
    return;
  }

  console.log("[bi-report dry-run]");
  console.log(jsonStringify({
    skillKey: payload.skillKey,
    severity: payload.severity,
    shouldSend: payload.shouldSend,
    windowLabel: payload.windowLabel,
    queryWarnings: payload.queryKnowledgeLint.warnings,
    deliveryTargets: payload.deliveryPreviews.map((item) => ({
      channel: item.channel,
      targetKey: item.targetKey,
      status: item.status,
    })),
  }));
  console.log("");
  console.log(payload.message);
}

void main().catch((error) => {
  console.error("run-bi-report-push failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
