import { describe, expect, it } from "vitest";
import { runAgenticGovernanceBoundaryStaticEval } from "@/lib/evals/agentic-governance-boundary-static-evals";

function evalFiles(content: string) {
  return runAgenticGovernanceBoundaryStaticEval({
    files: [{ filePath: "features/agentic-governance/example.ts", content }],
  });
}

describe("runAgenticGovernanceBoundaryStaticEval", () => {
  it("passes with checked-in Agentic Governance and External Agent Intake files", () => {
    const summary = runAgenticGovernanceBoundaryStaticEval();

    expect(summary.passed).toBe(true);
    expect(summary.scannedFileCount).toBeGreaterThan(0);
    expect(summary.failures).toHaveLength(0);
  });

  it("keeps the gate offline-only, candidate-only, and non-executing", () => {
    const summary = runAgenticGovernanceBoundaryStaticEval();

    expect(summary.candidateOnly).toBe(true);
    expect(summary.offlineOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.providerClientAllowed).toBe(false);
    expect(summary.credentialUseAllowed).toBe(false);
    expect(summary.databaseAllowed).toBe(false);
    expect(summary.apiAllowed).toBe(false);
    expect(summary.uiAllowed).toBe(false);
    expect(summary.schemaChangeAllowed).toBe(false);
    expect(summary.directMustPushAllowed).toBe(false);
    expect(summary.directMemoryWriteAllowed).toBe(false);
  });

  it("fails on database imports, database env, and production query references", () => {
    const summary = evalFiles([
      `import { PrismaClient } from "${"@"}prisma/client";`,
      `const url = process.env.${["DATABASE", "URL"].join("_")};`,
      `import { list } from "${["@/data", "queries"].join("/")}";`,
    ].join("\n"));

    expect(summary.passed).toBe(false);
    expect(summary.forbiddenImportCount).toBeGreaterThan(0);
    expect(summary.forbiddenEnvCount).toBeGreaterThan(0);
    expect(summary.forbiddenDatabaseReferenceCount).toBeGreaterThan(0);
    expect(summary.forbiddenProductionQueryReferenceCount).toBeGreaterThan(0);
  });

  it("fails on provider clients, credential env, hosts, and network calls", () => {
    const summary = evalFiles([
      `import OpenAI from "openai";`,
      `import Responses from "openai/resources/responses";`,
      `const Anthropic = require("@anthropic-ai/sdk");`,
      `const Prisma = await import("${"@"}prisma/client");`,
      `import jsforce from "jsforce";`,
      `import HubSpot from "@hubspot/api-client";`,
      `const HubSpotRuntime = require("@hubspot/api-client");`,
      `const key = process.env.${["OPENAI", "API", "KEY"].join("_")};`,
      `await ${"fe"}tch("https://${["api", "openai", "com"].join(".")}/v1/responses");`,
    ].join("\n"));

    expect(summary.passed).toBe(false);
    expect(summary.forbiddenProviderClientReferenceCount).toBeGreaterThan(0);
    expect(summary.forbiddenCredentialReferenceCount).toBeGreaterThan(0);
    expect(summary.forbiddenEnvCount).toBeGreaterThan(0);
    expect(summary.forbiddenNetworkCount).toBeGreaterThan(0);
    expect(summary.forbiddenRuntimeReferenceCount).toBeGreaterThan(0);
  });

  it("fails on app API, Next server, UI route, and schema references", () => {
    const summary = evalFiles([
      `import { NextResponse } from "next/server";`,
      `import { GET } from "${["@", "app", "api", "agentic"].join("/")}";`,
      `const route = "${["app", "(workspace)", "settings"].join("/")}";`,
      `const schemaPath = "prisma/schema.prisma";`,
    ].join("\n"));

    expect(summary.passed).toBe(false);
    expect(summary.forbiddenAppApiReferenceCount).toBeGreaterThan(0);
    expect(summary.forbiddenSchemaReferenceCount).toBeGreaterThan(0);
  });

  it("does not block negative fixture wording without mechanical boundary evidence", () => {
    const summary = evalFiles([
      `const fixture = {`,
      `  text: "negative fixture says no automatic execution and no provider runtime for salesforce or hubspot",`,
      `  boundaryNote: "candidate-only review packet",`,
      `};`,
    ].join("\n"));

    expect(summary.passed).toBe(true);
    expect(summary.failures).toHaveLength(0);
  });
});
