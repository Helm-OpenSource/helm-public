import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE,
  CAIO_PRO_FDE_CONTRACT_LIMITS,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
  CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION,
  CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_SCHEMA_VERSION,
} from "./caio-pro-fde-cross-repo-contract";

const ARTIFACT = path.resolve(
  __dirname,
  "../../docs/contracts/caio-pro-fde-cross-repo-interface.v1.schema.json",
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

function portablePublicSafeRefAccepts(value: string): boolean {
  const definition = artifact().$defs.publicSafeRef;
  const acceptedByBase = new RegExp(definition.pattern, "u").test(value);
  const rejectedByNot = (definition.not?.anyOf ?? []).some(
    (entry: { pattern: string }) => new RegExp(entry.pattern, "u").test(value),
  );
  return acceptedByBase && !rejectedByNot;
}

describe("portable CAIO Pro FDE cross-repo schema", () => {
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
