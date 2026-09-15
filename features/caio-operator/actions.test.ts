import { WorkspaceRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cacheMock, sessionMock, governanceMock } = vi.hoisted(() => ({
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

import { CaioMandateStoreError } from "@/lib/caio-governance/mandate-store.service";

import {
  activateMandateAction,
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
}>;

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

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.getCurrentWorkspaceSession.mockResolvedValue(session());
  for (const { service } of governanceCases) service.mockResolvedValue({ id: "record_1", status: "draft", secretField: "x" });
});

describe("summarizeOperationResult", () => {
  it("keeps only whitelisted scalar identity and state fields", () => {
    expect(summarizeOperationResult({ id: "a", status: "active", version: 3, payloadJson: "{}", nested: { id: "b" } }))
      .toEqual({ id: "a", status: "active", version: 3 });
    expect(summarizeOperationResult(undefined)).toEqual({});
    expect(summarizeOperationResult("text")).toEqual({});
  });
});

describe.each(governanceCases)("$name action", ({ action, service, input, access }) => {
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
      if (key === "validFrom" || key === "validUntil") expect(args[key]).toBe(value);
      else expect(args[key]).toEqual(value);
    }
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/caio");
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/caio/operator");
  });

  it("maps governance rejections to a closed code without leaking the service message", async () => {
    service.mockRejectedValue(new CaioMandateStoreError("private reason detail"));
    const result = await action(input);
    expect(result).toMatchObject({ ok: false, code: "governance_rejected" });
    expect(JSON.stringify(result)).not.toContain("private reason detail");
    expect(cacheMock.revalidatePath).not.toHaveBeenCalled();
  });

  it("maps unexpected failures to unavailable", async () => {
    service.mockRejectedValue(new Error("connection refused at private host"));
    const result = await action(input);
    expect(result).toMatchObject({ ok: false, code: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("private host");
  });
});

describe("access classification", () => {
  it("keeps registration OWNER-only and leaves binding-authorized transitions to the service", () => {
    expect(governanceCases.filter((c) => c.access === "owner").map((c) => c.name).sort())
      .toEqual(["createMandateDraft", "registerPrincipalBinding", "revokePrincipalBinding"]);
  });
});

describe("locale", () => {
  it("returns English copy for an en-US workspace", async () => {
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue(session(WorkspaceRole.MEMBER, "en-US"));
    const result = await registerPrincipalBindingAction(governanceCases[0].input);
    expect(result).toMatchObject({ ok: false, message: "Only the workspace owner can perform this operation." });
  });
});
