import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { runHeadlessSignalInterfaceEval } from "../evals/headless-signal-interface-evals";

const TEMPLATE_PATH = path.resolve(
  process.cwd(),
  "templates/signal-first-mile/helm-signal-first-mile.js",
);
const SELECTOR_PATH = path.resolve(
  process.cwd(),
  "templates/signal-first-mile/signal-first-mile-selector.js",
);
const CONVERTER_PATH = path.resolve(
  process.cwd(),
  "templates/signal-first-mile/ledger-to-hsi-fixture.js",
);
const REVIEW_PACKET_PATH = path.resolve(
  process.cwd(),
  "templates/signal-first-mile/ledger-to-review-packet.js",
);
const ACCEPTANCE_CARD_PATH = path.resolve(
  process.cwd(),
  "templates/signal-first-mile/signal-first-mile-acceptance-card.js",
);
const CUSTOMER_MATERIALS_PATH = path.resolve(
  process.cwd(),
  "templates/signal-first-mile/signal-first-mile-customer-materials.js",
);
const QUALITY_PATH = path.resolve(
  process.cwd(),
  "templates/signal-first-mile/signal-quality-eval.js",
);
const PROOF_PATH = path.resolve(
  process.cwd(),
  "templates/signal-first-mile/run-first-change-proof.js",
);
const SAMPLE_LEDGER_PATH = path.resolve(
  process.cwd(),
  "templates/signal-first-mile/signal-ledger.sample.json",
);
const SAMPLE_SELECTOR_INPUT_PATH = path.resolve(
  process.cwd(),
  "templates/signal-first-mile/selector-input.sample.json",
);
const SAMPLE_QUALITY_GOLDENS_PATH = path.resolve(
  process.cwd(),
  "templates/signal-first-mile/signal-quality-goldens.sample.json",
);
const requireForProofVm = createRequire(PROOF_PATH);

type SignalRecord = {
  readonly signalKey: string;
  readonly collectionMode: string;
  readonly dispositionMode: string;
  readonly dispositionTrack: string;
  readonly signalFamily: string;
  readonly whatChanged: string;
  readonly missingInfo: string;
  readonly dataPosture: string;
  readonly redactionStatus: string;
  readonly reviewState: string;
  readonly allowedNextSurface: string;
  readonly reviewerRequired: boolean;
  readonly forbiddenNextActions: readonly string[];
};

type SignalFirstMileApi = {
  readonly configure: (options: Record<string, unknown>) => Record<string, unknown>;
  readonly getCollectionModes: () => Record<string, { id: string; level: string }>;
  readonly getDispositionModes: () => Record<string, { id: string; track: string }>;
  readonly collect: (input: Record<string, unknown>) => SignalRecord;
  readonly collectFromElement: (element: {
    getAttribute(name: string): string | null;
  }) => SignalRecord;
  readonly getLedger: () => readonly SignalRecord[];
  readonly clear: () => void;
  readonly exportLedger: () => string;
};

