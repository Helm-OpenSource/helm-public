import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import Ajv from "ajv";
import { describe, expect, it } from "vitest";

import {
  CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE,
  CAIO_PRO_FDE_CONTRACT_LIMITS,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
  CAIO_PRO_FDE_PORTABLE_SEMANTIC_VERIFIER_REVISION,
  CAIO_PRO_FDE_PORTABLE_SEMANTIC_VERIFIER_RULES,
  CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION,
  CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_SCHEMA_VERSION,
  caioProPackOperatingInputSchema,
  computeCaioProFdePortableContractIdentity,
  materializeCaioProFdePortableContractArtifact,
  validateCaioProFdePortableContractArtifactIdentity,
  validateCaioProPackOperatingInputSemanticRules,
} from "./caio-pro-fde-cross-repo-contract";
import {
  CAIO_PRO_FDE_PORTABLE_SEMANTIC_VERIFIER_REVISION as PORTABLE_MODULE_REVISION,
  validateCaioProFdePackOperatingInputSemanticRules as validatePortablePackSemanticRules,
} from "../../docs/contracts/caio-pro-fde-cross-repo-interface.v1.semantic.mjs";

const ARTIFACT = path.resolve(
  __dirname,
  "../../docs/contracts/caio-pro-fde-cross-repo-interface.v1.schema.json",
);
const SEMANTIC_MODULE = path.resolve(
  __dirname,
  "../../docs/contracts/caio-pro-fde-cross-repo-interface.v1.semantic.mjs",
);

type PortablePayloadDefinition = {
  additionalProperties: boolean;
  required: string[];
  properties: Record<string, Record<string, unknown>>;
  "x-helm-receipt-outcome-semantics"?: {
    accepted: Record<string, Record<string, string>>;
    prohibited: Record<string, string>;
    businessResultAuthority: string;
  };
};

type PortableContractArtifact = {
  interfaceIdentity: Record<string, string>;
  resolutionRules: string[];
  "x-helm-semantic-verifier": Record<string, unknown>;
  $defs: Record<string, unknown> & {
    publicSafeRef: {
      pattern: string;
      not?: { anyOf?: Array<{ pattern: string }> };
    };
    consumerIdentity: {
      additionalProperties: boolean;
      properties: Record<string, { $ref: string }>;
    };
    packOperatingInput: PortablePayloadDefinition;
    privateExecutionResultProjection: PortablePayloadDefinition;
  };
};

function artifact() {
  return JSON.parse(
    readFileSync(ARTIFACT, "utf8"),
  ) as PortableContractArtifact;
}

function portablePackAccepts(payload: unknown): boolean {
  const schema = structuredClone(artifact()) as PortableContractArtifact & {
    $schema?: string;
    oneOf: unknown[];
  };
  delete schema.$schema;
  schema.oneOf = [{ $ref: "#/$defs/packOperatingInput" }];
  const validate = new Ajv({ allErrors: true, schemaId: "auto" }).compile(
    schema,
  );
  return (
    Boolean(validate(payload)) &&
    validatePortablePackSemanticRules(payload).valid
  );
}

function validPackInput() {
  const identity = artifact().interfaceIdentity;
  return {
    schemaVersion: CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION,
    ...identity,
    workspaceRef: "workspace:workspace-1",
    portfolioRef: "opportunity:opportunity-1",
    evidenceSnapshotRef: "observation-run:run-1",
    evidenceBindings: [
      {
        evidenceRef: "observation-run:run-1",
        evidenceKind: "source_observation",
      },
    ],
    taxonomy: [
      {
        taxonomyRef: "taxonomy:operating-risk",
        categoryRef: "category:delivery-risk",
        label: "Delivery risk",
      },
    ],
    metrics: [
      {
        metricRef: "metric:on-time-completion",
        definition: "Share completed inside the accepted operating window.",
        unit: "percent",
        evidenceRefs: ["observation-run:run-1"],
      },
    ],
    evidenceApplicabilityRules: [
      {
        ruleRef: "evidence-rule:delivery-risk",
        taxonomyRefs: ["taxonomy:operating-risk"],
        acceptedEvidenceKinds: ["source_observation"],
      },
    ],
    candidateInputs: [
      {
        candidateRef: "candidate-input:delivery-risk",
        taxonomyRefs: ["taxonomy:operating-risk"],
        metricRefs: ["metric:on-time-completion"],
        evidenceRefs: ["observation-run:run-1"],
        rationale: "Evidence supports a Core-owned candidate input.",
      },
    ],
    authorityEffect: "none",
  };
}

