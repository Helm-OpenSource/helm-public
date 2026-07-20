import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const sourceFilePattern = /\.[cm]?[jt]sx?$/;
const sourceTestFilePattern = /\.(test|spec)\.[cm]?[jt]sx?$/;

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const helmV2RuntimeGuardedFiles = [
  {
    relativePath: "lib/helm-v2/meeting-action-pack-runtime.ts",
    requiredImport: '@/lib/helm-v2/approval-matrix',
  },
  {
    relativePath: "lib/helm-v2/draft-comms-handoff-runtime.ts",
    requiredImport: '@/lib/helm-v2/approval-matrix',
  },
] as const;

const diagnosticsEvalJsonGuardedFiles = [
  {
    relativePath: "lib/evals/recommendation-evals.ts",
    requiredImport: '@/evals/recommendation/golden-samples.json',
  },
  {
    relativePath: "lib/evals/memory-evals.ts",
    requiredImport: '@/evals/memory/golden-samples.json',
  },
] as const;

const productionFixtureLoaderGuardedRoots = [
  "app",
  "features",
  "data",
  "lib/operating-system",
] as const;

function listSourceFiles(relativeRoots: readonly string[]) {
  const files: string[] = [];

  function visit(relativePath: string) {
    const fullPath = path.join(root, relativePath);
    if (!existsSync(fullPath)) {
      return;
    }

    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(fullPath, { withFileTypes: true })) {
        const entryRelativePath = path.join(relativePath, entry.name);
        if (entry.isDirectory()) {
          visit(entryRelativePath);
          continue;
        }
        if (!entry.isFile()) {
          continue;
        }
        if (!sourceFilePattern.test(entry.name) || sourceTestFilePattern.test(entry.name)) {
          continue;
        }
        files.push(entryRelativePath);
      }
      return;
    }

    const baseName = path.basename(relativePath);
    if (sourceFilePattern.test(baseName) && !sourceTestFilePattern.test(baseName)) {
      files.push(relativePath);
    }
  }

  for (const relativeRoot of relativeRoots) {
    visit(relativeRoot);
  }

  return files.sort();
}

describe("runtime build import guards", () => {
  it("keeps runtime modules off the helm-v2 barrel so eval harness cannot leak into production import chains", () => {
    const barrel = read("lib/helm-v2/index.ts");

    expect(barrel).toContain('export * from "@/lib/helm-v2/eval-harness"');

    for (const guardedFile of helmV2RuntimeGuardedFiles) {
      const content = read(guardedFile.relativePath);

      expect(content).toContain(guardedFile.requiredImport);
      expect(content).not.toContain('from "@/lib/helm-v2";');
      expect(content).not.toContain("from '@/lib/helm-v2';");
    }
  });

  it("keeps diagnostics-facing eval modules on static golden samples and isolates file-backed fixture loading", () => {
    const shared = read("lib/evals/shared.ts");
    const fixtureLoader = read("lib/evals/fixture-loader.ts");
    const evalHarness = read("lib/helm-v2/eval-harness.ts");

    for (const guardedFile of diagnosticsEvalJsonGuardedFiles) {
      const content = read(guardedFile.relativePath);

      expect(content).toContain(guardedFile.requiredImport);
      expect(content).not.toContain("loadEvalFixture");
      expect(content).not.toContain("@/lib/evals/fixture-loader");
    }

    expect(shared).not.toContain("loadEvalFixture");
    expect(shared).not.toContain("readFileSync");
    expect(shared).not.toContain("process.cwd()");
    expect(fixtureLoader).toContain("loadEvalFixture");
    expect(fixtureLoader).toContain("readFileSync");
    expect(fixtureLoader).toContain("process.cwd()");
    expect(evalHarness).toContain('@/lib/evals/fixture-loader');
  });

  it("keeps production surfaces and read-model scopes off the file-backed eval fixture loader", () => {
    const violations = listSourceFiles(productionFixtureLoaderGuardedRoots).filter((relativePath) => {
      const content = read(relativePath);
      return (
        content.includes("@/lib/evals/fixture-loader") ||
        content.includes("loadEvalFixture")
      );
    });

    expect(violations).toEqual([]);
  });

  it("keeps repo-external OpenClaw backup reads explicitly marked as Turbopack-ignored", () => {
    const openClawSyncService = read("lib/integrations/openclaw-memory/sync.service.ts");

    expect(openClawSyncService).toContain("turbopackIgnore: true */ backupDir");
    expect(openClawSyncService).toContain("turbopackIgnore: true */ fullPath");
  });

  it("keeps BI report runtime file-backed asset roots explicitly marked as Turbopack-ignored", () => {
    const skillLoader = read("lib/bi-report-skill/skill-loader.ts");
    const extensionManifests = read("lib/solution-extension-manifests.ts");
    const rootEnv = read("lib/root-env.ts");
    const odpsKnowledge = read("lib/bi-report-skill/odps-knowledge.ts");

    expect(skillLoader).toContain("turbopackIgnore: true */ process.cwd()");
    expect(extensionManifests).toContain("turbopackIgnore: true */ process.cwd()");
    expect(rootEnv).toContain("turbopackIgnore: true */ process.cwd()");
    expect(rootEnv).toContain("turbopackIgnore: true */ projectRoot");
    expect(rootEnv).toContain("turbopackIgnore: true */ filePath");
    expect(odpsKnowledge).toContain("turbopackIgnore: true */ process.cwd()");
    expect(odpsKnowledge).toContain("turbopackIgnore: true */ resolvedPath");
  });

  it("keeps private attachment storage I/O outside build-time file tracing", () => {
    const uploadRoute = read("app/api/opportunities/[id]/attachments/route.ts");
    const downloadRoute = read("app/api/opportunities/[id]/attachments/[attachmentId]/route.ts");
    const attachmentStorage = read("lib/opportunities/attachment-storage.ts");

    expect(uploadRoute).toContain("turbopackIgnore: true */ absoluteDir");
    expect(downloadRoute).toContain("turbopackIgnore: true */ absolutePath");
    expect(attachmentStorage).toContain("turbopackIgnore: true */ process.cwd()");
    expect(attachmentStorage).toContain("turbopackIgnore: true */ root");
  });

  it("keeps runtime stdio connector spawn lazy-loaded outside route tracing", () => {
    const dingTalkMcpClient = read("lib/connectors/dingtalk-mcp-client.ts");
    const odpsQueryAdapter = read("lib/bi-report-skill/query-adapters/odps.ts");

    expect(dingTalkMcpClient).not.toContain("import { spawn");
    expect(dingTalkMcpClient).toContain('await import("node:child_process")');
    expect(dingTalkMcpClient).toContain("await McpStdioClient.create()");
    expect(odpsQueryAdapter).not.toContain("import { spawn");
    expect(odpsQueryAdapter).toContain('await import("node:child_process")');
    expect(odpsQueryAdapter).toContain("await BiReportOdpsMcpClient.create()");
  });
});
