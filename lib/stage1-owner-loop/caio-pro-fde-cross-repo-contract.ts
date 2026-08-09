import { z } from "zod";

import { canonicalJson, sha256 } from "../expert-capability/hashing";
import {
  CAIO_PRO_V1_COMPLETION_EVALUATOR_CONTRACT_HASH,
  CAIO_PRO_V1_COMPLETION_EVALUATOR_CONTRACT_REF,
  CAIO_PRO_V1_COMPLETION_EVALUATOR_REVISION,
  CAIO_PRO_V1_COMPLETION_ITEMS,
} from "./caio-pro-completion";

export const CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION =
  "helm.caio-pro-fde.cross-repo-interface.v1" as const;
export const CAIO_PRO_FDE_CROSS_REPO_COMPATIBLE_INTERFACE_VERSIONS =
  Object.freeze([CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION] as const);
export const CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION =
  "helm.caio-pro-fde.pack-operating-input.v1" as const;
export const CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_SCHEMA_VERSION =
  "helm.caio-pro-fde.private-execution-result-projection.v1" as const;
export const CAIO_PRO_CANONICAL_EXECUTION_RECEIPT_WRITER_SCHEMA_VERSION =
  "helm.caio-pro-fde.canonical-execution-receipt-writer.v1" as const;
export const CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE_SCHEMA_VERSION =
  "helm.caio-pro-fde.completion-evaluator-interface.v1" as const;

export const CAIO_PRO_FDE_OBJECT_SEMANTICS = Object.freeze({
  Portfolio: Object.freeze({
    objectName: "Portfolio" as const,
    semantic: "business_asset_or_case_scope" as const,
    operatingQuestionAuthority: "none" as const,
  }),
  CaioOperatingQuestionPortfolio: Object.freeze({
    objectName: "CaioOperatingQuestionPortfolio" as const,
    semantic: "exactly_ten_operating_questions" as const,
    operatingQuestionAuthority:
      "public_core_exactly_ten_or_insufficient_evidence" as const,
    generationOutcomes: Object.freeze([
      "exactly_ten",
      "insufficient_evidence",
    ] as const),
  }),
});

export function validateCaioProFdeCrossRepoInterfaceVersion(
  version: string,
): { valid: boolean; errors: string[] } {
  if (
    !CAIO_PRO_FDE_CROSS_REPO_COMPATIBLE_INTERFACE_VERSIONS.some(
      (compatibleVersion) => compatibleVersion === version,
    )
  ) {
    return {
      valid: false,
      errors: [
        "caio_pro_fde_cross_repo_interface_version_unsupported",
      ],
    };
  }
  return { valid: true, errors: [] };
}

