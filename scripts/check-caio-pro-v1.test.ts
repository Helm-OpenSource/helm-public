import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createContextAgentConsentReceipt,
  validateContextAgentConsentReceipt,
} from "../lib/context-agent/context-agent-contracts";
import { computeCaioInitializationAssessment } from "../lib/stage1-owner-loop/caio-initialization-gate";
import { createCaioInitializationAcceptanceReceipt } from "../lib/stage1-owner-loop/caio-initialization-gate-receipt";
import { evaluateCaioOperatingQuestionGeneration } from "../lib/stage1-owner-loop/caio-operating-question";
import {
  syntheticOperatingQuestionCandidate,
  syntheticOperatingQuestionG0Input,
  syntheticOperatingQuestionGenerationInput,
} from "../lib/stage1-owner-loop/caio-operating-question.test-fixtures";
import { createCaioQuestionSelectionReceipt } from "../lib/stage1-owner-loop/caio-question-selection";
import {
  computeCaioProV1CompletionAssessment,
  createCaioProV1CompletionAcceptanceReceipt,
  createCaioQuestionValueReceipt,
  validateCaioProV1CompletionGateReceipt,
  type CaioProV1CompletionGateReceipt,
} from "../lib/stage1-owner-loop/caio-pro-completion";
import {
  syntheticCaioProV1CompletionInput,
  syntheticCaioQuestionValueReceiptInput,
} from "../lib/stage1-owner-loop/caio-pro-completion.test-fixtures";
import {
  checkCaioProV1,
  checkCaioProV1Exports,
  checkCaioProV1FrozenLiterals,
  checkCaioProV1Static,
  COMPLETION_STORE_SUITE,
  SYNTHETIC_LOOP_SUITE,
} from "./check-caio-pro-v1";

const CLEAN_HYGIENE_COMPANIONS = {
  [COMPLETION_STORE_SUITE]: "export const clean = true;\n",
  "lib/stage1-owner-loop/caio-operating-question.test-fixtures.ts":
    "export const clean = true;\n",
  "lib/stage1-owner-loop/caio-pro-completion.test-fixtures.ts":
    "export const clean = true;\n",
} as const;

