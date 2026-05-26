/**
 * Helm Self-Check Reporters
 *
 * Functions to format and display check results.
 */

import type { CheckResult } from "./checks";

/**
 * Print check result to console
 */
export function printCheckResult(result: CheckResult): void {
  console.log(`\n${result.detail}`);
}

/**
 * Print summary of all checks
 */
export function printSummary(results: CheckResult[]): void {
  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const failed = total - passed;

  console.log("\n" + "=".repeat(50));
  console.log(`HELM SELF-CHECK SUMMARY`);
  console.log("=".repeat(50));
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.log("\n❌ Failed checks:");
    results
      .filter((r) => !r.ok)
      .forEach((r) => {
        console.log(`  - ${r.name}`);
      });
  } else {
    console.log("\n✅ All checks passed!");
  }

  console.log("=".repeat(50));
}

/**
 * Print detailed report of all checks
 */
export function printDetailedReport(results: CheckResult[]): void {
  console.log("\n" + "=".repeat(50));
  console.log(`DETAILED CHECK REPORT`);
  console.log("=".repeat(50));

  results.forEach((result) => {
    console.log(`\n${result.name}:`);
    console.log(`  Status: ${result.ok ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`  Detail: ${result.detail}`);
  });

  console.log("\n" + "=".repeat(50));
}