const nonEmptyString = z.string().trim().min(1);
const nonEmptyStringArray = z.array(nonEmptyString).min(1);
export const CAIO_PRO_PUBLIC_SAFE_REF_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}:[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/u;
const publicSafeRef = z
  .string()
  .trim()
  .min(3)
  .max(256)
  .regex(CAIO_PRO_PUBLIC_SAFE_REF_PATTERN);

export const caioProTerminalBusinessOutcomeSchema = z
  .object({
    outcomeRef: publicSafeRef,
    result: z.enum(["success", "failure"]),
    followedAiRecommendation: z.boolean().nullable(),
  })
  .strict();

export type CaioProTerminalBusinessOutcome = z.infer<
  typeof caioProTerminalBusinessOutcomeSchema
>;

const packTaxonomySchema = z
  .object({
    taxonomyRef: nonEmptyString,
    categoryRef: nonEmptyString,
    label: nonEmptyString,
  })
  .strict();

const packMetricSchema = z
  .object({
    metricRef: nonEmptyString,
    definition: nonEmptyString,
    unit: nonEmptyString,
    evidenceRefs: nonEmptyStringArray,
  })
  .strict();

const packEvidenceApplicabilityRuleSchema = z
  .object({
    ruleRef: nonEmptyString,
    taxonomyRefs: nonEmptyStringArray,
    acceptedEvidenceKinds: nonEmptyStringArray,
  })
  .strict();

const packCandidateInputSchema = z
  .object({
    candidateRef: nonEmptyString,
    taxonomyRefs: nonEmptyStringArray,
    metricRefs: nonEmptyStringArray,
    evidenceRefs: nonEmptyStringArray,
    rationale: nonEmptyString,
  })
  .strict();

export const CAIO_PRO_PACK_OPERATING_INPUT_CONTRACT = Object.freeze({
  schemaVersion: CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION,
  allowedTopLevelFields: Object.freeze([
    "schemaVersion",
    "taxonomy",
    "metrics",
    "evidenceApplicabilityRules",
    "candidateInputs",
    "authorityEffect",
  ] as const),
  fixedQuestionOutput: "prohibited" as const,
  caioOperatingQuestionPortfolioWriteAuthority: "none" as const,
  coreGenerationOutcomes: Object.freeze([
    "exactly_ten",
    "insufficient_evidence",
  ] as const),
  authorityEffect: "none" as const,
});

// Pack contributes vocabulary and evidence-bounded candidate inputs only. It
// cannot submit a canonical question, rank, fixed ten-item set, or portfolio.
export const caioProPackOperatingInputSchema = z
  .object({
    schemaVersion: z.literal(CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION),
    taxonomy: z.array(packTaxonomySchema).min(1),
    metrics: z.array(packMetricSchema).min(1),
    evidenceApplicabilityRules: z
      .array(packEvidenceApplicabilityRuleSchema)
      .min(1),
    candidateInputs: z.array(packCandidateInputSchema).min(1),
    authorityEffect: z.literal("none"),
  })
  .strict();

export type CaioProPackOperatingInput = z.infer<
  typeof caioProPackOperatingInputSchema
>;

export const CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_CONTRACT =
  Object.freeze({
    schemaVersion:
      CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_SCHEMA_VERSION,
    outputKind: "execution_proof_and_result_projection" as const,
    allowedTopLevelFields: Object.freeze([
      "schemaVersion",
      "projectionRef",
      "workspaceRef",
      "decisionRecordRef",
      "actionItemRef",
      "executionProofRefs",
      "outcome",
      "recordedAt",
      "authorityEffect",
      "canonicalExecutionReceiptWriteAuthority",
      "contentHash",
    ] as const),
    canonicalExecutionReceiptWriteAuthority: "none" as const,
    authorityEffect: "none" as const,
  });

const privateExecutionResultProjectionInputSchema = z
  .object({
    projectionRef: publicSafeRef,
    workspaceRef: publicSafeRef,
    decisionRecordRef: publicSafeRef,
    actionItemRef: publicSafeRef,
    executionProofRefs: z.array(publicSafeRef).min(1),
    outcome: caioProTerminalBusinessOutcomeSchema,
    recordedAt: z.string().datetime(),
  })
  .strict();

const privateExecutionResultProjectionSchema =
  privateExecutionResultProjectionInputSchema
    .extend({
      schemaVersion: z.literal(
        CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_SCHEMA_VERSION,
      ),
      authorityEffect: z.literal("none"),
      canonicalExecutionReceiptWriteAuthority: z.literal("none"),
      contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    })
    .strict();

export type CaioProPrivateExecutionResultProjectionInput = z.infer<
  typeof privateExecutionResultProjectionInputSchema
>;
export type CaioProPrivateExecutionResultProjection = z.infer<
  typeof privateExecutionResultProjectionSchema
>;

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right),
  );
}

export function createCaioProPrivateExecutionResultProjection(
  input: CaioProPrivateExecutionResultProjectionInput,
): CaioProPrivateExecutionResultProjection {
  const parsed = privateExecutionResultProjectionInputSchema.parse(input);
  const content = {
    schemaVersion:
      CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_SCHEMA_VERSION,
    projectionRef: parsed.projectionRef,
    workspaceRef: parsed.workspaceRef,
    decisionRecordRef: parsed.decisionRecordRef,
    actionItemRef: parsed.actionItemRef,
    executionProofRefs: uniqueSorted(parsed.executionProofRefs),
    outcome: parsed.outcome,
    recordedAt: parsed.recordedAt,
    authorityEffect: "none" as const,
    canonicalExecutionReceiptWriteAuthority: "none" as const,
  };
  return {
    ...content,
    contentHash: sha256(canonicalJson(content)),
  };
}

