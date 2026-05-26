import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { STUB_CONTENT } from "../scripts/build-public-mirror-extensions-stub";
import { PUBLIC_DOCKERIGNORE_CONTENT } from "../scripts/build-public-dockerignore";
import { PUBLIC_ENV_EXAMPLE_CONTENT } from "../scripts/build-public-env-example";
import { buildPublicMirrorPreflight } from "../scripts/build-public-mirror-preflight";
import { verifyPublicMirrorTree } from "../scripts/check-public-mirror-tree";

let fixtureRoot: string;

const tenantSlug = ["gua", "ng", "pu"].join("");
const tenantPrivateRoot = ["extensions", tenantSlug].join("/");
const internalDocsRoot = ["docs", "internal"].join("/");

function writeText(relativePath: string, content: string): void {
  const fullPath = path.join(fixtureRoot, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}

function writeJson(relativePath: string, value: unknown): void {
  writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readText(relativePath: string): string {
  return readFileSync(path.join(fixtureRoot, relativePath), "utf8");
}

function seedMirrorCandidate(): void {
  writeJson("package.json", {
    name: "helm-console",
    private: true,
    license: "Apache-2.0",
    scripts: {
      dev: "next dev",
      [`seed:${tenantSlug}`]: `tsx ${tenantPrivateRoot}/scripts/seed.ts`,
    },
  });
  writeText("LICENSE", "Apache License\nVersion 2.0, January 2004\n");
  writeText(
    "NOTICE",
    "Helm\nLicensed under the Apache License, Version 2.0\n",
  );
  writeText(
    ".env.example",
    [
      'DATABASE_URL="mysql://root:root@127.0.0.1:3306/helm2026"',
      'MIDUN_BASE_URL=""',
    ].join("\n"),
  );
  writeText(".dockerignore", ["node_modules", tenantPrivateRoot].join("\n"));
  writeText(
    "lib/extensions/registry.tsx",
    [
      'import "server-only";',
      `import { privateRuntime } from "@/extensions/${tenantSlug}/bi-report";`,
      "export function resolveReportsExtensions() {",
      "  return privateRuntime;",
      "}",
      "",
    ].join("\n"),
  );
}

describe("public mirror tree verifier", () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "helm-public-mirror-tree-"));
  });

  afterEach(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it("fails if private roots remain in a prepared public mirror candidate", () => {
    seedMirrorCandidate();
    writeText(`${tenantPrivateRoot}/private.ts`, "private tenant runtime");
    writeText(`${internalDocsRoot}/internal.md`, "internal architecture note");
    buildPublicMirrorPreflight({ mirrorRoot: fixtureRoot });

    const result = verifyPublicMirrorTree({ mirrorRoot: fixtureRoot });

    expect(result.exitCode).toBe(1);
    expect(result.preflightExitCode).toBe(0);
    expect(result.violations.map((violation) => violation.rule)).toEqual([
      "public-mirror-tree:private-root-present",
      "public-mirror-tree:private-root-present",
    ]);
    expect(result.violations.map((violation) => violation.path)).toEqual([
      tenantPrivateRoot,
      internalDocsRoot,
    ]);
  });

  it("passes after projections are applied and private roots are removed", () => {
    seedMirrorCandidate();
    buildPublicMirrorPreflight({ mirrorRoot: fixtureRoot });

    const result = verifyPublicMirrorTree({ mirrorRoot: fixtureRoot });

    expect(result.exitCode).toBe(0);
    expect(result.preflightExitCode).toBe(0);
    expect(result.violations).toEqual([]);
    expect(JSON.parse(readText("package.json"))).toMatchObject({
      private: false,
      scripts: {
        dev: "next dev",
        "public:smoke:static": "tsx scripts/public-mirror-smoke.ts --repo-root .",
      },
    });
    expect(readText("lib/extensions/registry.tsx")).toBe(STUB_CONTENT);
    expect(readText(".env.example")).toBe(PUBLIC_ENV_EXAMPLE_CONTENT);
    expect(readText(".dockerignore")).toBe(PUBLIC_DOCKERIGNORE_CONTENT);
  });

  it("fails check mode if package or registry projection has not been applied", () => {
    seedMirrorCandidate();

    const result = verifyPublicMirrorTree({ mirrorRoot: fixtureRoot });

    expect(result.exitCode).toBe(1);
    expect(result.preflightExitCode).toBe(1);
  });
});
