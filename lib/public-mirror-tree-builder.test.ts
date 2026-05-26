import {
  existsSync,
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
import { buildPublicMirrorTree } from "../scripts/build-public-mirror-tree";

let fixtureParent: string;
let sourceRoot: string;
let mirrorRoot: string;

const tenantSlug = ["gua", "ng", "pu"].join("");
const tenantPrivateRoot = ["extensions", tenantSlug].join("/");
const internalDocsRoot = ["docs", "internal"].join("/");

function writeText(root: string, relativePath: string, content: string): void {
  const fullPath = path.join(root, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  writeText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readText(root: string, relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function seedPrivateSourceTree(): void {
  writeJson(sourceRoot, "package.json", {
    name: "helm-console",
    private: true,
    license: "Apache-2.0",
    scripts: {
      dev: "next dev",
      [`seed:${tenantSlug}`]: `tsx ${tenantPrivateRoot}/scripts/seed.ts`,
    },
  });
  writeText(sourceRoot, "LICENSE", "Apache License\nVersion 2.0, January 2004\n");
  writeText(
    sourceRoot,
    "NOTICE",
    "Helm\nLicensed under the Apache License, Version 2.0\n",
  );
  writeText(
    sourceRoot,
    "lib/extensions/registry.tsx",
    [
      'import "server-only";',
      `import { privateRuntime } from "@/extensions/${tenantSlug}/bi-report";`,
      "",
      "export function resolveReportsExtensions() {",
      "  return privateRuntime;",
      "}",
      "",
    ].join("\n"),
  );
  writeText(sourceRoot, "README.md", "# Helm\n");
  writeText(sourceRoot, ".env.example", "HELM_DEFAULT_LOCALE=zh-CN\n");
  writeText(sourceRoot, ".dockerignore", `node_modules\n${tenantPrivateRoot}/\n`);
  writeText(sourceRoot, ".env.local", "DATABASE_URL=mysql://private\n");
  writeText(sourceRoot, ".next/static/chunk.js.map", "tenant artifact");
  writeText(sourceRoot, "node_modules/example/index.js", "module artifact");
  writeText(sourceRoot, `${tenantPrivateRoot}/private.ts`, "tenant private");
  writeText(sourceRoot, `${internalDocsRoot}/adr.md`, "internal private");
  writeText(
    sourceRoot,
    "docs/HELM_INTERNAL_FREEZE_REFERENCE.md",
    "internal freeze reference",
  );
}

describe("public mirror tree builder", () => {
  beforeEach(() => {
    fixtureParent = mkdtempSync(path.join(tmpdir(), "helm-public-builder-"));
    sourceRoot = path.join(fixtureParent, "source");
    mirrorRoot = path.join(fixtureParent, "mirror");
    mkdirSync(sourceRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(fixtureParent, { force: true, recursive: true });
  });

  it("copies a public candidate, applies projections, and verifies the mirror", () => {
    seedPrivateSourceTree();

    const result = buildPublicMirrorTree({ mirrorRoot, sourceRoot });

    expect(result.exitCode).toBe(0);
    expect(result.preflightExitCode).toBe(0);
    expect(result.violations).toEqual([]);
    expect(result.copiedFiles).toBeGreaterThan(0);
    expect(result.skippedEntries.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        ".env.local",
        ".next",
        "node_modules",
        tenantPrivateRoot,
        internalDocsRoot,
        "docs/HELM_INTERNAL_FREEZE_REFERENCE.md",
      ]),
    );
    expect(readText(mirrorRoot, "README.md")).toBe("# Helm\n");
    expect(readText(mirrorRoot, ".env.example")).toBe(PUBLIC_ENV_EXAMPLE_CONTENT);
    expect(readText(mirrorRoot, ".dockerignore")).toBe(PUBLIC_DOCKERIGNORE_CONTENT);
    expect(existsSync(path.join(mirrorRoot, ".env.local"))).toBe(false);
    expect(existsSync(path.join(mirrorRoot, ".next"))).toBe(false);
    expect(existsSync(path.join(mirrorRoot, tenantPrivateRoot))).toBe(false);
    expect(existsSync(path.join(mirrorRoot, internalDocsRoot))).toBe(false);
    expect(
      existsSync(path.join(mirrorRoot, "docs/HELM_INTERNAL_FREEZE_REFERENCE.md")),
    ).toBe(false);
    expect(JSON.parse(readText(mirrorRoot, "package.json"))).toEqual({
      name: "helm-console",
      private: false,
      license: "Apache-2.0",
      scripts: {
        dev: "next dev",
        "public:smoke:static": "tsx scripts/public-mirror-smoke.ts --repo-root .",
        "public:smoke": "tsx scripts/public-mirror-smoke.ts --repo-root . --run-commands",
      },
    });
    expect(readText(mirrorRoot, "lib/extensions/registry.tsx")).toBe(
      STUB_CONTENT,
    );
  });

  it("refuses to build directly into the source root", () => {
    seedPrivateSourceTree();

    expect(() =>
      buildPublicMirrorTree({ mirrorRoot: sourceRoot, sourceRoot }),
    ).toThrow("--mirror-root must not be the source repo root");
  });

  it("refuses to build a mirror nested inside the source root", () => {
    seedPrivateSourceTree();
    const nestedMirrorRoot = path.join(sourceRoot, "public-mirror");

    expect(() =>
      buildPublicMirrorTree({ mirrorRoot: nestedMirrorRoot, sourceRoot }),
    ).toThrow("--mirror-root must not be inside the source repo");
  });

  it("refuses to build into a non-empty mirror root without force-clean", () => {
    seedPrivateSourceTree();
    writeText(mirrorRoot, "old.txt", "old");

    expect(() => buildPublicMirrorTree({ mirrorRoot, sourceRoot })).toThrow(
      "--mirror-root must be empty; pass --force-clean to replace it",
    );
    expect(readText(mirrorRoot, "old.txt")).toBe("old");
  });

  it("replaces an existing mirror root only when force-clean is explicit", () => {
    seedPrivateSourceTree();
    writeText(mirrorRoot, "old.txt", "old");

    const result = buildPublicMirrorTree({
      forceClean: true,
      mirrorRoot,
      sourceRoot,
    });

    expect(result.exitCode).toBe(0);
    expect(existsSync(path.join(mirrorRoot, "old.txt"))).toBe(false);
    expect(readText(mirrorRoot, "README.md")).toBe("# Helm\n");
  });
});
