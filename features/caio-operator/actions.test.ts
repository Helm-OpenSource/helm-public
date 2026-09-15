import { WorkspaceRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cacheMock, sessionMock, governanceMock, catalogMock, observationMock, gateMock } = vi.hoisted(() => ({
  gateMock: {
    recordCaioInitializationAssessment: vi.fn(),
    acceptCaioInitializationGate: vi.fn(),
    revokeCaioInitializationGate: vi.fn(),
  },
  catalogMock: {
    createDataAssetCatalogEntry: vi.fn(),
    recordDataAssetClassificationReceipt: vi.fn(),
    recordDataAssetAuthorizationReceipt: vi.fn(),
    recordDataAssetConnectionReceipt: vi.fn(),
    recordDataAssetInitializationReceipt: vi.fn(),
  },
  observationMock: {
    createEnterpriseObservationProgram: vi.fn(),
    registerObservationSource: vi.fn(),
  },
  cacheMock: { revalidatePath: vi.fn() },
  sessionMock: { getCurrentWorkspaceSession: vi.fn() },
  governanceMock: {
    registerCaioPrincipalBinding: vi.fn(),
    revokeCaioPrincipalBinding: vi.fn(),
    createCaioMandateDraft: vi.fn(),
    activateCaioMandate: vi.fn(),
    suspendCaioMandate: vi.fn(),
    revokeCaioMandate: vi.fn(),
    recordCaioGuardianStop: vi.fn(),
    resumeCaioGuardianStop: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: cacheMock.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession }));
vi.mock("@/lib/caio-governance/mandate-store.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/caio-governance/mandate-store.service")>()),
  ...governanceMock,
}));

vi.mock("@/lib/stage1-owner-loop/data-asset-catalog.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stage1-owner-loop/data-asset-catalog.service")>()),
  ...catalogMock,
}));
vi.mock("@/lib/stage1-owner-loop/observation.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stage1-owner-loop/observation.service")>()),
  ...observationMock,
}));

vi.mock("@/lib/stage1-owner-loop/caio-initialization-gate-store.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stage1-owner-loop/caio-initialization-gate-store.service")>()),
  ...gateMock,
}));

import { CaioMandateStoreError } from "@/lib/caio-governance/mandate-store.service";
import { CaioInitializationGateStoreError } from "@/lib/stage1-owner-loop/caio-initialization-gate-store.service";
import { DataAssetCatalogConflictError } from "@/lib/stage1-owner-loop/data-asset-catalog.service";
import { ObservationAuthorizationDeniedError } from "@/lib/stage1-owner-loop/observation.service";

import {
  acceptInitializationGateAction,
  activateMandateAction,
  recordInitializationAssessmentAction,
  revokeInitializationGateAction,
  createCatalogEntryAction,
  createObservationProgramAction,
  recordCatalogAuthorizationAction,
  recordCatalogClassificationAction,
  recordCatalogConnectionAction,
  recordCatalogInitializationAction,
  registerObservationSourceAction,
  createMandateDraftAction,
  recordGuardianStopAction,
  registerPrincipalBindingAction,
  resumeGuardianStopAction,
  revokeMandateAction,
  revokePrincipalBindingAction,
  suspendMandateAction,
} from "./actions";
import { summarizeOperationResult } from "./run-owner-operation";

function session(role: WorkspaceRole = WorkspaceRole.OWNER, defaultLocale = "zh-CN") {
  return {
    user: { id: "user_owner", name: "Owner Name" },
    membership: { role },
    workspace: { id: "workspace_1", defaultLocale },
  };
}

const ISO = "2026-09-15T08:00:00.000Z";
const LATER = "2026-09-22T08:00:00.000Z";

type Case = Readonly<{
  name: string;
  action: (input: unknown) => Promise<unknown>;
  service: ReturnType<typeof vi.fn>;
  input: Record<string, unknown>;
  /** owner: OWNER pre-check; principal_bound: the service authorizes by CEO/guardian binding. */
  access: "owner" | "principal_bound";
  rejection?: readonly [Error, string];
  /** Input fields the schema converts before the service (ISO string → Date). */
  dateFields?: readonly string[];
}>;

const stageBase = { assetId: "asset_1", receiptId: "receipt_1", idempotencyKey: "idem_1", expectedVersion: 1, evidenceRefs: ["evidence:1"] };
const catalogConflict = [new DataAssetCatalogConflictError(["private_conflict"]), "catalog_conflict"] as const;

