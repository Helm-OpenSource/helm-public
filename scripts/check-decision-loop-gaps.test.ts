import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkDecisionLoopGaps,
  functionCallIndex,
  productionCallReferences,
  productionReferences,
  RECORDED_CLOSED_GAPS,
  RECORDED_OPEN_GAPS,
  RECORDED_REACHABLE,
  REGISTER_PATH,
  REQUIRED_REGISTER_MARKERS,
  wordBoundaryRegExp,
} from "./check-decision-loop-gaps";

/** A throwaway repository shaped like the claims this guard makes. */
function fixtureRepo(files: Readonly<Record<string, string>> = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), "gap-register-"));
  const fixtureFiles: Record<string, string> = {
    [REGISTER_PATH]: `${REQUIRED_REGISTER_MARKERS.join("\n")}\n`,
    "prisma/schema.prisma": "",
    "lib/stage1-owner-loop/decision-follow-through.service.ts":
      "export function recordStage1SupervisionSignal() {}\n",
    "lib/stage1-owner-loop/decision-evaluation.service.ts":
      "export function evaluateStage1DecisionRecord() {}\n",
    "lib/stage1-owner-loop/terminal-result-reconciliation.service.ts": [
      "Prisma.TransactionIsolationLevel.Serializable;",
      "await db.$transaction(async (tx) => {",
      "await verifyExecutionReceipt({}, { client: tx });",
      "const evaluation = await evaluateStage1DecisionRecord({});",
      "const evaluationTx = { client: tx };",
      "const supervisionSignal = await recordStage1SupervisionSignal({}, { client: tx });",
    ].join("\n"),
    "features/approvals/actions.ts": [
      "await reconcileStage1TerminalResult({});",
      "await verifyExecutionReceipt({});",
    ].join("\n"),
    "lib/stage1-owner-loop/private-execution-result-ingress.service.ts": [
      "Prisma.TransactionIsolationLevel.Serializable;",
      "await resolveCaioFdePortfolioScope({});",
      "await resolveCaioFdeObservationEvidence({});",
      "await recordExecutionReceipt({}, { client: tx });",
    ].join("\n"),
    "tools/caio-access-gateway/server.ts": [
      "await ingestCaioPrivateExecutionResultProjection({});",
      "const registry = createCaioOperatingQuestionPackProviderRegistry();",
      "registerCaioOperatingQuestionPackProvider({ registry, provider });",
      "const caller = createCaioOperatingQuestionProductionCaller({ providerRegistry: registry });",
    ].join("\n"),
    "lib/caio-access-gateway/gateway-http-core.ts": [
      'path === "/v1/execution-results";',
      "const request = parseCaioOperatingQuestionGenerationRequest(payload);",
      "await dependencies.operatingQuestionGeneration({ request });",
    ].join("\n"),
    "lib/stage1-owner-loop/caio-operating-question-store.service.ts": [
      "export async function generateCaioOperatingQuestionPortfolioFromPackInput() {}",
      "validateCaioProFdeInterfaceDescriptor({});",
      "caioProPackOperatingInputSchema.safeParse({});",
      "await resolveCaioFdePortfolioScope({});",
      "await resolveCaioFdeObservationEvidence({});",
      "generateCaioOperatingQuestionPortfolioInternal({});",
    ].join("\n"),
    "lib/stage1-owner-loop/caio-operating-question-production-caller.service.ts": [
      "const provider = registry.resolve();",
      "const packInput = await provider.resolveOperatingInput(scope);",
      "return generateCaioOperatingQuestionPortfolioFromPackInput({ packInput });",
    ].join("\n"),
    "lib/stage1-owner-loop/caio-operating-question-pack-provider-registry.ts": [
      "export function createCaioOperatingQuestionPackProviderRegistry() {}",
      "export function registerCaioOperatingQuestionPackProvider() {}",
    ].join("\n"),
    "docs/contracts/caio-pro-fde-cross-repo-interface.v1.schema.json":
      JSON.stringify({
        $id: "https://helm.dev/contracts/caio-pro-fde-cross-repo-interface.v1.schema.json",
        oneOf: [{}, {}],
        $defs: {
          packOperatingInput: { additionalProperties: false },
          privateExecutionResultProjection: { additionalProperties: false },
        },
      }),
    ...Object.fromEntries(
      RECORDED_REACHABLE.map((fact) => [fact.file, `${fact.needle}\n`]),
    ),
    ...files,
  };
  for (const [file, contents] of Object.entries(fixtureFiles)) {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  return root;
}