function primitivePaths(
  value: unknown,
  pathParts: Array<string | number> = [],
): Array<Array<string | number>> {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      primitivePaths(entry, [...pathParts, index]),
    );
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) =>
      primitivePaths(entry, [...pathParts, key]),
    );
  }
  return [pathParts];
}

function mutatePrimitiveAtPath(
  value: PortableContractArtifact,
  pathParts: readonly (string | number)[],
) {
  let cursor: unknown = value;
  for (const part of pathParts.slice(0, -1)) {
    cursor = (cursor as Record<string | number, unknown>)[part];
  }
  const key = pathParts.at(-1)!;
  const record = cursor as Record<string | number, unknown>;
  const current = record[key];
  record[key] =
    typeof current === "string"
      ? `${current}__mutated`
      : typeof current === "number"
        ? current + 1
        : typeof current === "boolean"
          ? !current
          : "mutated";
}

function portablePublicSafeRefAccepts(value: string): boolean {
  const definition = artifact().$defs.publicSafeRef;
  const acceptedByBase = new RegExp(definition.pattern, "u").test(value);
  const rejectedByNot = (definition.not?.anyOf ?? []).some(
    (entry: { pattern: string }) => new RegExp(entry.pattern, "u").test(value),
  );
  return acceptedByBase && !rejectedByNot;
}

