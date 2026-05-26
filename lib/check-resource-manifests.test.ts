import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  parseManifestYaml,
  runResourceManifestCheck,
} from "../scripts/check-resource-manifests";

let fixtureRoot: string;

function validManifest(id = "resource.case.list"): string {
  return [
    `id: ${id}`,
    "upstream: source-a",
    "endpoint:",
    "  path: /api/cases",
    "  method: READ",
    "  via: fixture",
    "freshness:",
    "  promised_max_lag: 1h",
    "  staleness_action: degrade",
    "  freshness_evidence:",
    "    measured_via: fixture audit",
    "    typical_observed_lag: 10m",
    "    last_audit_date: '2026-05-01'",
    "sensitivity: internal",
    "commitment_level: suggestion_only",
    "caller_scopes:",
    "  - resource.case",
    "schema_ref: null",
    "upstream_known_issues: []",
    "data_owner:",
    "  team: operations",
    "  role: reviewer",
    "  contact_path: ops@example.test",
    "field_dictionary:",
    "  - name: case_id",
    "    type: string",
    "    required: true",
    "    description: Case identifier",
    "    pii_class: internal_id",
    "sample_payload:",
    "  request: {}",
    "  response:",
    "    ok: true",
    "",
  ].join("\n");
}

function writeManifest(relativePath: string, content: string): void {
  const fullPath = path.join(fixtureRoot, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}

function runCheck() {
  return runResourceManifestCheck({
    repoRoot: fixtureRoot,
  });
}

function rubyAvailable(): boolean {
  try {
    execFileSync("ruby", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("resource manifest check", () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "helm-resource-manifest-"));
  });

  afterEach(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it("passes valid resource manifest fixtures", () => {
    writeManifest(
      "extensions/tenant-alpha/resource-pack/resources/cases.resource.yaml",
      validManifest(),
    );

    const result = runCheck();

    expect(result).toMatchObject({
      ok: true,
      exitCode: 0,
      issues: [],
      uniqueIdCount: 1,
    });
    expect(result.files).toHaveLength(1);
  });

  it("reports a missing required field without exiting", () => {
    writeManifest(
      "extensions/tenant-alpha/resource-pack/resources/cases.resource.yaml",
      validManifest().replace("upstream: source-a\n", ""),
    );

    const result = runCheck();

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "extensions/tenant-alpha/resource-pack/resources/cases.resource.yaml",
          message: "missing required field: upstream",
        }),
      ]),
    );
  });

  it("reports duplicate manifest ids across fixtures", () => {
    writeManifest(
      "extensions/tenant-alpha/resource-pack/resources/cases.resource.yaml",
      validManifest("resource.case.duplicate"),
    );
    writeManifest(
      "extensions/tenant-alpha/resource-pack/resources/cases-copy.resource.yaml",
      validManifest("resource.case.duplicate"),
    );

    const result = runCheck();

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.issues.some((issue) =>
      issue.message.includes('duplicate manifest id "resource.case.duplicate"'),
    )).toBe(true);
    expect(result.issues.some((issue) =>
      issue.message.includes("already declared in extensions/tenant-alpha/resource-pack/resources/"),
    )).toBe(true);
  });

  it("reports invalid YAML as a manifest issue without exiting", () => {
    writeManifest(
      "extensions/tenant-alpha/resource-pack/resources/broken.resource.yaml",
      "id: [unterminated\n",
    );

    const result = runCheck();

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      file: "extensions/tenant-alpha/resource-pack/resources/broken.resource.yaml",
    });
    expect(result.issues[0]?.message).toContain("yaml parse failed");
  });

  it.skipIf(!rubyAvailable())(
    "parses valid YAML through the Ruby fallback when the primary parser fails",
    () => {
      const parsed = parseManifestYaml(
        "fixture.resource.yaml",
        validManifest("resource.case.fallback"),
        () => {
          throw new Error("primary parser unavailable");
        },
      );

      expect(parsed).toMatchObject({
        id: "resource.case.fallback",
        upstream: "source-a",
      });
    },
  );

  it("passes an empty extensions root with no manifests found", () => {
    mkdirSync(path.join(fixtureRoot, "extensions"), { recursive: true });

    const result = runCheck();

    expect(result).toMatchObject({
      ok: true,
      exitCode: 0,
      files: [],
      issues: [],
      uniqueIdCount: 0,
    });
  });
});
