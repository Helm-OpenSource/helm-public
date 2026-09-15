import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, governanceMock } = vi.hoisted(() => ({
  dbMock: {
    membership: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    workspace: { findUnique: vi.fn() },
  },
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

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/caio-governance/mandate-store.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/caio-governance/mandate-store.service")>()),
  ...governanceMock,
}));

import { CaioMandateStoreError } from "@/lib/caio-governance/mandate-store.service";

import {
  CAIO_GOVERNANCE_OPERATIONS,
  createMandateDraftSchema,
  guardianStopSchema,
  mandateTransitionSchema,
  parseCaioGovernanceCliArgs,
  registerPrincipalBindingSchema,
  resumeGuardianStopSchema,
  runCaioGovernanceOperation,
  type CaioGovernanceOperationKey,
} from "./governance-operator";

const ISO = "2026-09-15T08:00:00.000Z";
const LATER = "2026-09-22T08:00:00.000Z";

const inputs: Readonly<Record<CaioGovernanceOperationKey, Record<string, unknown>>> = {
  registerPrincipalBinding: { userId: "user_ceo", principalRef: "ceo-primary", principalKind: "ceo", evidenceRef: "evidence:board-1" },
  revokePrincipalBinding: { bindingId: "binding_1" },
  createMandateDraft: { caioRef: "caio-primary", ceoRef: "ceo-primary", stage: "observe", stageDecisionRef: "decision:1",
    objectiveRefs: ["objective:1"], scopeRefs: ["scope:workspace"], grantBasisRefs: ["grant:1"], reservedMatterRefs: [],
    humanResponsePolicyRef: "policy:1", accountabilityAnchorRefs: ["anchor:1"], guardianStopRefs: [],
    validFrom: ISO, validUntil: LATER, inFlightDisposition: "freeze", auditRefs: ["audit:1"] },
  activateMandate: { actorCeoRef: "ceo-primary", mandateRecordId: "mandate_1" },
  suspendMandate: { actorCeoRef: "ceo-primary", mandateRecordId: "mandate_1" },
  revokeMandate: { actorCeoRef: "ceo-primary", mandateRecordId: "mandate_1" },
  recordGuardianStop: { guardianRef: "guardian-primary", mandateRecordId: "mandate_1", reason: "unexpected volume", auditRefs: ["audit:2"] },
  resumeGuardianStop: { actorCeoRef: "ceo-primary", stopRecordId: "stop_1" },
};

const services: Readonly<Record<CaioGovernanceOperationKey, ReturnType<typeof vi.fn>>> = {
  registerPrincipalBinding: governanceMock.registerCaioPrincipalBinding,
  revokePrincipalBinding: governanceMock.revokeCaioPrincipalBinding,
  createMandateDraft: governanceMock.createCaioMandateDraft,
  activateMandate: governanceMock.activateCaioMandate,
  suspendMandate: governanceMock.suspendCaioMandate,
  revokeMandate: governanceMock.revokeCaioMandate,
  recordGuardianStop: governanceMock.recordCaioGuardianStop,
  resumeGuardianStop: governanceMock.resumeCaioGuardianStop,
};

const keys = Object.keys(CAIO_GOVERNANCE_OPERATIONS) as CaioGovernanceOperationKey[];

function member(role: WorkspaceRole, status: MembershipStatus = MembershipStatus.ACTIVE, defaultLocale = "zh-CN") {
  dbMock.membership.findUnique.mockResolvedValue({ role, status });
  dbMock.workspace.findUnique.mockResolvedValue({ defaultLocale });
}

const run = (operation: CaioGovernanceOperationKey, apply = true, rawInput: unknown = inputs[operation]) =>
  runCaioGovernanceOperation({ operation, workspaceId: "workspace_1", actorUserId: "user_actor", rawInput, apply });

beforeEach(() => {
  vi.clearAllMocks();
  member(WorkspaceRole.OWNER);
  dbMock.user.findUnique.mockResolvedValue({ name: "Actor Name" });
  for (const service of Object.values(services)) service.mockResolvedValue({ mandateId: "mandate_1", status: "draft", secretField: "x" });
});

describe.each(keys)("%s governance operation", (operation) => {
  const service = services[operation];
  const { access } = CAIO_GOVERNANCE_OPERATIONS[operation];

  it("applies the declared access rule to a non-owner member", async () => {
    member(WorkspaceRole.ADMIN);
    if (access === "owner") {
      await expect(run(operation)).resolves.toMatchObject({ ok: false, code: "not_owner" });
      expect(service).not.toHaveBeenCalled();
    } else {
      // A designated guardian or bound CEO need not be the workspace OWNER; the service decides.
      await expect(run(operation)).resolves.toMatchObject({ ok: true });
      expect(service).toHaveBeenCalledTimes(1);
    }
  });

  it("validates without writing unless apply is set", async () => {
    await expect(run(operation, false)).resolves.toEqual({ ok: true, value: { validated: true } });
    expect(service).not.toHaveBeenCalled();
    await expect(run(operation, false, { ...inputs[operation], injected: true }))
      .resolves.toMatchObject({ ok: false, code: "input_invalid" });
  });

  it("passes the named actor and workspace to the service and returns only a summary", async () => {
    await expect(run(operation)).resolves.toEqual({ ok: true, value: { mandateId: "mandate_1", status: "draft" } });
    expect(service.mock.calls[0][0]).toMatchObject({
      ...inputs[operation], workspaceId: "workspace_1", actorUserId: "user_actor", english: false,
    });
  });

  it("maps store rejections and unexpected failures to closed codes without leaking", async () => {
    service.mockRejectedValueOnce(new CaioMandateStoreError("private governance detail"));
    const rejected = await run(operation);
    expect(rejected).toMatchObject({ ok: false, code: "governance_rejected" });
    service.mockRejectedValueOnce(new Error("connection refused at private host"));
    const failed = await run(operation);
    expect(failed).toMatchObject({ ok: false, code: "unavailable" });
    expect(JSON.stringify([rejected, failed])).not.toMatch(/private/);
  });

  it("ships a template that parses with its schema", () => {
    const definition = CAIO_GOVERNANCE_OPERATIONS[operation];
    expect(definition.schema.safeParse(definition.template).success).toBe(true);
  });
});

