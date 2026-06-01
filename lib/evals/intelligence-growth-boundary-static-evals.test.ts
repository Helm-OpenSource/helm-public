import { describe, expect, it } from "vitest";
import { runIntelligenceGrowthBoundaryStaticEval } from "@/lib/evals/intelligence-growth-boundary-static-evals";

function evalFiles(content: string) {
  return runIntelligenceGrowthBoundaryStaticEval({
    files: [{ filePath: "lib/evals/intelligence-growth-example.ts", content }],
  });
}

describe("runIntelligenceGrowthBoundaryStaticEval", () => {
  it("passes with checked-in IGS files", () => {
    const summary = runIntelligenceGrowthBoundaryStaticEval();

    expect(summary.passed).toBe(true);
    expect(summary.scannedFileCount).toBeGreaterThan(0);
    expect(summary.failures).toHaveLength(0);
  });

  it("keeps static boundary gate candidate-only and non-executing", () => {
    const summary = runIntelligenceGrowthBoundaryStaticEval();

    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
    expect(summary.skillAutoPromotionAllowed).toBe(false);
  });

  it("fails on database imports and database env references", () => {
    const summary = evalFiles([
      `import { PrismaClient } from "${"@"}prisma/client";`,
      `const url = process.env.${["DATABASE", "URL"].join("_")};`,
    ].join("\n"));

    expect(summary.passed).toBe(false);
    expect(summary.forbiddenImportCount).toBeGreaterThan(0);
    expect(summary.forbiddenEnvCount).toBeGreaterThan(0);
    expect(summary.forbiddenDatabaseReferenceCount).toBeGreaterThan(0);
  });

  it("fails on provider env and network calls", () => {
    const summary = evalFiles([
      `const key = process.env.${["OPENAI", "API", "KEY"].join("_")};`,
      `await ${"fe"}tch("https://${["api", "openai", "com"].join(".")}/v1/responses");`,
    ].join("\n"));

    expect(summary.passed).toBe(false);
    expect(summary.forbiddenEnvCount).toBeGreaterThan(0);
    expect(summary.forbiddenNetworkCount).toBeGreaterThan(0);
    expect(summary.forbiddenRuntimeReferenceCount).toBeGreaterThan(0);
  });

  it("fails on app route and production query references", () => {
    const summary = evalFiles([
      `import { GET } from "${["@", "app", "api"].join("/")}";`,
      `import { list } from "${["@/data", "queries"].join("/")}";`,
    ].join("\n"));

    expect(summary.passed).toBe(false);
    expect(summary.forbiddenAppApiReferenceCount).toBeGreaterThan(0);
    expect(summary.forbiddenProductionQueryReferenceCount).toBeGreaterThan(0);
  });
});
