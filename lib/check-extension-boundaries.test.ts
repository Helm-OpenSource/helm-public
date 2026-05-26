import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runExtensionBoundaryCheck } from "../scripts/check-extension-boundaries";

let fixtureRoot: string;
const repoRoot = process.cwd();

function writeFixture(relativePath: string, content: string): void {
  const fullPath = path.join(fixtureRoot, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}

function runCheck() {
  return runExtensionBoundaryCheck({
    repoRoot: fixtureRoot,
  });
}

function validWorkerManifest(): string {
  return [
    "export const DEFAULT_OPERATION_MODE = \"observer\";",
    "export const manifest = {",
    "  forbiddenActions: [\"auto-send\", \"write-crm\"],",
    "  operationMode: DEFAULT_OPERATION_MODE,",
    "  dataAccess: {",
    "    reads: [\"case\"],",
    "    writes: [],",
    "  },",
    "};",
    "",
  ].join("\n");
}

function validWorkerDecide(): string {
  return [
    "export function decide(input: { caseId: string; now: string }) {",
    "  return { id: input.caseId, observedAt: input.now, action: \"review\" };",
    "}",
    "",
  ].join("\n");
}

describe("extension boundary check", () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "helm-extension-boundaries-"));
  });

  afterEach(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it("passes clean extension fixtures", () => {
    writeFixture(
      "extensions/tenant-alpha/sales/lib/gateway/source-client.ts",
      [
        "const callLogRepository = {};",
        "export async function loadSource() {",
        "  const fallback = { ok: false };",
        "  return fallback;",
        "}",
        "",
      ].join("\n"),
    );
    writeFixture(
      "extensions/tenant-alpha/sales/lib/runtime/service.ts",
      "export const service = { mode: \"review-only\" };\n",
    );
    writeFixture(
      "extensions/tenant-alpha/workers/review-driver/manifest.ts",
      validWorkerManifest(),
    );
    writeFixture(
      "extensions/tenant-alpha/workers/review-driver/decide.ts",
      validWorkerDecide(),
    );

    const result = runCheck();

    expect(result).toMatchObject({
      ok: true,
      exitCode: 0,
      issues: [],
      scannedManifests: 1,
      scannedDecides: 1,
    });
    expect(result.files).toHaveLength(4);
  });

  it("reports connector-isolation when extension business code calls fetch directly", () => {
    writeFixture(
      "extensions/tenant-alpha/sales/lib/runtime/service.ts",
      "export async function loadSource() { return fetch(\"https://example.test\"); }\n",
    );

    const result = runCheck();

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.issues).toEqual([
      {
        file: "extensions/tenant-alpha/sales/lib/runtime/service.ts",
        rule: "connector-isolation",
        message:
          "扩展业务代码不允许直接 fetch()；走 lib/gateway/ 出站。绕过请加 @bypass-connector-isolation 注释并在 PR 描述说明",
      },
    ]);
  });

  it("reports audit-enforced when a gateway client lacks call-log repository usage", () => {
    writeFixture(
      "extensions/tenant-alpha/sales/lib/gateway/source-client.ts",
      [
        "export async function loadSource() {",
        "  const fallback = { ok: false };",
        "  return fallback;",
        "}",
        "",
      ].join("\n"),
    );

    const result = runCheck();

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        file: "extensions/tenant-alpha/sales/lib/gateway/source-client.ts",
        rule: "audit-enforced",
        message:
          "出站 client 必须引用 call-log repository（每次出站强制审计落库）。绕过请加 @bypass-audit-enforced",
      },
    ]);
  });

  it("reports degraded-declared when a gateway client lacks fallback posture", () => {
    writeFixture(
      "extensions/tenant-alpha/sales/lib/gateway/source-client.ts",
      [
        "const callLogRepository = {};",
        "export async function loadSource() {",
        "  return { ok: true };",
        "}",
        "",
      ].join("\n"),
    );

    const result = runCheck();

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        file: "extensions/tenant-alpha/sales/lib/gateway/source-client.ts",
        rule: "degraded-declared",
        message:
          "出站 client 必须有 fallback / degraded / cache / mock 路径之一；不需要降级请在文件顶部加 @no-degraded 显式声明并附理由",
      },
    ]);
  });

  it("reports worker-manifest boundary issues deterministically", () => {
    writeFixture(
      "extensions/tenant-alpha/workers/review-driver/manifest.ts",
      [
        "export const manifest = {",
        "  forbiddenActions: [],",
        "  operationMode: \"executor\",",
        "  dataAccess: { writes: [\"case\"] },",
        "};",
        "",
      ].join("\n"),
    );

    const result = runCheck();

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        file: "extensions/tenant-alpha/workers/review-driver/manifest.ts",
        rule: "worker-manifest",
        message: "worker manifest 必须含非空 forbiddenActions 数组（best-practice §3 P5 / parent §10 边界）",
      },
      {
        file: "extensions/tenant-alpha/workers/review-driver/manifest.ts",
        rule: "worker-manifest",
        message:
          "worker manifest.operationMode 必须是 DEFAULT_OPERATION_MODE 或 \"observer\"（observer-first 起步原则）",
      },
      {
        file: "extensions/tenant-alpha/workers/review-driver/manifest.ts",
        rule: "worker-manifest",
        message: "worker manifest.dataAccess.writes 必须是空数组 []（preview 期 worker 自身禁写业务表）",
      },
    ]);
  });

  it("reports worker-decide-pure when decide.ts uses forbidden side-effect APIs", () => {
    writeFixture(
      "extensions/tenant-alpha/workers/review-driver/decide.ts",
      [
        "import { readFileSync } from \"node:fs\";",
        "export function decide() {",
        "  return { now: Date.now(), source: readFileSync(\"fixture.txt\", \"utf8\") };",
        "}",
        "",
      ].join("\n"),
    );

    const result = runCheck();

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        file: "extensions/tenant-alpha/workers/review-driver/decide.ts",
        rule: "worker-decide-pure",
        message: "worker decide.ts 必须是纯函数：禁用 node:fs",
      },
      {
        file: "extensions/tenant-alpha/workers/review-driver/decide.ts",
        rule: "worker-decide-pure",
        message: "worker decide.ts 必须是纯函数：禁用 Date.now() — 注入 now 参数",
      },
    ]);
  });

  it("keeps legal exemptions allowed", () => {
    writeFixture(
      "extensions/tenant-alpha/sales/lib/runtime/service.ts",
      [
        "// @bypass-connector-isolation covered by review-only local fixture",
        "export async function loadSource() { return fetch(\"https://example.test\"); }",
        "",
      ].join("\n"),
    );
    writeFixture(
      "extensions/tenant-alpha/sales/lib/runtime/service.test.ts",
      "export async function testFetch() { return fetch(\"https://example.test\"); }\n",
    );
    writeFixture(
      "extensions/tenant-alpha/sales/lib/runtime/sample.fixture.ts",
      "export async function fixtureFetch() { return fetch(\"https://example.test\"); }\n",
    );
    writeFixture(
      "extensions/tenant-alpha/sales/scripts/smoke.ts",
      "export async function smoke() { return fetch(\"https://example.test\"); }\n",
    );
    writeFixture(
      "extensions/tenant-alpha/sales/lib/gateway/source-client.ts",
      [
        "// @bypass-audit-enforced: local dry-run client",
        "// @no-degraded: local dry-run client",
        "export async function loadSource() { return fetch(\"https://example.test\"); }",
        "",
      ].join("\n"),
    );
    writeFixture(
      "extensions/tenant-alpha/workers/review-driver/manifest.ts",
      [
        "// @bypass-worker-manifest: fixture explicitly tests bypass plumbing",
        "export const manifest = {",
        "  forbiddenActions: [],",
        "  operationMode: \"executor\",",
        "  dataAccess: { writes: [\"case\"] },",
        "};",
        "",
      ].join("\n"),
    );
    writeFixture(
      "extensions/tenant-alpha/workers/review-driver/decide.ts",
      [
        "// @bypass-worker-decide-pure: fixture explicitly tests bypass plumbing",
        "import { readFileSync } from \"node:fs\";",
        "export function decide() { return readFileSync(\"fixture.txt\", \"utf8\"); }",
        "",
      ].join("\n"),
    );

    const result = runCheck();

    expect(result).toMatchObject({
      ok: true,
      exitCode: 0,
      issues: [],
    });
  });

  it("passes an empty extensions root without crashing", () => {
    mkdirSync(path.join(fixtureRoot, "extensions"), { recursive: true });

    const result = runCheck();

    expect(result).toMatchObject({
      ok: true,
      exitCode: 0,
      files: [],
      issues: [],
      scannedManifests: 0,
      scannedDecides: 0,
    });
  });

  it("passes a missing extensions root without crashing", () => {
    const result = runCheck();

    expect(result).toMatchObject({
      ok: true,
      exitCode: 0,
      files: [],
      issues: [],
      scannedManifests: 0,
      scannedDecides: 0,
    });
  });

  it("preserves CLI failure output and exit code", () => {
    writeFixture(
      "extensions/tenant-alpha/sales/lib/runtime/service.ts",
      "export async function loadSource() { return fetch(\"https://example.test\"); }\n",
    );

    try {
      execFileSync(
        path.join(repoRoot, "node_modules/.bin/tsx"),
        [path.join(repoRoot, "scripts/check-extension-boundaries.ts")],
        {
          cwd: fixtureRoot,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      throw new Error("expected CLI to fail");
    } catch (caught) {
      const error = caught as Error & {
        readonly status?: number;
        readonly stderr?: string;
      };
      expect(error.status).toBe(1);
      expect(error.stderr).toContain("[check:extension-boundaries] FAILED — 1 issue(s):");
      expect(error.stderr).toContain("[connector-isolation] (1)");
      expect(error.stderr).toContain("extensions/tenant-alpha/sales/lib/runtime/service.ts");
    }
  });
});
