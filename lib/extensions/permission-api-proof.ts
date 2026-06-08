import {
  PERMISSION_DATA_CLASSIFICATION_DEFAULT_REDACTION,
  type PermissionDecision,
  type PermissionPolicy,
  type PermissionSubject,
} from "@/lib/auth/permission-policy";
import {
  createPermissionedExtensionApiRoute,
  type ExtensionApiRoute,
} from "@/lib/extensions/api-route-registry";

type SyntheticCaseQueue = "north" | "south";

type SyntheticCaseRow = {
  caseId: string;
  workspaceId: string;
  queue: SyntheticCaseQueue;
  status: string;
  contactToken: string;
  balanceCents: number;
  legalNotes: string;
};

const SYNTHETIC_CASE_ROWS: readonly SyntheticCaseRow[] = [
  {
    caseId: "CASE-SAMPLE-001",
    workspaceId: "workspace-1",
    queue: "north",
    status: "review",
    contactToken: "raw-contact-token-001",
    balanceCents: 1234500,
    legalNotes: "synthetic legal-sensitive note one",
  },
  {
    caseId: "CASE-SAMPLE-002",
    workspaceId: "workspace-1",
    queue: "south",
    status: "hold",
    contactToken: "raw-contact-token-002",
    balanceCents: 987600,
    legalNotes: "synthetic legal-sensitive note two",
  },
  {
    caseId: "CASE-SAMPLE-003",
    workspaceId: "workspace-2",
    queue: "north",
    status: "review",
    contactToken: "raw-contact-token-003",
    balanceCents: 333300,
    legalNotes: "synthetic legal-sensitive note three",
  },
];

type ResolveSubject = (
  request: Request,
  context: { params: Record<string, string> },
) => Promise<PermissionSubject | null> | PermissionSubject | null;

function publicDecision(decision: PermissionDecision) {
  return {
    effect: decision.effect,
    failureCode: decision.failureCode,
    policyVersion: decision.policyVersion,
    traceId: decision.traceId,
    source: decision.source,
    action: decision.action,
    obligations: decision.obligations ?? [],
    redactions: decision.redactions ?? [],
  };
}

function serializeSyntheticCaseRow(row: SyntheticCaseRow) {
  return {
    caseId: row.caseId,
    queue: row.queue,
    status: row.status,
    contact: {
      redaction: PERMISSION_DATA_CLASSIFICATION_DEFAULT_REDACTION.personal_contact,
    },
    balance: {
      redaction: PERMISSION_DATA_CLASSIFICATION_DEFAULT_REDACTION.financial_data,
    },
    legalNotes: {
      redaction: PERMISSION_DATA_CLASSIFICATION_DEFAULT_REDACTION.legal_sensitive,
    },
  };
}

export function buildSyntheticCaseReadApiRoute(input: {
  pattern: string;
  policy: PermissionPolicy;
  resolveSubject: ResolveSubject;
  allowedQueues: readonly SyntheticCaseQueue[];
}): ExtensionApiRoute {
  return createPermissionedExtensionApiRoute({
    method: "GET",
    pattern: input.pattern,
    actionName: "case.read",
    policy: input.policy,
    resolveSubject: input.resolveSubject,
    resource: {
      kind: "case_record",
      workspaceId: "workspace-1",
      extensionKey: "case-management-sample",
      packKey: "case-management-sample",
      dataClassifications: ["workspace_internal"],
    },
    handler: async (_request, context) => {
      const actorWorkspaceId = context.permissionDecision.actor?.workspaceId;
      const allowedQueues = new Set(input.allowedQueues);
      const rows = SYNTHETIC_CASE_ROWS.filter(
        (row) =>
          row.workspaceId === actorWorkspaceId && allowedQueues.has(row.queue),
      ).map(serializeSyntheticCaseRow);

      return Response.json({
        decision: publicDecision(context.permissionDecision),
        rows,
      });
    },
  });
}

export function buildSyntheticPrepareWritebackApiRoute(input: {
  pattern: string;
  policy: PermissionPolicy;
  resolveSubject: ResolveSubject;
  execute: () => void;
}): ExtensionApiRoute {
  return createPermissionedExtensionApiRoute({
    method: "POST",
    pattern: input.pattern,
    actionName: "case.prepare_writeback",
    policy: input.policy,
    resolveSubject: input.resolveSubject,
    resource: {
      kind: "case_record",
      workspaceId: "workspace-1",
      extensionKey: "case-management-sample",
      packKey: "case-management-sample",
      dataClassifications: ["workspace_internal", "financial_data", "legal_sensitive"],
    },
    handler: async (_request, context) => {
      return Response.json(
        {
          decision: publicDecision(context.permissionDecision),
          reviewPacket: {
            status: "review_required",
            executed: false,
            obligations: context.permissionDecision.obligations ?? [],
          },
        },
        { status: 202 },
      );
    },
  });
}

export function buildSyntheticExecuteWritebackApiRoute(input: {
  pattern: string;
  policy: PermissionPolicy;
  resolveSubject: ResolveSubject;
  execute: () => void;
}): ExtensionApiRoute {
  return createPermissionedExtensionApiRoute({
    method: "POST",
    pattern: input.pattern,
    actionName: "case.execute_writeback",
    policy: input.policy,
    resolveSubject: input.resolveSubject,
    resource: {
      kind: "case_record",
      workspaceId: "workspace-1",
      extensionKey: "case-management-sample",
      packKey: "case-management-sample",
      dataClassifications: ["workspace_internal"],
    },
    handler: async () => {
      input.execute();
      return Response.json({ executed: true });
    },
  });
}
