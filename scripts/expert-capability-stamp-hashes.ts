// Stamp deterministic content hashes into the public-safe expert-capability packs and
// regenerate the EvaluationRun sample from the evaluator output, so samples never drift
// from the enforced bindings. Run after editing any A/B pack:
//
//   npx tsx scripts/expert-capability-stamp-hashes.ts
//
// Public-safe: operates only on synthetic template packs; no network, no model calls.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ASet, BSet, PreRegistration, RunInput } from "@/lib/expert-capability/contracts";
import { evaluate } from "@/lib/expert-capability/evaluator";
import {
  computeASetHash,
  computeBSetHash,
  computeGoldLabelsHash,
  computePreRegistrationContentHash,
  computeReplaySnapshotHashes,
  computeReplaySnapshotRootHash,
} from "@/lib/expert-capability/hashing";

const here = path.dirname(fileURLToPath(import.meta.url));
const packsDir = path.resolve(here, "..", "templates", "expert-capability", "packs");
const schemaDir = path.resolve(here, "..", "templates", "expert-capability", "schema");

function read<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}
function write(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const aPath = path.join(packsDir, "a-correction-set.json");
  const bPath = path.join(packsDir, "b-heldout-eval-set.json");
  const pPath = path.join(packsDir, "pre-registration.json");
  const samplePath = path.join(schemaDir, "evaluation-run.sample.json");

  const aSet = read<ASet>(aPath);
  const bSet = read<BSet>(bPath);
  const preRegistration = read<PreRegistration>(pPath);
  const runInput = read<RunInput>(path.join(packsDir, "run-input.json"));

  const aHash = computeASetHash(aSet);
  const bHash = computeBSetHash(bSet);
  const goldHash = computeGoldLabelsHash(bSet);
  const snapshotHashes = computeReplaySnapshotHashes(bSet);
  const rootHash = computeReplaySnapshotRootHash(snapshotHashes);

  aSet.setHash = aHash;
  bSet.setHash = bHash;
  bSet.goldLabelsHash = goldHash;
  preRegistration.aCorrectionSetHash = aHash;
  preRegistration.bHeldoutSetHash = bHash;
  preRegistration.goldLabelsHash = goldHash;
  preRegistration.replaySnapshotHashes = snapshotHashes;
  preRegistration.replaySnapshotRootHash = rootHash;
  // contentHash last: it self-hashes every other pre-registration field.
  preRegistration.contentHash = computePreRegistrationContentHash(preRegistration);

  write(aPath, aSet);
  write(bPath, bSet);
  write(pPath, preRegistration);

  // Regenerate the EvaluationRun sample from the actual evaluator output.
  const report = evaluate({ preRegistration, runInput, aSet, bSet });
  const sample = read<Record<string, unknown>>(samplePath);
  sample.perCaseScores = report.candidate.perCase.map((c) => ({
    caseId: c.caseId,
    dispositionGoldAccuracy: c.dispositionGoldAccuracy,
    evidenceCompleteness: c.evidenceCompleteness,
    boundaryCorrect: c.boundary.ok,
  }));
  sample.aggregateWeightedScore = report.candidate.weighted;
  sample.boundaryCorrectness = report.candidate.boundaryCorrectness;
  sample.loopCompoundingDecision = report.loopCompoundingDecision;
  sample.expertJustifiedDecision = report.expertJustifiedDecision;
  write(samplePath, sample);

  console.log(
    `stamped: a=${aHash.slice(0, 16)}… b=${bHash.slice(0, 16)}… gold=${goldHash.slice(0, 16)}… ` +
      `snapshots=${snapshotHashes.length} loop=${report.loopCompoundingDecision}`,
  );
}

main();