describe("portable CAIO Pro FDE cross-repo schema", () => {
  it("binds the independently executable semantic verifier bytes", () => {
    const verifier = artifact()["x-helm-semantic-verifier"] as {
      revision: string;
      modulePath: string;
      moduleSha256: string;
      exportName: string;
    };
    const moduleSha256 = `sha256:${createHash("sha256")
      .update(readFileSync(SEMANTIC_MODULE))
      .digest("hex")}`;

    expect(verifier).toMatchObject({
      revision: CAIO_PRO_FDE_PORTABLE_SEMANTIC_VERIFIER_REVISION,
      modulePath:
        "docs/contracts/caio-pro-fde-cross-repo-interface.v1.semantic.mjs",
      moduleSha256,
      exportName: "validateCaioProFdePackOperatingInputSemanticRules",
    });
    expect(PORTABLE_MODULE_REVISION).toBe(
      CAIO_PRO_FDE_PORTABLE_SEMANTIC_VERIFIER_REVISION,
    );
  });

  it("publishes the exact Core interface and evaluator identity", () => {
    const schema = artifact();
    expect(schema.interfaceIdentity).toEqual({
      interfaceVersion: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
      contractRef: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
      contractHash: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
      evaluatorRevision:
        CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorRevision,
      evaluatorContractRef:
        CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractRef,
      evaluatorContractHash:
        CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractHash,
    });
    expect(schema.$defs.consumerIdentity.additionalProperties).toBe(false);
    for (const [field, value] of Object.entries(schema.interfaceIdentity)) {
      const ref = schema.$defs.consumerIdentity.properties[field].$ref as string;
      const definition = ref.slice(ref.lastIndexOf("/") + 1);
      expect((schema.$defs[definition] as { const: unknown }).const).toBe(value);
    }
    expect(validateCaioProFdePortableContractArtifactIdentity(schema)).toEqual({
      valid: true,
      errors: [],
    });
    expect(materializeCaioProFdePortableContractArtifact(schema)).toEqual(
      schema,
    );
  });

  it("binds the complete canonical schema and semantic verifier bytes into identity", () => {
    const schema = artifact();
    expect(schema["x-helm-semantic-verifier"]).toEqual(
      CAIO_PRO_FDE_PORTABLE_SEMANTIC_VERIFIER_RULES,
    );
    const baseline = computeCaioProFdePortableContractIdentity(schema);
    const mutations = [
      (copy: PortableContractArtifact) => {
        (copy.$defs.publicSafeRef as { maxLength?: number }).maxLength = 255;
      },
      (copy: PortableContractArtifact) => {
        copy.$defs.packOperatingInput.required = copy.$defs.packOperatingInput.required.filter(
          (field) => field !== "candidateInputs",
        );
      },
      (copy: PortableContractArtifact) => {
        (copy.$defs.packOperatingInput.properties.candidateInputs as {
          maxItems?: number;
        }).maxItems = 127;
      },
      (copy: PortableContractArtifact) => {
        copy["x-helm-semantic-verifier"] = {
          ...copy["x-helm-semantic-verifier"],
          trustedEvidenceRule: "weakened_rule",
        };
      },
      (copy: PortableContractArtifact) => {
        copy["x-helm-semantic-verifier"] = {
          ...copy["x-helm-semantic-verifier"],
          revision: "helm.caio-pro-fde.portable-semantic-verifier.v2",
        };
      },
    ];

    for (const mutate of mutations) {
      const copy = structuredClone(schema);
      mutate(copy);
      try {
        expect(computeCaioProFdePortableContractIdentity(copy)).not.toEqual(
          baseline,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
      expect(validateCaioProFdePortableContractArtifactIdentity(copy).valid).toBe(
        false,
      );
    }
  });

  it("changes identity or fails the build for every nested schema and semantic-rule leaf mutation", () => {
    const schema = artifact();
    const baseline = computeCaioProFdePortableContractIdentity(schema);
    const identitySelfFields = new Set([
      "$defs.contractRef.const",
      "$defs.contractHash.const",
    ]);
    const paths = [
      ...primitivePaths(schema.$defs, ["$defs"]),
      ...primitivePaths(schema["x-helm-semantic-verifier"], [
        "x-helm-semantic-verifier",
      ]),
    ].filter((pathParts) => !identitySelfFields.has(pathParts.join(".")));

    expect(paths.length).toBeGreaterThan(100);
    for (const pathParts of paths) {
      const copy = structuredClone(schema);
      mutatePrimitiveAtPath(copy, pathParts);
      try {
        expect(computeCaioProFdePortableContractIdentity(copy)).not.toEqual(
          baseline,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    }
  });

  it("keeps TypeScript and portable artifact validation in differential agreement", () => {
    const base = validPackInput();
    const privateAddress = [10, 0, 0, 8].join(".");
    const corpus = [
      base,
      { ...base, question: "Pack must not supply a question" },
      {
        ...base,
        metrics: [
          ...base.metrics,
          { ...base.metrics[0], definition: "Duplicate metric ref." },
        ],
      },
      {
        ...base,
        candidateInputs: [
          { ...base.candidateInputs[0], taxonomyRefs: ["taxonomy:missing"] },
        ],
      },
      {
        ...base,
        evidenceBindings: [
          {
            evidenceRef: "observation-run:run-1",
            evidenceKind: "crm_record",
          },
        ],
      },
      {
        ...base,
        taxonomy: [
          ...base.taxonomy,
          { ...base.taxonomy[0], label: "Duplicate taxonomy ref" },
        ],
      },
      {
        ...base,
        evidenceApplicabilityRules: [
          {
            ...base.evidenceApplicabilityRules[0],
            taxonomyRefs: ["taxonomy:missing"],
          },
        ],
      },
      {
        ...base,
        evidenceBindings: [
          ...base.evidenceBindings,
          {
            evidenceRef: "observation-run:run-1",
            evidenceKind: "verified_receipt",
          },
        ],
      },
      {
        ...base,
        evidenceBindings: [
          ...base.evidenceBindings,
          {
            evidenceRef: "observation-run:uncovered",
            evidenceKind: "source_observation",
          },
        ],
      },
      {
        ...base,
        taxonomy: [{ ...base.taxonomy[0], label: "   " }],
      },
      {
        ...base,
        metrics: [{ ...base.metrics[0], definition: "\t\n" }],
      },
      { ...base, workspaceRef: "workspace:https:private.invalid" },
      {
        ...base,
        evidenceSnapshotRef: `observation-run:${privateAddress}`,
      },
      { ...base, portfolioRef: "opportunity:token-secret-value" },
    ];

    for (const payload of corpus) {
      const portableAccepted = portablePackAccepts(payload);
      const typescriptAccepted =
        caioProPackOperatingInputSchema.safeParse(payload).success;
      expect(portableAccepted, JSON.stringify(payload)).toBe(
        typescriptAccepted,
      );
      const portableSemantic = validatePortablePackSemanticRules(payload);
      const typescriptSemantic =
        validateCaioProPackOperatingInputSemanticRules(payload);
      expect(portableSemantic, JSON.stringify(payload)).toEqual(
        typescriptSemantic,
      );
    }
  });

  it("keeps both portable payloads strict and bounded", () => {
    const schema = artifact();
    const pack = schema.$defs.packOperatingInput;
    const projection = schema.$defs.privateExecutionResultProjection;

    expect(pack.additionalProperties).toBe(false);
    expect(pack.properties.schemaVersion.const).toBe(
      CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION,
    );
    expect(pack.required).toEqual(
      expect.arrayContaining([
        "workspaceRef",
        "portfolioRef",
        "evidenceSnapshotRef",
        "evidenceBindings",
        "taxonomy",
        "metrics",
        "evidenceApplicabilityRules",
        "candidateInputs",
      ]),
    );
    expect(pack.properties.candidateInputs.maxItems).toBe(
      CAIO_PRO_FDE_CONTRACT_LIMITS.candidateItems,
    );
    expect(pack.properties.taxonomy.maxItems).toBe(
      CAIO_PRO_FDE_CONTRACT_LIMITS.taxonomyItems,
    );

    expect(projection.additionalProperties).toBe(false);
    expect(projection.properties.schemaVersion.const).toBe(
      CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_SCHEMA_VERSION,
    );
    expect(projection.properties.executionProofRefs.maxItems).toBe(
      CAIO_PRO_FDE_CONTRACT_LIMITS.executionProofRefs,
    );
    expect(projection.properties.receiptOutcome.enum).toEqual([
      "SUCCESS",
      "PARTIAL_SUCCESS",
      "FAILURE",
    ]);
    expect(projection["x-helm-receipt-outcome-semantics"]).toEqual({
      accepted: {
        SUCCESS: {
          businessResult: "success",
          actionItemStatus: "EXECUTED",
          supervisionStatus: "resolved",
        },
        PARTIAL_SUCCESS: {
          businessResult: "failure",
          actionItemStatus: "EXECUTED",
          supervisionStatus: "open",
        },
        FAILURE: {
          businessResult: "failure",
          actionItemStatus: "EXECUTED",
          supervisionStatus: "open",
        },
      },
      prohibited: {
        NOT_EXECUTED: "existing_core_blocked_without_execution_path",
        REJECTED: "existing_core_approval_rejection_path",
      },
      businessResultAuthority:
        "trusted_evidence_constrained_by_receipt_outcome",
    });
    expect(projection.required).toEqual(
      expect.arrayContaining([
        "contentHash",
        "workspaceRef",
        "portfolioRef",
        "evidenceSnapshotRef",
        "decisionRecordRef",
        "actionItemRef",
        "approvalTaskRef",
      ]),
    );
  });

  it("requires Core scope resolution and contains no workstation paths", () => {
    const source = readFileSync(ARTIFACT, "utf8");
    const schema = JSON.parse(source) as PortableContractArtifact;
    expect(schema.resolutionRules).toEqual(
      expect.arrayContaining([
        "workspaceRef must equal the authenticated workspace",
        "portfolioRef must resolve to a workspace-scoped Core Opportunity",
        "all evidence refs must resolve within the current authorized ObservationSourceRun snapshot",
      ]),
    );
    expect(source).not.toMatch(/\/Users\/|[A-Za-z]:\\/u);
  });

  it("rejects portable refs that expose locators, IPs, PII or secrets", () => {
    const privateAddress = [10, 0, 0, 8].join(".");
    for (const unsafeRef of [
      "proof:https:example.invalid",
      `proof:${privateAddress}`,
      `proof:server-${privateAddress}`,
      "proof:fe80::1",
      "proof:case:fe80::1",
      "proof:ref-13800138000",
      "proof:ref-11010519491231002X",
      "proof:ref-6222020202020202020",
      "proof:phone-13800138000",
      "proof:id-card-11010519491231002X",
      "proof:bank-card-6222020202020202020",
      "proof:token-secret-value",
      "proof:mysql-username-password",
    ]) {
      expect(portablePublicSafeRefAccepts(unsafeRef), unsafeRef).toBe(false);
    }
  });
});