const catalogCases: readonly Case[] = [
  { name: "createCatalogEntry", access: "owner", action: createCatalogEntryAction, service: catalogMock.createDataAssetCatalogEntry,
    rejection: catalogConflict, dateFields: ["nextReviewAt"],
    input: { assetKey: "activity", sourceSystemRef: "system:core-db", displayName: "Activity", sourceKind: "relational_database",
      businessDomain: "operations", businessOwnerRef: "owner:operations", purpose: "Observe aggregates", scopeRefs: ["scope:workspace"],
      recommendedAccessMode: "read_only_replica", retentionDays: 90, freshnessSlaMinutes: 10, residencyRequirements: ["domestic"],
      blindSpots: [], blockerCodes: [], riskOwnerRef: null, nextReviewAt: LATER, evidenceRefs: ["evidence:1"] } },
  { name: "recordCatalogClassification", access: "owner", action: recordCatalogClassificationAction,
    service: catalogMock.recordDataAssetClassificationReceipt, rejection: catalogConflict,
    input: { ...stageBase, dataShape: "structured", sensitivity: "confidential", processingDisposition: "local_only", technicalFeasibility: "feasible" } },
  { name: "recordCatalogAuthorization", access: "owner", action: recordCatalogAuthorizationAction,
    service: catalogMock.recordDataAssetAuthorizationReceipt, rejection: catalogConflict, dateFields: ["validFrom", "validUntil"],
    input: { ...stageBase, authorizationStatus: "authorized", authorizationRef: "authorization:1", scopeRefs: ["scope:workspace"],
      consentRefs: [], validFrom: ISO, validUntil: LATER, reasonCodes: ["owner_approved"] } },
  { name: "recordCatalogConnection", access: "owner", action: recordCatalogConnectionAction,
    service: catalogMock.recordDataAssetConnectionReceipt, rejection: catalogConflict,
    input: { ...stageBase, connectionStatus: "connected", accessMode: "read_only_replica", connectorRef: "connector:1", secretRef: null,
      authorizationReceiptRef: "receipt:auth-1", observationSourceRef: null, reasonCodes: [] } },
  { name: "recordCatalogInitialization", access: "owner", action: recordCatalogInitializationAction,
    service: catalogMock.recordDataAssetInitializationReceipt, rejection: catalogConflict,
    input: { ...stageBase, initializationStatus: "initialized", connectionReceiptRef: "receipt:conn-1", observationRunRefs: ["run:1"],
      schemaMappingRefs: [], companyMemoryRefs: [], temporalContextSnapshotRef: null, reasonCodes: [] } },
  { name: "createObservationProgram", access: "owner", action: createObservationProgramAction,
    service: observationMock.createEnterpriseObservationProgram, dateFields: ["startsAt", "expiresAt"],
    rejection: [new ObservationAuthorizationDeniedError(["private_denied"]), "observation_denied"],
    input: { purpose: "Observe operations", scopeRefs: ["scope:workspace"], dataCategories: ["operations_aggregate"],
      startsAt: ISO, expiresAt: LATER, retentionDays: 90, authorizationRef: "authorization:1" } },
  { name: "registerObservationSource", access: "owner", action: registerObservationSourceAction,
    service: observationMock.registerObservationSource,
    rejection: [new ObservationAuthorizationDeniedError(["private_denied"]), "observation_denied"],
    input: { programId: "program_1", catalogEntryId: "asset_1", sourceKey: "activity", sourceKind: "relational_database",
      accessMode: "read_only_replica", ownerRef: "owner:operations", freshnessSlaMinutes: 10, sensitivity: "confidential",
      authorizationRef: "authorization:1", secretRef: "managed-ref:activity", retentionDays: 90 } },
];

