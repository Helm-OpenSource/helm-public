#!/usr/bin/env tsx
import { runPackAPilotReadinessEval } from "@/lib/evals/pack-a-pilot-readiness";

function main() {
  const summary = runPackAPilotReadinessEval();

  console.log("\nPack A Pilot Readiness Eval");
  console.log("===========================");
  console.log(`Version:             ${summary.version}`);
  console.log(`Cases:               ${summary.gateMatches}/${summary.totalCases} gate matches`);
  console.log(`Average score:       ${summary.averageScore}`);
  console.log(`Week 0 ready:        ${summary.week0ReadyCases}`);
  console.log(`Scope-call ready:    ${summary.scopeCallReadyCases}`);
  console.log(`Candidate pool:      ${summary.candidatePoolCases}`);
  console.log(`No-Go:               ${summary.noGoCases}`);
  console.log(
    `Pack A integration:  ${summary.repositoryIntegration.integratedSkillCount}/${summary.repositoryIntegration.requiredSkillCount} skills`,
  );

  console.log("\nCase Results:");
  for (const result of summary.caseResults) {
    console.log(
      `  ${result.gateMatched ? "PASS" : "FAIL"} ${result.caseId.padEnd(24)} ${result.alias.padEnd(10)} score=${String(result.totalScore).padStart(3)} gate=${result.actualGate}`,
    );
    if (result.blockedReasons.length > 0) {
      console.log(`       blocked=${result.blockedReasons.join(",")}`);
    }
    console.log(`       next=${result.nextAction}`);
  }

  console.log("\nSkill Integration:");
  for (const row of summary.repositoryIntegration.rows) {
    console.log(
      `  ${row.integrated ? "PASS" : "FAIL"} ${row.skillId.padEnd(24)} skill=${row.skillMdPresent} fixture=${row.fixturePresent} playbook=${row.seedPlaybookPresent} thresholds=${row.seedThresholdsPresent} templates=${row.templateCount}`,
    );
  }

  if (!summary.passed) {
    console.error("\nPack A pilot readiness eval FAILED");
    for (const failure of summary.failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log("\nPack A pilot readiness eval PASSED\n");
}

main();
