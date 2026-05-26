#!/usr/bin/env tsx
/**
 * llm-monthly-spend-report — aggregate LLMCallLog into per-workspace
 * month-to-date USD spend, with provider/model/taskType breakdown.
 *
 * Purpose:
 *   - Give owner a monthly visibility into LLM spend per workspace
 *     (supports D003 burn-rate / runway tracking from the 2026-05-19 audit)
 *   - Surface near-budget workspaces (where workspaceConfig.monthlySpend-
 *     BudgetUSD is set, flag > 80% utilization)
 *   - Identify cost concentration: which provider/model/taskType dominates
 *
 * Usage:
 *   # Current month report
 *   npx tsx scripts/llm-monthly-spend-report.ts
 *
 *   # Specific month
 *   npx tsx scripts/llm-monthly-spend-report.ts --month 2026-04
 *
 *   # Limit to one workspace
 *   npx tsx scripts/llm-monthly-spend-report.ts --workspace <id>
 *
 *   # JSON only (no console table)
 *   npx tsx scripts/llm-monthly-spend-report.ts --json-only
 *
 * Output: docs/internal/llm-spend-reports/<YYYY-MM>.json + console table
 *
 * Reference: HELM_LLM_SPEND_AND_ABUSE_GUARDS_SPEC_V1.md §二 Gap 3 +
 * HELM_FOUNDER_DECISIONS_AND_DERIVED_TASKS_2026-05-19.md T029 burn-rate review
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { db } from "@/lib/db";
import { estimateSpendUSD } from "@/lib/llm/token-cost-table";
import type { LLMProvider } from "@/lib/llm/types";

const REPO_ROOT = path.resolve(__dirname, "..");

type WorkspaceAggregate = {
  workspaceId: string;
  callCount: number;
  successCount: number;
  failureCount: number;
  promptTokensTotal: number;
  completionTokensTotal: number;
  spendUSD: number;
  byProvider: Record<string, { calls: number; spendUSD: number }>;
  byModel: Record<string, { calls: number; spendUSD: number }>;
  byTaskType: Record<string, { calls: number; spendUSD: number }>;
};

function monthKeyOrToday(input?: string): string {
  if (input && /^\d{4}-\d{2}$/.test(input)) return input;
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function startOfMonthUTC(monthKey: string): Date {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
}

function startOfNextMonthUTC(monthKey: string): Date {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
}

function formatUSD(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.01) return `$${value.toFixed(6)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const monthIdx = argv.indexOf("--month");
  const wsIdx = argv.indexOf("--workspace");
  const jsonOnly = argv.includes("--json-only");

  const monthKey = monthKeyOrToday(monthIdx !== -1 ? argv[monthIdx + 1] : undefined);
  const workspaceFilter = wsIdx !== -1 ? argv[wsIdx + 1] : null;

  const windowStart = startOfMonthUTC(monthKey);
  const windowEnd = startOfNextMonthUTC(monthKey);

  if (!jsonOnly) {
    console.log(`LLM Monthly Spend Report — month=${monthKey} ${workspaceFilter ? `workspace=${workspaceFilter}` : "(all workspaces)"}`);
    console.log(`Window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}\n`);
  }

  const where: {
    createdAt: { gte: Date; lt: Date };
    workspaceId?: string;
  } = {
    createdAt: { gte: windowStart, lt: windowEnd },
  };
  if (workspaceFilter) {
    where.workspaceId = workspaceFilter;
  }

  const rows = await db.lLMCallLog.findMany({
    where,
    select: {
      workspaceId: true,
      provider: true,
      model: true,
      taskType: true,
      tokenUsagePrompt: true,
      tokenUsageCompletion: true,
      success: true,
    },
  });

  if (!jsonOnly) {
    console.log(`Found ${rows.length} call log entries for the window.\n`);
  }

  const aggregates = new Map<string, WorkspaceAggregate>();
  for (const r of rows) {
    let agg = aggregates.get(r.workspaceId);
    if (!agg) {
      agg = {
        workspaceId: r.workspaceId,
        callCount: 0,
        successCount: 0,
        failureCount: 0,
        promptTokensTotal: 0,
        completionTokensTotal: 0,
        spendUSD: 0,
        byProvider: {},
        byModel: {},
        byTaskType: {},
      };
      aggregates.set(r.workspaceId, agg);
    }
    agg.callCount += 1;
    if (r.success) agg.successCount += 1;
    else agg.failureCount += 1;
    const promptTokens = r.tokenUsagePrompt ?? 0;
    const completionTokens = r.tokenUsageCompletion ?? 0;
    agg.promptTokensTotal += promptTokens;
    agg.completionTokensTotal += completionTokens;
    const spend = estimateSpendUSD({
      provider: r.provider as LLMProvider,
      model: r.model,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
    });
    agg.spendUSD += spend;

    const providerBucket = (agg.byProvider[r.provider] ??= { calls: 0, spendUSD: 0 });
    providerBucket.calls += 1;
    providerBucket.spendUSD += spend;

    const modelBucket = (agg.byModel[r.model] ??= { calls: 0, spendUSD: 0 });
    modelBucket.calls += 1;
    modelBucket.spendUSD += spend;

    const taskBucket = (agg.byTaskType[r.taskType] ??= { calls: 0, spendUSD: 0 });
    taskBucket.calls += 1;
    taskBucket.spendUSD += spend;
  }

  const sortedAggregates = Array.from(aggregates.values()).sort((a, b) => b.spendUSD - a.spendUSD);
  const grandTotal = sortedAggregates.reduce((sum, agg) => sum + agg.spendUSD, 0);

  const report = {
    month: monthKey,
    generatedAt: new Date().toISOString(),
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    workspaceFilter,
    totals: {
      workspaceCount: sortedAggregates.length,
      callCount: rows.length,
      spendUSD: grandTotal,
    },
    workspaces: sortedAggregates,
  };

  const outDir = path.join(REPO_ROOT, "docs", "internal", "llm-spend-reports");
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, `${monthKey}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  if (!jsonOnly) {
    console.log("Per-workspace spend (sorted by USD):");
    console.log(
      "workspaceId".padEnd(40),
      "calls".padStart(8),
      "success".padStart(8),
      "fail".padStart(6),
      "tokens(in+out)".padStart(20),
      "USD".padStart(12),
    );
    console.log("-".repeat(96));
    for (const agg of sortedAggregates.slice(0, 25)) {
      console.log(
        agg.workspaceId.slice(0, 40).padEnd(40),
        String(agg.callCount).padStart(8),
        String(agg.successCount).padStart(8),
        String(agg.failureCount).padStart(6),
        `${agg.promptTokensTotal}+${agg.completionTokensTotal}`.padStart(20),
        formatUSD(agg.spendUSD).padStart(12),
      );
    }
    if (sortedAggregates.length > 25) {
      console.log(`...and ${sortedAggregates.length - 25} more (see JSON output).`);
    }
    console.log("-".repeat(96));
    console.log(`TOTAL`.padEnd(40), String(rows.length).padStart(8), "", "", "", formatUSD(grandTotal).padStart(12));
    console.log(`\nReport written to ${path.relative(REPO_ROOT, outPath)}`);

    if (sortedAggregates.length > 0) {
      const top = sortedAggregates[0];
      console.log(`\nTop spender: ${top.workspaceId}`);
      console.log(`  Top provider: ${Object.entries(top.byProvider).sort((a, b) => b[1].spendUSD - a[1].spendUSD)[0]?.[0] ?? "none"}`);
      console.log(`  Top model: ${Object.entries(top.byModel).sort((a, b) => b[1].spendUSD - a[1].spendUSD)[0]?.[0] ?? "none"}`);
      console.log(`  Top taskType: ${Object.entries(top.byTaskType).sort((a, b) => b[1].spendUSD - a[1].spendUSD)[0]?.[0] ?? "none"}`);
    }
  } else {
    console.log(JSON.stringify(report, null, 2));
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Report generation failed:", err);
  process.exit(1);
});