const governanceCases: readonly Case[] = [
  { name: "registerPrincipalBinding", access: "owner", action: registerPrincipalBindingAction, service: governanceMock.registerCaioPrincipalBinding,
    input: { userId: "user_ceo", principalRef: "ceo-primary", principalKind: "ceo", evidenceRef: "evidence:board-1" } },
  { name: "revokePrincipalBinding", access: "owner", action: revokePrincipalBindingAction, service: governanceMock.revokeCaioPrincipalBinding,
    input: { bindingId: "binding_1" } },
  { name: "createMandateDraft", access: "owner", action: createMandateDraftAction, service: governanceMock.createCaioMandateDraft,
    input: { caioRef: "caio-primary", ceoRef: "ceo-primary", stage: "observe", stageDecisionRef: "decision:1",
      objectiveRefs: ["objective:1"], scopeRefs: ["scope:workspace"], grantBasisRefs: ["grant:1"], reservedMatterRefs: [],
      humanResponsePolicyRef: "policy:1", accountabilityAnchorRefs: ["anchor:1"], guardianStopRefs: [],
      validFrom: ISO, validUntil: LATER, inFlightDisposition: "freeze", auditRefs: ["audit:1"] } },
  { name: "activateMandate", access: "principal_bound", action: activateMandateAction, service: governanceMock.activateCaioMandate,
    input: { actorCeoRef: "ceo-primary", mandateRecordId: "mandate_1" } },
  { name: "suspendMandate", access: "principal_bound", action: suspendMandateAction, service: governanceMock.suspendCaioMandate,
    input: { actorCeoRef: "ceo-primary", mandateRecordId: "mandate_1" } },
  { name: "revokeMandate", access: "principal_bound", action: revokeMandateAction, service: governanceMock.revokeCaioMandate,
    input: { actorCeoRef: "ceo-primary", mandateRecordId: "mandate_1" } },
  { name: "recordGuardianStop", access: "principal_bound", action: recordGuardianStopAction, service: governanceMock.recordCaioGuardianStop,
    input: { guardianRef: "guardian-primary", mandateRecordId: "mandate_1", reason: "unexpected volume", auditRefs: ["audit:2"] } },
  { name: "resumeGuardianStop", access: "principal_bound", action: resumeGuardianStopAction, service: governanceMock.resumeCaioGuardianStop,
    input: { actorCeoRef: "ceo-primary", stopRecordId: "stop_1" } },
];

const gateRejection = [new CaioInitializationGateStoreError("private gate detail"), "initialization_rejected"] as const;

const gateCases: readonly Case[] = [
  { name: "recordInitializationAssessment", access: "owner", action: recordInitializationAssessmentAction,
    service: gateMock.recordCaioInitializationAssessment, rejection: gateRejection,
    input: { mandateRecordId: "mandate_1", evaluationKey: "g0-2026-09-15" } },
  { name: "acceptInitializationGate", access: "principal_bound", action: acceptInitializationGateAction,
    service: gateMock.acceptCaioInitializationGate, rejection: gateRejection,
    input: { assessmentId: "assessment_1", ceoPrincipalRef: "ceo-primary", idempotencyKey: "accept_1",
      inventoryConfirmationRef: "inventory:1", customerAcceptanceRef: "acceptance:1", acceptedExceptionRefs: [],
      reasonCodes: ["ready"], evidenceRefs: ["evidence:g0-1"] } },
  { name: "revokeInitializationGate", access: "principal_bound", action: revokeInitializationGateAction,
    service: gateMock.revokeCaioInitializationGate, rejection: gateRejection,
    input: { ceoPrincipalRef: "ceo-primary", idempotencyKey: "revoke_1", reasonCodes: ["withdrawn"], evidenceRefs: ["evidence:r-1"] } },
];

const allCases: readonly Case[] = [...governanceCases, ...catalogCases, ...gateCases];

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.getCurrentWorkspaceSession.mockResolvedValue(session());
  for (const { service } of allCases) service.mockResolvedValue({ id: "record_1", status: "draft", secretField: "x" });
});

describe("summarizeOperationResult", () => {
  it("keeps only whitelisted scalar identity and state fields", () => {
    expect(summarizeOperationResult({ id: "a", status: "active", version: 3, payloadJson: "{}", nested: { id: "b" } }))
      .toEqual({ id: "a", status: "active", version: 3 });
    expect(summarizeOperationResult(undefined)).toEqual({});
    expect(summarizeOperationResult("text")).toEqual({});
  });

  it("surfaces the identifiers operators need from the real service result shapes", () => {
    expect(summarizeOperationResult({ mandateId: "m1", status: "draft", grantBasisRefs: ["x"], authorityEffect: "none" }))
      .toEqual({ mandateId: "m1", status: "draft" });
    expect(summarizeOperationResult({ stop: { stopId: "s1", reason: "private reason" }, mandate: { mandateId: "m1", status: "suspended" } }))
      .toEqual({ "stop.stopId": "s1", "mandate.mandateId": "m1", "mandate.status": "suspended" });
    expect(summarizeOperationResult({ assessment: { assessmentId: "a1", basisHash: "h" }, diagnostics: ["private"], replayed: false }))
      .toEqual({ "assessment.assessmentId": "a1", replayed: false });
    expect(summarizeOperationResult({ entry: { assetId: "as1", version: 2, purpose: "private" }, receipt: { receiptId: "r1" }, replayed: true }))
      .toEqual({ "entry.assetId": "as1", "entry.version": 2, "receipt.receiptId": "r1", replayed: true });
    expect(summarizeOperationResult({ programId: "p1", sourceId: "src1", status: "active" }))
      .toEqual({ programId: "p1", sourceId: "src1", status: "active" });
  });
});

