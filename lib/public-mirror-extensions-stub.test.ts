import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildPublicMirrorExtensionsStub,
  resolveRegistryPath,
  STUB_CONTENT,
} from "../scripts/build-public-mirror-extensions-stub";

let fixtureRoot: string;
const repoRoot = process.cwd();

const requiredPublicExports = [
  "resolveReportsExtensions",
  "resolveImportsExtensions",
  "resolveApprovalsExtensions",
  "logReportsExtensionPageView",
  "getBiReportP0ProcessSkillKey",
  "listRegisteredSignalCollectionJobs",
  "previewBiReportP0ProcessSignals",
  "persistBiReportP0ProcessSignals",
  "runRegisteredSignalCollectionJobs",
  "startRegisteredSignalCollectionScheduler",
] as const;

function writeRegistry(content: string): string {
  const registryPath = resolveRegistryPath(fixtureRoot);
  mkdirSync(path.dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, content, "utf8");
  return registryPath;
}

function readRegistry(): string {
  return readFileSync(resolveRegistryPath(fixtureRoot), "utf8");
}

function exportedFunctionNames(source: string): string[] {
  return [...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)]
    .map((match) => match[1])
    .sort();
}

function exportedFunctionSignatures(source: string): Record<string, string> {
  const signatures = new Map<string, string>();
  for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)\s*\(/g)) {
    const start = match.index;
    const name = match[1];
    if (start === undefined || !name) continue;

    let parenDepth = 0;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (char === "(") {
        parenDepth += 1;
      } else if (char === ")") {
        parenDepth -= 1;
      } else if (char === "{" && parenDepth === 0) {
        signatures.set(
          name,
          source
            .slice(start, index)
            .replace(/\b_(?=[A-Za-z]\w*\s*:)/g, "")
            .replace(/\s+/g, " ")
            .trim(),
        );
        break;
      }
    }
  }

  return Object.fromEntries([...signatures.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  ));
}

function exportedTypeNames(source: string): string[] {
  return [...source.matchAll(/export\s+type\s+(\w+)/g)]
    .map((match) => match[1])
    .sort();
}

describe("public mirror extensions stub builder", () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "helm-public-mirror-stub-"));
  });

  afterEach(() => {
    process.chdir(repoRoot);
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it("rejects a private registry in check mode without mutation", () => {
    const tenantSlug = ["gua", "ng", "pu"].join("");
    const privateImportPath = ["@/", "extensions", tenantSlug, "bi-report"].join("/");
    const privateRegistry = [
      'import "server-only";',
      `import { privateRuntime } from "${privateImportPath}";`,
      "",
      "export function resolveReportsExtensions() {",
      "  return privateRuntime;",
      "}",
      "",
    ].join("\n");
    const registryPath = writeRegistry(privateRegistry);

    const result = buildPublicMirrorExtensionsStub({
      repoRoot: fixtureRoot,
      checkMode: true,
    });

    expect(result).toEqual({
      status: "not-stub",
      registryPath,
      exitCode: 1,
    });
    expect(readRegistry()).toBe(privateRegistry);
  });

  it("writes the deterministic stub once and is idempotent on the second run", () => {
    writeRegistry('import "server-only";\nexport {};\n');
    process.chdir(fixtureRoot);

    const first = buildPublicMirrorExtensionsStub();
    const firstContent = readRegistry();
    const second = buildPublicMirrorExtensionsStub();
    const secondContent = readRegistry();

    expect(first.status).toBe("wrote-stub");
    expect(second.status).toBe("already-stub");
    expect(firstContent).toBe(STUB_CONTENT);
    expect(secondContent).toBe(firstContent);
  });

  it("keeps generated public exports in parity with the private registry seam", () => {
    const realRegistry = readFileSync(
      path.join(repoRoot, "lib/extensions/registry.tsx"),
      "utf8",
    );

    expect(exportedFunctionNames(STUB_CONTENT)).toEqual(
      exportedFunctionNames(realRegistry),
    );
    expect(exportedFunctionSignatures(STUB_CONTENT)).toEqual(
      exportedFunctionSignatures(realRegistry),
    );
    expect(exportedTypeNames(STUB_CONTENT)).toEqual(exportedTypeNames(realRegistry));

    for (const exportName of requiredPublicExports) {
      expect(exportedFunctionNames(STUB_CONTENT)).toContain(exportName);
    }
  });

  it("does not generate tenant-private imports or known private tokens", () => {
    const tenantSlug = ["gua", "ng", "pu"].join("");
    const adjacentTenantSlug = ["mi", "dun"].join("");
    const tenantRoot = ["extensions", tenantSlug].join("/");
    const scopedTenantImport = ["@/", "extensions", tenantSlug].join("/");
    const commercialRoot = ["customer", "proof", "packs"].join("-");
    const internalHostToken = [
      ["rm", "shuyao"].join("-"),
      "dev",
      "rds",
      "aliyuncs",
      "com",
    ].join(".");

    expect(STUB_CONTENT).not.toContain(tenantSlug);
    expect(STUB_CONTENT).not.toContain(adjacentTenantSlug);
    expect(STUB_CONTENT).not.toContain(tenantRoot);
    expect(STUB_CONTENT).not.toContain(scopedTenantImport);
    expect(STUB_CONTENT).not.toContain(commercialRoot);
    expect(STUB_CONTENT).not.toContain(internalHostToken);
  });
});
