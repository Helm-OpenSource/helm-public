import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PUBLIC_DOCKERIGNORE_CONTENT } from "../scripts/build-public-dockerignore";
import { PUBLIC_ENV_EXAMPLE_CONTENT } from "../scripts/build-public-env-example";
import { STUB_CONTENT } from "../scripts/build-public-mirror-extensions-stub";
import {
  runPublicMirrorSemanticSmoke,
  runPublicMirrorSmoke,
} from "../scripts/public-mirror-smoke";

let fixtureRoot: string;

function writeText(relativePath: string, content: string): void {
  const fullPath = path.join(fixtureRoot, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}

function writeJson(relativePath: string, value: unknown): void {
  writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function seedProjectedMirror(): void {
  writeJson("package.json", {
    name: "helm-console",
    private: false,
    license: "Apache-2.0",
    scripts: {
      "public:smoke:static": "tsx scripts/public-mirror-smoke.ts --repo-root .",
      "public:smoke": "tsx scripts/public-mirror-smoke.ts --repo-root . --run-commands",
    },
  });
  writeText("LICENSE", "Apache License\nVersion 2.0, January 2004\n");
  writeText(
    "NOTICE",
    "Helm\nLicensed under the Apache License, Version 2.0\n",
  );
  writeText(".env.example", PUBLIC_ENV_EXAMPLE_CONTENT);
  writeText(".dockerignore", PUBLIC_DOCKERIGNORE_CONTENT);
  writeText("lib/extensions/registry.tsx", STUB_CONTENT);
}

describe("public mirror smoke", () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "helm-public-smoke-"));
  });

  afterEach(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it("flags tenant-private semantic anchors in public runtime source", () => {
    seedProjectedMirror();
    const tenantSlug = ["gua", "ngpu"].join("");
    const customerDisplayName = ["米", "盾", "云"].join("");
    writeText(
      "lib/runtime.ts",
      `export const tenant = "${tenantSlug}";\nexport const label = "${customerDisplayName}";\n`,
    );

    const result = runPublicMirrorSemanticSmoke(fixtureRoot);

    expect(result.violations.map((violation) => violation.rule)).toEqual([
      ["semantic:tenant-slug", tenantSlug].join(":"),
      ["semantic:customer-name", ["mi", "dun-cn"].join("")].join(":"),
    ]);
  });

  it("allows policy guard files to carry reviewed deny-list terms", () => {
    seedProjectedMirror();
    const tenantSlug = ["gua", "ngpu"].join("");
    const partnerSlug = ["mi", "dun"].join("");
    const customerDisplayName = ["米", "盾", "云"].join("");
    writeText(
      "scripts/public-release-guard.ts",
      `const denyList = ["${tenantSlug}", "${partnerSlug}", "${customerDisplayName}"];\n`,
    );

    const result = runPublicMirrorSemanticSmoke(fixtureRoot);

    expect(result.violations).toEqual([]);
  });

  it("passes a projected public mirror candidate", () => {
    seedProjectedMirror();

    const result = runPublicMirrorSmoke({ repoRoot: fixtureRoot });

    expect(result.exitCode).toBe(0);
    expect(result.verificationExitCode).toBe(0);
    expect(result.violations).toEqual([]);
  });
});