describe.each(allCases)("$name action", ({ action, service, input, access, rejection, dateFields }) => {
  it.each([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER])("applies the declared access rule for %s", async (role) => {
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue(session(role));
    if (access === "owner") {
      await expect(action(input)).resolves.toMatchObject({ ok: false, code: "not_owner" });
      expect(service).not.toHaveBeenCalled();
      expect(cacheMock.revalidatePath).not.toHaveBeenCalled();
    } else {
      // A designated guardian or bound CEO need not be the workspace OWNER; the service decides.
      await expect(action(input)).resolves.toMatchObject({ ok: true });
      expect(service).toHaveBeenCalledTimes(1);
      expect(service.mock.calls[0][0]).toMatchObject({ actorUserId: "user_owner" });
    }
  });

  it("refuses malformed input without calling the service", async () => {
    await expect(action({ ...input, injected: true })).resolves.toMatchObject({ ok: false, code: "input_invalid" });
    await expect(action(null)).resolves.toMatchObject({ ok: false, code: "input_invalid" });
    expect(service).not.toHaveBeenCalled();
  });

  it("injects session identity, never trusts the client for it, and returns a summary", async () => {
    const result = await action(input);
    expect(result).toEqual({ ok: true, value: { id: "record_1", status: "draft" } });
    expect(service).toHaveBeenCalledTimes(1);
    const args = service.mock.calls[0][0];
    expect(args).toMatchObject({ workspaceId: "workspace_1", actorUserId: "user_owner", english: false });
    for (const [key, value] of Object.entries(input)) {
      if (dateFields?.includes(key)) {
        expect(args[key]).toBeInstanceOf(Date);
        expect((args[key] as Date).toISOString()).toBe(value);
      } else {
        expect(args[key]).toEqual(value);
      }
    }
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/caio");
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/caio/operator");
  });

  it("maps service rejections to a closed code without leaking the service message", async () => {
    const [error, code] = rejection ?? [new CaioMandateStoreError("private reason detail"), "governance_rejected"];
    service.mockRejectedValue(error);
    const result = await action(input);
    expect(result).toMatchObject({ ok: false, code });
    expect(JSON.stringify(result)).not.toMatch(/private/);
    expect(cacheMock.revalidatePath).not.toHaveBeenCalled();
  });

  it("maps unexpected failures to unavailable", async () => {
    service.mockRejectedValue(new Error("connection refused at private host"));
    const result = await action(input);
    expect(result).toMatchObject({ ok: false, code: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("private host");
  });
});

describe("session-derived actor name", () => {
  it.each([
    [createObservationProgramAction, observationMock.createEnterpriseObservationProgram, 5],
    [registerObservationSourceAction, observationMock.registerObservationSource, 6],
    [createCatalogEntryAction, catalogMock.createDataAssetCatalogEntry, 0],
  ] as const)("passes actorName from the session (%#)", async (action, service, index) => {
    await action(catalogCases[index].input);
    expect(service.mock.calls[0][0]).toMatchObject({ actorName: "Owner Name" });
  });
});

describe("access classification", () => {
  it("keeps registration OWNER-only and leaves CEO/guardian acts to the service's binding check", () => {
    expect(allCases.filter((c) => c.access === "principal_bound").map((c) => c.name).sort()).toEqual([
      "acceptInitializationGate", "activateMandate", "recordGuardianStop", "resumeGuardianStop",
      "revokeInitializationGate", "revokeMandate", "suspendMandate",
    ]);
  });
});

describe("G0 acceptance idempotency", () => {
  it("passes the client idempotency key through and returns the service's replay result unchanged", async () => {
    gateMock.acceptCaioInitializationGate.mockResolvedValue({ receiptId: "receipt_g0", status: "accepted", outcome: "replayed" });
    const first = await acceptInitializationGateAction(gateCases[1].input);
    const second = await acceptInitializationGateAction(gateCases[1].input);
    expect(first).toEqual(second);
    expect(first).toEqual({ ok: true, value: { receiptId: "receipt_g0", status: "accepted", outcome: "replayed" } });
    for (const call of gateMock.acceptCaioInitializationGate.mock.calls) expect(call[0].idempotencyKey).toBe("accept_1");
  });
});

describe("locale", () => {
  it("returns English copy for an en-US workspace", async () => {
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue(session(WorkspaceRole.MEMBER, "en-US"));
    const result = await registerPrincipalBindingAction(governanceCases[0].input);
    expect(result).toMatchObject({ ok: false, message: "Only the workspace owner can perform this operation." });
  });
});
