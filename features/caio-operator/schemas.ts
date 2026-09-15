import { z } from "zod";

import { CAIO_IN_FLIGHT_DISPOSITIONS, CAIO_MANDATE_STAGES } from "@/lib/caio-governance/types";
import {
  DATA_ASSET_AUTHORIZATION_STATUSES,
  DATA_ASSET_CONNECTION_STATUSES,
  DATA_ASSET_INITIALIZATION_STATUSES,
  DATA_ASSET_PROCESSING_DISPOSITIONS,
  DATA_ASSET_SHAPES,
  DATA_ASSET_TECHNICAL_FEASIBILITY_STATES,
} from "@/lib/stage1-owner-loop/data-asset-catalog.types";
import { OBSERVATION_ACCESS_MODES, OBSERVATION_SENSITIVITY_LEVELS } from "@/lib/stage1-owner-loop/types";

/**
 * Input schemas for the CAIO OWNER operator entry points. Fields mirror the existing
 * service signatures one-to-one; workspaceId, actorUserId, actorName and english are
 * injected from the session by the runner and are never accepted from the client.
 */

const ref = z.string().trim().min(1).max(191);
const text = (max: number) => z.string().trim().min(1).max(max);
const refs = z.array(ref).max(100);
// Principal refs must stay colon-free (grant-basis issuer format enforced by the store).
const principalRef = ref.refine((value) => !value.includes(":"), { message: "principal_ref_colon" });
const instant = z.string().datetime({ offset: true });
const instantDate = instant.transform((value) => new Date(value));
const positiveInt = (max: number) => z.number().int().min(1).max(max);
const without = <T extends readonly string[], E extends T[number]>(values: T, excluded: E) =>
  values.filter((value): value is Exclude<T[number], E> => value !== excluded) as [Exclude<T[number], E>, ...Exclude<T[number], E>[]];

export const registerPrincipalBindingSchema = z.object({
  userId: ref,
  principalRef,
  principalKind: z.enum(["ceo", "guardian", "fde"]),
  evidenceRef: ref,
}).strict();

export const revokePrincipalBindingSchema = z.object({ bindingId: ref }).strict();

export const createMandateDraftSchema = z.object({
  caioRef: principalRef,
  ceoRef: principalRef,
  stage: z.enum(CAIO_MANDATE_STAGES),
  stageDecisionRef: ref,
  objectiveRefs: refs,
  scopeRefs: refs,
  grantBasisRefs: refs,
  reservedMatterRefs: refs,
  humanResponsePolicyRef: ref,
  accountabilityAnchorRefs: refs,
  guardianStopRefs: refs,
  validFrom: instant,
  validUntil: instant,
  inFlightDisposition: z.enum(CAIO_IN_FLIGHT_DISPOSITIONS),
  auditRefs: refs,
}).strict();

export const mandateTransitionSchema = z.object({
  actorCeoRef: principalRef,
  mandateRecordId: ref,
  supersedesRecordId: ref.nullable().optional(),
}).strict();

export const guardianStopSchema = z.object({
  guardianRef: principalRef,
  mandateRecordId: ref,
  reason: text(500),
  auditRefs: refs,
}).strict();

export const resumeGuardianStopSchema = z.object({
  actorCeoRef: principalRef,
  stopRecordId: ref,
}).strict();

export const createCatalogEntrySchema = z.object({
  assetKey: ref,
  sourceSystemRef: ref,
  displayName: text(191),
  sourceKind: ref,
  businessDomain: ref,
  businessOwnerRef: ref,
  purpose: text(1000),
  scopeRefs: refs,
  recommendedAccessMode: z.enum(OBSERVATION_ACCESS_MODES),
  retentionDays: positiveInt(3650),
  freshnessSlaMinutes: positiveInt(525600),
  residencyRequirements: refs,
  blindSpots: z.array(text(500)).max(100),
  blockerCodes: refs,
  riskOwnerRef: ref.nullable(),
  nextReviewAt: instantDate.nullable(),
  evidenceRefs: refs,
}).strict();

const stageBase = {
  assetId: ref,
  receiptId: ref,
  idempotencyKey: ref,
  expectedVersion: z.number().int().min(0),
  evidenceRefs: refs,
};

export const catalogClassificationSchema = z.object({
  ...stageBase,
  dataShape: z.enum(DATA_ASSET_SHAPES),
  sensitivity: z.enum(OBSERVATION_SENSITIVITY_LEVELS),
  processingDisposition: z.enum(DATA_ASSET_PROCESSING_DISPOSITIONS),
  technicalFeasibility: z.enum(without(DATA_ASSET_TECHNICAL_FEASIBILITY_STATES, "unassessed")),
}).strict();

export const catalogAuthorizationSchema = z.object({
  ...stageBase,
  authorizationStatus: z.enum(without(DATA_ASSET_AUTHORIZATION_STATUSES, "not_requested")),
  authorizationRef: ref.nullable(),
  scopeRefs: refs,
  consentRefs: refs,
  validFrom: instantDate.nullable(),
  validUntil: instantDate.nullable(),
  reasonCodes: refs,
}).strict();

export const catalogConnectionSchema = z.object({
  ...stageBase,
  connectionStatus: z.enum(without(DATA_ASSET_CONNECTION_STATUSES, "not_started")),
  accessMode: z.enum(OBSERVATION_ACCESS_MODES),
  connectorRef: ref.nullable(),
  secretRef: ref.nullable(),
  authorizationReceiptRef: ref.nullable(),
  observationSourceRef: ref.nullable(),
  reasonCodes: refs,
}).strict();

export const catalogInitializationSchema = z.object({
  ...stageBase,
  initializationStatus: z.enum(without(DATA_ASSET_INITIALIZATION_STATUSES, "not_started")),
  connectionReceiptRef: ref.nullable(),
  observationRunRefs: refs,
  schemaMappingRefs: refs,
  companyMemoryRefs: refs,
  temporalContextSnapshotRef: ref.nullable(),
  reasonCodes: refs,
}).strict();

export const createObservationProgramSchema = z.object({
  purpose: text(1000),
  scopeRefs: refs,
  dataCategories: refs,
  startsAt: instantDate,
  expiresAt: instantDate,
  retentionDays: positiveInt(3650),
  authorizationRef: ref,
}).strict();

export const registerObservationSourceSchema = z.object({
  programId: ref,
  catalogEntryId: ref,
  sourceKey: ref,
  sourceKind: ref,
  accessMode: z.enum(OBSERVATION_ACCESS_MODES),
  ownerRef: ref,
  freshnessSlaMinutes: positiveInt(525600),
  sensitivity: z.enum(OBSERVATION_SENSITIVITY_LEVELS),
  authorizationRef: ref,
  secretRef: ref,
  retentionDays: positiveInt(3650),
}).strict();

export const recordInitializationAssessmentSchema = z.object({
  mandateRecordId: ref,
  evaluationKey: ref,
}).strict();

export const acceptInitializationGateSchema = z.object({
  assessmentId: ref,
  ceoPrincipalRef: principalRef,
  idempotencyKey: ref,
  inventoryConfirmationRef: ref,
  customerAcceptanceRef: ref,
  acceptedExceptionRefs: refs,
  reasonCodes: refs,
  evidenceRefs: refs,
}).strict();

export const revokeInitializationGateSchema = z.object({
  ceoPrincipalRef: principalRef,
  idempotencyKey: ref,
  reasonCodes: refs,
  evidenceRefs: refs,
}).strict();