describe("governance access", () => {
  it("keeps registration OWNER-only and leaves CEO/guardian acts to the binding check", () => {
    expect(keys.filter((key) => CAIO_GOVERNANCE_OPERATIONS[key].access === "principal_bound").sort()).toEqual([
      "activateMandate", "recordGuardianStop", "resumeGuardianStop", "revokeMandate", "suspendMandate",
    ]);
  });

  it("treats an inactive or missing membership as not owner for registration", async () => {
    member(WorkspaceRole.OWNER, MembershipStatus.INACTIVE);
    await expect(run("registerPrincipalBinding")).resolves.toMatchObject({ ok: false, code: "not_owner" });
    dbMock.membership.findUnique.mockResolvedValue(null);
    await expect(run("createMandateDraft")).resolves.toMatchObject({ ok: false, code: "not_owner" });
    expect(governanceMock.registerCaioPrincipalBinding).not.toHaveBeenCalled();
    expect(governanceMock.createCaioMandateDraft).not.toHaveBeenCalled();
  });

  it("uses English copy for an en-US workspace", async () => {
    member(WorkspaceRole.MEMBER, MembershipStatus.ACTIVE, "en-US");
    await expect(run("registerPrincipalBinding"))
      .resolves.toMatchObject({ message: "Only the workspace owner can perform this operation." });
  });
});

describe("governance schemas", () => {
  it("rejects colon-bearing principal refs on every CEO/guardian field", () => {
    expect(registerPrincipalBindingSchema.safeParse({ ...inputs.registerPrincipalBinding, principalRef: "ceo:primary" }).success).toBe(false);
    expect(mandateTransitionSchema.safeParse({ ...inputs.activateMandate, actorCeoRef: "ceo:primary" }).success).toBe(false);
    expect(guardianStopSchema.safeParse({ ...inputs.recordGuardianStop, guardianRef: "g:1" }).success).toBe(false);
    expect(resumeGuardianStopSchema.safeParse({ ...inputs.resumeGuardianStop, actorCeoRef: "c:1" }).success).toBe(false);
  });

  it("rejects out-of-set kinds and stages and malformed instants, and keeps mandate instants as ISO strings", () => {
    expect(registerPrincipalBindingSchema.safeParse({ ...inputs.registerPrincipalBinding, principalKind: "owner" }).success).toBe(false);
    expect(createMandateDraftSchema.safeParse({ ...inputs.createMandateDraft, stage: "authorized_execute" }).success).toBe(false);
    expect(createMandateDraftSchema.safeParse({ ...inputs.createMandateDraft, validFrom: "yesterday" }).success).toBe(false);
    expect(createMandateDraftSchema.parse(inputs.createMandateDraft).validFrom).toBe(ISO);
  });
});

describe("parseCaioGovernanceCliArgs", () => {
  const base = ["--operation=activateMandate", "--workspace-id=ws", "--actor-user-id=u", "--input-file=in.json"];

  it("defaults to validation only and requires an explicit --apply", () => {
    expect(parseCaioGovernanceCliArgs(base)).toEqual({
      mode: "run", operation: "activateMandate", workspaceId: "ws", actorUserId: "u", inputFile: "in.json", apply: false,
    });
    expect(parseCaioGovernanceCliArgs([...base, "--apply"])).toMatchObject({ mode: "run", apply: true });
  });

  it("prints a template for a known operation", () => {
    expect(parseCaioGovernanceCliArgs(["--template=recordGuardianStop"])).toEqual({ mode: "template", operation: "recordGuardianStop" });
  });

  it.each([
    [["--operation=activateMandate"], "missing_argument"],
    [[...base, "--operation=revokeMandate"], "duplicate_argument"],
    [[...base, "--apply", "--apply"], "duplicate_argument"],
    [[...base, "--force"], "unknown_argument"],
    [[...base, "--apply=true"], "unknown_argument"],
    [["--operation=grantAuthority", ...base.slice(1)], "unknown_operation"],
    [["--template=grantAuthority"], "unknown_operation"],
    [["--template=activateMandate", "--apply"], "template_takes_no_other_arguments"],
  ] as const)("refuses %j with %s", (argv, reason) => {
    expect(parseCaioGovernanceCliArgs(argv)).toEqual({ mode: "invalid", reason });
  });
});
