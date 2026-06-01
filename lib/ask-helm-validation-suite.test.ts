import { afterEach, describe, expect, it, vi } from "vitest";

async function loadSuiteModule() {
  vi.resetModules();
  return import("@/scripts/ask-helm-validation-suite");
}

function buildQueryIntentSummary(overrides: Record<string, unknown> = {}) {
  return {
    minimumPassRate: 80,
    totalCases: 10,
    passedCases: 10,
    passRate: 100,
    meetsMinimumPassRate: true,
    byIntent: [],
    cases: [],
    ...overrides,
  };
}

function buildActionIntentSummary(overrides: Record<string, unknown> = {}) {
  return {
    minimumPassRate: 90,
    totalCases: 10,
    passedCases: 10,
    passRate: 100,
    meetsMinimumPassRate: true,
    byIntent: [],
    cases: [],
    ...overrides,
  };
}

function buildActionPacketSummary(overrides: Record<string, unknown> = {}) {
  return {
    passed: true,
    totalCases: 4,
    passedCases: 4,
    failureCount: 0,
    authorityLeakCount: 0,
    cases: [],
    failures: [],
    ...overrides,
  };
}

function buildContextPacketSummary(overrides: Record<string, unknown> = {}) {
  return {
    passed: true,
    version: "test",
    totalCases: 4,
    passedCases: 4,
    expectedPositiveCases: 3,
    expectedNegativeCases: 1,
    failureCount: 0,
    warningCount: 0,
    authorityLeakCount: 0,
    rawLeakCount: 0,
    memoryPolicyViolationCount: 0,
    redactionCoveragePercent: 100,
    contextCoveragePercent: 100,
    caseResults: [],
    failures: [],
    ...overrides,
  };
}

function buildInterpreterResponse(overrides: Record<string, unknown> = {}) {
  return {
    classification: {
      intentType: "current_status",
      normalizedQuery: "status",
    },
    retrievalPlan: {
      readOnly: true,
      writePath: false,
      sources: ["object_search"],
      deniedSources: [],
      reason: "test",
    },
    answer: {
      summary: "test answer",
      confidence: "high",
    },
    nextStep: {
      primary: {
        type: "page_target",
        target: "/operating",
        label: "Open operating",
      },
    },
    grounding: {
      workspaceContext: ["workspace:demo"],
      memoryUsed: false,
      systemKnowledgeUsed: true,
    },
    ...overrides,
  };
}

function buildMemberAccessScope(overrides: Record<string, unknown> = {}) {
  return {
    canAsk: true,
    objectReadScope: "current_workspace",
    allowedHelpPages: ["/search"],
    deniedHelpTopics: ["reserved_internal_truth"],
    retrievalSourcePolicy: {
      objectSearch: "current_workspace_only",
      memorySummary: "current_workspace_only",
      workspaceContext: "current_workspace_only",
      knowledgePack: "capability_aware",
      officialWritePath: "denied",
    },
    featureAvailability: {
      enabledTenantExtensions: ["bi-report"],
      enabledFeatures: [],
      disabledFeatures: [],
    },
    boundaryNotes: [],
    ...overrides,
  };
}

function buildNoMembershipAccessScope(overrides: Record<string, unknown> = {}) {
  return {
    canAsk: false,
    objectReadScope: "none",
    allowedHelpPages: [],
    deniedHelpTopics: [],
    retrievalSourcePolicy: {
      objectSearch: "denied",
      memorySummary: "denied",
      workspaceContext: "denied",
      knowledgePack: "denied",
      officialWritePath: "denied",
    },
    featureAvailability: {
      enabledTenantExtensions: [],
      enabledFeatures: [],
      disabledFeatures: [],
    },
    boundaryNotes: [],
    ...overrides,
  };
}

