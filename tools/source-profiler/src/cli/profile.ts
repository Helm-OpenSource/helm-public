/**
 * Source Profiler — `profile` command.
 *
 * Loads the scope manifest (or a default rooted at --source), runs the
 * deterministic profiler, and writes a user-private run directory.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseScopeManifest, defaultScopeManifest, type ScopeManifest } from "../contract/scope-manifest";
import { runProfile, type ProfileResult } from "../profiler/profile";
import { shortHash } from "../util/hash";

export type ProfileCommandInput = {
  cwd: string;
  scopePath?: string;
  source?: string;
  output?: string;
  now?: () => Date;
};

export type ProfileCommandResult = {
  runDir: string;
  result: ProfileResult;
  artifactRefs: string[];
};

export function runProfileCommand(input: ProfileCommandInput): ProfileCommandResult {
  const { cwd, scopePath, source, output, now } = input;
  const clock = now ?? (() => new Date());

  const manifest = loadManifest({ cwd, scopePath, source });
  const rootAbs = path.resolve(cwd, manifest.root);
  if (!existsSync(rootAbs)) {
    throw new Error(`source root does not exist: ${rootAbs}`);
  }

  const result = runProfile({ rootAbs, manifest, now });

  const outputDir = path.resolve(cwd, output ?? manifest.output.dir);
  const stamp = clock().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(outputDir, `${stamp}-${shortHash(result.run.runId)}`);
  mkdirSync(runDir, { recursive: true });

  const artifactRefs = ["run.json", "code-scan.json", "mapping-candidates.json"];
  const runRecord = { ...result.run, artifactRefs };
  writeJson(path.join(runDir, "run.json"), runRecord);
  writeJson(path.join(runDir, "code-scan.json"), result.codeScan);
  writeJson(path.join(runDir, "mapping-candidates.json"), result.candidates);

  return { runDir, result: { ...result, run: runRecord }, artifactRefs };
}

function loadManifest({
  cwd,
  scopePath,
  source,
}: Pick<ProfileCommandInput, "cwd" | "scopePath" | "source">): ScopeManifest {
  if (scopePath) {
    const abs = path.resolve(cwd, scopePath);
    if (existsSync(abs)) {
      const parsed = parseScopeManifest(JSON.parse(readFileSync(abs, "utf8")));
      return source ? { ...parsed, root: source } : parsed;
    }
  }
  return defaultScopeManifest(source ?? ".");
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
