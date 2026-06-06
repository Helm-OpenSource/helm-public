/**
 * Source Profiler — deterministic profile orchestrator.
 *
 * scope → secret preflight → structural scan → mapping candidates → run record.
 * This is the only trusted layer. It performs no network I/O, executes no
 * scanned code, and reads no DB rows.
 */

import type { ScopeManifest } from "../contract/scope-manifest";
import type { CodeScanSummary, DiscoveredObject, SkippedFile } from "../contract/code-scan";
import type { SignalMappingCandidate } from "../contract/mapping";
import type { AuditEntry, SourceProfileRun } from "../contract/run";
import { CONTRACT_VERSION, TOOL_VERSION } from "../contract";
import { enumerateFiles, readTextFile } from "../util/fs-walk";
import { newRunId, stableHash } from "../util/hash";
import {
  isSecretFilename,
  scanContentForSecrets,
} from "./secret-preflight";
import { scanFile } from "./source-scan";
import { proposeMappings } from "./mapping-proposer";

export type ProfileInput = {
  rootAbs: string;
  manifest: ScopeManifest;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
};

export type ProfileResult = {
  run: SourceProfileRun;
  codeScan: CodeScanSummary;
  candidates: SignalMappingCandidate[];
};

export function runProfile({ rootAbs, manifest, now }: ProfileInput): ProfileResult {
  const clock = now ?? (() => new Date());
  const audit: AuditEntry[] = [];
  const addAudit = (
    phase: AuditEntry["phase"],
    message: string,
    level: AuditEntry["level"] = "info",
  ) => audit.push({ at: clock().toISOString(), phase, message, level });

  const scopeHash = stableHash(manifest);
  addAudit("scope_resolved", `scope resolved at ${rootAbs} (hash ${scopeHash.slice(0, 12)})`);

  const walk = enumerateFiles({ rootAbs, manifest });
  addAudit(
    "scope_resolved",
    `enumerated ${walk.total} file(s): ${walk.files.length} eligible, ${walk.skipped.length} skipped`,
  );

  const skipped: SkippedFile[] = [...walk.skipped];
  const objects: DiscoveredObject[] = [];
  let scannedFileCount = 0;
  const mode = manifest.secretPreflight.mode;

  for (const rel of walk.files) {
    if (mode !== "off" && isSecretFilename(rel)) {
      skipped.push({ path: rel, reason: "secret_preflight" });
      addAudit("secret_preflight", `secret-bearing filename skipped: ${rel}`, "warn");
      continue;
    }
    let content: string;
    try {
      content = readTextFile(rootAbs, rel);
    } catch {
      skipped.push({ path: rel, reason: "unreadable" });
      continue;
    }
    if (mode !== "off") {
      const findings = scanContentForSecrets(content, {
        extraPatterns: manifest.secretPreflight.extraPatterns,
      });
      if (findings.length > 0) {
        const rules = findings.map((f) => `${f.rule}@${f.line}`).join(", ");
        if (mode === "strict") {
          skipped.push({ path: rel, reason: "secret_preflight" });
          addAudit("secret_preflight", `strict skip ${rel}: ${rules}`, "warn");
          continue;
        }
        addAudit("secret_preflight", `warn ${rel}: ${rules}`, "warn");
      }
    }

    scannedFileCount++;
    for (const object of scanFile(rel, content)) objects.push(object);
  }

  addAudit("source_scan", `scanned ${scannedFileCount} file(s); found ${objects.length} object(s)`);

  const candidates = objects.flatMap((object) => proposeMappings(object));
  addAudit("source_scan", `proposed ${candidates.length} mapping candidate(s)`);

  const codeScan: CodeScanSummary = {
    fileCount: walk.total,
    scannedFileCount,
    skippedFiles: skipped.sort((a, b) => a.path.localeCompare(b.path)),
    objects,
  };

  const run: SourceProfileRun = {
    runId: newRunId(),
    toolVersion: TOOL_VERSION,
    contractVersion: CONTRACT_VERSION,
    createdAt: clock().toISOString(),
    scopeHash,
    phase: "completed",
    modalities: ["static_source"],
    artifactRefs: [],
    audit,
  };

  return { run, codeScan, candidates };
}