function buildPassingDeps() {
  return {
    runQueryIntentEval: () => buildQueryIntentSummary(),
    runActionIntentEval: () => buildActionIntentSummary(),
    runActionPacketEval: () => buildActionPacketSummary(),
    runContextPacketEval: () => buildContextPacketSummary(),
    loadKnowledgePack: () => ({ id: "test-pack" }),
    validateKnowledgePack: () => ({ ok: true, failures: [] }),
    interpretQuery: () => buildInterpreterResponse(),
    resolveAccessScope: (input: { hasWorkspaceMembership: boolean }) =>
      input.hasWorkspaceMembership
        ? buildMemberAccessScope()
        : buildNoMembershipAccessScope(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Ask Helm validation suite seam", () => {
  it("aggregates an ok report on the happy path", async () => {
    const suite = await loadSuiteModule();

    const report = suite.runAskHelmValidationSuite(buildPassingDeps());

    expect(report.ok).toBe(true);
    expect(report.failures).toEqual([]);
    expect(report.queryIntent).toEqual({
      totalCases: 10,
      passedCases: 10,
      passRate: 100,
    });
    expect(report.actionIntent).toEqual({
      totalCases: 10,
      passedCases: 10,
      passRate: 100,
    });
    expect(report.actionPacket).toEqual({
      totalCases: 4,
      passedCases: 4,
      failureCount: 0,
      authorityLeakCount: 0,
    });
    expect(report.interpreter.totalCases).toBe(10);
    expect(report.stopConditions.every((condition: { clear: boolean }) => condition.clear)).toBe(
      true,
    );
  });

  it("aggregates query, action, context, knowledge, interpreter, access, and stop-condition failures", async () => {
    const suite = await loadSuiteModule();

    const failingDeps = {
      ...buildPassingDeps(),
      runQueryIntentEval: () =>
        buildQueryIntentSummary({
          passedCases: 7,
          passRate: 70,
          meetsMinimumPassRate: false,
        }),
      runActionIntentEval: () =>
        buildActionIntentSummary({
          passedCases: 8,
          passRate: 80,
          meetsMinimumPassRate: false,
        }),
      runContextPacketEval: () =>
        buildContextPacketSummary({
          passed: false,
          passedCases: 3,
          failures: [{ caseId: "ctx_bad", reason: "authority_leak" }],
        }),
      validateKnowledgePack: () => ({
        ok: false,
        failures: ["knowledge pack missing required section"],
      }),
      interpretQuery: () =>
        buildInterpreterResponse({
          classification: {
            intentType: "plan_breakdown",
            normalizedQuery: "plan",
          },
          retrievalPlan: {
            readOnly: false,
            writePath: true,
            sources: ["object_search"],
            deniedSources: [],
            reason: "test bad path",
          },
          nextStep: {
            primary: {
              type: "page_target",
              target: "",
              label: "Missing target",
            },
          },
        }),
      resolveAccessScope: (input: { hasWorkspaceMembership: boolean }) =>
        input.hasWorkspaceMembership
          ? buildMemberAccessScope({
              canAsk: false,
              objectReadScope: "none",
              deniedHelpTopics: [],
            })
          : buildNoMembershipAccessScope({
              canAsk: true,
              retrievalSourcePolicy: {
                objectSearch: "current_workspace_only",
                memorySummary: "denied",
                workspaceContext: "denied",
                knowledgePack: "denied",
                officialWritePath: "denied",
              },
            }),
    };
    const report = suite.runAskHelmValidationSuite(failingDeps);

    expect(report.ok).toBe(false);
    expect(report.failures).toEqual(
      expect.arrayContaining([
        "query intent pass rate below 80%",
        "action intent pass rate below 90%",
        "knowledge pack missing required section",
        "context packet ctx_bad: authority_leak",
        "plan_breakdown: write path enabled",
        "plan_breakdown: missing next step target",
        "plan_breakdown: missing plan",
        "member scope denied unexpectedly",
        "member object read scope is not current_workspace",
        "reserved_internal_truth is not denied",
        "non-member scope allowed unexpectedly",
        "non-member object search is not denied",
        "stop condition triggered: classifier_pass_rate_below_80",
        "stop condition triggered: action_classifier_pass_rate_below_90",
        "stop condition triggered: knowledge_pack_not_structured",
        "stop condition triggered: missing_next_step",
        "stop condition triggered: write_path_enabled",
        "stop condition triggered: access_scope_leak",
        "stop condition triggered: context_packet_gate_failed",
      ]),
    );

    const output = { log: vi.fn() };
    expect(suite.main(failingDeps, output)).toBe(1);
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining('"ok": false'));
  });

  it("prints JSON with the key validation sections", async () => {
    const suite = await loadSuiteModule();
    const report = suite.runAskHelmValidationSuite(buildPassingDeps());
    const output = { log: vi.fn() };

    suite.printAskHelmValidationSuiteReport(report, output);

    const printed = output.log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(() => JSON.parse(printed)).not.toThrow();
    expect(printed).toContain('"queryIntent"');
    expect(printed).toContain('"actionIntent"');
    expect(printed).toContain('"actionPacket"');
    expect(printed).toContain('"contextPacket"');
    expect(printed).toContain('"knowledgePack"');
    expect(printed).toContain('"interpreter"');
    expect(printed).toContain('"accessScope"');
    expect(printed).toContain('"stopConditions"');
  });

  it("does not execute the CLI wrapper when imported", async () => {
    const previousExitCode = process.exitCode;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await loadSuiteModule();

    expect(logSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(previousExitCode);
  });
});
