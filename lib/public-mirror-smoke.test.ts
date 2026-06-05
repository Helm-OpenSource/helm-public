import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PUBLIC_DOCKERIGNORE_CONTENT } from "../scripts/build-public-dockerignore";
import { PUBLIC_ENV_EXAMPLE_CONTENT } from "../scripts/build-public-env-example";
import {
  runPublicMirrorSemanticSmoke,
  runPublicMirrorSmoke,
} from "../scripts/public-mirror-smoke";

// repo-split 5C: a tenant-free registry (no @/extensions import) — the real
// registry ships unchanged in the mirror; there is no stub anymore.
const TENANT_FREE_REGISTRY = [
  'import "server-only";',
  "",
  'import { getRegisteredReportsExtensions } from "./registry-contract";',
  "",
  "export async function resolveReportsExtensions() {",
  "  return { tabs: getRegisteredReportsExtensions().slice(0, 0), active: null };",
  "}",
  "",
].join("\n");

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
      "check:boundaries": "npm run public:smoke:static",
      "check:public-commit-metadata":
        "node --import tsx scripts/public-commit-metadata-check.ts",
      "check:public-docs": "node --import tsx scripts/check-public-docs-curation.ts",
      "check:bilingual-mixing":
        "node --import tsx scripts/lint-bilingual-mixing.ts",
      "check:bilingual-mixing:update":
        "node --import tsx scripts/lint-bilingual-mixing.ts --update-baseline",
      "check:public-release":
        "npm run check:public-docs && node --import tsx scripts/public-release-guard.ts",
      "db:prepare":
        "node -e \"console.log('public mirror: database prepare is not required')\"",
      e2e: "npm run public:e2e:smoke",
      "public:e2e:smoke": "npm run public:smoke:static",
      "public:smoke:static":
        "npm run check:public-docs && node --import tsx scripts/public-mirror-smoke.ts --repo-root .",
      "public:smoke": "node --import tsx scripts/public-mirror-smoke.ts --repo-root . --run-commands",
      "quality:regression":
        "npm run test:public:guards && npm run public:smoke:static",
      "release:check": "node --import tsx scripts/release-readiness-check.ts",
      "self-check":
        "npm run public:smoke:static && npm run check:secret-history",
      test: "vitest run --config vitest.public.config.ts",
      "test:public:guards":
        "vitest run lib/public-release-guard.test.ts lib/public-mirror-semantic-entry-docs.test.ts",
      typecheck: "tsc --noEmit --project tsconfig.public.json",
    },
  });
  writeText("LICENSE", "Apache License\nVersion 2.0, January 2004\n");
  writeText(
    "NOTICE",
    "Helm\nLicensed under the Apache License, Version 2.0\n",
  );
  writeText(".env.example", PUBLIC_ENV_EXAMPLE_CONTENT);
  writeText(".dockerignore", PUBLIC_DOCKERIGNORE_CONTENT);
  writeText("lib/extensions/registry.tsx", TENANT_FREE_REGISTRY);
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
