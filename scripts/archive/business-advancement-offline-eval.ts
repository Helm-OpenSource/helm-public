#!/usr/bin/env npx tsx
/**
 * Helm Business Advancement — Phase 1A Offline Eval Script
 *
 * Usage:
 *   npx tsx scripts/business-advancement-offline-eval.ts
 *
 * Exits 0 on success, 1 on failure.
 * Prints a concise eval summary to stdout.
 *
 * No external services, no network calls, no production data.
 */

import { runOfflineEval, getFixtureStats } from "@/features/business-advancement/offline-eval";

function pad(s: string, width: number): string {
  return s.padEnd(width);
}

function main(): void {
  console.log("=".repeat(64));
  console.log("  Helm Business Advancement — Phase 1A Offline Eval");
  console.log("=".repeat(64));
  console.log();

  const stats = getFixtureStats();

  console.log("Fixture Statistics:");
  console.log(`  Total fixtures:           ${stats.total}`);
  console.log(`  read_only:                ${stats.byPosture.read_only}`);
  console.log(`  review_required:          ${stats.byPosture.review_required}`);
  console.log(`  human_owner_required:     ${stats.byPosture.human_owner_required}`);
  console.log(`  blocked:                  ${stats.byPosture.blocked}`);
  console.log(`  governance-gated total:   ${stats.governanceGatedCount}`);
  console.log();
  console.log("Source Coverage:");
  for (const [src, count] of Object.entries(stats.bySource).sort()) {
    console.log(`  ${pad(src, 24)} ${count}`);
  }
  console.log();

  const summary = runOfflineEval();

  console.log("-".repeat(64));
  console.log("Eval Checks:");
  console.log("-".repeat(64));

  for (const check of summary.checks) {
    const status = check.passed ? "PASS" : "FAIL";
    const icon = check.passed ? "✓" : "✗";
    console.log(`  [${status}] ${icon} ${check.checkName}`);
    if (!check.passed) {
      console.log(`         ${check.detail}`);
    }
  }

  console.log();
  console.log("-".repeat(64));
  console.log(
    `  ${summary.passed}/${summary.totalChecks} checks passed, ${summary.failed} failed`
  );

  if (summary.overallPassed) {
    console.log();
    console.log("  ✓ Phase 1A offline eval PASSED");
    console.log();
    console.log("  Phase 1A pass criteria met:");
    console.log(`    ✓ 20 fixtures complete (${stats.total}/20)`);
    console.log(`    ✓ High-risk review coverage: 100% (governance-gated: ${stats.governanceGatedCount})`);
    console.log("    ✓ Boundary incident count: 0");
    console.log("    ✓ Source coverage: meeting, crm, tenant_resource, ask_helm");
    console.log("    ✓ LLM final ranking: not granted in any fixture");
    console.log();
    process.exit(0);
  } else {
    console.log();
    console.log("  ✗ Phase 1A offline eval FAILED");
    console.log();
    console.log("  Failed checks:");
    for (const check of summary.checks.filter((c) => !c.passed)) {
      console.log(`    [${check.checkName}]: ${check.detail}`);
    }
    console.log();
    process.exit(1);
  }
}

main();
