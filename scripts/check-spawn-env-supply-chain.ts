#!/usr/bin/env tsx
import { analyzeSpawnEnvSupplyChain } from "@/lib/security/spawn-env-supply-chain-guard";

const result = analyzeSpawnEnvSupplyChain(process.cwd());

console.log(
  `[check:spawn-env-supply-chain] scanned ${result.scannedFileCount} source file(s); warnings=${result.warnCount}; failures=${result.failCount}`,
);

for (const finding of result.findings) {
  const label = finding.severity === "fail" ? "FAIL" : "WARN";
  const stream = finding.severity === "fail" ? console.error : console.warn;
  stream(
    `[check:spawn-env-supply-chain] ${label} ${finding.id} ${finding.file}:${finding.line}`,
  );
  stream(`  command: ${finding.commandExpression}`);
  stream(`  args: ${finding.argsExpression}`);
  stream(`  reachability: ${finding.reachability}`);
  stream(`  reason: ${finding.reason}`);
}

if (result.failCount > 0) {
  console.error(
    "[check:spawn-env-supply-chain] FAIL — new env-derived spawn(command,args,stdio) routes require owner-approved allow-list and reachability notes.",
  );
  process.exit(1);
}

console.log(
  "[check:spawn-env-supply-chain] OK — no new env-derived spawn(command,args,stdio) routes beyond approved warn-mode inventory.",
);