describe("decision loop gap register", () => {
  it("matches this repository as written", () => {
    expect(checkDecisionLoopGaps(process.cwd())).toEqual([]);
  });

  it("checks two closed producer gaps, one open persistence gap, and controls", () => {
    expect(RECORDED_CLOSED_GAPS.map((entry) => entry.gap)).toEqual([
      "GAP-1",
      "GAP-2",
    ]);
    expect(RECORDED_OPEN_GAPS.map((entry) => entry.gap)).toEqual(["GAP-3"]);
    expect(RECORDED_REACHABLE.length).toBeGreaterThanOrEqual(4);
    expect(REQUIRED_REGISTER_MARKERS).toHaveLength(3);
    expect(REGISTER_PATH).toMatch(/\.md$/u);
  });

  describe("closed production paths", () => {
    for (const entry of ["GAP-1", "GAP-2"] as const) {
      it(`fails when ${entry}'s terminal producer call is removed`, () => {
        const closed = RECORDED_CLOSED_GAPS.find(
          (candidate) => candidate.gap === entry,
        );
        expect(closed).toBeDefined();
        const other = RECORDED_CLOSED_GAPS.find(
          (candidate) => candidate.gap !== entry,
        );
        expect(other).toBeDefined();
        const root = fixtureRepo({
          [closed!.producerFile]: [
            `const evaluation = await ${
              entry === "GAP-2"
                ? `${closed!.producerNeedle}Removed`
                : other!.producerNeedle
            }({});`,
            `const supervisionSignal = await ${
              entry === "GAP-1"
                ? `${closed!.producerNeedle}Removed`
                : other!.producerNeedle
            }({});`,
          ].join("\n"),
        });

        const findings = checkDecisionLoopGaps(root);
        expect(findings.some((finding) => finding.gap === entry)).toBe(true);
      });
    }

    it("fails when approvals no longer invokes the terminal reconciler", () => {
      const root = fixtureRepo({
        "features/approvals/actions.ts": "await verifyExecutionReceipt({});\n",
      });
      const findings = checkDecisionLoopGaps(root);

      expect(findings.filter((finding) => finding.gap === "GAP-1")).toHaveLength(
        1,
      );
      expect(findings.filter((finding) => finding.gap === "GAP-2")).toHaveLength(
        1,
      );
    });

    it("fails when supervision is attempted before the decision evaluation", () => {
      const root = fixtureRepo({
        "lib/stage1-owner-loop/terminal-result-reconciliation.service.ts": [
          "Prisma.TransactionIsolationLevel.Serializable;",
          "await db.$transaction(async (tx) => {",
          "await verifyExecutionReceipt({}, { client: tx });",
          "const supervisionSignal = await recordStage1SupervisionSignal({});",
          "const evaluation = await evaluateStage1DecisionRecord({});",
        ].join("\n"),
      });
      const findings = checkDecisionLoopGaps(root);

      expect(findings.some((finding) => finding.detail.includes("order"))).toBe(
        true,
      );
    });

    it("recognizes governed producer calls wrapped by an error normalizer", () => {
      const source = [
        "Prisma.TransactionIsolationLevel.Serializable;",
        "await db.$transaction(async (tx) => {",
        "await verifyExecutionReceipt({}, { client: tx });",
        "const evaluation = await runStep(() =>",
        "  evaluateStage1DecisionRecord({}, { client: tx }),",
        ");",
        "const supervision = await runStep(() =>",
        "  recordStage1SupervisionSignal({}, { client: tx }),",
        ");",
      ].join("\n");
      const root = fixtureRepo({
        "lib/stage1-owner-loop/terminal-result-reconciliation.service.ts":
          source,
      });

      expect(functionCallIndex(source, "evaluateStage1DecisionRecord")).toBeLessThan(
        functionCallIndex(source, "recordStage1SupervisionSignal"),
      );
      expect(checkDecisionLoopGaps(root)).toEqual([]);
    });

    it("fails when the terminal producer loses its atomic transaction boundary", () => {
      const root = fixtureRepo({
        "lib/stage1-owner-loop/terminal-result-reconciliation.service.ts": [
          "await verifyExecutionReceipt({});",
          "await evaluateStage1DecisionRecord({});",
          "await recordStage1SupervisionSignal({});",
        ].join("\n"),
      });

      const findings = checkDecisionLoopGaps(root);
      expect(
        findings.some(
          (finding) =>
            finding.gap === "terminal-atomicity" &&
            finding.detail.includes("SERIALIZABLE"),
        ),
      ).toBe(true);
    });

    it("fails when the authenticated private ingress is no longer production-wired", () => {
      const root = fixtureRepo({
        "tools/caio-access-gateway/server.ts": "ingress removed\n",
      });

      expect(checkDecisionLoopGaps(root)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ gap: "private-ingress" }),
        ]),
      );
    });

    it("fails when Pack input bypasses the workspace evidence resolver", () => {
      const root = fixtureRepo({
        "lib/stage1-owner-loop/caio-operating-question-store.service.ts": [
          "export async function generateCaioOperatingQuestionPortfolioFromPackInput() {}",
          "validateCaioProFdeInterfaceDescriptor({});",
          "caioProPackOperatingInputSchema.safeParse({});",
          "generateCaioOperatingQuestionPortfolioInternal({});",
        ].join("\n"),
      });

      expect(checkDecisionLoopGaps(root)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ gap: "pack-consumer" }),
        ]),
      );
    });

    it("fails when the sole production Pack generator caller is replaced by a string marker", () => {
      const root = fixtureRepo({
        "lib/stage1-owner-loop/caio-operating-question-production-caller.service.ts":
          'const marker = "generateCaioOperatingQuestionPortfolioFromPackInput({})";\n',
        "lib/fake-pack-caller.test.ts":
          "generateCaioOperatingQuestionPortfolioFromPackInput({});\n",
        "lib/fake-pack-caller-schema.ts":
          "type Definition = { generateCaioOperatingQuestionPortfolioFromPackInput(input: unknown): void };\n",
      });

      expect(checkDecisionLoopGaps(root)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ gap: "pack-consumer" }),
        ]),
      );
    });

    it("fails when the production composition deletes provider registration", () => {
      const root = fixtureRepo({
        "tools/caio-access-gateway/server.ts": [
          "await ingestCaioPrivateExecutionResultProjection({});",
          "const registry = createCaioOperatingQuestionPackProviderRegistry();",
          'const marker = "registerCaioOperatingQuestionPackProvider({})";',
          "const caller = createCaioOperatingQuestionProductionCaller({ providerRegistry: registry });",
        ].join("\n"),
        "lib/fake-provider-registration.test.ts":
          "registerCaioOperatingQuestionPackProvider({});\n",
        "lib/fake-provider-registration-schema.ts":
          "interface Registration { registerCaioOperatingQuestionPackProvider(input: unknown): void }\n",
      });

      expect(checkDecisionLoopGaps(root)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ gap: "pack-consumer" }),
        ]),
      );
    });

    it("fails when a second production module calls the Core generator", () => {
      const root = fixtureRepo({
        "tools/alternate-question-runtime.ts":
          "await generateCaioOperatingQuestionPortfolioFromPackInput({});\n",
      });

      expect(checkDecisionLoopGaps(root)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            gap: "pack-consumer",
            detail: expect.stringContaining("alternate-question-runtime.ts"),
          }),
        ]),
      );
    });

    it("fails when a second production module registers a Pack provider", () => {
      const root = fixtureRepo({
        "tools/alternate-pack-composition.ts":
          "registerCaioOperatingQuestionPackProvider({ registry, provider });\n",
      });

      expect(checkDecisionLoopGaps(root)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            gap: "pack-consumer",
            detail: expect.stringContaining("alternate-pack-composition.ts"),
          }),
        ]),
      );
    });

    it("fails when any Public production module reverse-imports the Pack repository", () => {
      const forbiddenModule = ["helm", "packs/runtime"].join("-");
      const root = fixtureRepo({
        "lib/reverse-pack-dependency.ts": `import provider from ${JSON.stringify(forbiddenModule)};\nprovider();\n`,
      });

      expect(checkDecisionLoopGaps(root)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            gap: "pack-consumer",
            detail: expect.stringContaining("reverse-pack-dependency.ts"),
          }),
        ]),
      );
    });

    it("finds a production reference but excludes definitions and tests", () => {
      const root = fixtureRepo({
        "lib/caller.ts":
          'import { recordStage1SupervisionSignal } from "x";\n',
        "lib/thing.test.ts":
          'import { recordStage1SupervisionSignal } from "x";\n',
      });

      expect(
        productionReferences(
          root,
          "recordStage1SupervisionSignal",
          "lib/stage1-owner-loop/decision-follow-through.service.ts",
        ),
      ).toEqual([
        "lib/caller.ts",
        "lib/stage1-owner-loop/terminal-result-reconciliation.service.ts",
      ]);
    });

    it("finds real production calls but excludes imports, strings, type signatures, and tests", () => {
      const root = fixtureRepo({
        "lib/real-call.ts":
          "await generateCaioOperatingQuestionPortfolioFromPackInput({});\n",
        "lib/import-only.ts":
          'import { generateCaioOperatingQuestionPortfolioFromPackInput } from "x";\n',
        "lib/string-only.ts":
          'const marker = "generateCaioOperatingQuestionPortfolioFromPackInput({})";\n',
        "lib/type-only.ts":
          "interface Generator { generateCaioOperatingQuestionPortfolioFromPackInput(input: unknown): void }\n",
        "lib/call-only.test.ts":
          "generateCaioOperatingQuestionPortfolioFromPackInput({});\n",
      });

      expect(
        productionCallReferences(
          root,
          "generateCaioOperatingQuestionPortfolioFromPackInput",
          "lib/stage1-owner-loop/caio-operating-question-store.service.ts",
        ),
      ).toEqual([
        "lib/real-call.ts",
        "lib/stage1-owner-loop/caio-operating-question-production-caller.service.ts",
      ]);
    });

    it("fails when a second production path calls a canonical producer directly", () => {
      const root = fixtureRepo({
        "lib/alternate-terminal-runtime.ts":
          "await recordStage1SupervisionSignal({});\n",
      });

      const findings = checkDecisionLoopGaps(root);

      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            gap: "GAP-1",
            detail: expect.stringContaining("alternate-terminal-runtime.ts"),
          }),
        ]),
      );
    });

    it("fails when a second production entry invokes the terminal reconciler", () => {
      const root = fixtureRepo({
        "app/api/alternate-terminal/route.ts":
          "await reconcileStage1TerminalResult({});\n",
      });

      const findings = checkDecisionLoopGaps(root);

      expect(findings.filter((finding) => finding.gap === "GAP-1")).toHaveLength(
        1,
      );
      expect(findings.filter((finding) => finding.gap === "GAP-2")).toHaveLength(
        1,
      );
      expect(findings[0]?.detail).toContain("alternate-terminal/route.ts");
    });
  });

  describe("the remaining open gap", () => {
    it("fails when a Company Memory persistence model appears", () => {
      const root = fixtureRepo({
        "prisma/schema.prisma": "model KnowledgeCard {\n  id String @id\n}\n",
      });
      const findings = checkDecisionLoopGaps(root);

      expect(findings).toHaveLength(1);
      expect(findings[0]?.gap).toBe("GAP-3");
    });
  });

  describe("register and closed-loop controls", () => {
    it("fails when a recorded-closed fact stops being true", () => {
      const [fact] = RECORDED_REACHABLE;
      const root = fixtureRepo({ [fact.file]: "gone\n" });
      const findings = checkDecisionLoopGaps(root);

      expect(findings).toHaveLength(1);
      expect(findings[0]?.gap).toBe("control");
      expect(findings[0]?.detail).toContain(fact.file);
    });

    it("fails when a checked gap status marker is missing", () => {
      const root = fixtureRepo({
        [REGISTER_PATH]: `${REQUIRED_REGISTER_MARKERS.slice(1).join("\n")}\n`,
      });
      const findings = checkDecisionLoopGaps(root);

      expect(findings).toHaveLength(1);
      expect(findings[0]?.gap).toBe("register");
    });

    it("matches on a word boundary, so a rename cannot survive the check", () => {
      expect(
        wordBoundaryRegExp("Stage1DecisionQueue").test(
          "<Stage1DecisionQueue />",
        ),
      ).toBe(true);
      expect(
        wordBoundaryRegExp("Stage1DecisionQueue").test(
          "<Stage1DecisionQueueX />",
        ),
      ).toBe(false);
      expect(
        wordBoundaryRegExp("decisionRecord.create").test(
          "tx.decisionRecord.create({",
        ),
      ).toBe(true);
      expect(
        wordBoundaryRegExp("decisionRecord.create").test(
          "tx.decisionRecord.created",
        ),
      ).toBe(false);
    });
  });

  it("fails when the register itself is gone", () => {
    const root = mkdtempSync(path.join(tmpdir(), "gap-register-missing-"));
    mkdirSync(path.join(root, "prisma"), { recursive: true });
    writeFileSync(path.join(root, "prisma/schema.prisma"), "");

    const findings = checkDecisionLoopGaps(root);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain(REGISTER_PATH);
  });
});