function withFixture(
  files: Record<string, string>,
  assertion: (root: string) => void,
): void {
  const root = mkdtempSync(path.join(os.tmpdir(), "caio-pro-v1-gate-"));
  try {
    for (const [file, content] of Object.entries(files)) {
      const absolute = path.join(root, file);
      mkdirSync(path.dirname(absolute), { recursive: true });
      writeFileSync(absolute, content, "utf8");
    }
    assertion(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("caio-pro-v1 aggregate gate", () => {
  it("passes on the real repository", () => {
    expect(checkCaioProV1(process.cwd())).toEqual([]);
  });

  it("exports every required gate function", () => {
    expect(checkCaioProV1Exports()).toEqual([]);
  });

  it("holds every frozen fail-closed literal", () => {
    expect(checkCaioProV1FrozenLiterals()).toEqual([]);
  });

  it.each([9, 11])(
    "refuses a %s-candidate generation instead of padding it",
    (count) => {
      const evaluation = evaluateCaioOperatingQuestionGeneration(
        syntheticOperatingQuestionGenerationInput(
          Array.from({ length: count }, (_, index) =>
            syntheticOperatingQuestionCandidate(index),
          ),
        ),
      );
      expect(evaluation.status).toBe("insufficient_evidence");
      expect(evaluation.portfolio).toBeNull();
      expect(evaluation.gapCodes).toContain("candidate_count_not_ten");
    },
  );

  it("refuses a four-question CEO selection", () => {
    const evaluation = evaluateCaioOperatingQuestionGeneration(
      syntheticOperatingQuestionGenerationInput(),
    );
    const portfolio = evaluation.portfolio;
    if (!portfolio) {
      throw new Error("synthetic portfolio required");
    }
    expect(() =>
      createCaioQuestionSelectionReceipt({
        portfolio,
        workspaceRef: portfolio.workspaceRef,
        ceoPrincipalBindingRef: "binding:ceo:synthetic-caio",
        ceoPrincipalRef: "principal:ceo:synthetic-caio",
        actorUserRef: "user:ceo:synthetic-caio",
        idempotencyKey: "selection:synthetic-caio:test-four",
        previousReceipt: null,
        selections: portfolio.candidates.slice(0, 4).map(
          (candidate, index) => ({
            questionId: candidate.questionId,
            questionOverride: null,
            goal: `Synthetic selection goal ${index + 1}`,
            successMetrics: [
              {
                metricKey: `metric-${index + 1}`,
                target: `Synthetic governed target ${index + 1}`,
              },
            ],
            priority: index + 1,
            implementationScopeRefs: ["scope:review-only"],
            ownerRef: null,
            reviewerRef: null,
            startsAt: null,
            endsAt: null,
            prohibitedActions: ["external_side_effect"],
          }),
        ),
        reasonCodes: ["ceo_selected_operating_focus"],
        evidenceRefs: ["evidence:operating:1"],
        selectedAt: "2026-07-23T10:00:00.000Z",
      }),
    ).toThrow("caio_question_selection_limit_exceeded");
  });

  it("refuses a caller-supplied accepted state without a ready assessment", () => {
    const acceptanceInput = (
      assessment: ReturnType<typeof computeCaioInitializationAssessment>,
      key: string,
    ) => ({
      workspaceRef: assessment.workspaceRef,
      assessment,
      mandateRef: assessment.mandateRef,
      ceoPrincipalBindingRef: "binding:ceo:synthetic-caio",
      ceoPrincipalRef: "principal:ceo:synthetic-caio",
      actorUserRef: "user:ceo:synthetic-caio",
      idempotencyKey: `accept:synthetic-caio:${key}`,
      evidenceRefs: ["evidence:ceo-reviewed-g0"],
      previousReceipt: null,
      recordedAt: "2026-07-23T08:00:00.000Z",
      inventoryConfirmationRef: "confirmation:inventory:synthetic-caio",
      customerAcceptanceRef: "acceptance:ceo:synthetic-caio",
      acceptedExceptionRefs: [...assessment.exceptionRefs],
      reasonCodes: ["owner_scope_confirmed"],
    });
    const ready = computeCaioInitializationAssessment(
      syntheticOperatingQuestionG0Input(),
    );
    // Tampering the decision on a ready assessment trips the integrity
    // refusal (the content hash no longer matches).
    expect(() =>
      createCaioInitializationAcceptanceReceipt(
        acceptanceInput(
          { ...ready, decision: "not_ready" },
          "test-tampered",
        ),
      ),
    ).toThrow("caio_initialization_assessment_invalid");
    // A genuinely not-ready assessment (a registered write path is a hard
    // failure) trips the readiness refusal.
    const notReady = computeCaioInitializationAssessment({
      ...syntheticOperatingQuestionG0Input(),
      registeredWritePathCount: 1,
    });
    expect(notReady.decision).toBe("not_ready");
    expect(() =>
      createCaioInitializationAcceptanceReceipt(
        acceptanceInput(notReady, "test-not-ready"),
      ),
    ).toThrow("caio_initialization_assessment_not_ready");
  });

  it("requires performanceInputProhibited to be exactly true", () => {
    const consent = createContextAgentConsentReceipt({
      workspaceRef: "workspace:synthetic-caio",
      invitationRef: "context-agent-invitation:synthetic-test",
      memberUserRef: "user:synthetic-member",
      actorUserRef: "user:synthetic-member",
      consentVersion: 1,
      previousConsentRef: null,
      scope: {
        deviceRefs: ["device:synthetic-workstation"],
        directoryRefs: ["dir:projects"],
        enterpriseAppRefs: ["app:synthetic-crm"],
        purposes: ["company_memory_candidates"],
      },
      evidenceRefs: ["evidence:synthetic-consent"],
      idempotencyKey: "consent:synthetic:test",
      recordedAt: "2026-07-23T09:00:00.000Z",
    });
    expect(consent.performanceInputProhibited).toBe(true);
    expect(validateContextAgentConsentReceipt(consent).valid).toBe(true);
    const tampered = validateContextAgentConsentReceipt({
      ...consent,
      performanceInputProhibited: false as unknown as true,
    });
    expect(tampered.valid).toBe(false);
    expect(tampered.errors).toContain(
      "context_agent_performance_input_boundary_invalid",
    );
  });

  it("keeps a completion assessment with any missing item not_ready", () => {
    const input = syntheticCaioProV1CompletionInput();
    input.attestations = input.attestations.filter(
      (attestation) => attestation.itemKey !== "p3_runtime_truth_bound",
    );
    const assessment = computeCaioProV1CompletionAssessment(input);
    expect(assessment.decision).toBe("not_ready");
    expect(assessment.missingItemKeys).toEqual(["p3_runtime_truth_bound"]);
  });

  it("refuses completion acceptance against a not-ready assessment", () => {
    const input = syntheticCaioProV1CompletionInput();
    input.valueReceipts = input.valueReceipts.slice(0, 1);
    const notReady = computeCaioProV1CompletionAssessment(input);
    expect(notReady.decision).toBe("not_ready");
    expect(() =>
      createCaioProV1CompletionAcceptanceReceipt({
        workspaceRef: notReady.workspaceRef,
        assessment: notReady,
        ceoPrincipalBindingRef: "binding:ceo:synthetic-completion",
        ceoPrincipalRef: "principal:ceo:synthetic-completion",
        actorUserRef: "user:ceo:synthetic-completion",
        idempotencyKey: "completion-accept:test-not-ready",
        reasonCodes: ["site_deployment_reviewed"],
        evidenceRefs: ["evidence:completion-acceptance"],
        previousReceipt: null,
        recordedAt: "2026-07-26T08:00:00.000Z",
      }),
    ).toThrow("caio_pro_v1_completion_assessment_not_ready");
  });

  it("validates the fullFunctionOperation literal exactly", () => {
    const ready = computeCaioProV1CompletionAssessment(
      syntheticCaioProV1CompletionInput(),
    );
    const receipt = createCaioProV1CompletionAcceptanceReceipt({
      workspaceRef: ready.workspaceRef,
      assessment: ready,
      ceoPrincipalBindingRef: "binding:ceo:synthetic-completion",
      ceoPrincipalRef: "principal:ceo:synthetic-completion",
      actorUserRef: "user:ceo:synthetic-completion",
      idempotencyKey: "completion-accept:test-literal",
      reasonCodes: ["site_deployment_reviewed"],
      evidenceRefs: ["evidence:completion-acceptance"],
      previousReceipt: null,
      recordedAt: "2026-07-26T08:00:00.000Z",
    });
    expect(receipt.fullFunctionOperation).toBe(
      "not_authorized_by_this_receipt",
    );
    const tampered = validateCaioProV1CompletionGateReceipt({
      ...receipt,
      fullFunctionOperation:
        "activated" as unknown as CaioProV1CompletionGateReceipt["fullFunctionOperation"],
    });
    expect(tampered.valid).toBe(false);
    expect(tampered.errors).toContain(
      "completion_gate_receipt_governance_boundary_invalid",
    );
  });

  it("refuses a token-count value metric fail-closed", () => {
    const input = syntheticCaioQuestionValueReceiptInput();
    input.metricDefinitions = [
      {
        metricKey: "token-usage-total",
        definition: "tokens consumed per operating window",
        dataSourceRefs: ["evidence:synthetic-tokens"],
      },
    ];
    expect(() => createCaioQuestionValueReceipt(input)).toThrow(
      "value_receipt_forbidden_value_basis:token_usage",
    );
  });

  it("fails closed on an empty repository fixture", () => {
    withFixture({}, (root) => {
      const rules = new Set(
        checkCaioProV1Static(root).map((violation) => violation.rule),
      );
      for (const rule of [
        "CPV1-DOCS",
        "CPV1-FIREWALL",
        "CPV1-HYGIENE",
        "CPV1-WIRING",
        "CPV1-CI",
      ]) {
        expect(rules).toContain(rule);
      }
    });
  });

  it("flags contact, endpoint, and credential-shaped strings in the fixtures", () => {
    // Assembled at runtime so the negative fixture itself never puts a
    // phone-shaped digit run into this repository's source text.
    const phoneShaped = ["+86139", "1234", "5678"].join("");
    withFixture(
      {
        [SYNTHETIC_LOOP_SUITE]: [
          `const phone = "${phoneShaped}";`,
          'const email = "someone@realcompany.io";',
          'const endpoint = "https://internal.example-corp.io/api";',
          'const secret = "sk-abcdefghijklmnopqrstuvwx";',
        ].join("\n"),
        ...CLEAN_HYGIENE_COMPANIONS,
      },
      (root) => {
        const hygiene = checkCaioProV1Static(root).filter(
          (violation) =>
            violation.rule === "CPV1-HYGIENE" &&
            violation.file === SYNTHETIC_LOOP_SUITE,
        );
        const details = hygiene.map((violation) => violation.detail).join("; ");
        expect(details).toContain("phone_shaped");
        expect(details).toContain("email_shaped");
        expect(details).toContain("endpoint_shaped");
        expect(details).toContain("secret_shaped");
        // Error text never echoes the matched content.
        expect(details).not.toContain(phoneShaped.slice(1));
        expect(details).not.toContain("realcompany");
        expect(details).not.toContain("sk-abcdefghijklmnop");
      },
    );
  });

  it("accepts clearly synthetic contact forms in the fixtures", () => {
    withFixture(
      {
        [SYNTHETIC_LOOP_SUITE]:
          'const email = "synthetic-owner@example.test";\nconst host = "127.0.0.1";\n',
        ...CLEAN_HYGIENE_COMPANIONS,
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).filter(
            (violation) => violation.rule === "CPV1-HYGIENE",
          ),
        ).toEqual([]);
      },
    );
  });

  it("rejects a boundary chain that dropped the gate or the firewall guard", () => {
    withFixture(
      {
        "package.json": JSON.stringify({
          scripts: {
            "test:caio-pro-v1:mysql":
              "vitest run lib/stage1-owner-loop/caio-pro-v1-synthetic-loop.mysql.test.ts lib/stage1-owner-loop/caio-pro-completion-store.mysql.test.ts --config vitest.public.config.ts --fileParallelism=false",
            "check:caio-pro-v1":
              "node --import tsx scripts/check-caio-pro-v1.ts && vitest run scripts/check-caio-pro-v1.test.ts --config vitest.public.config.ts",
            "check:boundaries": "npm run public:smoke:static",
          },
        }),
      },
      (root) => {
        const violations = checkCaioProV1Static(root);
        expect(
          violations.some(
            (violation) =>
              violation.rule === "CPV1-WIRING" &&
              violation.detail.includes("check:boundaries"),
          ),
        ).toBe(true);
        expect(
          violations.some(
            (violation) =>
              violation.rule === "CPV1-FIREWALL" &&
              violation.file === "package.json",
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects a skippable MySQL CI job", () => {
    withFixture(
      {
        ".github/workflows/ci.yml": [
          "jobs:",
          "  caio-pro-v1-mysql:",
          "    continue-on-error: true",
          "    env:",
          "      MYSQL_DATABASE: helm_caio_pro_v1_ci",
          "      CAIO_PRO_V1_TEST_DATABASE_NAME: helm_caio_pro_v1_ci",
          "    steps:",
          "      - run: printf 'CAIO_PRO_V1_DATABASE_URL=%s\\n' \"${url}\"",
          "      - run: npx tsx prisma/setup-db.ts prepare",
          "      - run: npm run test:caio-pro-v1:mysql",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.detail.includes("skippable"),
          ),
        ).toBe(true);
      },
    );
  });
});
