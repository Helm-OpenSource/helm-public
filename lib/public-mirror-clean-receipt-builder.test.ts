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

import { buildPublicMirrorCleanReceipt } from "../scripts/build-public-mirror-clean-receipt";
import {
  PUBLIC_MIRROR_CLEAN_RECEIPT_KIND,
  getPublicMirrorCleanReceiptPath,
  validateSecretHistoryReceipt,
} from "../scripts/release-readiness-check";

let fixtureParent: string;
let sourceRoot: string;
let mirrorRoot: string;
let receiptRepoRoot: string;

const tenantSlug = ["gua", "ng", "pu"].join("");
const tenantPrivateRoot = ["extensions", tenantSlug].join("/");

function writeText(root: string, relativePath: string, content: string): void {
  const fullPath = path.join(root, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  writeText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
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
  writeText(sourceRoot, `${tenantPrivateRoot}/private.ts`, "tenant private");
}

describe("public mirror clean receipt builder", () => {
  beforeEach(() => {
    fixtureParent = mkdtempSync(path.join(tmpdir(), "helm-public-clean-receipt-"));
    sourceRoot = path.join(fixtureParent, "source");
    mirrorRoot = path.join(fixtureParent, "mirror");
    receiptRepoRoot = path.join(fixtureParent, "receipt-repo");
    mkdirSync(sourceRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(fixtureParent, { force: true, recursive: true });
  });

  it("builds and validates a sanitized public mirror clean receipt", () => {
    seedPrivateSourceTree();
    const receiptId = "public-mirror-2026-05-17-smoke";

    const result = buildPublicMirrorCleanReceipt({
      createdAt: "2026-05-17",
      mirrorRoot,
      receiptId,
      repoRoot: receiptRepoRoot,
      sourceRef: "main@abcdef0",
      sourceRoot,
    });

    expect(result.mirrorBuild.exitCode).toBe(0);
    expect(result.receiptPath).toBe(
      getPublicMirrorCleanReceiptPath(receiptId, { repoRoot: receiptRepoRoot }),
    );
    expect(validateSecretHistoryReceipt(`mirror-clean:${receiptId}`, {
      repoRoot: receiptRepoRoot,
    })).toBe(undefined);

    const receipt = readJson(result.receiptPath);
    expect(receipt).toMatchObject({
      receiptId,
      kind: PUBLIC_MIRROR_CLEAN_RECEIPT_KIND,
      createdAt: "2026-05-17",
      sourceRef: "main@abcdef0",
    });
    const commandEvidence = receipt.commandEvidence as Array<Record<string, unknown>>;
    expect(commandEvidence[0]).toMatchObject({
      command: "npm run public-mirror:build -- --mirror-root <candidate>",
      completedAt: "2026-05-17",
      exitCode: 0,
    });
    expect(commandEvidence[0].scannedFiles).toBeGreaterThan(0);
    expect(JSON.stringify(receipt)).not.toContain(fixtureParent);
    expect(JSON.stringify(receipt)).not.toContain(mirrorRoot);
    expect(JSON.stringify(receipt)).not.toContain(sourceRoot);
  });

  it("refuses to overwrite an existing receipt id", () => {
    seedPrivateSourceTree();
    const receiptId = "public-mirror-2026-05-17-repeat";
    const options = {
      createdAt: "2026-05-17",
      forceClean: true,
      mirrorRoot,
      receiptId,
      repoRoot: receiptRepoRoot,
      sourceRef: "main@abcdef0",
      sourceRoot,
    } as const;

    buildPublicMirrorCleanReceipt(options);

    expect(() => buildPublicMirrorCleanReceipt(options)).toThrow("already exists");
  });

  it("does not write a receipt when the mirror verifier fails", () => {
    seedPrivateSourceTree();
    writeText(
      sourceRoot,
      "lib/leaked-tenant-slug.ts",
      `export const leakedTenantSlug = "${tenantSlug}";\n`,
    );
    const receiptId = "public-mirror-2026-05-17-fail";
    const receiptPath = getPublicMirrorCleanReceiptPath(receiptId, {
      repoRoot: receiptRepoRoot,
    });

    expect(() =>
      buildPublicMirrorCleanReceipt({
        createdAt: "2026-05-17",
        mirrorRoot,
        receiptId,
        repoRoot: receiptRepoRoot,
        sourceRef: "main@abcdef0",
        sourceRoot,
      }),
    ).toThrow("public mirror build failed; receipt not written");
    expect(existsSync(receiptPath)).toBe(false);
  });
});
