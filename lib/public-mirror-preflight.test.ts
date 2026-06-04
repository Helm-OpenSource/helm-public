import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PUBLIC_DOCKERIGNORE_CONTENT } from "../scripts/build-public-dockerignore";
import { PUBLIC_ENV_EXAMPLE_CONTENT } from "../scripts/build-public-env-example";
import { buildPublicMirrorPreflight } from "../scripts/build-public-mirror-preflight";

// repo-split 5C: the preflight no longer projects lib/extensions/registry.tsx —
// the real registry is tenant-free and ships unchanged (the former extensions
// stub was removed). These tests therefore only cover the package/env/dockerignore
// projections; registry parity is proven by
// lib/extensions/registry-core-only-mirror-parity.test.ts.

let fixtureRoot: string;

function writeText(relativePath: string, content: string): string {
  const fullPath = path.join(fixtureRoot, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
  return fullPath;
}

function writeJson(relativePath: string, value: unknown): string {
  return writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readText(relativePath: string): string {
  return readFileSync(path.join(fixtureRoot, relativePath), "utf8");
}

function seedPrivateMirrorInputs(): { privatePackage: unknown; privateRegistry: string } {
  const tenantSlug = ["gua", "ng", "pu"].join("");
  const privatePackage = {
    name: "helm-console",
    private: true,
    license: "Apache-2.0",
    scripts: {
      dev: "next dev",
      [`seed:${tenantSlug}`]: `tsx extensions/${tenantSlug}/scripts/seed.ts`,
    },
  };
  const privateRegistry = [
    'import "server-only";',
    `import { privateRuntime } from "@/extensions/${tenantSlug}/bi-report";`,
    "",
    "export function resolveReportsExtensions() {",
    "  return privateRuntime;",
    "}",
    "",
  ].join("\n");

  writeJson("package.json", privatePackage);
  writeText(".env.example", "HELM_DEFAULT_LOCALE=zh-CN\n");
  writeText(".dockerignore", `node_modules\nextensions/${tenantSlug}/\n`);
  writeText("lib/extensions/registry.tsx", privateRegistry);

  return { privatePackage, privateRegistry };
}

describe("public mirror preflight", () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "helm-public-preflight-"));
  });

  afterEach(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it("writes the package/env/dockerignore projections against an explicit mirror root", () => {
    const { privateRegistry: privateRegistrySeed } = seedPrivateMirrorInputs();

    const result = buildPublicMirrorPreflight({ mirrorRoot: fixtureRoot });

    expect(result.exitCode).toBe(0);
    expect(result.packageManifest.status).toBe("wrote-projection");
    expect(result.envExample.status).toBe("wrote-projection");
    expect(result.dockerignore.status).toBe("wrote-projection");
    expect(JSON.parse(readText("package.json"))).toMatchObject({
      name: "helm-console",
      private: false,
      license: "Apache-2.0",
      scripts: {
        dev: "next dev",
        "public:smoke:static":
          "npm run check:public-docs && node --import tsx scripts/public-mirror-smoke.ts --repo-root .",
        "public:smoke": "node --import tsx scripts/public-mirror-smoke.ts --repo-root . --run-commands",
      },
    });
    expect(readText(".env.example")).toBe(PUBLIC_ENV_EXAMPLE_CONTENT);
    expect(readText(".dockerignore")).toBe(PUBLIC_DOCKERIGNORE_CONTENT);
    // The preflight does NOT touch lib/extensions/registry.tsx anymore (5C).
    expect(readText("lib/extensions/registry.tsx")).toBe(privateRegistrySeed);
  });

  it("passes in check mode after the mirror root has been projected", () => {
    seedPrivateMirrorInputs();

    const writeResult = buildPublicMirrorPreflight({ mirrorRoot: fixtureRoot });
    const checkResult = buildPublicMirrorPreflight({
      mirrorRoot: fixtureRoot,
      checkMode: true,
    });

    expect(writeResult.exitCode).toBe(0);
    expect(checkResult.exitCode).toBe(0);
    expect(checkResult.packageManifest.status).toBe("already-projected");
    expect(checkResult.envExample.status).toBe("already-projected");
    expect(checkResult.dockerignore.status).toBe("already-projected");
  });

  it("fails in check mode without mutating unprojected mirror inputs", () => {
    const { privatePackage } = seedPrivateMirrorInputs();

    const result = buildPublicMirrorPreflight({
      mirrorRoot: fixtureRoot,
      checkMode: true,
    });

    expect(result.exitCode).toBe(1);
    expect(result.packageManifest.status).toBe("not-projected");
    expect(result.envExample.status).toBe("not-projected");
    expect(result.dockerignore.status).toBe("not-projected");
    expect(JSON.parse(readText("package.json"))).toEqual(privatePackage);
  });
});
