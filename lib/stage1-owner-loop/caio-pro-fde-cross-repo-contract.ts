import { isIP } from "node:net";

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

export const CAIO_PRO_FDE_CONTRACT_LIMITS = Object.freeze({
  refLength: 256,
  shortTextLength: 128,
  longTextLength: 2_048,
  taxonomyItems: 64,
  metricItems: 64,
  evidenceRuleItems: 64,
  candidateItems: 128,
  nestedRefs: 64,
  executionProofRefs: 64,
});

export const CAIO_PRO_FDE_OBJECT_SEMANTICS = Object.freeze({
  Portfolio: Object.freeze({
    objectName: "Portfolio" as const,
    semantic: "business_asset_or_case_scope" as const,
    publicCoreBackingObject: "Opportunity" as const,
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

export const CAIO_PRO_PRIVATE_EXECUTION_RECEIPT_OUTCOMES = Object.freeze([
  "SUCCESS",
  "PARTIAL_SUCCESS",
  "FAILURE",
] as const);

export const CAIO_PRO_PRIVATE_EXECUTION_RECEIPT_OUTCOME_SEMANTICS =
  Object.freeze({
    accepted: Object.freeze({
      SUCCESS: Object.freeze({
        businessResult: "success" as const,
        actionItemStatus: "EXECUTED" as const,
        supervisionStatus: "resolved" as const,
      }),
      PARTIAL_SUCCESS: Object.freeze({
        businessResult: "failure" as const,
        actionItemStatus: "EXECUTED" as const,
        supervisionStatus: "open" as const,
      }),
      FAILURE: Object.freeze({
        businessResult: "failure" as const,
        actionItemStatus: "EXECUTED" as const,
        supervisionStatus: "open" as const,
      }),
    }),
    prohibited: Object.freeze({
      NOT_EXECUTED: "existing_core_blocked_without_execution_path" as const,
      REJECTED: "existing_core_approval_rejection_path" as const,
    }),
    businessResultAuthority:
      "trusted_evidence_constrained_by_receipt_outcome" as const,
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
      errors: ["caio_pro_fde_cross_repo_interface_version_unsupported"],
    };
  }
  return { valid: true, errors: [] };
}

const OPAQUE_REF_PATTERN =
  /^[a-z][a-z0-9-]{1,63}:[A-Za-z0-9][A-Za-z0-9._:-]{0,190}$/u;
export const CAIO_PRO_PUBLIC_SAFE_REF_PATTERN = OPAQUE_REF_PATTERN;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SECRET_OR_CONNECTION_PATTERN =
  /(?:password|passwd|secret|token|api[-_]?key|authorization|bearer|mysql|postgres(?:ql)?|mongodb|redis|jdbc|connection[-_]?string)/iu;
const PII_LABEL_PATTERN =
  /(?:^|[:._-])(?:phone|mobile|tel|id(?:entity)?[-_]?card|ssn|bank[-_]?card|card[-_]?number|account[-_]?number)(?:$|[:._-])/iu;
const URL_PATTERN = /(?:[a-z][a-z0-9+.-]*:\/\/|^\/\/|\bwww\.)/iu;
const LOCATOR_SCHEME_PATTERN =
  /(?:^|:)(?:https?|file|ftp|ssh|s3|gs|mailto):/iu;
const TOKEN_MATERIAL_PATTERN =
  /(?:^|:)(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})/u;
const EMAIL_PATTERN = /@/u;
const DIGIT_LIKE_PATTERN = /^[0-9][0-9 -]{5,22}[0-9Xx]$/u;
const EMBEDDED_DIGIT_PII_PATTERN = /(?:[0-9]{7,22}|[0-9]{6,21}[Xx])/u;
const EMBEDDED_IPV4_PATTERN = /(?:^|[^0-9])((?:[0-9]{1,3}\.){3}[0-9]{1,3})(?=$|[^0-9])/gu;

function containsIpLiteral(value: string): boolean {
  const candidates = new Set([value]);
  for (let index = 0; index < value.length; index += 1) {
    if ([":", "-", "_"].includes(value[index])) {
      candidates.add(value.slice(index + 1));
    }
  }
  for (const candidate of candidates) {
    if (isIP(candidate) !== 0) return true;
  }
  for (const match of value.matchAll(EMBEDDED_IPV4_PATTERN)) {
    if (isIP(match[1]) === 4) return true;
  }
  for (const candidate of value.match(/[A-Fa-f0-9:]{2,}/gu) ?? []) {
    if (candidate.includes(":") && isIP(candidate) === 6) return true;
  }
  return false;
}

function opaqueRefIsPublicSafe(value: string): boolean {
  if (!OPAQUE_REF_PATTERN.test(value)) return false;
  if (
    URL_PATTERN.test(value) ||
    LOCATOR_SCHEME_PATTERN.test(value) ||
    TOKEN_MATERIAL_PATTERN.test(value) ||
    SECRET_OR_CONNECTION_PATTERN.test(value) ||
    PII_LABEL_PATTERN.test(value) ||
    EMAIL_PATTERN.test(value)
  ) {
    return false;
  }
  const separator = value.indexOf(":");
  const opaqueId = separator >= 0 ? value.slice(separator + 1) : value;
  if (containsIpLiteral(opaqueId)) return false;
  if (
    DIGIT_LIKE_PATTERN.test(opaqueId) ||
    EMBEDDED_DIGIT_PII_PATTERN.test(opaqueId)
  ) {
    return false;
  }
  const segments = opaqueId.split(/[:._-]/u).filter(Boolean);
  if (
    segments.some(
      (segment) => isIP(segment) !== 0 || DIGIT_LIKE_PATTERN.test(segment),
    )
  ) {
    return false;
  }
  return true;
}

function boundedOpaqueRef(prefix: string) {
  return z
    .string()
    .trim()
    .min(prefix.length + 2)
    .max(CAIO_PRO_FDE_CONTRACT_LIMITS.refLength)
    .regex(OPAQUE_REF_PATTERN)
    .refine((value) => value.startsWith(`${prefix}:`))
    .refine(opaqueRefIsPublicSafe);
}

export const caioProPublicSafeRefSchema = z
  .string()
  .trim()
  .min(3)
  .max(CAIO_PRO_FDE_CONTRACT_LIMITS.refLength)
  .regex(OPAQUE_REF_PATTERN)
  .refine(opaqueRefIsPublicSafe);
export const caioProPublicSafeWorkspaceRefSchema = boundedOpaqueRef("workspace");
export const caioProPublicSafePortfolioRefSchema = boundedOpaqueRef("opportunity");
export const caioProPublicSafeObservationRunRefSchema =
  boundedOpaqueRef("observation-run");
export const caioProPublicSafeDecisionRecordRefSchema =
  boundedOpaqueRef("decision-record");
export const caioProPublicSafeActionItemRefSchema = boundedOpaqueRef("action-item");
export const caioProPublicSafeApprovalTaskRefSchema =
  boundedOpaqueRef("approval-task");

const taxonomyRefSchema = boundedOpaqueRef("taxonomy");
const categoryRefSchema = boundedOpaqueRef("category");
const metricRefSchema = boundedOpaqueRef("metric");
const evidenceRuleRefSchema = boundedOpaqueRef("evidence-rule");
const candidateInputRefSchema = boundedOpaqueRef("candidate-input");
const privateResultRefSchema = boundedOpaqueRef("private-result");
const shortText = z
  .string()
  .trim()
  .min(1)
  .max(CAIO_PRO_FDE_CONTRACT_LIMITS.shortTextLength);
const longText = z
  .string()
  .trim()
  .min(1)
  .max(CAIO_PRO_FDE_CONTRACT_LIMITS.longTextLength);
const identifier = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/u);

export const caioProTerminalBusinessOutcomeSchema = z
  .object({
    outcomeRef: caioProPublicSafeObservationRunRefSchema,
    result: z.enum(["success", "failure"]),
    followedAiRecommendation: z.boolean().nullable(),
  })
  .strict();

export type CaioProTerminalBusinessOutcome = z.infer<
  typeof caioProTerminalBusinessOutcomeSchema
>;

export const CAIO_PRO_PACK_OPERATING_INPUT_CONTRACT = Object.freeze({
  schemaVersion: CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION,
  allowedTopLevelFields: Object.freeze([
    "schemaVersion",
    "interfaceVersion",
    "contractRef",
    "contractHash",
    "evaluatorRevision",
    "evaluatorContractRef",
    "evaluatorContractHash",
    "workspaceRef",
    "portfolioRef",
    "evidenceSnapshotRef",
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
  limits: CAIO_PRO_FDE_CONTRACT_LIMITS,
});

export const CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_CONTRACT =
  Object.freeze({
    schemaVersion:
      CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_SCHEMA_VERSION,
    outputKind: "execution_proof_and_result_projection" as const,
    allowedTopLevelFields: Object.freeze([
      "schemaVersion",
      "interfaceVersion",
      "contractRef",
      "contractHash",
      "evaluatorRevision",
      "evaluatorContractRef",
      "evaluatorContractHash",
      "projectionRef",
      "workspaceRef",
      "portfolioRef",
      "evidenceSnapshotRef",
      "decisionRecordRef",
      "actionItemRef",
      "approvalTaskRef",
      "executionProofRefs",
      "receiptOutcome",
      "actionTaken",
      "outcome",
      "recordedAt",
      "authorityEffect",
      "canonicalExecutionReceiptWriteAuthority",
      "contentHash",
    ] as const),
    acceptedReceiptOutcomeMapping:
      CAIO_PRO_PRIVATE_EXECUTION_RECEIPT_OUTCOME_SEMANTICS.accepted,
    prohibitedReceiptOutcomeRouting:
      CAIO_PRO_PRIVATE_EXECUTION_RECEIPT_OUTCOME_SEMANTICS.prohibited,
    businessResultAuthority:
      CAIO_PRO_PRIVATE_EXECUTION_RECEIPT_OUTCOME_SEMANTICS.businessResultAuthority,
    canonicalExecutionReceiptWriteAuthority: "none" as const,
    authorityEffect: "none" as const,
    limits: CAIO_PRO_FDE_CONTRACT_LIMITS,
  });

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
  portableContract: Object.freeze({
    schemaRef:
      "docs/contracts/caio-pro-fde-cross-repo-interface.v1.schema.json" as const,
    publicSafeRefPolicyRevision:
      "helm.caio-pro-fde.public-safe-ref-policy.v2" as const,
    trustedEvidenceResolver:
      "workspace-scoped-active-observation-source-run" as const,
    packConsumer:
      "generateCaioOperatingQuestionPortfolioFromPackInput" as const,
    privateProjectionIngress:
      "ingestCaioPrivateExecutionResultProjection" as const,
    runtimeScopeResolutionRequired: true as const,
  }),
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

export function validateCaioProFdeInterfaceDescriptor(
  descriptor: unknown,
): { valid: boolean; errors: string[] } {
  try {
    if (
      canonicalJson(descriptor) !==
      canonicalJson(CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR)
    ) {
      return {
        valid: false,
        errors: ["caio_pro_fde_interface_descriptor_invalid"],
      };
    }
  } catch {
    return {
      valid: false,
      errors: ["caio_pro_fde_interface_descriptor_invalid"],
    };
  }
  return { valid: true, errors: [] };
}

export const caioProFdeConsumerIdentitySchema = z
  .object({
    interfaceVersion: z.literal(CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION),
    contractRef: z.literal(CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF),
    contractHash: z.literal(CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH),
    evaluatorRevision: z.literal(CAIO_PRO_V1_COMPLETION_EVALUATOR_REVISION),
    evaluatorContractRef: z.literal(
      CAIO_PRO_V1_COMPLETION_EVALUATOR_CONTRACT_REF,
    ),
    evaluatorContractHash: z.literal(
      CAIO_PRO_V1_COMPLETION_EVALUATOR_CONTRACT_HASH,
    ),
  })
  .strict();

export type CaioProFdeConsumerIdentity = z.infer<
  typeof caioProFdeConsumerIdentitySchema
>;

export function validateCaioProFdeConsumerIdentity(
  identity: unknown,
): { valid: boolean; errors: string[] } {
  if (!caioProFdeConsumerIdentitySchema.safeParse(identity).success) {
    return {
      valid: false,
      errors: ["caio_pro_fde_consumer_identity_invalid"],
    };
  }
  return { valid: true, errors: [] };
}

const identityShape = caioProFdeConsumerIdentitySchema.shape;
const packTaxonomySchema = z
  .object({
    taxonomyRef: taxonomyRefSchema,
    categoryRef: categoryRefSchema,
    label: shortText,
  })
  .strict();
const packMetricSchema = z
  .object({
    metricRef: metricRefSchema,
    definition: longText,
    unit: identifier,
    evidenceRefs: z
      .array(caioProPublicSafeRefSchema)
      .min(1)
      .max(CAIO_PRO_FDE_CONTRACT_LIMITS.nestedRefs),
  })
  .strict();
const packEvidenceApplicabilityRuleSchema = z
  .object({
    ruleRef: evidenceRuleRefSchema,
    taxonomyRefs: z
      .array(taxonomyRefSchema)
      .min(1)
      .max(CAIO_PRO_FDE_CONTRACT_LIMITS.nestedRefs),
    acceptedEvidenceKinds: z
      .array(identifier)
      .min(1)
      .max(CAIO_PRO_FDE_CONTRACT_LIMITS.nestedRefs),
  })
  .strict();
const packCandidateInputSchema = z
  .object({
    candidateRef: candidateInputRefSchema,
    taxonomyRefs: z
      .array(taxonomyRefSchema)
      .min(1)
      .max(CAIO_PRO_FDE_CONTRACT_LIMITS.nestedRefs),
    metricRefs: z
      .array(metricRefSchema)
      .min(1)
      .max(CAIO_PRO_FDE_CONTRACT_LIMITS.nestedRefs),
    evidenceRefs: z
      .array(caioProPublicSafeRefSchema)
      .min(1)
      .max(CAIO_PRO_FDE_CONTRACT_LIMITS.nestedRefs),
    rationale: longText,
  })
  .strict();

// Pack contributes vocabulary and evidence-bounded candidate inputs only. It
// cannot submit a canonical question, rank, fixed ten-item set, or portfolio.
export const caioProPackOperatingInputSchema = z
  .object({
    schemaVersion: z.literal(CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION),
    ...identityShape,
    workspaceRef: caioProPublicSafeWorkspaceRefSchema,
    portfolioRef: caioProPublicSafePortfolioRefSchema,
    evidenceSnapshotRef: caioProPublicSafeObservationRunRefSchema,
    taxonomy: z
      .array(packTaxonomySchema)
      .min(1)
      .max(CAIO_PRO_FDE_CONTRACT_LIMITS.taxonomyItems),
    metrics: z
      .array(packMetricSchema)
      .min(1)
      .max(CAIO_PRO_FDE_CONTRACT_LIMITS.metricItems),
    evidenceApplicabilityRules: z
      .array(packEvidenceApplicabilityRuleSchema)
      .min(1)
      .max(CAIO_PRO_FDE_CONTRACT_LIMITS.evidenceRuleItems),
    candidateInputs: z
      .array(packCandidateInputSchema)
      .min(1)
      .max(CAIO_PRO_FDE_CONTRACT_LIMITS.candidateItems),
    authorityEffect: z.literal("none"),
  })
  .strict();

export type CaioProPackOperatingInput = z.infer<
  typeof caioProPackOperatingInputSchema
>;

const privateExecutionResultProjectionInputSchema = z
  .object({
    ...identityShape,
    projectionRef: privateResultRefSchema,
    workspaceRef: caioProPublicSafeWorkspaceRefSchema,
    portfolioRef: caioProPublicSafePortfolioRefSchema,
    evidenceSnapshotRef: caioProPublicSafeObservationRunRefSchema,
    decisionRecordRef: caioProPublicSafeDecisionRecordRefSchema,
    actionItemRef: caioProPublicSafeActionItemRefSchema,
    approvalTaskRef: caioProPublicSafeApprovalTaskRefSchema,
    executionProofRefs: z
      .array(caioProPublicSafeRefSchema)
      .min(1)
      .max(CAIO_PRO_FDE_CONTRACT_LIMITS.executionProofRefs),
    receiptOutcome: z.enum(CAIO_PRO_PRIVATE_EXECUTION_RECEIPT_OUTCOMES),
    actionTaken: longText,
    outcome: caioProTerminalBusinessOutcomeSchema,
    recordedAt: z.string().max(40).datetime(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.evidenceSnapshotRef !== value.outcome.outcomeRef) {
      context.addIssue({
        code: "custom",
        path: ["outcome", "outcomeRef"],
        message: "outcome evidence must equal the trusted evidence snapshot",
      });
    }
    const canonicalResult =
      CAIO_PRO_PRIVATE_EXECUTION_RECEIPT_OUTCOME_SEMANTICS.accepted[
        value.receiptOutcome
      ].businessResult;
    if (value.outcome.result !== canonicalResult) {
      context.addIssue({
        code: "custom",
        path: ["outcome", "result"],
        message: "business result conflicts with canonical receipt outcome",
      });
    }
  });

export const caioProPrivateExecutionResultProjectionSchema =
  privateExecutionResultProjectionInputSchema
    .safeExtend({
      schemaVersion: z.literal(
        CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_SCHEMA_VERSION,
      ),
      authorityEffect: z.literal("none"),
      canonicalExecutionReceiptWriteAuthority: z.literal("none"),
      contentHash: z.string().max(71).regex(SHA256_PATTERN),
    })
    .strict();

export type CaioProPrivateExecutionResultProjectionInput = z.input<
  typeof privateExecutionResultProjectionInputSchema
>;
export type CaioProPrivateExecutionResultProjection = z.output<
  typeof caioProPrivateExecutionResultProjectionSchema
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
    ...parsed,
    executionProofRefs: uniqueSorted(parsed.executionProofRefs),
    authorityEffect: "none" as const,
    canonicalExecutionReceiptWriteAuthority: "none" as const,
  };
  return caioProPrivateExecutionResultProjectionSchema.parse({
    ...content,
    contentHash: sha256(canonicalJson(content)),
  });
}

export function parseCaioProPrivateExecutionResultProjection(
  projection: unknown,
): CaioProPrivateExecutionResultProjection {
  const parsed = caioProPrivateExecutionResultProjectionSchema.safeParse(
    projection,
  );
  if (!parsed.success) {
    throw new Error("private_execution_result_projection_invalid");
  }
  const { contentHash: _contentHash, ...content } = parsed.data;
  if (parsed.data.contentHash !== sha256(canonicalJson(content))) {
    throw new Error("private_execution_result_projection_content_hash_mismatch");
  }
  return parsed.data;
}

export function validateCaioProPrivateExecutionResultProjection(
  projection: unknown,
): { valid: boolean; errors: string[] } {
  try {
    parseCaioProPrivateExecutionResultProjection(projection);
  } catch (error) {
    return {
      valid: false,
      errors: [
        error instanceof Error &&
        error.message ===
          "private_execution_result_projection_content_hash_mismatch"
          ? error.message
          : "private_execution_result_projection_invalid",
      ],
    };
  }
  return { valid: true, errors: [] };
}