type SignalFirstMileHsiApi = {
  readonly convertLedgerToHsiFixture: (
    ledger: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Parameters<typeof runHeadlessSignalInterfaceEval>[0];
  readonly mapSignalToHsiFamily: (signal: Record<string, unknown>) => string;
  readonly mapSourceKind: (sourceFamily: string) => string;
};

type SignalFirstMileReviewPacketApi = {
  readonly convertLedgerToReviewPacket: (
    ledger: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => string;
  readonly summarizeLedger: (ledger: Record<string, unknown>) => {
    readonly totalSignalCount: number;
    readonly acceptedSignalCount: number;
    readonly rejectedSignalCount: number;
  };
};

type SignalFirstMileSelectorApi = {
  readonly getSelectorOptions: () => {
    readonly materialTypes: readonly string[];
    readonly accessLevels: readonly string[];
    readonly signalFamilies: readonly string[];
  };
  readonly selectSignalFirstMilePath: (
    input: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => {
    readonly collectionMode: string;
    readonly dispositionMode: string;
    readonly layer: string;
    readonly confidenceBand: string;
    readonly prerequisites: readonly string[];
    readonly forbiddenActions: readonly string[];
  };
  readonly renderRecommendationMarkdown: (recommendation: Record<string, unknown>) => string;
};

type SignalFirstMileProofApi = {
  readonly runFirstChangeProof: (
    input: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => {
    readonly acceptedSignalCount: number;
    readonly rejectedSignalCount: number;
    readonly evalCommand: string;
    readonly qualityEvalCommand: string;
    readonly filesById: Record<string, string>;
    readonly qualitySummary: {
      readonly passed: boolean;
      readonly goldenSource: string;
      readonly interpretation: string;
      readonly precision: number;
      readonly recall: number;
      readonly evidenceCoverage: number;
      readonly reviewerCompleteness: number;
      readonly boundaryIncidentCount: number;
      readonly rawPrivateLeakCount: number;
    };
    readonly recommendation: {
      readonly collectionMode: string;
      readonly dispositionMode: string;
    };
  };
};

type SignalFirstMileAcceptanceCardApi = {
  readonly buildAcceptanceCard: (
    input: Record<string, unknown>,
    recommendation: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => {
    readonly collectionMode: string;
    readonly dispositionMode: string;
    readonly minimumMaterials: readonly string[];
    readonly reviewerReceipt: readonly string[];
    readonly l2Readiness: {
      readonly status: string;
      readonly checks: readonly string[];
      readonly reason: string;
    };
    readonly forbiddenActions: readonly string[];
  };
  readonly renderAcceptanceCardMarkdown: (card: Record<string, unknown>) => string;
};

type CustomerMaterialsRequest = {
  readonly schemaVersion: string;
  readonly title: string;
  readonly sourceFamily: string;
  readonly collectionMode: string;
  readonly dispositionMode: string;
  readonly requestedMaterials: readonly string[];
  readonly fieldMapping: readonly { readonly field: string; readonly meaning: string }[];
  readonly doNotSend: readonly string[];
  readonly boundaryNote: string;
};

type SignalFirstMileCustomerMaterialsApi = {
  readonly buildCustomerMaterialsRequest: (
    input: Record<string, unknown>,
    recommendation: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => CustomerMaterialsRequest;
  readonly renderCustomerMaterialsMarkdown: (request: CustomerMaterialsRequest) => string;
};

type SignalQualityReport = {
  readonly schemaVersion: string;
  readonly goldenStatus: string;
  readonly goldenSource: string;
  readonly passed: boolean;
  readonly metrics: {
    readonly precision: number;
    readonly recall: number;
    readonly signalFamilyAccuracy: number;
    readonly dispositionAccuracy: number;
    readonly requiredFieldCompleteness: number;
    readonly evidenceCoverage: number;
    readonly reviewerCompleteness: number;
    readonly boundaryIncidentCount: number;
    readonly rawPrivateLeakCount: number;
  };
  readonly coverage: {
    readonly sourceFamilies: readonly string[];
    readonly signalFamilies: readonly string[];
    readonly dispositionModes: readonly string[];
  };
  readonly failures: readonly { readonly caseId: string; readonly reason: string }[];
};

type SignalFirstMileQualityApi = {
  readonly evaluateSignalQuality: (
    ledger: Record<string, unknown>,
    goldenPack: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => SignalQualityReport;
  readonly renderSignalQualityMarkdown: (summary: SignalQualityReport) => string;
};

function createStorage() {
  const entries = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return entries.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      entries.set(key, value);
    },
    removeItem(key: string): void {
      entries.delete(key);
    },
  };
}

function loadTemplateApi(): SignalFirstMileApi {
  const source = readFileSync(TEMPLATE_PATH, "utf8");
  const commonJsModule: { exports: unknown } = { exports: {} };
  const context = vm.createContext({
    module: commonJsModule,
    exports: commonJsModule.exports,
    localStorage: createStorage(),
  });

  vm.runInContext(source, context, { filename: TEMPLATE_PATH });
  return commonJsModule.exports as SignalFirstMileApi;
}

function loadConverterApi(): SignalFirstMileHsiApi {
  const source = readFileSync(CONVERTER_PATH, "utf8");
  const commonJsModule: { exports: unknown } = { exports: {} };
  const context = vm.createContext({
    module: commonJsModule,
    exports: commonJsModule.exports,
  });

  vm.runInContext(source, context, { filename: CONVERTER_PATH });
  return commonJsModule.exports as SignalFirstMileHsiApi;
}

function loadReviewPacketApi(): SignalFirstMileReviewPacketApi {
  const source = readFileSync(REVIEW_PACKET_PATH, "utf8");
  const commonJsModule: { exports: unknown } = { exports: {} };
  const context = vm.createContext({
    module: commonJsModule,
    exports: commonJsModule.exports,
  });

  vm.runInContext(source, context, { filename: REVIEW_PACKET_PATH });
  return commonJsModule.exports as SignalFirstMileReviewPacketApi;
}

function loadSelectorApi(): SignalFirstMileSelectorApi {
  const source = readFileSync(SELECTOR_PATH, "utf8");
  const commonJsModule: { exports: unknown } = { exports: {} };
  const context = vm.createContext({
    module: commonJsModule,
    exports: commonJsModule.exports,
  });

  vm.runInContext(source, context, { filename: SELECTOR_PATH });
  return commonJsModule.exports as SignalFirstMileSelectorApi;
}

function loadProofApi(): SignalFirstMileProofApi {
  const source = readFileSync(PROOF_PATH, "utf8");
  const commonJsModule: { exports: unknown } = { exports: {} };
  const context = vm.createContext({
    module: commonJsModule,
    exports: commonJsModule.exports,
    require: requireForProofVm,
    __dirname: path.dirname(PROOF_PATH),
  });

  vm.runInContext(source, context, { filename: PROOF_PATH });
  return commonJsModule.exports as SignalFirstMileProofApi;
}

function loadAcceptanceCardApi(): SignalFirstMileAcceptanceCardApi {
  const source = readFileSync(ACCEPTANCE_CARD_PATH, "utf8");
  const commonJsModule: { exports: unknown } = { exports: {} };
  const context = vm.createContext({
    module: commonJsModule,
    exports: commonJsModule.exports,
  });

  vm.runInContext(source, context, { filename: ACCEPTANCE_CARD_PATH });
  return commonJsModule.exports as SignalFirstMileAcceptanceCardApi;
}

function loadCustomerMaterialsApi(): SignalFirstMileCustomerMaterialsApi {
  const source = readFileSync(CUSTOMER_MATERIALS_PATH, "utf8");
  const commonJsModule: { exports: unknown } = { exports: {} };
  const context = vm.createContext({
    module: commonJsModule,
    exports: commonJsModule.exports,
  });

  vm.runInContext(source, context, { filename: CUSTOMER_MATERIALS_PATH });
  return commonJsModule.exports as SignalFirstMileCustomerMaterialsApi;
}

function loadQualityApi(): SignalFirstMileQualityApi {
  const source = readFileSync(QUALITY_PATH, "utf8");
  const commonJsModule: { exports: unknown } = { exports: {} };
  const context = vm.createContext({
    module: commonJsModule,
    exports: commonJsModule.exports,
  });

  vm.runInContext(source, context, { filename: QUALITY_PATH });
  return commonJsModule.exports as SignalFirstMileQualityApi;
}

function loadQualityBrowserApi(): SignalFirstMileQualityApi {
  const source = readFileSync(QUALITY_PATH, "utf8");
  const context = vm.createContext({});

  vm.runInContext(source, context, { filename: QUALITY_PATH });
  return (context as { HelmSignalFirstMileQuality: SignalFirstMileQualityApi })
    .HelmSignalFirstMileQuality;
}

function loadSampleLedger(): Record<string, unknown> {
  return JSON.parse(readFileSync(SAMPLE_LEDGER_PATH, "utf8")) as Record<string, unknown>;
}

function loadSampleQualityGoldens(): Record<string, unknown> {
  return JSON.parse(readFileSync(SAMPLE_QUALITY_GOLDENS_PATH, "utf8")) as Record<
    string,
    unknown
  >;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("Signal First Mile drop-in template", () => {
  it("does not include network transport primitives", () => {
    const source = [
      readFileSync(SELECTOR_PATH, "utf8"),
      readFileSync(TEMPLATE_PATH, "utf8"),
      readFileSync(CONVERTER_PATH, "utf8"),
      readFileSync(REVIEW_PACKET_PATH, "utf8"),
      readFileSync(ACCEPTANCE_CARD_PATH, "utf8"),
      readFileSync(CUSTOMER_MATERIALS_PATH, "utf8"),
      readFileSync(QUALITY_PATH, "utf8"),
      readFileSync(PROOF_PATH, "utf8"),
    ].join("\n");

    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toContain("XMLHttpRequest");
    expect(source).not.toContain("sendBeacon");
    expect(source).not.toContain("WebSocket");
  });

  it("selects a marked DOM first-mile path for UI-change access", () => {
    const api = loadSelectorApi();
    const input = JSON.parse(readFileSync(SAMPLE_SELECTOR_INPUT_PATH, "utf8")) as Record<
      string,
      unknown
    >;

    const recommendation = api.selectSignalFirstMilePath(input, {
      generatedAt: "2026-06-03T00:00:00.000Z",
    });
    const markdown = api.renderRecommendationMarkdown(recommendation);

    expect(api.getSelectorOptions().materialTypes).toContain("business_web_app");
    expect(recommendation.collectionMode).toBe("marked_dom");
    expect(recommendation.dispositionMode).toBe("escalate_blocker");
    expect(recommendation.layer).toBe("L0");
    expect(recommendation.forbiddenActions).toContain("auto_writeback");
    expect(markdown).toContain("Collection mode | `marked_dom`");
    expect(markdown).toContain("not approval");
  });

  it("blocks raw private or write-access selector inputs", () => {
    const api = loadSelectorApi();

    const rawPrivate = api.selectSignalFirstMilePath({
      materialType: "meeting_note",
      accessLevel: "human_view_only",
      signalFamily: "commitment",
      dataPosture: "raw_private",
    });
    const writeAccess = api.selectSignalFirstMilePath({
      materialType: "crm_record",
      accessLevel: "write_access_requested",
      signalFamily: "advancement",
      dataPosture: "redacted",
    });

    expect(rawPrivate.collectionMode).toBe("manual_card");
    expect(rawPrivate.dispositionMode).toBe("reject_input");
    expect(rawPrivate.confidenceBand).toBe("blocked");
    expect(rawPrivate.prerequisites.join(" ")).toContain("redacted or alias-only summary");
    expect(writeAccess.collectionMode).toBe("manual_card");
    expect(writeAccess.dispositionMode).toBe("reject_input");
    expect(writeAccess.prerequisites.join(" ")).toContain("Downgrade write access");
  });

  it("requires explicit read-only authorization before selector recommends a connector", () => {
    const api = loadSelectorApi();

    const unauthorized = api.selectSignalFirstMilePath({
      materialType: "crm_record",
      accessLevel: "human_view_only",
      hasReadOnlyApi: true,
      hasReadOnlyAuthorization: false,
      signalFamily: "pacing",
      dataPosture: "redacted",
    });
    const authorized = api.selectSignalFirstMilePath({
      materialType: "crm_record",
      accessLevel: "read_only_api_authorized",
      hasReadOnlyApi: true,
      hasReadOnlyAuthorization: true,
      signalFamily: "pacing",
      dataPosture: "redacted",
    });

    expect(unauthorized.collectionMode).toBe("crm_snapshot");
    expect(authorized.collectionMode).toBe("read_only_connector");
    expect(authorized.layer).toBe("L2");
    expect(authorized.prerequisites.join(" ")).toContain("dry_run_fixture");
    expect(authorized.dispositionMode).toBe("schedule_recheck");
  });

  it("builds a one-command first-change proof package", () => {
    const api = loadProofApi();
    const input = JSON.parse(readFileSync(SAMPLE_SELECTOR_INPUT_PATH, "utf8")) as Record<
      string,
      unknown
    >;
    const outputDir = mkdtempSync(path.join(tmpdir(), "helm-sfm-proof-"));

    try {
      const manifest = api.runFirstChangeProof(input, {
        outputDir,
        generatedAt: "2026-06-03T00:00:00.000Z",
      });
      const hsiFixture = JSON.parse(
        readFileSync(path.join(outputDir, manifest.filesById.hsiFixture), "utf8"),
      ) as Parameters<typeof runHeadlessSignalInterfaceEval>[0];
      const ledger = JSON.parse(
        readFileSync(path.join(outputDir, manifest.filesById.ledger), "utf8"),
      ) as { signals: SignalRecord[] };
      const reviewPacket = readFileSync(
        path.join(outputDir, manifest.filesById.reviewPacket),
        "utf8",
      );
      const acceptanceCard = readFileSync(
        path.join(outputDir, manifest.filesById.acceptanceCard),
        "utf8",
      );
      const customerMaterials = readFileSync(
        path.join(outputDir, manifest.filesById.customerMaterials),
        "utf8",
      );
      const customerMaterialsJson = JSON.parse(
        readFileSync(path.join(outputDir, manifest.filesById.customerMaterialsJson), "utf8"),
      ) as CustomerMaterialsRequest;
      const qualityReport = JSON.parse(
        readFileSync(path.join(outputDir, manifest.filesById.signalQualityReportJson), "utf8"),
      ) as SignalQualityReport;
      const qualityReportMarkdown = readFileSync(
        path.join(outputDir, manifest.filesById.signalQualityReport),
        "utf8",
      );
      const readme = readFileSync(path.join(outputDir, manifest.filesById.readme), "utf8");
      const summary = runHeadlessSignalInterfaceEval(hsiFixture);

      expect(manifest.acceptedSignalCount).toBe(1);
      expect(manifest.rejectedSignalCount).toBe(0);
      expect(manifest.recommendation.collectionMode).toBe("marked_dom");
      expect(manifest.recommendation.dispositionMode).toBe("escalate_blocker");
      expect(ledger.signals[0]?.collectionMode).toBe("marked_dom");
      expect(ledger.signals[0]?.dispositionMode).toBe("escalate_blocker");
      expect(reviewPacket).toContain("Escalate the blocker internally");
      expect(acceptanceCard).toContain("Minimum Redacted Materials");
      expect(acceptanceCard).toContain("L2 readiness | `not_l2_ready`");
      expect(customerMaterials).toContain("Business Web App Materials");
      expect(customerMaterials).toContain("Do Not Send");
      expect(customerMaterials).toContain("data-helm-source-family");
      expect(customerMaterialsJson.schemaVersion).toBe(
        "helm.signal-first-mile-customer-materials.v1",
      );
      expect(customerMaterialsJson.sourceFamily).toBe("web_app");
      expect(manifest.qualitySummary.passed).toBe(true);
      expect(manifest.qualityEvalCommand).toContain("signal-quality-eval.js");
      expect(qualityReport.schemaVersion).toBe("helm.signal-first-mile-quality-report.v1");
      expect(qualityReport.goldenSource).toBe("expected_input_before_collection");
      expect(qualityReport.passed).toBe(true);
      expect(qualityReport.metrics.precision).toBe(1);
      expect(qualityReport.metrics.recall).toBe(1);
      expect(qualityReport.metrics.evidenceCoverage).toBe(1);
      expect(qualityReportMarkdown).toContain("Signal First Mile Quality Report");
      expect(readme).toContain("npm run eval:headless-signal-interface");
      expect(readme).toContain("quality eval");
      expect(summary.passed).toBe(true);
      Object.values(manifest.filesById).forEach((fileName) => {
        expect(existsSync(path.join(outputDir, fileName))).toBe(true);
      });
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("keeps raw private first-change proof details out of review packets", () => {
    const api = loadProofApi();
    const outputDir = mkdtempSync(path.join(tmpdir(), "helm-sfm-proof-raw-"));

    try {
      const manifest = api.runFirstChangeProof({
        materialType: "meeting_note",
        accessLevel: "human_view_only",
        signalFamily: "commitment",
        dataPosture: "raw_private",
        whatChanged: "Raw private transcript with owner@example.com",
      }, {
        outputDir,
        generatedAt: "2026-06-03T00:00:00.000Z",
      });
      const reviewPacket = readFileSync(
        path.join(outputDir, manifest.filesById.reviewPacket),
        "utf8",
      );
      const qualityReport = JSON.parse(
        readFileSync(path.join(outputDir, manifest.filesById.signalQualityReportJson), "utf8"),
      ) as SignalQualityReport;

      expect(manifest.acceptedSignalCount).toBe(0);
      expect(manifest.rejectedSignalCount).toBe(1);
      expect(manifest.qualitySummary.passed).toBe(false);
      expect(manifest.qualitySummary.goldenSource).toBe("expected_input_before_collection");
      expect(qualityReport.metrics.recall).toBe(0);
      expect(qualityReport.metrics.rawPrivateLeakCount).toBe(1);
      expect(manifest.recommendation.dispositionMode).toBe("reject_input");
      expect(reviewPacket).toContain("No accepted signals are available for review.");
      expect(reviewPacket).not.toContain("Raw private transcript");
      expect(reviewPacket).not.toContain("owner@example.com");
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("builds acceptance cards with strict L2 readiness gates", () => {
    const api = loadAcceptanceCardApi();
    const selector = loadSelectorApi();
    const input = {
      materialType: "crm_record",
      accessLevel: "read_only_api_authorized",
      hasReadOnlyApi: true,
      hasReadOnlyAuthorization: true,
      signalFamily: "pacing",
      dataPosture: "redacted",
    };
    const recommendation = selector.selectSignalFirstMilePath(input);
    const card = api.buildAcceptanceCard(input, recommendation, {
      generatedAt: "2026-06-03T00:00:00.000Z",
    });
    const markdown = api.renderAcceptanceCardMarkdown(card);

    expect(card.collectionMode).toBe("read_only_connector");
    expect(card.dispositionMode).toBe("schedule_recheck");
    expect(card.l2Readiness.status).toBe("eligible_for_l2_design_review");
    expect(card.minimumMaterials.join(" ")).toContain("Explicit read-only authorization");
    expect(card.l2Readiness.checks.join(" ")).toContain("does not write back");
    expect(card.forbiddenActions).toContain("auto_writeback");
    expect(markdown).toContain("L2 Read-Only Connector Gate");
    expect(markdown).toContain("not approval");
  });

  it("passes the sample signal quality golden pack", () => {
    const api = loadQualityApi();
    const summary = api.evaluateSignalQuality(loadSampleLedger(), loadSampleQualityGoldens(), {
      generatedAt: "2026-06-03T00:00:00.000Z",
    });
    const markdown = api.renderSignalQualityMarkdown(summary);

    expect(summary.passed).toBe(true);
    expect(summary.metrics.precision).toBe(1);
    expect(summary.metrics.recall).toBe(1);
    expect(summary.metrics.signalFamilyAccuracy).toBe(1);
    expect(summary.metrics.dispositionAccuracy).toBe(1);
    expect(summary.metrics.evidenceCoverage).toBe(1);
    expect(summary.metrics.reviewerCompleteness).toBe(1);
    expect(summary.metrics.boundaryIncidentCount).toBe(0);
    expect(summary.metrics.rawPrivateLeakCount).toBe(0);
    expect(summary.coverage.sourceFamilies).toContain("crm");
    expect(markdown).toContain("## Metrics");
  });

  it("loads the signal quality evaluator in a browser-like context without Node globals", () => {
    const api = loadQualityBrowserApi();
    const summary = api.evaluateSignalQuality(loadSampleLedger(), loadSampleQualityGoldens(), {
      generatedAt: "2026-06-03T00:00:00.000Z",
    });

    expect(summary.passed).toBe(true);
    expect(summary.metrics.precision).toBe(1);
  });

  it("keeps signal quality metrics stable for empty ledgers and empty goldens", () => {
    const api = loadQualityApi();
    const summary = api.evaluateSignalQuality({
      schemaVersion: "helm.signal-first-mile-ledger.v1",
      signals: [],
    }, {
      schemaVersion: "helm.signal-first-mile-quality-goldens.v1",
      cases: [],
    });

    expect(summary.passed).toBe(true);
    expect(summary.counts.acceptedSignals).toBe(0);
    expect(summary.counts.expectedSignals).toBe(0);
    expect(summary.metrics.precision).toBe(1);
    expect(summary.metrics.recall).toBe(1);
    expect(summary.metrics.signalFamilyAccuracy).toBe(1);
    expect(summary.metrics.dispositionAccuracy).toBe(1);
    expect(summary.metrics.requiredFieldCompleteness).toBe(1);
    expect(summary.metrics.evidenceCoverage).toBe(1);
    expect(summary.metrics.reviewerCompleteness).toBe(1);
    expect(Number.isNaN(summary.metrics.precision)).toBe(false);
    expect(Number.isNaN(summary.metrics.recall)).toBe(false);
  });

  it("fails signal quality when expected or unexpected signals change precision and recall", () => {
    const api = loadQualityApi();
    const sampleLedger = loadSampleLedger();
    const sampleGoldens = loadSampleQualityGoldens();
    const missingSummary = api.evaluateSignalQuality({
      schemaVersion: "helm.signal-first-mile-ledger.v1",
      signals: [],
    }, sampleGoldens);
    const extraLedger = cloneJson(sampleLedger) as {
      signals: Array<Record<string, unknown>>;
    };
    extraLedger.signals.push({
      ...extraLedger.signals[0],
      signalKey: "sfm-extra-risk-001",
      sourceRef: "crm-row-extra",
      businessObject: { kind: "Deal", ref: "Deal-Alias-Extra" },
    });
    const extraSummary = api.evaluateSignalQuality(extraLedger, sampleGoldens);

    expect(missingSummary.passed).toBe(false);
    expect(missingSummary.metrics.recall).toBe(0);
    expect(missingSummary.failures.map((item) => item.reason)).toContain(
      "expected_signal_missing",
    );
    expect(extraSummary.passed).toBe(false);
    expect(extraSummary.metrics.precision).toBe(0.833);
    expect(extraSummary.failures.map((item) => item.reason)).toContain("unexpected_signal");
  });

  it("fails signal quality on wrong family, wrong disposition, missing evidence, and reviewer gaps", () => {
    const api = loadQualityApi();
    const brokenLedger = cloneJson(loadSampleLedger()) as {
      signals: Array<Record<string, unknown>>;
    };
    const singleCaseGoldens = cloneJson(loadSampleQualityGoldens()) as {
      cases: Array<Record<string, unknown>>;
    };
    brokenLedger.signals[0] = {
      ...brokenLedger.signals[0],
      signalFamily: "commitment",
      dispositionMode: "prepare_review_packet",
      evidenceRefs: [],
      owner: "",
      reviewer: "",
      boundaryNote: "",
    };
    brokenLedger.signals = [brokenLedger.signals[0] ?? {}];
    singleCaseGoldens.cases = [singleCaseGoldens.cases[0] ?? {}];
    const summary = api.evaluateSignalQuality(brokenLedger, singleCaseGoldens);
    const reasons = summary.failures.map((item) => item.reason);

    expect(summary.passed).toBe(false);
    expect(summary.metrics.signalFamilyAccuracy).toBe(0);
    expect(summary.metrics.dispositionAccuracy).toBe(0);
    expect(summary.metrics.evidenceCoverage).toBe(0);
    expect(summary.metrics.reviewerCompleteness).toBe(0);
    expect(summary.metrics.requiredFieldCompleteness).toBeLessThan(0.9);
    expect(reasons).toContain("signal_family_mismatch");
    expect(reasons).toContain("disposition_mode_mismatch");
    expect(reasons).toContain("required_evidence_missing:crm-row-17");
    expect(reasons).toContain("owner_missing_or_mismatch");
    expect(reasons).toContain("reviewer_missing_or_mismatch");
    expect(reasons).toContain("required_field_missing:boundaryNote");
  });

  it("fails signal quality on raw private rows and forbidden allowed actions", () => {
    const api = loadQualityApi();
    const rawLedger = cloneJson(loadSampleLedger()) as {
      signals: Array<Record<string, unknown>>;
    };
    rawLedger.signals.push({
      ...rawLedger.signals[0],
      signalKey: "sfm-raw-private-quality",
      dataPosture: "raw_private",
      redactionStatus: "raw_blocked",
      reviewState: "REJECTED",
    });
    const boundaryLedger = cloneJson(loadSampleLedger()) as {
      signals: Array<Record<string, unknown>>;
    };
    boundaryLedger.signals[0] = {
      ...boundaryLedger.signals[0],
      allowedNextActions: ["auto_send"],
    };
    const rawSummary = api.evaluateSignalQuality(rawLedger, loadSampleQualityGoldens());
    const boundarySummary = api.evaluateSignalQuality(boundaryLedger, loadSampleQualityGoldens());

    expect(rawSummary.passed).toBe(false);
    expect(rawSummary.metrics.rawPrivateLeakCount).toBe(1);
    expect(rawSummary.failures.map((item) => item.reason)).toContain(
      "raw_private_or_raw_blocked_signal",
    );
    expect(boundarySummary.passed).toBe(false);
    expect(boundarySummary.metrics.boundaryIncidentCount).toBe(1);
    expect(boundarySummary.failures.map((item) => item.reason)).toContain(
      "forbidden_allowed_next_action:auto_send",
    );
  });

  it("fails signal quality on source/object mismatch and missing required forbidden actions", () => {
    const api = loadQualityApi();
    const mismatchLedger = cloneJson(loadSampleLedger()) as {
      signals: Array<Record<string, unknown>>;
    };
    const singleCaseGoldens = cloneJson(loadSampleQualityGoldens()) as {
      cases: Array<Record<string, unknown>>;
    };
    mismatchLedger.signals[0] = {
      ...mismatchLedger.signals[0],
      sourceFamily: "ticket",
      businessObject: { kind: "Deal", ref: "Wrong-Object-Alias" },
      forbiddenNextActions: ["auto_send"],
    };
    mismatchLedger.signals = [mismatchLedger.signals[0] ?? {}];
    singleCaseGoldens.cases = [singleCaseGoldens.cases[0] ?? {}];
    const summary = api.evaluateSignalQuality(mismatchLedger, singleCaseGoldens);
    const reasons = summary.failures.map((item) => item.reason);

    expect(summary.passed).toBe(false);
    expect(summary.metrics.boundaryIncidentCount).toBe(4);
    expect(reasons).toContain("source_family_mismatch");
    expect(reasons).toContain("business_object_mismatch");
    expect(reasons).toContain("required_forbidden_next_action_missing:auto_approve");
    expect(reasons).toContain("required_forbidden_next_action_missing:auto_write_back");
  });

  it("honors signal quality threshold overrides", () => {
    const api = loadQualityApi();
    const ledger = cloneJson(loadSampleLedger()) as {
      signals: Array<Record<string, unknown>>;
    };
    const goldens = cloneJson(loadSampleQualityGoldens()) as {
      cases: Array<Record<string, unknown>>;
      thresholds: Record<string, number>;
    };
    ledger.signals[0] = {
      ...ledger.signals[0],
      evidenceRefs: [],
    };
    ledger.signals = [ledger.signals[0] ?? {}];
    goldens.cases = [goldens.cases[0] ?? {}];
    goldens.thresholds = {
      ...goldens.thresholds,
      evidenceCoverage: 0,
    };
    const packOverrideSummary = api.evaluateSignalQuality(ledger, goldens);
    const optionOverrideSummary = api.evaluateSignalQuality(ledger, goldens, {
      thresholds: { evidenceCoverage: 1 },
    });

    expect(packOverrideSummary.metrics.evidenceCoverage).toBe(0);
    expect(packOverrideSummary.failures.map((item) => item.reason)).not.toContain(
      "evidenceCoverage_below_threshold:0<0",
    );
    expect(optionOverrideSummary.passed).toBe(false);
    expect(optionOverrideSummary.failures.map((item) => item.reason)).toContain(
      "evidenceCoverage_below_threshold:0<1",
    );
  });

  it("builds customer materials requests for common enterprise sources", () => {
    const materials = loadCustomerMaterialsApi();
    const selector = loadSelectorApi();
    const cases = [
      ["crm_record", "crm", "CRM Snapshot Materials", "stageOrStatus"],
      ["ticket_queue", "ticket", "Ticket / Case Materials", "slaOrAge"],
      ["meeting_note", "meeting", "Meeting Summary Materials", "participantRoles"],
      ["chat_thread", "chat", "IM / Chat Digest Materials", "threadAlias"],
      ["email_thread", "email", "Email Thread Materials", "subjectAlias"],
      ["spreadsheet", "sheet", "Spreadsheet / CSV Materials", "columnMapping"],
      ["finance_sheet", "finance", "Finance Sheet Materials", "amountBand"],
      ["delivery_receipt", "delivery", "Delivery Receipt Materials", "receiptAlias"],
      ["business_web_app", "web_app", "Business Web App Materials", "data-helm-source-family"],
      [
        "external_agent_output",
        "external_agent_output",
        "External Agent Output Materials",
        "externalRunAlias",
      ],
    ] as const;

    cases.forEach(([materialType, sourceFamily, title, expectedField]) => {
      const input = {
        materialType,
        accessLevel: sourceFamily === "web_app" ? "ui_change_allowed" : "human_view_only",
        sourceFamily,
        signalFamily: sourceFamily === "delivery" ? "receipt" : "risk",
        canModifyBusinessUi: sourceFamily === "web_app",
        canRunLocalJs: sourceFamily === "web_app",
        hasExternalAgentOutput: sourceFamily === "external_agent_output",
        dataPosture: "redacted",
      };
      const recommendation = selector.selectSignalFirstMilePath(input);
      const request = materials.buildCustomerMaterialsRequest(input, recommendation, {
        generatedAt: "2026-06-03T00:00:00.000Z",
      });
      const markdown = materials.renderCustomerMaterialsMarkdown(request);

      expect(request.sourceFamily).toBe(sourceFamily);
      expect(request.title).toBe(title);
      expect(request.requestedMaterials.length).toBeGreaterThan(2);
      expect(request.fieldMapping.some((item) => item.field === expectedField)).toBe(true);
      expect(request.doNotSend.join(" ")).toContain("Raw transcripts or full message threads.");
      expect(request.boundaryNote).toContain("not connector authorization");
      expect(markdown).toContain("Do Not Send");
      expect(markdown).toContain(expectedField);
    });
  });

  it("stores a review-first redacted ledger record", () => {
    const api = loadTemplateApi();
    api.configure({
      workspaceAlias: "diagnostic-workspace",
      defaultReviewer: "customer-reviewer",
    });

    const signal = api.collect({
      sourceFamily: "crm",
      collectionMode: "crm_snapshot",
      dispositionMode: "assign_reviewer",
      objectKind: "Deal",
      objectRef: "Deal-Alias-001",
      signalFamily: "risk",
      evidenceRefs: ["crm-row-17"],
      whatChanged:
        "Decision date moved twice; contact owner@example.com or 13800000000; see https://example.test/private",
      owner: "delivery-owner",
      dataPosture: "redacted",
      allowedNextSurface: "/approvals",
    });

    expect(signal.collectionMode).toBe("crm_snapshot");
    expect(signal.dispositionMode).toBe("assign_reviewer");
    expect(signal.dispositionTrack).toBe("review");
    expect(signal.signalFamily).toBe("risk");
    expect(signal.reviewState).toBe("REVIEW_PENDING");
    expect(signal.reviewerRequired).toBe(true);
    expect(signal.allowedNextSurface).toBe("/approvals");
    expect(signal.forbiddenNextActions).toContain("auto_send");
    expect(signal.whatChanged).toContain("[redacted-email]");
    expect(signal.whatChanged).toContain("[redacted-phone]");
    expect(signal.whatChanged).toContain("[redacted-url]");
    expect(api.getLedger()).toHaveLength(1);
  });

  it("rejects raw private input before ledger storage", () => {
    const api = loadTemplateApi();

    const signal = api.collect({
      sourceFamily: "meeting",
      objectKind: "Commitment",
      objectRef: "Commitment-Alias-002",
      whatChanged: "Raw transcript pasted here",
      dataPosture: "raw_private",
    });

    expect(signal.reviewState).toBe("REJECTED");
    expect(signal.redactionStatus).toBe("raw_blocked");
    expect(signal.whatChanged).toBe(
      "Raw private input blocked. Provide a redacted or alias-only summary.",
    );
  });

  it("collects only explicit data attributes from marked elements", () => {
    const api = loadTemplateApi();
    const attributes = new Map<string, string>([
      ["data-helm-source-family", "crm"],
      ["data-helm-collection-mode", "crm_snapshot"],
      ["data-helm-disposition-mode", "prepare_review_packet"],
      ["data-helm-object-kind", "Deal"],
      ["data-helm-object-ref", "Deal-Alias-003"],
      ["data-helm-signal-family", "commitment"],
      ["data-helm-evidence-ref", "crm-row-18"],
      ["data-helm-what-changed", "Follow-up promised; receipt missing"],
      ["data-helm-data-posture", "alias_only"],
    ]);

    const signal = api.collectFromElement({
      getAttribute(name: string): string | null {
        return attributes.get(name) ?? null;
      },
    });

    expect(signal.collectionMode).toBe("crm_snapshot");
    expect(signal.dispositionMode).toBe("prepare_review_packet");
    expect(signal.signalFamily).toBe("commitment");
    expect(signal.whatChanged).toBe("Follow-up promised; receipt missing");
    expect(api.exportLedger()).toContain("Deal-Alias-003");
  });

  it("exposes a delivery-engineer collection mode catalog and infers defaults", () => {
    const api = loadTemplateApi();

    expect(api.getCollectionModes().manual_card.level).toBe("L0");
    expect(api.getCollectionModes().read_only_connector.level).toBe("L2");
    expect(api.getDispositionModes().prepare_review_packet.track).toBe("review");
    expect(api.getDispositionModes().schedule_recheck.track).toBe("auto");

    const meetingSignal = api.collect({
      sourceFamily: "meeting",
      objectKind: "Commitment",
      objectRef: "Commitment-Alias-004",
      whatChanged: "Follow-up promised after workshop",
      dataPosture: "redacted",
    });

    expect(meetingSignal.collectionMode).toBe("meeting_summary");
    expect(meetingSignal.dispositionMode).toBe("prepare_review_packet");
  });

  it("infers disposition modes from signal families and blocks raw private input", () => {
    const api = loadTemplateApi();

    const evidenceGapSignal = api.collect({
      sourceFamily: "sheet",
      signalFamily: "evidence_gap",
      dataPosture: "redacted",
      whatChanged: "Missing signed receipt",
    });
    const rawPrivateSignal = api.collect({
      sourceFamily: "meeting",
      signalFamily: "commitment",
      dataPosture: "raw_private",
      whatChanged: "Raw private transcript",
    });

    expect(evidenceGapSignal.dispositionMode).toBe("request_evidence");
    expect(rawPrivateSignal.dispositionMode).toBe("reject_input");
    expect(rawPrivateSignal.reviewState).toBe("REJECTED");
  });

  it("keeps auto disposition routing on the operating surface", () => {
    const api = loadTemplateApi();

    const signal = api.collect({
      sourceFamily: "crm",
      signalFamily: "pacing",
      dataPosture: "redacted",
      whatChanged: "Decision date moved twice",
    });

    expect(signal.dispositionMode).toBe("schedule_recheck");
    expect(signal.allowedNextSurface).toBe("/operating");
  });

  it("converts a signal ledger into an HSI eval-passing fixture", () => {
    const api = loadConverterApi();
    const ledger = JSON.parse(readFileSync(SAMPLE_LEDGER_PATH, "utf8")) as Record<string, unknown>;

    const fixture = api.convertLedgerToHsiFixture(ledger, {
      packId: "signal-first-mile-diagnostic",
    });
    const summary = runHeadlessSignalInterfaceEval(fixture);

    expect(summary.passed).toBe(true);
    expect(summary.counts.signalFamilyPositiveCount).toBeGreaterThanOrEqual(6);
    expect(summary.incidents.authorityLeakCount).toBe(0);
  });

  it("keeps raw private ledger rows out of HSI signal-family cases", () => {
    const api = loadConverterApi();
    const fixture = api.convertLedgerToHsiFixture({
      schemaVersion: "helm.signal-first-mile-ledger.v1",
      workspaceAlias: "diagnostic-workspace",
      signals: [
        {
          signalKey: "sfm-raw-private",
          sourceFamily: "meeting",
          signalFamily: "commitment",
          whatChanged: "Raw private transcript",
          dataPosture: "raw_private",
          redactionStatus: "raw_blocked",
          reviewState: "REJECTED",
        },
      ],
    });

    expect(fixture.conversionMetadata.rejectedSignalCount).toBe(1);
    expect(
      fixture.signalFamilyCases.some((item) => item.caseId.includes("sfm-raw-private")),
    ).toBe(false);
  });

  it("maps operating disposition surfaces into the HSI operating signal flow map", () => {
    const api = loadConverterApi();
    const fixture = api.convertLedgerToHsiFixture({
      schemaVersion: "helm.signal-first-mile-ledger.v1",
      workspaceAlias: "diagnostic-workspace",
      signals: [
        {
          signalKey: "sfm-pacing",
          sourceFamily: "crm",
          signalFamily: "pacing",
          collectionMode: "crm_snapshot",
          dispositionMode: "schedule_recheck",
          allowedNextSurface: "/operating",
          whatChanged: "Decision date moved twice",
          dataPosture: "redacted",
          redactionStatus: "redacted",
          reviewState: "REVIEW_PENDING",
        },
      ],
    });

    expect(fixture.signalFamilyCases[0]?.expectedReviewSurface).toBe(
      "operating_signal_flow_map",
    );
  });

  it("converts a signal ledger into a public-safe review packet", () => {
    const api = loadReviewPacketApi();
    const ledger = JSON.parse(readFileSync(SAMPLE_LEDGER_PATH, "utf8")) as Record<string, unknown>;

    const packet = api.convertLedgerToReviewPacket(ledger, {
      generatedAt: "2026-06-03T00:00:00.000Z",
      defaultReviewer: "customer-reviewer",
    });
    const summary = api.summarizeLedger(ledger);

    expect(summary.acceptedSignalCount).toBe(5);
    expect(packet).toContain("# Helm Signal First Mile Review Packet");
    expect(packet).toContain("assign_reviewer");
    expect(packet).toContain("Decision date moved twice; reviewer missing");
    expect(packet).toContain("Do not send external messages automatically.");
    expect(packet).not.toContain("customer deployment readiness | true");
  });

  it("excludes raw private ledger rows from review packet details", () => {
    const api = loadReviewPacketApi();
    const packet = api.convertLedgerToReviewPacket({
      schemaVersion: "helm.signal-first-mile-ledger.v1",
      workspaceAlias: "diagnostic-workspace",
      signals: [
        {
          signalKey: "sfm-raw-private",
          sourceFamily: "meeting",
          signalFamily: "commitment",
          whatChanged: "Raw private transcript with owner@example.com",
          dataPosture: "raw_private",
          redactionStatus: "raw_blocked",
          reviewState: "REJECTED",
        },
      ],
    }, {
      generatedAt: "2026-06-03T00:00:00.000Z",
    });

    expect(packet).toContain("| Rejected or blocked rows | 1 |");
    expect(packet).toContain("No accepted signals are available for review.");
    expect(packet).not.toContain("Raw private transcript");
    expect(packet).not.toContain("owner@example.com");
  });
});
