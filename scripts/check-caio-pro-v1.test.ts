import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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

const D2_SMOKE_HELPER = readFileSync(
  path.join(process.cwd(), "scripts/d2-docker-smoke.sh"),
  "utf8",
);
const D2_SMOKE_WORKFLOW = readFileSync(
  path.join(process.cwd(), ".github/workflows/d2-docker-smoke.yml"),
  "utf8",
);

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
        selections: portfolio.candidates
          .slice(0, 4)
          .map((candidate, index) => ({
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
          })),
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
        acceptanceInput({ ...ready, decision: "not_ready" }, "test-tampered"),
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

  it("rejects variable-driven external checkout and generic secrets from Public CI", () => {
    withFixture(
      {
        ".github/workflows/ci.yml": [
          "jobs:",
          "  caio-pro-v1-mysql:",
          "    env:",
          "      MYSQL_DATABASE: helm_caio_pro_v1_ci",
          "      CAIO_PRO_V1_TEST_DATABASE_NAME: helm_caio_pro_v1_ci",
          "    steps:",
          "      - run: printf 'CAIO_PRO_V1_DATABASE_URL=%s\\n' \"${url}\"",
          "      - run: npx tsx prisma/setup-db.ts prepare",
          "      - run: npm run test:caio-pro-v1:mysql",
          "",
        ].join("\n"),
        ".github/workflows/private-composition.yml": [
          "jobs:",
          "  composition-contract:",
          "    steps:",
          "      - uses: actions/checkout@v5",
          "        with:",
          '          "repository": ${{ vars.CROSS_REPO }}',
          "          token: ${{ secrets['READ_ONLY_REPOSITORY'] }}",
          "          persist-credentials: false",
          "",
        ].join("\n"),
      },
      (root) => {
        const violations = checkCaioProV1Static(root);
        expect(
          violations.some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/private-composition.yml" &&
              violation.detail.includes("external checkout is not allowlisted"),
          ),
        ).toBe(true);
        expect(
          violations.some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/private-composition.yml" &&
              violation.detail.includes("must not reference Actions secrets"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects manual repository fetches from Public CI", () => {
    withFixture(
      {
        ".github/workflows/remote-fetch.yml": [
          "jobs:",
          "  composition-contract:",
          "    steps:",
          "      - run: git -C .deps/downstream fetch origin ${{ vars.CROSS_REPO }}",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/remote-fetch.yml" &&
              violation.detail.includes("shell network commands"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects dynamic or unreviewed workflow actions", () => {
    withFixture(
      {
        ".github/workflows/private-action.yml": [
          "jobs:",
          "  composition-contract:",
          "    steps:",
          "      - { uses: ${{ vars.CROSS_REPO_ACTION }} }",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/private-action.yml" &&
              violation.detail.includes("workflow action is not allowlisted"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects a quoted checkout key that hides external repository ownership", () => {
    withFixture(
      {
        ".github/workflows/quoted-checkout.yml": [
          "jobs:",
          "  composition-contract:",
          "    steps:",
          '      - "uses": actions/checkout@v5',
          "        with:",
          "          repository: Helm-OpenSource/another-public-repo",
          "",
        ].join("\n"),
      },
      (root) => {
        const violations = checkCaioProV1Static(root);
        expect(
          violations.some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/quoted-checkout.yml" &&
              violation.detail.includes("external checkout is not allowlisted"),
          ),
        ).toBe(true);
        expect(
          violations.some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/quoted-checkout.yml" &&
              violation.detail.includes("plain explicit mapping keys"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects a flow-style checkout step that cannot be ownership-checked", () => {
    withFixture(
      {
        ".github/workflows/flow-checkout.yml": [
          "jobs:",
          "  composition-contract:",
          "    steps: [{ uses: actions/checkout@v5, with: { repository: Helm-OpenSource/another-public-repo } }]",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/flow-checkout.yml" &&
              violation.detail.includes("explicit block mapping"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects renamed reverse-composition artifacts owned by Public Core", () => {
    withFixture(
      {
        "tools/caio-access-gateway/downstream-pin.json": `${JSON.stringify({ commit: "a".repeat(40) })}\n`,
        "tools/caio-access-gateway/downstream-composition.test.ts":
          "export const load = (root: string) => import(root);\n",
        "vitest.downstream.config.ts": "export default {};\n",
      },
      (root) => {
        const violations = checkCaioProV1Static(root);
        expect(
          violations.some(
            (violation) =>
              violation.rule === "CPV1-BOUNDARY" &&
              violation.file.endsWith("downstream-pin.json") &&
              violation.detail.includes("explicit Core-owned allowlist"),
          ),
        ).toBe(true);
        expect(
          violations.some(
            (violation) =>
              violation.rule === "CPV1-BOUNDARY" &&
              violation.file === "vitest.downstream.config.ts" &&
              violation.detail.includes("dedicated reverse-composition runner"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects reverse-composition semantics hidden in an allowed Core test", () => {
    withFixture(
      {
        "tools/caio-access-gateway/server.test.ts": [
          "const root = process.env.CROSS_REPO;",
          "export const load = () => import(root);",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-BOUNDARY" &&
              violation.file === "tools/caio-access-gateway/server.test.ts" &&
              violation.detail.includes("reverse-composition semantics"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects a template-expression dynamic import in an allowed Core test", () => {
    withFixture(
      {
        "tools/caio-access-gateway/server.test.ts":
          "export const load = (root: string) => import(`${root}/router.ts`);\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-BOUNDARY" &&
              violation.file === "tools/caio-access-gateway/server.test.ts" &&
              violation.detail.includes("computed dynamic import"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects a string-concatenation dynamic import in an allowed Core test", () => {
    withFixture(
      {
        "tools/caio-access-gateway/server.test.ts":
          "export const load = (root: string) => import('./' + root);\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-BOUNDARY" &&
              violation.file === "tools/caio-access-gateway/server.test.ts" &&
              violation.detail.includes("computed dynamic import"),
          ),
        ).toBe(true);
      },
    );
  });

  it("does not let an allowlisted import name authorize another import site", () => {
    withFixture(
      {
        "instrumentation.ts":
          "export const load = (packBootstrapPath: string) => import(packBootstrapPath);\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-BOUNDARY" &&
              violation.file === "instrumentation.ts" &&
              violation.detail.includes("computed dynamic import"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects a reverse-composition test moved outside the gateway directory", () => {
    withFixture(
      {
        "tests/downstream-composition.test.ts":
          "export const load = (root: string) => import(`${root}/router.ts`);\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-BOUNDARY" &&
              violation.file === "tests/downstream-composition.test.ts" &&
              violation.detail.includes("computed dynamic import"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects a renamed Vite test-runner config", () => {
    withFixture(
      {
        "vite.downstream.config.ts": "export default {};\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-BOUNDARY" &&
              violation.file === "vite.downstream.config.ts" &&
              violation.detail.includes("test-runner config"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects repository archive downloads through gh api", () => {
    withFixture(
      {
        ".github/workflows/remote-archive.yml": [
          "jobs:",
          "  composition-contract:",
          "    steps:",
          "      - run: gh api repos/${{ vars.OWNER }}/${{ vars.REPO }}/tarball/${{ vars.REF }} > downstream.tar.gz",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/remote-archive.yml" &&
              violation.detail.includes("shell network commands"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects quoted OIDC permission with a direct request-token exchange", () => {
    withFixture(
      {
        ".github/workflows/oidc-fetch.yml": [
          "permissions:",
          '  "id-token": "write"',
          "jobs:",
          "  composition-contract:",
          "    steps:",
          "      - run: node -e \"fetch(process.env.ACTIONS_ID_TOKEN_REQUEST_URL,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}})\"",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/oidc-fetch.yml" &&
              violation.detail.includes("mint external credentials"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects quoted OIDC write permission without relying on request env markers", () => {
    withFixture(
      {
        ".github/workflows/oidc-permission.yml": [
          "permissions:",
          '  "id-token": "write"',
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: npm test",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/oidc-permission.yml" &&
              violation.detail.includes("mint external credentials"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects a workflow-reachable shell helper that fetches a repository", () => {
    withFixture(
      {
        ".github/workflows/helper-fetch.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: bash ops/fetch-private.sh",
          "",
        ].join("\n"),
        "ops/fetch-private.sh":
          "gh api repos/example/private/tarball/main > private.tar.gz\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === "ops/fetch-private.sh" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects an extensionless executable helper that fetches a repository", () => {
    withFixture(
      {
        ".github/workflows/helper-fetch.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: ./ops/fetch",
          "",
        ].join("\n"),
        "ops/fetch":
          "#!/usr/bin/env bash\ngh api repos/example/private/tarball/main\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/fetch" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    ['"/bin/bash" ops/fetch.sh', "ops/fetch.sh"],
    ["/usr/bin/env bash ops/fetch.sh", "ops/fetch.sh"],
    ["env -i bash ops/fetch.sh", "ops/fetch.sh"],
    ["env -u FOO bash ops/fetch.sh", "ops/fetch.sh"],
    ["command bash ops/fetch.sh", "ops/fetch.sh"],
    ["command -p bash ops/fetch.sh", "ops/fetch.sh"],
    ["/usr/local/bin/bash ops/fetch.sh", "ops/fetch.sh"],
    ["bash \\\n  ops/fetch.sh", "ops/fetch.sh"],
    ['"./ops/fetch"', "ops/fetch"],
  ])(
    "resolves an ordinary wrapped shell helper entry: %s",
    (runCommand, expectedHelper) => {
      withFixture(
        {
          ".github/workflows/helper-entry.yml": [
            "jobs:",
            "  verify:",
            "    steps:",
            `      - run: ${JSON.stringify(runCommand)}`,
            "",
          ].join("\n"),
          "ops/fetch.sh":
            "gh api repos/example/private/tarball/main > private.tar.gz\n",
          "ops/fetch":
            "#!/usr/bin/env bash\ngh api repos/example/private/tarball/main\n",
        },
        (root) => {
          expect(
            checkCaioProV1Static(root).some(
              (violation) =>
                violation.file === expectedHelper &&
                violation.detail.includes("workflow-reachable helper"),
            ),
          ).toBe(true);
        },
      );
    },
  );

  it.each([
    ['echo "$(./ops/fetch)"', "ops/fetch"],
    ["echo `./ops/fetch`", "ops/fetch"],
    ["(bash ops/fetch.sh)", "ops/fetch.sh"],
  ])("resolves a nested shell helper entry: %s", (runCommand, helperFile) => {
    withFixture(
      {
        ".github/workflows/nested-entry.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          `      - run: ${JSON.stringify(runCommand)}`,
          "",
        ].join("\n"),
        "ops/fetch":
          "#!/usr/bin/env bash\ngh api repos/example/private/tarball/main\n",
        "ops/fetch.sh":
          "gh api repos/example/private/tarball/main > private.tar.gz\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === helperFile &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each(['"$HELPER"', "env -C ops bash fetch.sh"])(
    "fails closed for an unresolved command context: %s",
    (runCommand) => {
      withFixture(
        {
          ".github/workflows/unresolved-entry.yml": [
            "jobs:",
            "  verify:",
            "    steps:",
            `      - run: ${JSON.stringify(runCommand)}`,
            "",
          ].join("\n"),
        },
        (root) => {
          expect(
            checkCaioProV1Static(root).some(
              (violation) =>
                violation.file === ".github/workflows/unresolved-entry.yml" &&
                violation.detail.includes("could not be resolved statically"),
            ),
          ).toBe(true);
        },
      );
    },
  );

  it("fails closed when a reachable command changes cwd", () => {
    withFixture(
      {
        ".github/workflows/cd-npm.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: cd ops && npm run acquire-private",
          "",
        ].join("\n"),
        "package.json": JSON.stringify({
          scripts: { "acquire-private": "echo benign-root-script" },
        }),
        "ops/package.json": JSON.stringify({
          scripts: { "acquire-private": "node network.mjs" },
        }),
        "ops/network.mjs":
          'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/cd-npm.yml" &&
              violation.detail.includes("working directory mutation"),
          ),
        ).toBe(true);
      },
    );
  });

  it("fails closed when builtin changes the reachable working directory", () => {
    withFixture(
      {
        ".github/workflows/builtin-cd.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: builtin cd ops; bash fetch.sh",
          "",
        ].join("\n"),
        "fetch.sh": "echo benign-root-helper\n",
        "ops/fetch.sh":
          "gh api repos/example/private/tarball/main > private.tar.gz\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/builtin-cd.yml" &&
              violation.detail.includes("working directory mutation"),
          ),
        ).toBe(true);
      },
    );
  });

  it("resolves a local executable introduced by a static PATH prefix", () => {
    withFixture(
      {
        ".github/workflows/path-helper.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: PATH=ops:$PATH fetch-private",
          "",
        ].join("\n"),
        "ops/fetch-private":
          "#!/usr/bin/env bash\ngh api repos/example/private/tarball/main\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/fetch-private" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    "PATH=ops:$PATH; fetch-private",
    "export PATH=ops:$PATH; fetch-private",
    "PATH=ops:$PATH export PATH; fetch-private",
    "PATH=ops:$PATH readonly PATH; fetch-private",
    "PATH=ops:$PATH builtin export PATH; fetch-private",
    "PATH=ops:$PATH declare -x PATH; fetch-private",
    "PATH+=:ops; fetch-private",
    "export PATH+=:ops; fetch-private",
  ])("fails closed for a persistent PATH mutation: %s", (runCommand) => {
    withFixture(
      {
        ".github/workflows/path-mutation.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          `      - run: ${JSON.stringify(runCommand)}`,
          "",
        ].join("\n"),
        "ops/fetch-private":
          "#!/usr/bin/env bash\ngh api repos/example/private/tarball/main\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/path-mutation.yml" &&
              violation.detail.includes("could not be resolved statically"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    ["BASH_ENV", ["env:", "  BASH_ENV: ops/env.sh"], "      - run: echo ok"],
    [
      "NODE_OPTIONS preload",
      ["env:", "  NODE_OPTIONS: --require ./ops/preload.cjs"],
      "      - run: node -e \"console.log('ok')\"",
    ],
    ["GITHUB_PATH", [], '      - run: echo "ops" >> "$GITHUB_PATH"'],
    [
      "GITHUB_ENV execution hook",
      [],
      '      - run: echo "BASH_ENV=ops/env.sh" >> "$GITHUB_ENV"',
    ],
  ])(
    "fails closed for implicit workflow execution through %s",
    (_label, workflowPrefix, runStep) => {
      withFixture(
        {
          ".github/workflows/implicit-entry.yml": [
            ...workflowPrefix,
            "jobs:",
            "  verify:",
            "    steps:",
            runStep,
            "      - run: fetch-private",
            "",
          ].join("\n"),
          "ops/env.sh":
            "gh api repos/example/private/tarball/main > private.tar.gz\n",
          "ops/preload.cjs":
            'require("node:child_process").execFileSync("gh", ["api", "repos/example/private/tarball/main"]);\n',
          "ops/fetch-private":
            "#!/usr/bin/env bash\ngh api repos/example/private/tarball/main\n",
        },
        (root) => {
          expect(
            checkCaioProV1Static(root).some(
              (violation) =>
                violation.file === ".github/workflows/implicit-entry.yml" &&
                violation.detail.includes("implicit execution"),
            ),
          ).toBe(true);
        },
      );
    },
  );

  it.each([
    [
      "workflow defaults",
      [
        "defaults:",
        "  run:",
        '    shell: "bash ops/wrapper.sh {0}"',
        "jobs:",
        "  verify:",
        "    steps:",
        "      - run: echo ok",
        "",
      ],
    ],
    [
      "job defaults",
      [
        "jobs:",
        "  verify:",
        "    defaults:",
        "      run:",
        '        shell: "bash ops/wrapper.sh {0}"',
        "    steps:",
        "      - run: echo ok",
        "",
      ],
    ],
    [
      "step shell",
      [
        "jobs:",
        "  verify:",
        "    steps:",
        "      - run: echo ok",
        '        shell: "bash ops/wrapper.sh {0}"',
        "",
      ],
    ],
  ])("fails closed for an unverified custom %s", (_label, workflow) => {
    withFixture(
      {
        ".github/workflows/custom-shell.yml": workflow.join("\n"),
        "ops/wrapper.sh": [
          "#!/usr/bin/env bash",
          "gh api repos/example/private/tarball/main",
          'bash "$1"',
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/custom-shell.yml" &&
              violation.detail.includes("shell could not be verified"),
          ),
        ).toBe(true);
      },
    );
  });

  it("allows the explicit built-in bash workflow shell", () => {
    withFixture(
      {
        ".github/workflows/bash-shell.yml": [
          "defaults:",
          "  run:",
          "    shell: bash",
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: echo ok",
          "        shell: bash",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/bash-shell.yml" &&
              violation.detail.includes("shell could not be verified"),
          ),
        ).toBe(false);
      },
    );
  });

  it("fails closed for implicit execution through the job container environment", () => {
    withFixture(
      {
        ".github/workflows/container-env.yml": [
          "jobs:",
          "  verify:",
          "    container:",
          "      image: node:22",
          "      env:",
          "        BASH_ENV: ops/env.sh",
          "    steps:",
          "      - run: echo ok",
          "",
        ].join("\n"),
        "ops/env.sh":
          "gh api repos/example/private/tarball/main > private.tar.gz\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/container-env.yml" &&
              violation.detail.includes("implicit execution through BASH_ENV"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    "--env BASH_ENV=/__w/helm-public/helm-public/ops/env.sh",
    "--env-file ops/environment",
  ])("fails closed for unverified job container options: %s", (options) => {
    withFixture(
      {
        ".github/workflows/container-options.yml": [
          "jobs:",
          "  verify:",
          "    container:",
          "      image: node:22",
          `      options: ${options}`,
          "    steps:",
          "      - run: echo ok",
          "",
        ].join("\n"),
        "ops/environment": "BASH_ENV=ops/env.sh\n",
        "ops/env.sh":
          "gh api repos/example/private/tarball/main > private.tar.gz\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/container-options.yml" &&
              violation.detail.includes("container options could not be verified"),
          ),
        ).toBe(true);
      },
    );
  });

  it("fails closed for an unverified job container volume", () => {
    withFixture(
      {
        ".github/workflows/container-volume.yml": [
          "jobs:",
          "  verify:",
          "    container:",
          "      image: node:22",
          "      volumes:",
          "        - ops:/workspace/ops",
          "    steps:",
          "      - run: echo ok",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/container-volume.yml" &&
              violation.detail.includes("container volumes could not be verified"),
          ),
        ).toBe(true);
      },
    );
  });

  it("checks implicit execution environment on an action step", () => {
    withFixture(
      {
        ".github/workflows/action-step-env.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - uses: actions/checkout@v5",
          "        env:",
          "          NODE_OPTIONS: --require ./ops/preload.cjs",
          "",
        ].join("\n"),
        "ops/preload.cjs":
          'require("node:child_process").execFileSync("gh", ["api", "repos/example/private/tarball/main"]);\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/action-step-env.yml" &&
              violation.detail.includes("implicit execution through NODE_OPTIONS"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    `printf '%s=%s\\n' BASH_ENV ops/env.sh >> "$GITHUB_ENV"`,
    `cat ops/environment >> "$GITHUB_ENV"`,
    `echo 'BASH_ENV'='ops/env.sh' >> "$GITHUB_ENV"`,
    `printf 'DATABASE_URL=mysql://safe\\nBASH_ENV=ops/env.sh\\n' >> "$GITHUB_ENV"`,
  ])("fails closed for an unverified GITHUB_ENV writer: %s", (runCommand) => {
    withFixture(
      {
        ".github/workflows/github-env-writer.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          `      - run: ${JSON.stringify(runCommand)}`,
          "",
        ].join("\n"),
        "ops/environment": "BASH_ENV=ops/env.sh\n",
        "ops/env.sh":
          "gh api repos/example/private/tarball/main > private.tar.gz\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/github-env-writer.yml" &&
              violation.detail.includes("implicit execution state mutation"),
          ),
        ).toBe(true);
      },
    );
  });

  it("requires a fail-closed line check before an audited GITHUB_ENV group", () => {
    withFixture(
      {
        ".github/workflows/github-env-unchecked.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: |",
          '          url="mysql://app@127.0.0.1/test"',
          "          {",
          "            printf 'DATABASE_URL=%s\\n' \"${url}\"",
          '          } >>"${GITHUB_ENV}"',
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/github-env-unchecked.yml" &&
              violation.detail.includes("implicit execution state mutation"),
          ),
        ).toBe(true);
      },
    );
  });

  it("allows the audited database URL block to write GITHUB_ENV", () => {
    withFixture(
      {
        ".github/workflows/github-env-database.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: |",
          '          url="mysql://app@127.0.0.1/test"',
          "          [[ \"${url}\" != *$'\\n'* && \"${url}\" != *$'\\r'* ]] || exit 1",
          "          {",
          "            printf 'DATABASE_URL=%s\\n' \"${url}\"",
          "            printf 'CAIO_PRO_V1_DATABASE_URL=%s\\n' \"${url}\"",
          '          } >>"${GITHUB_ENV}"',
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/github-env-database.yml" &&
              violation.detail.includes("implicit execution state mutation"),
          ),
        ).toBe(false);
      },
    );
  });

  it("rejects a workflow-reachable module helper that uses fetch", () => {
    withFixture(
      {
        ".github/workflows/helper-fetch.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: npm run acquire-private",
          "",
        ].join("\n"),
        "package.json": JSON.stringify({
          scripts: { "acquire-private": "node ops/fetch-private.mjs" },
        }),
        "ops/fetch-private.mjs":
          'await fetch("https://example.test/private-repository.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === "ops/fetch-private.mjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    "curl -fsSL https://example.test/repository.tar.gz -o repository.tar.gz",
    "git -C .deps/repository fetch origin main",
  ])("rejects workflow-reachable shell repository access: %s", (command) => {
    withFixture(
      {
        ".github/workflows/helper-fetch.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: bash ops/fetch-private.sh",
          "",
        ].join("\n"),
        "ops/fetch-private.sh": `${command}\n`,
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === "ops/fetch-private.sh" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects repository access in a nested workflow-reachable shell helper", () => {
    withFixture(
      {
        ".github/workflows/helper-fetch.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: bash ops/entrypoint",
          "",
        ].join("\n"),
        "ops/entrypoint": "#!/usr/bin/env bash\nbash ops/nested.sh\n",
        "ops/nested.sh":
          "#!/usr/bin/env bash\ngit fetch https://example.test/private.git main\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === "ops/nested.sh" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects property-access fetch in a workflow-reachable module helper", () => {
    withFixture(
      {
        ".github/workflows/helper-fetch.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: node ops/fetch-private.mjs",
          "",
        ].join("\n"),
        "ops/fetch-private.mjs":
          'await globalThis.fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === "ops/fetch-private.mjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    'await globalThis["fetch"]("https://example.test/private.tar.gz");',
    'await fetch.call(globalThis, "https://example.test/private.tar.gz");',
  ])("rejects an indirect fetch call in a reachable helper: %s", (source) => {
    withFixture(
      {
        ".github/workflows/helper-fetch.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: node ops/fetch-private.mjs",
          "",
        ].join("\n"),
        "ops/fetch-private.mjs": `${source}\n`,
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/fetch-private.mjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects bracket-access fetch in inline Node evaluation", () => {
    withFixture(
      {
        ".github/workflows/inline-fetch.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          '      - run: node -e \'globalThis["fetch"]("https://example.test/private.tar.gz")\'',
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/inline-fetch.yml" &&
              violation.detail.includes("inline node evaluation"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects repository access in a statically imported helper module", () => {
    withFixture(
      {
        ".github/workflows/helper-fetch.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: node ops/entrypoint.mjs",
          "",
        ].join("\n"),
        "ops/entrypoint.mjs": 'import "./network.mjs";\n',
        "ops/network.mjs":
          'await fetch("https://example.test/private-repository.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === "ops/network.mjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("does not let the local D2 binding allow unrelated repository access", () => {
    withFixture(
      {
        ".github/workflows/d2-docker-smoke.yml": [
          "jobs:",
          "  d2-docker-smoke:",
          "    env:",
          "      HELM_D2_SMOKE_REPO_URL: ${{ github.workspace }}",
          "      HELM_D2_SMOKE_REF: HEAD",
          "    steps:",
          "      - run: bash scripts/d2-docker-smoke.sh",
          "",
        ].join("\n"),
        "scripts/d2-docker-smoke.sh":
          "gh api repos/example/private/tarball/main > private.tar.gz\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === "scripts/d2-docker-smoke.sh" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects an escaped semantic id-token write permission", () => {
    withFixture(
      {
        ".github/workflows/escaped-oidc.yml": [
          "permissions:",
          '  "\\u0069d-token": "write"',
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: npm test",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/escaped-oidc.yml" &&
              violation.detail.includes("mint external credentials"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects an escaped job-level id-token write permission", () => {
    withFixture(
      {
        ".github/workflows/job-oidc.yml": [
          "jobs:",
          "  verify:",
          "    permissions:",
          '      "\\u0069d-token": "write"',
          "    steps:",
          "      - run: npm test",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/job-oidc.yml" &&
              violation.detail.includes("mint external credentials"),
          ),
        ).toBe(true);
      },
    );
  });

  it("fails closed when workflow YAML cannot be parsed", () => {
    withFixture(
      {
        ".github/workflows/invalid.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: [unterminated",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/invalid.yml" &&
              violation.detail.includes("valid YAML"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects a command that concatenates an OIDC request environment name", () => {
    withFixture(
      {
        ".github/workflows/spliced-oidc.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          '      - run: printf "%s" "$ACTIONS_ID_TOKEN_REQUEST_U""RL"',
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/spliced-oidc.yml" &&
              violation.detail.includes("mint external credentials"),
          ),
        ).toBe(true);
      },
    );
  });

  it("fails closed when a workflow helper entry is not statically resolvable", () => {
    withFixture(
      {
        ".github/workflows/dynamic-helper.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          '      - run: bash "$HELPER_PATH"',
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.file === ".github/workflows/dynamic-helper.yml" &&
              violation.detail.includes("could not be resolved statically"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each(["python3 ops/fetch.py", '"/usr/bin/python3" ops/fetch.py'])(
    "fails closed for an unsupported local interpreter helper: %s",
    (runCommand) => {
      withFixture(
        {
          ".github/workflows/python-helper.yml": [
            "jobs:",
            "  verify:",
            "    steps:",
            `      - run: ${JSON.stringify(runCommand)}`,
            "",
          ].join("\n"),
          "ops/fetch.py": [
            "from urllib.request import urlopen",
            'urlopen("https://example.test/private.tar.gz")',
            "",
          ].join("\n"),
        },
        (root) => {
          expect(
            checkCaioProV1Static(root).some(
              (violation) =>
                violation.file === ".github/workflows/python-helper.yml" &&
                violation.detail.includes("unsupported local interpreter"),
            ),
          ).toBe(true);
        },
      );
    },
  );

  it("does not let comments forge a computed-import allowance", () => {
    withFixture(
      {
        "instrumentation.ts": [
          "const packBootstrapPath = process.env.PACK_BOOTSTRAP_PATH;",
          '// const packBootstrapPath = ["@/extensions", "pack-bootstrap"].join("/");',
          "// const { registerAllPacks } = (await import(packBootstrapPath)) as {",
          "export async function register() {",
          "  await import(packBootstrapPath);",
          "}",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-BOUNDARY" &&
              violation.file === "instrumentation.ts" &&
              violation.detail.includes("computed dynamic import"),
          ),
        ).toBe(true);
      },
    );
  });

  it("scans executable source in a nested directory named coverage", () => {
    withFixture(
      {
        "src/coverage/escape.ts":
          "export const load = (target: string) => import(target);\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-BOUNDARY" &&
              violation.file === "src/coverage/escape.ts" &&
              violation.detail.includes("computed dynamic import"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects the actual runner config referenced by a package script", () => {
    withFixture(
      {
        "package.json": JSON.stringify({
          scripts: {
            verify: "vitest run --config runner/downstream.vitest.config.ts",
          },
        }),
        "runner/downstream.vitest.config.ts": "export default {};\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-BOUNDARY" &&
              violation.file === "runner/downstream.vitest.config.ts" &&
              violation.detail.includes("test-runner config"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects the actual runner config referenced by a workflow command", () => {
    withFixture(
      {
        ".github/workflows/custom-runner.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: vitest run --config runner/custom-runner.ts",
          "",
        ].join("\n"),
        "runner/custom-runner.ts": "export default {};\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-BOUNDARY" &&
              violation.file === "runner/custom-runner.ts" &&
              violation.detail.includes("test-runner config"),
          ),
        ).toBe(true);
      },
    );
  });

  it("fails closed when TypeScript source has parse diagnostics", () => {
    withFixture(
      {
        "src/malformed.ts": [
          "const broken = `unterminated;",
          "export const load = (target: string) => import(target);",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-BOUNDARY" &&
              violation.file === "src/malformed.ts" &&
              violation.detail.includes("could not be parsed"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects top-level write-all permissions as OIDC-capable", () => {
    withFixture(
      {
        ".github/workflows/write-all.yml": [
          "permissions: write-all",
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: echo ok",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/write-all.yml" &&
              violation.detail.includes("mint external credentials"),
          ),
        ).toBe(true);
      },
    );
  });

  it("fails closed for a non-literal job-level id-token permission", () => {
    withFixture(
      {
        ".github/workflows/matrix-oidc.yml": [
          "jobs:",
          "  verify:",
          "    permissions:",
          "      id-token: ${{ matrix.permission }}",
          "    steps:",
          "      - run: echo ok",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/matrix-oidc.yml" &&
              violation.detail.includes("mint external credentials"),
          ),
        ).toBe(true);
      },
    );
  });

  it("allows an explicitly disabled id-token permission", () => {
    withFixture(
      {
        ".github/workflows/no-oidc.yml": [
          "permissions:",
          "  id-token: none",
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: echo ok",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).filter(
            (violation) =>
              violation.file === ".github/workflows/no-oidc.yml" &&
              violation.detail.includes("mint external credentials"),
          ),
        ).toEqual([]);
      },
    );
  });

  it("rejects a step-level override of the D2 local clone binding", () => {
    withFixture(
      {
        ".github/workflows/d2-docker-smoke.yml": [
          "jobs:",
          "  d2-docker-smoke:",
          "    env:",
          "      HELM_D2_SMOKE_REPO_URL: ${{ github.workspace }}",
          "      HELM_D2_SMOKE_REF: HEAD",
          "    steps:",
          "      - run: bash scripts/d2-docker-smoke.sh",
          "        env:",
          "          HELM_D2_SMOKE_REPO_URL: https://example.test/private.git",
          "",
        ].join("\n"),
        "scripts/d2-docker-smoke.sh": D2_SMOKE_HELPER,
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "scripts/d2-docker-smoke.sh" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects a run-prefix override of the D2 local clone binding", () => {
    withFixture(
      {
        ".github/workflows/d2-docker-smoke.yml": [
          "jobs:",
          "  d2-docker-smoke:",
          "    env:",
          "      HELM_D2_SMOKE_REPO_URL: ${{ github.workspace }}",
          "      HELM_D2_SMOKE_REF: HEAD",
          "    steps:",
          "      - run: HELM_D2_SMOKE_REPO_URL=https://example.test/private.git bash scripts/d2-docker-smoke.sh",
          "",
        ].join("\n"),
        "scripts/d2-docker-smoke.sh": D2_SMOKE_HELPER,
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-CI" &&
              violation.detail.includes("workflow-reachable"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects a D2 helper that rewrites the local repository binding", () => {
    withFixture(
      {
        ".github/workflows/d2-docker-smoke.yml": [
          "jobs:",
          "  d2-docker-smoke:",
          "    env:",
          "      HELM_D2_SMOKE_REPO_URL: ${{ github.workspace }}",
          "      HELM_D2_SMOKE_REF: HEAD",
          "    steps:",
          "      - run: bash scripts/d2-docker-smoke.sh",
          "",
        ].join("\n"),
        "scripts/d2-docker-smoke.sh": D2_SMOKE_HELPER.replace(
          'repo_url="${HELM_D2_SMOKE_REPO_URL:-$(git config --get remote.origin.url)}"',
          'repo_url="https://example.test/private.git"',
        ),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "scripts/d2-docker-smoke.sh" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each(["  bash ops/fetch.sh", "source ops/fetch.sh", ". ops/fetch.sh"])(
    "resolves a shell helper invocation form: %s",
    (runCommand) => {
      withFixture(
        {
          ".github/workflows/helper-form.yml": [
            "jobs:",
            "  verify:",
            "    steps:",
            "      - run: |",
            `          ${runCommand}`,
            "",
          ].join("\n"),
          "ops/fetch.sh":
            "curl -fsSL https://example.test/private.tar.gz -o private.tar.gz\n",
        },
        (root) => {
          expect(
            checkCaioProV1Static(root).some(
              (violation) =>
                violation.file === "ops/fetch.sh" &&
                violation.detail.includes("workflow-reachable helper"),
            ),
          ).toBe(true);
        },
      );
    },
  );

  it("fails closed for a shell -c wrapper around a local helper", () => {
    withFixture(
      {
        ".github/workflows/helper-form.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: bash -c 'source ops/fetch.sh'",
          "",
        ].join("\n"),
        "ops/fetch.sh":
          "curl -fsSL https://example.test/private.tar.gz -o private.tar.gz\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/helper-form.yml" &&
              violation.detail.includes("could not be resolved statically"),
          ),
        ).toBe(true);
      },
    );
  });

  it("fails closed for a dynamic source inside a reachable shell helper", () => {
    withFixture(
      {
        ".github/workflows/dynamic-source.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: bash ops/entry.sh",
          "",
        ].join("\n"),
        "ops/entry.sh": 'source "$HELPER_PATH"\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/entry.sh" &&
              violation.detail.includes("could not be resolved statically"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each(["fetch", "globalThis.fetch"])(
    "rejects inline node -e %s",
    (fetchExpression) => {
      withFixture(
        {
          ".github/workflows/inline-fetch.yml": [
            "jobs:",
            "  verify:",
            "    steps:",
            `      - run: node -e '${fetchExpression}("https://example.test/private.tar.gz")'`,
            "",
          ].join("\n"),
        },
        (root) => {
          expect(
            checkCaioProV1Static(root).some(
              (violation) =>
                violation.file === ".github/workflows/inline-fetch.yml" &&
                violation.detail.includes("fetch another repository"),
            ),
          ).toBe(true);
        },
      );
    },
  );

  it("rejects an allowlisted initializer outside the import lexical scope", () => {
    withFixture(
      {
        "instrumentation.ts": [
          "export async function register() {",
          "  if (false) {",
          '    const packBootstrapPath = ["@/extensions", "pack-bootstrap"].join("/");',
          "  }",
          "  await import(packBootstrapPath);",
          "}",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "instrumentation.ts" &&
              violation.detail.includes("computed dynamic import"),
          ),
        ).toBe(true);
      },
    );
  });

  it("requires node:path and node:url provenance for the SQLite allowance", () => {
    withFixture(
      {
        "scripts/archive/sqlite-to-mysql-migration.ts": [
          'import path from "node:path";',
          'import { pathToFileURL } from "node:url";',
          "const projectRoot = process.cwd();",
          "async function load() {",
          "  const path = { resolve: (...parts: string[]) => parts.join('/') };",
          "  const pathToFileURL = (value: string) => ({ href: value });",
          "  const sqliteClientModulePath = pathToFileURL(",
          '    path.resolve(projectRoot, "generated/sqlite-client/index.js"),',
          "  ).href;",
          "  await import(sqliteClientModulePath);",
          "}",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file ===
                "scripts/archive/sqlite-to-mysql-migration.ts" &&
              violation.detail.includes("computed dynamic import"),
          ),
        ).toBe(true);
      },
    );
  });

  it("recognizes a runner config after a shell line continuation", () => {
    withFixture(
      {
        "package.json": JSON.stringify({
          scripts: {
            verify:
              "vitest run --config \\\n  runner/downstream.vitest.config.ts",
          },
        }),
        "runner/downstream.vitest.config.ts": "export default {};\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "runner/downstream.vitest.config.ts" &&
              violation.detail.includes("test-runner config"),
          ),
        ).toBe(true);
      },
    );
  });

  it("ignores .git and node_modules directories at every depth", () => {
    withFixture(
      {
        "nested/.git/escape.ts":
          "export const load = (target: string) => import(target);\n",
        "nested/node_modules/escape.ts":
          "export const load = (target: string) => import(target);\n",
      },
      (root) => {
        const files = checkCaioProV1Static(root)
          .filter((violation) => violation.rule === "CPV1-BOUNDARY")
          .map((violation) => violation.file);
        expect(files).not.toContain("nested/.git/escape.ts");
        expect(files).not.toContain("nested/node_modules/escape.ts");
      },
    );
  });

  it("lets the all-repository guard reject dynamic import in a JS helper", () => {
    withFixture(
      {
        ".github/workflows/dynamic-import.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: node ops/entry.mjs",
          "",
        ].join("\n"),
        "ops/entry.mjs": "export const load = (target) => import(target);\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.rule === "CPV1-BOUNDARY" &&
              violation.file === "ops/entry.mjs" &&
              violation.detail.includes("computed dynamic import"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    'bash "ops/fetch.sh"',
    "/bin/bash ops/fetch.sh",
    "env bash ops/fetch.sh",
  ])("resolves an alternate shell entry form: %s", (runCommand) => {
    withFixture(
      {
        ".github/workflows/helper-entry.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          `      - run: ${runCommand}`,
          "",
        ].join("\n"),
        "ops/fetch.sh":
          "curl -fsSL https://example.test/private.tar.gz -o private.tar.gz\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/fetch.sh" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("continues the command graph from a shell helper into an npm script", () => {
    withFixture(
      {
        ".github/workflows/helper-npm.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: bash ops/entry.sh",
          "",
        ].join("\n"),
        "ops/entry.sh": "npm run acquire-private\n",
        "package.json": JSON.stringify({
          scripts: { "acquire-private": "node ops/network.mjs" },
        }),
        "ops/network.mjs":
          'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/network.mjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("resolves npm scripts from the workflow working directory package", () => {
    withFixture(
      {
        ".github/workflows/helper-npm-cwd.yml": [
          "jobs:",
          "  verify:",
          "    defaults:",
          "      run:",
          "        working-directory: ops",
          "    steps:",
          "      - run: bash entry.sh",
          "",
        ].join("\n"),
        "ops/entry.sh": "npm run acquire-private\n",
        "package.json": JSON.stringify({
          scripts: { "acquire-private": "echo benign-root-script" },
        }),
        "ops/package.json": JSON.stringify({
          scripts: { "acquire-private": "node network.mjs" },
        }),
        "ops/network.mjs":
          'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/network.mjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects remote access executed directly by an npm script", () => {
    withFixture(
      {
        ".github/workflows/helper-npm.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: npm run acquire-private",
          "",
        ].join("\n"),
        "package.json": JSON.stringify({
          scripts: {
            "acquire-private":
              "curl -fsSL https://example.test/private.tar.gz -o private.tar.gz",
          },
        }),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "package.json" &&
              violation.detail.includes("workflow-reachable command"),
          ),
        ).toBe(true);
      },
    );
  });

  it("resolves a quoted npm executable", () => {
    withFixture(
      {
        ".github/workflows/quoted-npm.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          `      - run: ${JSON.stringify('"npm" run acquire-private')}`,
          "",
        ].join("\n"),
        "package.json": JSON.stringify({
          scripts: { "acquire-private": "node network.mjs" },
        }),
        "network.mjs": 'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "network.mjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("expands npm ci lifecycle scripts", () => {
    withFixture(
      {
        ".github/workflows/npm-ci.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: npm ci",
          "",
        ].join("\n"),
        "package.json": JSON.stringify({
          scripts: { postinstall: "node network.mjs" },
        }),
        "network.mjs": 'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "network.mjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    [
      "workspace postinstall",
      "npm ci",
      {},
      { postinstall: "node network.mjs" },
      "ops/network.mjs",
    ],
    [
      "root dependencies",
      "npm ci",
      { dependencies: "node network.mjs" },
      {},
      "network.mjs",
    ],
    [
      "workspace plus included root",
      "npm ci --workspace ops --include-workspace-root",
      { postinstall: "node network.mjs" },
      {},
      "network.mjs",
    ],
  ])(
    "expands npm install lifecycle for %s",
    (_label, runCommand, rootScripts, workspaceScripts, expectedHelper) => {
      withFixture(
        {
          ".github/workflows/npm-lifecycle.yml": [
            "jobs:",
            "  verify:",
            "    steps:",
            `      - run: ${JSON.stringify(runCommand)}`,
            "",
          ].join("\n"),
          "package.json": JSON.stringify({
            workspaces: ["ops"],
            scripts: rootScripts,
          }),
          "ops/package.json": JSON.stringify({
            name: "ops",
            scripts: workspaceScripts,
          }),
          "network.mjs":
            'await fetch("https://example.test/private.tar.gz");\n',
          "ops/network.mjs":
            'await fetch("https://example.test/private.tar.gz");\n',
        },
        (root) => {
          expect(
            checkCaioProV1Static(root).some(
              (violation) =>
                violation.file === expectedHelper &&
                violation.detail.includes("workflow-reachable helper"),
            ),
          ).toBe(true);
        },
      );
    },
  );

  it("expands a named workspace selected through a static wildcard", () => {
    withFixture(
      {
        ".github/workflows/npm-workspace-glob.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: npm ci --workspace @example/ops",
          "",
        ].join("\n"),
        "package.json": JSON.stringify({ workspaces: ["packages/*"] }),
        "packages/ops/package.json": JSON.stringify({
          name: "@example/ops",
          scripts: { postinstall: "node network.mjs" },
        }),
        "packages/ops/network.mjs":
          'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "packages/ops/network.mjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    ["selected workspace", "npm ci --workspace ops", ""],
    ["workspace cwd", "npm ci", "ops"],
  ])(
    "includes root install lifecycle for %s",
    (_label, runCommand, workingDirectory) => {
      withFixture(
        {
          ".github/workflows/npm-root-lifecycle.yml": [
            "jobs:",
            "  verify:",
            ...(workingDirectory
              ? [
                  "    defaults:",
                  "      run:",
                  `        working-directory: ${workingDirectory}`,
                ]
              : []),
            "    steps:",
            `      - run: ${JSON.stringify(runCommand)}`,
            "",
          ].join("\n"),
          "package.json": JSON.stringify({
            workspaces: ["ops"],
            scripts: { postinstall: "node network.mjs" },
          }),
          "ops/package.json": JSON.stringify({ name: "ops" }),
          "network.mjs":
            'await fetch("https://example.test/private.tar.gz");\n',
        },
        (root) => {
          expect(
            checkCaioProV1Static(root).some(
              (violation) =>
                violation.file === "network.mjs" &&
                violation.detail.includes("workflow-reachable helper"),
            ),
          ).toBe(true);
        },
      );
    },
  );

  it("fails closed for a symlinked workspace matched by a wildcard", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "caio-pro-v1-gate-"));
    try {
      mkdirSync(path.join(root, ".github/workflows"), { recursive: true });
      mkdirSync(path.join(root, "packages"), { recursive: true });
      mkdirSync(path.join(root, "actual/ops"), { recursive: true });
      writeFileSync(
        path.join(root, ".github/workflows/npm-symlink-workspace.yml"),
        ["jobs:", "  verify:", "    steps:", "      - run: npm ci", ""].join(
          "\n",
        ),
        "utf8",
      );
      writeFileSync(
        path.join(root, "package.json"),
        JSON.stringify({ workspaces: ["packages/*"] }),
        "utf8",
      );
      writeFileSync(
        path.join(root, "actual/ops/package.json"),
        JSON.stringify({
          name: "ops",
          scripts: { postinstall: "node network.mjs" },
        }),
        "utf8",
      );
      writeFileSync(
        path.join(root, "actual/ops/network.mjs"),
        'await fetch("https://example.test/private.tar.gz");\n',
        "utf8",
      );
      symlinkSync("../actual/ops", path.join(root, "packages/ops"));

      expect(
        checkCaioProV1Static(root).some(
          (violation) =>
            violation.file === ".github/workflows/npm-symlink-workspace.yml" &&
            violation.detail.includes("package graph could not be resolved"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    "npm run acquire-private --workspace ops",
    "npm --prefix ops run acquire-private",
  ])("resolves an npm package execution context: %s", (runCommand) => {
    withFixture(
      {
        ".github/workflows/npm-context.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          `      - run: ${JSON.stringify(runCommand)}`,
          "",
        ].join("\n"),
        "package.json": JSON.stringify({
          workspaces: ["ops"],
          scripts: { "acquire-private": "echo benign-root-script" },
        }),
        "ops/package.json": JSON.stringify({
          name: "ops",
          scripts: { "acquire-private": "node network.mjs" },
        }),
        "ops/network.mjs":
          'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/network.mjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("resolves helpers relative to workflow defaults.run.working-directory", () => {
    withFixture(
      {
        ".github/workflows/helper-cwd.yml": [
          "jobs:",
          "  verify:",
          "    defaults:",
          "      run:",
          "        working-directory: ops",
          "    steps:",
          "      - run: bash fetch.sh",
          "",
        ].join("\n"),
        "fetch.sh": "echo benign-root-helper\n",
        "ops/fetch.sh":
          "curl -fsSL https://example.test/private.tar.gz -o private.tar.gz\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/fetch.sh" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("follows a tsconfig local alias from a tsx helper", () => {
    withFixture(
      {
        ".github/workflows/helper-alias.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: npx tsx ops/entry.ts",
          "",
        ].join("\n"),
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@/*": ["./*"] },
          },
        }),
        "ops/entry.ts": 'import "@/ops/network";\n',
        "ops/network.ts":
          'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/network.ts" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("follows a tsconfig baseUrl import from a reachable helper", () => {
    withFixture(
      {
        ".github/workflows/helper-base-url.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: npx tsx ops/entry.ts",
          "",
        ].join("\n"),
        "tsconfig.json": JSON.stringify({
          compilerOptions: { baseUrl: "." },
        }),
        "ops/entry.ts": 'import "ops/network";\n',
        "ops/network.ts":
          'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/network.ts" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("follows a tsconfig alias inherited through extends", () => {
    withFixture(
      {
        ".github/workflows/helper-extends.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: npx tsx ops/entry.ts",
          "",
        ].join("\n"),
        "tsconfig.json": JSON.stringify({ extends: "./config/base.json" }),
        "config/base.json": JSON.stringify({
          compilerOptions: {
            baseUrl: "..",
            paths: { "@ops/*": ["ops/*"] },
          },
        }),
        "ops/entry.ts": 'import "@ops/network";\n',
        "ops/network.ts":
          'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/network.ts" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("follows tsconfig aliases inherited through an extends array", () => {
    withFixture(
      {
        ".github/workflows/helper-extends-array.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: npx tsx ops/entry.ts",
          "",
        ].join("\n"),
        "tsconfig.json": JSON.stringify({
          extends: ["./config/base-a.json", "./config/base-b.json"],
        }),
        "config/base-a.json": JSON.stringify({
          compilerOptions: { strict: true },
        }),
        "config/base-b.json": JSON.stringify({
          compilerOptions: {
            baseUrl: "..",
            paths: { "@ops/*": ["ops/*"] },
          },
        }),
        "ops/entry.ts": 'import "@ops/network";\n',
        "ops/network.ts":
          'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/network.ts" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    [
      "an explicit tsx config",
      "npx tsx --tsconfig=ops/selected.json ops/entry.ts",
      "ops/selected.json",
    ],
    [
      "the workflow working directory config",
      "npx tsx entry.ts",
      "ops/tsconfig.json",
    ],
  ])("follows aliases from %s", (_label, runCommand, configFile) => {
    const workflow =
      configFile === "ops/tsconfig.json"
        ? [
            "jobs:",
            "  verify:",
            "    defaults:",
            "      run:",
            "        working-directory: ops",
            "    steps:",
            `      - run: ${JSON.stringify(runCommand)}`,
            "",
          ].join("\n")
        : [
            "jobs:",
            "  verify:",
            "    steps:",
            `      - run: ${JSON.stringify(runCommand)}`,
            "",
          ].join("\n");
    withFixture(
      {
        ".github/workflows/helper-selected-config.yml": workflow,
        [configFile]: JSON.stringify({
          compilerOptions: {
            baseUrl: "..",
            paths: { "@ops/*": ["ops/*"] },
          },
        }),
        "ops/entry.ts": 'import "@ops/network";\n',
        "ops/network.ts":
          'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/network.ts" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("uses the most specific matching tsconfig paths pattern", () => {
    withFixture(
      {
        ".github/workflows/helper-specific-path.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: npx tsx ops/entry.ts",
          "",
        ].join("\n"),
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@/*": ["broad/*"],
              "@/remote/*": ["specific/*"],
            },
          },
        }),
        "ops/entry.ts": 'import "@/remote/network";\n',
        "broad/remote/network.ts": "export const benign = true;\n",
        "specific/network.ts":
          'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "specific/network.ts" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("preserves tsconfig declaration order when path prefixes tie", () => {
    withFixture(
      {
        ".github/workflows/helper-path-tie.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: npx tsx ops/entry.ts",
          "",
        ].join("\n"),
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@/*": ["malicious/*"],
              "@/*bar": ["benign/*"],
            },
          },
        }),
        "ops/entry.ts": 'import "@/foobar";\n',
        "malicious/foobar.ts":
          'await fetch("https://example.test/private.tar.gz");\n',
        "benign/foo.ts": "export const benign = true;\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "malicious/foobar.ts" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("fails closed for TSX_TSCONFIG_PATH environment selection", () => {
    withFixture(
      {
        ".github/workflows/helper-env-config.yml": [
          "env:",
          "  TSX_TSCONFIG_PATH: ops/selected.json",
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: npx tsx ops/entry.ts",
          "",
        ].join("\n"),
        "ops/selected.json": JSON.stringify({
          compilerOptions: {
            baseUrl: "..",
            paths: { "@ops/*": ["ops/*"] },
          },
        }),
        "ops/entry.ts": 'import "@ops/network";\n',
        "ops/network.ts":
          'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/helper-env-config.yml" &&
              violation.detail.includes("TSX_TSCONFIG_PATH"),
          ),
        ).toBe(true);
      },
    );
  });

  it("fails closed when a reachable helper selects TSX_TSCONFIG_PATH", () => {
    withFixture(
      {
        ".github/workflows/helper-env-config.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: bash ops/entry.sh",
          "",
        ].join("\n"),
        "ops/entry.sh":
          "TSX_TSCONFIG_PATH=ops/selected.json npx tsx ops/entry.ts\n",
        "ops/entry.ts": "export const benign = true;\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/entry.sh" &&
              violation.detail.includes("TSX_TSCONFIG_PATH"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each(["execFileSync", "spawnSync"])(
    "checks canonical %s argv arrays in a reachable Node helper",
    (callName) => {
      withFixture(
        {
          ".github/workflows/helper-argv.yml": [
            "jobs:",
            "  verify:",
            "    steps:",
            "      - run: node ops/argv.mjs",
            "",
          ].join("\n"),
          "ops/argv.mjs": [
            `import { ${callName} } from "node:child_process";`,
            `${callName}("gh", ["api", "repos/example/private/tarball/main"]);`,
            "",
          ].join("\n"),
        },
        (root) => {
          expect(
            checkCaioProV1Static(root).some(
              (violation) =>
                violation.file === "ops/argv.mjs" &&
                violation.detail.includes("workflow-reachable helper"),
            ),
          ).toBe(true);
        },
      );
    },
  );

  it("rejects repository access through an imported child-process alias", () => {
    withFixture(
      {
        ".github/workflows/helper-argv.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: node ops/argv.mjs",
          "",
        ].join("\n"),
        "ops/argv.mjs": [
          'import { execFileSync as run } from "node:child_process";',
          'run("gh", ["api", "repos/example/private/tarball/main"]);',
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/argv.mjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects repository access through a CommonJS child-process alias", () => {
    withFixture(
      {
        ".github/workflows/helper-commonjs.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: node ops/argv.cjs",
          "",
        ].join("\n"),
        "ops/argv.cjs": [
          'const { execFileSync: run } = require("node:child_process");',
          'run("gh", ["api", "repos/example/private/tarball/main"]);',
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/argv.cjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects child-process repository access in inline Node evaluation", () => {
    withFixture(
      {
        ".github/workflows/inline-child-process.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          `      - run: ${JSON.stringify(
            'node -e \'require("node:child_process").execFileSync("gh", ["api", "repos/example/private/tarball/main"])\'',
          )}`,
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === ".github/workflows/inline-child-process.yml" &&
              violation.detail.includes("inline node evaluation"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    ["fetch", "node -e 'fetch(\"https://example.test/private.tar.gz\")'\n"],
    [
      "child process",
      'node -e \'require("node:child_process").execFileSync("gh", ["api", "repos/example/private/tarball/main"])\'\n',
    ],
  ])(
    "rejects %s repository access reached through a shell helper",
    (_label, shellCommand) => {
      withFixture(
        {
          ".github/workflows/helper-inline-node.yml": [
            "jobs:",
            "  verify:",
            "    steps:",
            "      - run: bash ops/entry.sh",
            "",
          ].join("\n"),
          "ops/entry.sh": shellCommand,
        },
        (root) => {
          expect(
            checkCaioProV1Static(root).some(
              (violation) =>
                violation.file === "ops/entry.sh" &&
                violation.detail.includes("fetch remote repositories"),
            ),
          ).toBe(true);
        },
      );
    },
  );

  it("rejects repository access through a CommonJS property alias", () => {
    withFixture(
      {
        ".github/workflows/helper-commonjs-property.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: node ops/argv.cjs",
          "",
        ].join("\n"),
        "ops/argv.cjs": [
          'const run = require("node:child_process").execFileSync;',
          'run("gh", ["api", "repos/example/private/tarball/main"]);',
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/argv.cjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    [
      "fetch alias",
      [
        "const request = fetch;",
        'await request("https://example.test/private.tar.gz");',
      ].join("\n"),
    ],
    [
      "child-process module alias",
      [
        'const child = require("node:child_process");',
        "const run = child.execFileSync;",
        'run("gh", ["api", "repos/example/private/tarball/main"]);',
      ].join("\n"),
    ],
    [
      "destructured fetch alias",
      [
        "const { fetch: request } = globalThis;",
        'await request("https://example.test/private.tar.gz");',
      ].join("\n"),
    ],
    [
      "assigned fetch alias",
      [
        "let request;",
        "request = fetch;",
        'await request("https://example.test/private.tar.gz");',
      ].join("\n"),
    ],
    [
      "ESM child-process namespace alias",
      [
        'import * as child from "node:child_process";',
        "const run = child.execFileSync;",
        'run("gh", ["api", "repos/example/private/tarball/main"]);',
      ].join("\n"),
    ],
    [
      "ESM child-process default import alias",
      [
        'import child from "node:child_process";',
        "const run = child.execFileSync;",
        'run("gh", ["api", "repos/example/private/tarball/main"]);',
      ].join("\n"),
    ],
    [
      "destructuring-assignment fetch alias",
      [
        "let request;",
        "({ fetch: request } = globalThis);",
        'await request("https://example.test/private.tar.gz");',
      ].join("\n"),
    ],
    [
      "CommonJS destructuring-assignment child-process alias",
      [
        "let run;",
        '({ execFileSync: run } = require("node:child_process"));',
        'run("gh", ["api", "repos/example/private/tarball/main"]);',
      ].join("\n"),
    ],
    [
      "ESM named default child-process alias",
      [
        'import { default as child } from "node:child_process";',
        "const run = child.execFileSync;",
        'run("gh", ["api", "repos/example/private/tarball/main"]);',
      ].join("\n"),
    ],
    [
      "secondary child-process module alias",
      [
        'import * as child from "node:child_process";',
        "const runner = child;",
        "const run = runner.execFileSync;",
        'run("gh", ["api", "repos/example/private/tarball/main"]);',
      ].join("\n"),
    ],
    [
      "computed destructuring-assignment fetch alias",
      [
        "let request;",
        '({ ["fetch"]: request } = globalThis);',
        'await request("https://example.test/private.tar.gz");',
      ].join("\n"),
    ],
    [
      "CommonJS computed destructuring child-process alias",
      [
        'const { ["execFileSync"]: run } = require("node:child_process");',
        'run("gh", ["api", "repos/example/private/tarball/main"]);',
      ].join("\n"),
    ],
    [
      "const-computed destructuring fetch alias",
      [
        'const method = "fetch";',
        "const { [method]: request } = globalThis;",
        'await request("https://example.test/private.tar.gz");',
      ].join("\n"),
    ],
    [
      "CommonJS const-computed destructuring child-process alias",
      [
        'const method = "execFileSync";',
        'const { [method]: run } = require("node:child_process");',
        'run("gh", ["api", "repos/example/private/tarball/main"]);',
      ].join("\n"),
    ],
    [
      "const-computed fetch property alias",
      [
        'const method = "fetch";',
        "const request = globalThis[method];",
        'await request("https://example.test/private.tar.gz");',
      ].join("\n"),
    ],
    [
      "CommonJS const-computed child-process property alias",
      [
        'const method = "execFileSync";',
        'const child = require("node:child_process");',
        "const run = child[method];",
        'run("gh", ["api", "repos/example/private/tarball/main"]);',
      ].join("\n"),
    ],
    [
      "mutable computed fetch property alias",
      [
        'let method = "fetch";',
        "const request = globalThis[method];",
        'await request("https://example.test/private.tar.gz");',
      ].join("\n"),
    ],
    [
      "runtime-computed child-process property alias",
      [
        "const method = process.argv[2];",
        'const child = require("node:child_process");',
        "const run = child[method];",
        'run("gh", ["api", "repos/example/private/tarball/main"]);',
      ].join("\n"),
    ],
    [
      "runtime-computed direct fetch call",
      [
        "const method = process.argv[2];",
        'await globalThis[method]("https://example.test/private.tar.gz");',
      ].join("\n"),
    ],
    [
      "runtime-computed direct child-process call",
      [
        "const method = process.argv[2];",
        'const child = require("node:child_process");',
        'child[method]("gh", ["api", "repos/example/private/tarball/main"]);',
      ].join("\n"),
    ],
    [
      "parameter-shadowed computed fetch call",
      [
        'function unrelated() { const method = "safeBusinessField"; }',
        "async function load(method) {",
        '  await globalThis[method]("https://example.test/private.tar.gz");',
        "}",
      ].join("\n"),
    ],
    [
      "parameter-shadowed computed child-process alias",
      [
        'function unrelated() { const method = "safeBusinessField"; }',
        "function runCommand(method) {",
        '  const child = require("node:child_process");',
        "  const run = child[method];",
        '  run("gh", ["api", "repos/example/private/tarball/main"]);',
        "}",
      ].join("\n"),
    ],
  ])("rejects repository access through a %s", (_label, source) => {
    withFixture(
      {
        ".github/workflows/helper-indirect-alias.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: node ops/alias.cjs",
          "",
        ].join("\n"),
        "ops/alias.cjs": `${source}\n`,
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/alias.cjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("allows a lexically resolved safe computed global property", () => {
    withFixture(
      {
        ".github/workflows/helper-safe-computed.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: node ops/safe-computed.cjs",
          "",
        ].join("\n"),
        "ops/safe-computed.cjs": [
          'const method = "setTimeout";',
          "const schedule = globalThis[method];",
          "schedule(() => undefined, 0);",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/safe-computed.cjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(false);
      },
    );
  });

  it("resolves a local module through package.json imports", () => {
    withFixture(
      {
        ".github/workflows/helper-package-import.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: node ops/entry.mjs",
          "",
        ].join("\n"),
        "package.json": JSON.stringify({
          imports: { "#network": "./ops/network.mjs" },
        }),
        "ops/entry.mjs": 'import "#network";\n',
        "ops/network.mjs":
          'await fetch("https://example.test/private.tar.gz");\n',
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/network.mjs" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("binds the D2 exception to each individual workflow step", () => {
    withFixture(
      {
        ".github/workflows/d2-docker-smoke.yml": [
          "jobs:",
          "  d2-docker-smoke:",
          "    env:",
          "      HELM_D2_SMOKE_REPO_URL: ${{ github.workspace }}",
          "      HELM_D2_SMOKE_REF: HEAD",
          "    steps:",
          "      - run: bash scripts/d2-docker-smoke.sh",
          "      - run: bash scripts/d2-docker-smoke.sh",
          "        env:",
          "          HELM_D2_SMOKE_REPO_URL: https://example.test/private.git",
          "          HELM_D2_SMOKE_REF: main",
          "",
        ].join("\n"),
        "scripts/d2-docker-smoke.sh": D2_SMOKE_HELPER,
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "scripts/d2-docker-smoke.sh" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("revokes the D2 exception when the helper content rewrites repo_url", () => {
    withFixture(
      {
        ".github/workflows/d2-docker-smoke.yml": [
          "jobs:",
          "  d2-docker-smoke:",
          "    env:",
          "      HELM_D2_SMOKE_REPO_URL: ${{ github.workspace }}",
          "      HELM_D2_SMOKE_REF: HEAD",
          "    steps:",
          "      - run: bash scripts/d2-docker-smoke.sh",
          "",
        ].join("\n"),
        "scripts/d2-docker-smoke.sh": D2_SMOKE_HELPER.replace(
          "set -euo pipefail",
          'set -euo pipefail\nexport repo_url="https://example.test/private.git"',
        ),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "scripts/d2-docker-smoke.sh" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("revokes the D2 exception when the helper invocation is rewritten", () => {
    withFixture(
      {
        ".github/workflows/d2-docker-smoke.yml": [
          "jobs:",
          "  d2-docker-smoke:",
          "    env:",
          "      HELM_D2_SMOKE_REPO_URL: ${{ github.workspace }}",
          "      HELM_D2_SMOKE_REF: HEAD",
          "    steps:",
          "      - run: env bash scripts/d2-docker-smoke.sh",
          "",
        ].join("\n"),
        "scripts/d2-docker-smoke.sh": D2_SMOKE_HELPER,
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "scripts/d2-docker-smoke.sh" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    [
      "a previous step writes GITHUB_ENV",
      D2_SMOKE_WORKFLOW.replace(
        "      - name: Run D2 fresh-clone Docker smoke",
        [
          "      - name: Rewrite D2 binding",
          '        run: echo "HELM_D2_SMOKE_REPO_URL=https://example.test/private.git" >> "$GITHUB_ENV"',
          "",
          "      - name: Run D2 fresh-clone Docker smoke",
        ].join("\n"),
      ),
    ],
    [
      "BASH_ENV can alter the helper environment",
      D2_SMOKE_WORKFLOW.replace(
        "      HELM_D2_SMOKE_REF: HEAD",
        [
          "      HELM_D2_SMOKE_REF: HEAD",
          "      BASH_ENV: scripts/d2-env-override.sh",
        ].join("\n"),
      ),
    ],
    [
      "a previous step replaces the helper",
      D2_SMOKE_WORKFLOW.replace(
        "      - name: Run D2 fresh-clone Docker smoke",
        [
          "      - name: Replace helper",
          "        run: cp scripts/replacement.sh scripts/d2-docker-smoke.sh",
          "",
          "      - name: Run D2 fresh-clone Docker smoke",
        ].join("\n"),
      ),
    ],
  ])("revokes the D2 exception when %s", (_label, workflow) => {
    withFixture(
      {
        ".github/workflows/d2-docker-smoke.yml": workflow,
        "scripts/d2-docker-smoke.sh": D2_SMOKE_HELPER,
        "scripts/d2-env-override.sh":
          'export HELM_D2_SMOKE_REPO_URL="https://example.test/private.git"\n',
        "scripts/replacement.sh": "gh api repos/example/private/tarball/main\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "scripts/d2-docker-smoke.sh" &&
              violation.detail.includes("workflow-reachable helper"),
          ),
        ).toBe(true);
      },
    );
  });

  it("recognizes the Vitest -c runner config shorthand", () => {
    withFixture(
      {
        "package.json": JSON.stringify({
          scripts: { verify: "vitest run -c runner/downstream.config.ts" },
        }),
        "runner/downstream.config.ts": "export default {};\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "runner/downstream.config.ts" &&
              violation.detail.includes("test-runner config"),
          ),
        ).toBe(true);
      },
    );
  });

  it("recognizes the Vitest -c= runner config shorthand", () => {
    withFixture(
      {
        "package.json": JSON.stringify({
          scripts: { verify: "vitest run -c=runner/downstream.config.ts" },
        }),
        "runner/downstream.config.ts": "export default {};\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "runner/downstream.config.ts" &&
              violation.detail.includes("test-runner config"),
          ),
        ).toBe(true);
      },
    );
  });

  it("collects runner configs from a reachable shell helper", () => {
    withFixture(
      {
        ".github/workflows/helper-runner.yml": [
          "jobs:",
          "  verify:",
          "    steps:",
          "      - run: bash ops/test.sh",
          "",
        ].join("\n"),
        "ops/test.sh": "vitest run --config runner/downstream.config.ts\n",
        "runner/downstream.config.ts": "export default {};\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "runner/downstream.config.ts" &&
              violation.detail.includes("test-runner config"),
          ),
        ).toBe(true);
      },
    );
  });

  it("resolves a shell helper runner config from the workflow working directory", () => {
    withFixture(
      {
        ".github/workflows/helper-runner-cwd.yml": [
          "jobs:",
          "  verify:",
          "    defaults:",
          "      run:",
          "        working-directory: ops",
          "    steps:",
          "      - run: bash test.sh",
          "",
        ].join("\n"),
        "ops/test.sh": "vitest run --config runner/downstream.config.ts\n",
        "ops/runner/downstream.config.ts": "export default {};\n",
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file === "ops/runner/downstream.config.ts" &&
              violation.detail.includes("test-runner config"),
          ),
        ).toBe(true);
      },
    );
  });

  it.each([
    [
      "environment source",
      [
        'const projectRoot = process.env.PROJECT_ROOT ?? ".";',
        "async function load() {",
      ],
    ],
    [
      "post-declaration mutation",
      [
        "let projectRoot = process.cwd();",
        'projectRoot = process.env.PROJECT_ROOT ?? ".";',
        "async function load() {",
      ],
    ],
    [
      "inner lexical rebind",
      [
        "const projectRoot = process.cwd();",
        "async function load() {",
        '  const projectRoot = process.env.PROJECT_ROOT ?? ".";',
      ],
    ],
    [
      "parameter rebind",
      [
        "const projectRoot = process.cwd();",
        'async function load(projectRoot = process.env.PROJECT_ROOT ?? ".") {',
      ],
    ],
    [
      "prior cwd mutation",
      [
        'process.chdir(process.env.CROSS_REPO_ROOT ?? ".");',
        "const projectRoot = process.cwd();",
        "async function load() {",
      ],
    ],
    [
      "aliased process cwd mutation",
      [
        "const p = process;",
        'p.chdir(process.env.CROSS_REPO_ROOT ?? ".");',
        "const projectRoot = process.cwd();",
        "async function load() {",
      ],
    ],
    [
      "assigned process alias mutation",
      [
        "let p;",
        "p = process;",
        'p.chdir(process.env.CROSS_REPO_ROOT ?? ".");',
        "const projectRoot = process.cwd();",
        "async function load() {",
      ],
    ],
    [
      "globalThis process cwd mutation",
      [
        'globalThis.process.chdir(process.env.CROSS_REPO_ROOT ?? ".");',
        "const projectRoot = process.cwd();",
        "async function load() {",
      ],
    ],
    [
      "destructured chdir mutation",
      [
        "const { chdir } = process;",
        'chdir(process.env.CROSS_REPO_ROOT ?? ".");',
        "const projectRoot = process.cwd();",
        "async function load() {",
      ],
    ],
    [
      "reflective cwd replacement",
      [
        'Reflect.set(process, "cwd", () => process.env.CROSS_REPO_ROOT);',
        "const projectRoot = process.cwd();",
        "async function load() {",
      ],
    ],
    [
      "passed process reference",
      [
        "move(process);",
        "const projectRoot = process.cwd();",
        "async function load() {",
      ],
    ],
    [
      "object-assigned cwd replacement",
      [
        "Object.assign(process, { cwd: () => process.env.CROSS_REPO_ROOT });",
        "const projectRoot = process.cwd();",
        "async function load() {",
      ],
    ],
  ])("rejects an unsafe projectRoot binding: %s", (_label, prefix) => {
    withFixture(
      {
        "scripts/archive/sqlite-to-mysql-migration.ts": [
          'import path from "node:path";',
          'import { pathToFileURL } from "node:url";',
          ...prefix,
          "  const sqliteClientModulePath = pathToFileURL(",
          '    path.resolve(projectRoot, "generated/sqlite-client/index.js"),',
          "  ).href;",
          "  await import(sqliteClientModulePath);",
          "}",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file ===
                "scripts/archive/sqlite-to-mysql-migration.ts" &&
              violation.detail.includes("computed dynamic import"),
          ),
        ).toBe(true);
      },
    );
  });

  it("rejects projectRoot derived from a shadowed process binding", () => {
    withFixture(
      {
        "scripts/archive/sqlite-to-mysql-migration.ts": [
          'import path from "node:path";',
          'import { pathToFileURL } from "node:url";',
          "const process = { cwd: () => process.env.CROSS_REPO_ROOT! };",
          "const projectRoot = process.cwd();",
          "async function load() {",
          "  const sqliteClientModulePath = pathToFileURL(",
          '    path.resolve(projectRoot, "generated/sqlite-client/index.js"),',
          "  ).href;",
          "  await import(sqliteClientModulePath);",
          "}",
          "",
        ].join("\n"),
      },
      (root) => {
        expect(
          checkCaioProV1Static(root).some(
            (violation) =>
              violation.file ===
                "scripts/archive/sqlite-to-mysql-migration.ts" &&
              violation.detail.includes("computed dynamic import"),
          ),
        ).toBe(true);
      },
    );
  });

  it("declares yaml as a direct development dependency", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { devDependencies?: Record<string, string> };
    expect(packageJson.devDependencies?.yaml).toMatch(/^\^?2\./u);
  });
});
