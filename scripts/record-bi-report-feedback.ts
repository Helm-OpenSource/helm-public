#!/usr/bin/env tsx

import { recordBiReportFeedbackMemory } from "@/lib/bi-report-skill/feedback-memory";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const hit = args.find((arg) => arg.startsWith(`--${name}=`));
    if (!hit) return undefined;
    return hit.slice(name.length + 3);
  };
  const parseBoolean = (name: string) => {
    const value = get(name);
    if (value == null) return undefined;
    return !["0", "false", "no"].includes(value.trim().toLowerCase());
  };

  return {
    workspaceId: get("workspace-id") ?? "workspace_demo",
    extensionKey: get("extension"),
    skillKey: get("skill") ?? "bi_revenue_daily",
    skillVersion: get("skill-version") ?? "1.0.0",
    windowLabel: get("window-label"),
    feedbackStatus: get("feedback-status") ?? "accepted",
    confirmedCause: get("confirmed-cause"),
    confirmedAction: get("confirmed-action"),
    isFalsePositive: parseBoolean("is-false-positive"),
    actionEffective: parseBoolean("action-effective"),
    needsRuleAdjustment: parseBoolean("needs-rule-adjustment"),
    resolutionOutcome: get("resolution-outcome"),
    note: get("note"),
  };
}

async function main() {
  const args = parseArgs();
  if (!args.extensionKey) {
    throw new Error(
      "--extension=<extensionKey> is required (e.g. --extension=acme-bi-report)",
    );
  }
  if (!["accepted", "corrected", "rejected"].includes(args.feedbackStatus)) {
    throw new Error(`Unsupported feedback status: ${args.feedbackStatus}`);
  }

  await recordBiReportFeedbackMemory({
    workspaceId: args.workspaceId,
    extensionKey: args.extensionKey,
    skillKey: args.skillKey,
    skillVersion: args.skillVersion,
    windowLabel: args.windowLabel ?? null,
    feedbackStatus: args.feedbackStatus as "accepted" | "corrected" | "rejected",
    confirmedCause: args.confirmedCause ?? null,
    confirmedAction: args.confirmedAction ?? null,
    isFalsePositive: args.isFalsePositive ?? null,
    actionEffective: args.actionEffective ?? null,
    needsRuleAdjustment: args.needsRuleAdjustment ?? null,
    resolutionOutcome: args.resolutionOutcome ?? null,
    note: args.note ?? null,
  });

  console.log("[bi-report feedback recorded]");
  console.log(
    JSON.stringify(
      {
        workspaceId: args.workspaceId,
        extensionKey: args.extensionKey,
        skillKey: args.skillKey,
        feedbackStatus: args.feedbackStatus,
        isFalsePositive: args.isFalsePositive ?? null,
        actionEffective: args.actionEffective ?? null,
        needsRuleAdjustment: args.needsRuleAdjustment ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    "record-bi-report-feedback failed",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