export function validateCaioProPrivateExecutionResultProjection(
  projection: CaioProPrivateExecutionResultProjection,
): { valid: boolean; errors: string[] } {
  const parsed = privateExecutionResultProjectionSchema.safeParse(projection);
  if (!parsed.success) {
    return {
      valid: false,
      errors: ["private_execution_result_projection_invalid"],
    };
  }
  const { contentHash: _contentHash, ...content } = parsed.data;
  if (projection.contentHash !== sha256(canonicalJson(content))) {
    return {
      valid: false,
      errors: [
        "private_execution_result_projection_content_hash_mismatch",
      ],
    };
  }
  return { valid: true, errors: [] };
}

export const CAIO_PRO_CANONICAL_EXECUTION_RECEIPT_WRITER_CONTRACT =
  Object.freeze({
    schemaVersion:
      CAIO_PRO_CANONICAL_EXECUTION_RECEIPT_WRITER_SCHEMA_VERSION,
    interfaceVersion: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
    canonicalObjectName: "ExecutionReceipt" as const,
    soleWriter: "recordExecutionReceipt" as const,
    writerModule: "lib/receipts/execution-receipt.service.ts" as const,
    privateExecutorOutputObjectName:
      "CaioProPrivateExecutionResultProjection" as const,
    ingressRule:
      "public_core_validates_projection_and_writes_with_existing_transaction_permission_and_cas_rules" as const,
    controlPlaneIndexFields: Object.freeze([
      "summary",
      "contentHash",
      "sourceRef",
    ] as const),
    authorityEffect: "none" as const,
  });

export const CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE = Object.freeze({
  schemaVersion: CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE_SCHEMA_VERSION,
  interfaceVersion: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
  evaluatorRevision: CAIO_PRO_V1_COMPLETION_EVALUATOR_REVISION,
  evaluatorContractHash: CAIO_PRO_V1_COMPLETION_EVALUATOR_CONTRACT_HASH,
  evaluatorContractRef: CAIO_PRO_V1_COMPLETION_EVALUATOR_CONTRACT_REF,
  completionItemCount: CAIO_PRO_V1_COMPLETION_ITEMS.length,
  completionItemSource: "CAIO_PRO_V1_COMPLETION_ITEMS" as const,
  consumerRule: "reference_only" as const,
  packageReadyImplementationShaSource: "release_bom" as const,
  charterShaIsPackageReadyImplementationSha: false as const,
  authorityEffect: "none" as const,
});

const caioProFdeCrossRepoInterfaceContractBasis = {
  interfaceVersion: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
  compatibleInterfaceVersions:
    CAIO_PRO_FDE_CROSS_REPO_COMPATIBLE_INTERFACE_VERSIONS,
  objectSemantics: CAIO_PRO_FDE_OBJECT_SEMANTICS,
  packOperatingInput: CAIO_PRO_PACK_OPERATING_INPUT_CONTRACT,
  privateExecutionResultProjection:
    CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_CONTRACT,
  canonicalExecutionReceiptWriter:
    CAIO_PRO_CANONICAL_EXECUTION_RECEIPT_WRITER_CONTRACT,
  completionEvaluator: CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE,
  authorityEffect: "none" as const,
} as const;

export const CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH = sha256(
  canonicalJson(caioProFdeCrossRepoInterfaceContractBasis),
);
export const CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF =
  `caio-pro-fde-cross-repo-interface:${CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH.slice(7, 23)}` as const;

export const CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR = Object.freeze({
  ...caioProFdeCrossRepoInterfaceContractBasis,
  contractHash: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
  contractRef: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
});
