/**
 * Validates external resource manifests under extensions/<tenant>/<extension>/resources/.
 * Spec: see the External Resource Intake Best Practice doc under the tenant
 * docs directory (§2.2 of the v1 spec).
 *
 * Today this is a structural / enum check. Cross-reference against actual
 * caller code (manifest existence per upstream call site) is a follow-up
 * tracked by the same best-practice doc §7 step 6.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = process.cwd();

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "READ", "SEND"]);
const ALLOWED_STALENESS_ACTIONS = new Set(["degrade", "block", "silent"]);
const ALLOWED_SENSITIVITY = new Set(["public", "internal", "confidential", "restricted"]);
const ALLOWED_COMMITMENT_LEVELS = new Set(["suggestion_only", "promotable"]);
const ALLOWED_PII_CLASSES = new Set(["public", "internal_id", "confidential", "restricted"]);
const DURATION_PATTERN = /^[1-9]\d*(ms|s|m|h|d)$/;
const CALLER_SCOPE_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;
const ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const FIELD_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$|^[0-9]+_[a-zA-Z][a-zA-Z0-9_]*$/;
const RESOURCE_PATH_PATTERN = /^(\/|[a-z][a-z0-9+.-]*:\/\/)/i;

export type ResourceManifestIssue = { file: string; message: string };

export type ResourceManifestCheckOptions = {
  readonly repoRoot?: string;
  readonly scanRoot?: string;
};

export type ResourceManifestCheckResult = {
  readonly ok: boolean;
  readonly exitCode: 0 | 1 | 2;
  readonly files: readonly string[];
  readonly uniqueIdCount: number;
  readonly issues: readonly ResourceManifestIssue[];
  readonly walkError?: Error;
};

type Issue = ResourceManifestIssue;
type ResourceManifestYamlParser = (input: string) => unknown;

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, acc);
    } else if (entry.endsWith(".resource.yaml")) {
      acc.push(full);
    }
  }
  return acc;
}

function pushMissing(issues: Issue[], file: string, path: string) {
  issues.push({ file, message: `missing required field: ${path}` });
}

export function parseManifestYaml(
  file: string,
  source: string,
  parseYaml?: ResourceManifestYamlParser,
): unknown {
  try {
    if (parseYaml) {
      return parseYaml(source);
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parse } = require("yaml") as { parse: (input: string) => unknown };
    return parse(source);
  } catch {
    const rubyProgram = [
      "require 'yaml'",
      "require 'json'",
      "content = STDIN.read",
      "data = YAML.safe_load(content, aliases: true)",
      "puts JSON.generate(data)",
    ].join(";");
    try {
      const output = execFileSync("ruby", ["-e", rubyProgram], {
        input: source,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return JSON.parse(output);
    } catch (error) {
      throw new Error(
        `yaml parse failed for ${file}: ${(error as Error).message}`,
      );
    }
  }
}

export function validateResourceManifest(file: string, raw: unknown): ResourceManifestIssue[] {
  const issues: Issue[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    issues.push({ file, message: "manifest must be a yaml mapping" });
    return issues;
  }
  const m = raw as Record<string, unknown>;

  if (typeof m.id !== "string" || !ID_PATTERN.test(m.id)) {
    issues.push({ file, message: `id must match ${ID_PATTERN}` });
  }
  if (typeof m.upstream !== "string" || m.upstream.length === 0) {
    pushMissing(issues, file, "upstream");
  }

  const endpoint = m.endpoint as Record<string, unknown> | undefined;
  if (!endpoint || typeof endpoint !== "object") {
    pushMissing(issues, file, "endpoint");
  } else {
    if (
      typeof endpoint.path !== "string" ||
      !RESOURCE_PATH_PATTERN.test(endpoint.path)
    ) {
      issues.push({
        file,
        message: "endpoint.path must start with '/' or use a scheme path like 'odps://' / 'report-skill://' / 'dingtalk://'",
      });
    }
    if (typeof endpoint.method !== "string" || !ALLOWED_METHODS.has(endpoint.method)) {
      issues.push({
        file,
        message: `endpoint.method must be one of ${[...ALLOWED_METHODS].join(", ")}`,
      });
    }
    if (typeof endpoint.via !== "string" || endpoint.via.length === 0) {
      pushMissing(issues, file, "endpoint.via");
    }
  }

  const freshness = m.freshness as Record<string, unknown> | undefined;
  if (!freshness || typeof freshness !== "object") {
    pushMissing(issues, file, "freshness");
  } else {
    if (
      typeof freshness.promised_max_lag !== "string" ||
      !DURATION_PATTERN.test(freshness.promised_max_lag)
    ) {
      issues.push({
        file,
        message: "freshness.promised_max_lag must match ^[1-9]\\d*(ms|s|m|h|d)$",
      });
    }
    if (
      typeof freshness.staleness_action !== "string" ||
      !ALLOWED_STALENESS_ACTIONS.has(freshness.staleness_action)
    ) {
      issues.push({
        file,
        message: `freshness.staleness_action must be one of ${[...ALLOWED_STALENESS_ACTIONS].join(", ")}`,
      });
    }
  }

  if (typeof m.sensitivity !== "string" || !ALLOWED_SENSITIVITY.has(m.sensitivity)) {
    issues.push({
      file,
      message: `sensitivity must be one of ${[...ALLOWED_SENSITIVITY].join(", ")}`,
    });
  }
  if (
    typeof m.commitment_level !== "string" ||
    !ALLOWED_COMMITMENT_LEVELS.has(m.commitment_level)
  ) {
    issues.push({
      file,
      message: `commitment_level must be one of ${[...ALLOWED_COMMITMENT_LEVELS].join(", ")}`,
    });
  }

  if (!Array.isArray(m.caller_scopes) || m.caller_scopes.length === 0) {
    issues.push({ file, message: "caller_scopes must be a non-empty array" });
  } else {
    for (const scope of m.caller_scopes) {
      if (typeof scope !== "string" || !CALLER_SCOPE_PATTERN.test(scope)) {
        issues.push({
          file,
          message: `caller_scopes entry must match ${CALLER_SCOPE_PATTERN}: got ${String(scope)}`,
        });
      }
    }
  }

  if (m.schema_ref !== null && typeof m.schema_ref !== "string") {
    issues.push({ file, message: "schema_ref must be string or null" });
  }

  if (!Array.isArray(m.upstream_known_issues)) {
    issues.push({ file, message: "upstream_known_issues must be an array (use [] if none)" });
  } else {
    for (const issue of m.upstream_known_issues) {
      if (!issue || typeof issue !== "object" || Array.isArray(issue)) {
        issues.push({ file, message: "upstream_known_issues entry must be a mapping" });
        continue;
      }
      const e = issue as Record<string, unknown>;
      if (typeof e.id !== "string" || e.id.length === 0) {
        issues.push({ file, message: "upstream_known_issues[].id required" });
      }
      if (typeof e.note !== "string" || e.note.length === 0) {
        issues.push({ file, message: "upstream_known_issues[].note required" });
      }
    }
  }

  // R7: freshness_evidence under freshness
  if (freshness && typeof freshness === "object") {
    const fe = (freshness as Record<string, unknown>).freshness_evidence;
    if (!fe || typeof fe !== "object" || Array.isArray(fe)) {
      pushMissing(issues, file, "freshness.freshness_evidence");
    } else {
      const evidence = fe as Record<string, unknown>;
      if (typeof evidence.measured_via !== "string" || evidence.measured_via.length === 0) {
        pushMissing(issues, file, "freshness.freshness_evidence.measured_via");
      }
      if (typeof evidence.typical_observed_lag !== "string" || evidence.typical_observed_lag.length === 0) {
        pushMissing(issues, file, "freshness.freshness_evidence.typical_observed_lag");
      }
      if (typeof evidence.last_audit_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(evidence.last_audit_date)) {
        issues.push({
          file,
          message: "freshness.freshness_evidence.last_audit_date must match YYYY-MM-DD",
        });
      }
    }
  }

  // R7: data_owner block
  const dataOwner = m.data_owner as Record<string, unknown> | undefined;
  if (!dataOwner || typeof dataOwner !== "object" || Array.isArray(dataOwner)) {
    pushMissing(issues, file, "data_owner");
  } else {
    if (typeof dataOwner.team !== "string" || dataOwner.team.length === 0) {
      pushMissing(issues, file, "data_owner.team");
    }
    if (typeof dataOwner.role !== "string" || dataOwner.role.length === 0) {
      pushMissing(issues, file, "data_owner.role");
    }
    if (typeof dataOwner.contact_path !== "string" || dataOwner.contact_path.length === 0) {
      pushMissing(issues, file, "data_owner.contact_path");
    }
  }

  // R7: field_dictionary
  if (!Array.isArray(m.field_dictionary) || m.field_dictionary.length === 0) {
    pushMissing(issues, file, "field_dictionary (non-empty array)");
  } else {
    const seenNames = new Set<string>();
    for (const field of m.field_dictionary) {
      if (!field || typeof field !== "object" || Array.isArray(field)) {
        issues.push({ file, message: "field_dictionary entry must be a mapping" });
        continue;
      }
      const f = field as Record<string, unknown>;
      if (typeof f.name !== "string" || !FIELD_NAME_PATTERN.test(f.name)) {
        issues.push({
          file,
          message: `field_dictionary[].name must match ${FIELD_NAME_PATTERN}: got ${String(f.name)}`,
        });
      } else if (seenNames.has(f.name)) {
        issues.push({ file, message: `field_dictionary duplicate name "${f.name}"` });
      } else {
        seenNames.add(f.name);
      }
      if (typeof f.type !== "string" || f.type.length === 0) {
        issues.push({ file, message: `field_dictionary[${String(f.name)}].type required` });
      }
      if (typeof f.required !== "boolean") {
        issues.push({ file, message: `field_dictionary[${String(f.name)}].required must be boolean` });
      }
      if (typeof f.description !== "string" || f.description.length === 0) {
        issues.push({ file, message: `field_dictionary[${String(f.name)}].description required` });
      }
      if (typeof f.pii_class !== "string" || !ALLOWED_PII_CLASSES.has(f.pii_class)) {
        issues.push({
          file,
          message: `field_dictionary[${String(f.name)}].pii_class must be one of ${[...ALLOWED_PII_CLASSES].join(", ")}`,
        });
      }
    }
  }

  // R7: sample_payload
  const sample = m.sample_payload as Record<string, unknown> | undefined;
  if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
    pushMissing(issues, file, "sample_payload");
  } else {
    if (!("request" in sample)) {
      pushMissing(issues, file, "sample_payload.request");
    }
    if (!("response" in sample)) {
      pushMissing(issues, file, "sample_payload.response");
    }
  }

  return issues;
}

export function runResourceManifestCheck(
  options: ResourceManifestCheckOptions = {},
): ResourceManifestCheckResult {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const scanRoot = options.scanRoot ?? join(repoRoot, "extensions");
  let files: string[] = [];
  try {
    files = walk(scanRoot);
  } catch (error) {
    return {
      ok: false,
      exitCode: 2,
      files: [],
      uniqueIdCount: 0,
      issues: [],
      walkError: error as Error,
    };
  }

  if (files.length === 0) {
    return {
      ok: true,
      exitCode: 0,
      files: [],
      uniqueIdCount: 0,
      issues: [],
    };
  }

  const seenIds = new Map<string, string>();
  const allIssues: Issue[] = [];

  for (const file of files) {
    const rel = relative(repoRoot, file);
    let raw: unknown;
    try {
      raw = parseManifestYaml(rel, readFileSync(file, "utf8"));
    } catch (error) {
      allIssues.push({ file: rel, message: `yaml parse failed: ${(error as Error).message}` });
      continue;
    }
    const issues = validateResourceManifest(rel, raw);
    if (
      raw &&
      typeof raw === "object" &&
      typeof (raw as { id?: unknown }).id === "string"
    ) {
      const id = (raw as { id: string }).id;
      const previous = seenIds.get(id);
      if (previous) {
        issues.push({
          file: rel,
          message: `duplicate manifest id "${id}" already declared in ${previous}`,
        });
      } else {
        seenIds.set(id, rel);
      }
    }
    allIssues.push(...issues);
  }

  if (allIssues.length === 0) {
    return {
      ok: true,
      exitCode: 0,
      files,
      uniqueIdCount: seenIds.size,
      issues: [],
    };
  }

  return {
    ok: false,
    exitCode: 1,
    files,
    uniqueIdCount: seenIds.size,
    issues: allIssues,
  };
}

function main(): number {
  const result = runResourceManifestCheck();

  if (result.walkError) {
    console.error("[check:resource-manifests] failed to walk extensions/", result.walkError);
    return result.exitCode;
  }

  if (result.files.length === 0) {
    console.log("[check:resource-manifests] no manifests found under extensions/");
    return result.exitCode;
  }

  if (result.ok) {
    console.log(
      `[check:resource-manifests] OK — ${result.files.length} manifest(s), ${result.uniqueIdCount} unique id(s)`,
    );
    return result.exitCode;
  }

  console.error(`[check:resource-manifests] FAILED — ${result.issues.length} issue(s):`);
  for (const issue of result.issues) {
    console.error(`  ${issue.file}: ${issue.message}`);
  }
  return result.exitCode;
}

if (require.main === module) {
  process.exitCode = main();
}
