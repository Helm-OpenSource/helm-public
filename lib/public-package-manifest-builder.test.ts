import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildPublicPackageManifest } from "../scripts/build-public-package-manifest";

let fixtureRoot: string;

function writeJson(relativePath: string, value: unknown): string {
  const fullPath = path.join(fixtureRoot, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return fullPath;
}

function readText(relativePath: string): string {
  return readFileSync(path.join(fixtureRoot, relativePath), "utf8");
}

describe("public package manifest builder", () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "helm-public-package-"));
  });

  afterEach(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it("prints the projected manifest by default without mutating package.json", () => {
    const tenantSlug = ["gua", "ng", "pu"].join("");
    const privateScriptPath = ["extensions", tenantSlug, "scripts", "seed.ts"].join("/");
    const sourceManifest = {
      name: "helm-console",
      private: true,
      license: "Apache-2.0",
      scripts: {
        dev: "next dev",
        [`seed:${tenantSlug}`]: `tsx ${privateScriptPath}`,
        "self-check": "tsx scripts/helm-self-check-refactored.ts",
      },
    };
    writeJson("package.json", sourceManifest);
    let output = "";

    const result = buildPublicPackageManifest({
      repoRoot: fixtureRoot,
      stdout: (content) => {
        output += content;
      },
    });

    expect(result).toMatchObject({
      status: "printed-projection",
      outputPath: null,
      removedScripts: [`seed:${tenantSlug}`],
      exitCode: 0,
    });
    expect(JSON.parse(output)).toEqual({
      name: "helm-console",
      private: false,
      license: "Apache-2.0",
      scripts: {
        dev: "next dev",
        "self-check": "tsx scripts/helm-self-check-refactored.ts",
        "public:smoke:static": "tsx scripts/public-mirror-smoke.ts --repo-root .",
        "public:smoke": "tsx scripts/public-mirror-smoke.ts --repo-root . --run-commands",
      },
    });
    expect(JSON.parse(readText("package.json"))).toEqual(sourceManifest);
  });

  it("writes an explicit output file and is idempotent", () => {
    writeJson("package.json", {
      name: "helm-console",
      private: true,
      license: "Apache-2.0",
      scripts: {
        dev: "next dev",
      },
    });

    const first = buildPublicPackageManifest({
      repoRoot: fixtureRoot,
      outputPath: "public/package.json",
    });
    const second = buildPublicPackageManifest({
      repoRoot: fixtureRoot,
      outputPath: "public/package.json",
    });

    expect(first.status).toBe("wrote-projection");
    expect(second.status).toBe("already-projected");
    expect(JSON.parse(readText("public/package.json"))).toMatchObject({
      private: false,
      license: "Apache-2.0",
      scripts: {
        dev: "next dev",
        "public:smoke:static": "tsx scripts/public-mirror-smoke.ts --repo-root .",
        "public:smoke": "tsx scripts/public-mirror-smoke.ts --repo-root . --run-commands",
      },
    });
  });

  it("checks a projected output file without mutation", () => {
    writeJson("package.json", {
      name: "helm-console",
      private: true,
      license: "Apache-2.0",
      scripts: {
        dev: "next dev",
      },
    });
    writeJson("public/package.json", {
      name: "helm-console",
      private: true,
      scripts: {
        dev: "next dev",
      },
    });

    const result = buildPublicPackageManifest({
      repoRoot: fixtureRoot,
      outputPath: "public/package.json",
      checkMode: true,
    });

    expect(result).toMatchObject({
      status: "not-projected",
      exitCode: 1,
    });
    expect(JSON.parse(readText("public/package.json"))).toMatchObject({
      private: true,
    });
  });
});
