#!/usr/bin/env tsx

import { readFileSync } from "node:fs";
import path from "node:path";
import { buildBenchmarkMatrixReadModel } from "@/lib/helm-v2/benchmark-matrix";
import type { HelmV21BenchmarkRecordedGateOutcome } from "@/lib/helm-v2/contracts";

function getArg(name: string) {
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function isRecordMode() {
  return process.argv.slice(2).includes("record") || Boolean(getArg("record-file"));
}

function parseRecordPayload() {
  const recordFile = getArg("record-file");
  const workspaceId = getArg("workspace-id");
  const actorName = getArg("actor-name") ?? "Helm benchmark matrix";
  const actorUserId = getArg("actor-user-id") ?? null;
  const sourcePage = getArg("source-page") ?? "/operating";
  const commandSource = getArg("command-source") ?? "benchmark:runtime-substrate";

  if (!recordFile) {
    throw new Error("Missing --record-file=<json path> for benchmark matrix record mode.");
  }
  if (!workspaceId) {
    throw new Error("Missing --workspace-id=<workspace id> for benchmark matrix record mode.");
  }

  const payload = JSON.parse(
    readFileSync(path.resolve(process.cwd(), recordFile), "utf8"),
  ) as {
    benchmarkRunId?: string | null;
    runLabel?: string | null;
    notes?: string | null;
    outcomes?: HelmV21BenchmarkRecordedGateOutcome[];
  };

  if (!Array.isArray(payload.outcomes) || payload.outcomes.length === 0) {
    throw new Error("Benchmark record payload must include a non-empty outcomes array.");
  }

  return {
    workspaceId,
    actorName,
    actorUserId,
    sourcePage,
    commandSource,
    benchmarkRunId: payload.benchmarkRunId ?? null,
    runLabel: payload.runLabel ?? null,
    notes: payload.notes ?? null,
    outcomes: payload.outcomes,
  };
}

function printMatrix() {
  const matrix = buildBenchmarkMatrixReadModel();

  console.log("HELM_AGENT_RUNTIME_BENCHMARK_MATRIX_V1");
  console.log("");
  console.log(matrix.boundaryNote);
  console.log("");

  for (const layer of matrix.layers) {
    console.log(`## ${layer.label} (${layer.layerId})`);
    console.log(layer.summary);
    for (const gate of layer.gates) {
      console.log(`- ${gate.label}`);
      console.log(`  command: ${gate.command}`);
      console.log(`  pass: ${gate.passCriterion}`);
      console.log(`  evidence: ${gate.evidenceNote}`);
    }
    console.log("");
  }
}

async function recordMatrixRun() {
  const payload = parseRecordPayload();
  const { recordRuntimeBenchmarkMatrixRun } = await import("@/lib/helm-v2/runtime-upgrade");
  const result = await recordRuntimeBenchmarkMatrixRun(payload);
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  if (isRecordMode()) {
    await recordMatrixRun();
    return;
  }
  printMatrix();
}

main().catch((error) => {
  console.error(
    "helm-agent-runtime-benchmark-matrix failed",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
