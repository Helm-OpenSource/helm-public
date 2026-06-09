import { MembershipStatus, WorkspaceRole } from "@prisma/client";

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

type SyntheticCaseFieldRedaction = {
  field: "contact" | "balance" | "legalNotes";
  redaction: "alias_only" | "raw_private_rejected";
};

type SyntheticReadPathStepName =
  | "session"
  | "workspace"
  | "permission_decision"
  | "row_filter"
  | "field_redaction"
  | "audit_receipt";

export type SyntheticPermissionReadAuditReceipt = {
  readonly receiptKind: "helm.synthetic-permission-read.receipt/v1";
  readonly traceId: string;
  readonly policyVersion: string;
  readonly dataMode: "public_safe_synthetic";
  readonly steps: readonly {
    readonly name: SyntheticReadPathStepName;
    readonly status: "completed";
  }[];
  readonly session: {
    readonly source: "session";
    readonly sessionId: string;
    readonly actorType: PermissionSubject["actorType"];
  };
  readonly workspace: {
    readonly workspaceId: string;
  };
  readonly permissionDecision: {
    readonly effect: PermissionDecision["effect"];
    readonly actionName: string;
    readonly source: PermissionDecision["source"];
    readonly obligations: readonly string[];
  };
  readonly rowFilter: {
    readonly workspaceId: string;
    readonly allowedQueues: readonly SyntheticCaseQueue[];
    readonly returnedRowIds: readonly string[];
    readonly filteredOutRowCount: number;
  };
  readonly fieldRedactions: readonly SyntheticCaseFieldRedaction[];
  readonly sideEffects: {
    readonly writebackExecuted: false;
    readonly externalSend: false;
    readonly customerMutation: false;
  };
};

const SYNTHETIC_SESSION_ID_HEADER = "x-helm-synthetic-session-id";
const SYNTHETIC_WORKSPACE_ID_HEADER = "x-helm-workspace-id";

const SYNTHETIC_CASE_FIELD_REDACTIONS: readonly SyntheticCaseFieldRedaction[] = [
  {
    field: "contact",
    redaction: PERMISSION_DATA_CLASSIFICATION_DEFAULT_REDACTION.personal_contact,
  },
  {
    field: "balance",
    redaction: PERMISSION_DATA_CLASSIFICATION_DEFAULT_REDACTION.financial_data,
  },
  {
    field: "legalNotes",
    redaction: PERMISSION_DATA_CLASSIFICATION_DEFAULT_REDACTION.legal_sensitive,
  },
];

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

function nonEmptyHeader(request: Request, headerName: string): string | null {
  const value = request.headers.get(headerName)?.trim();
  return value && value.length > 0 ? value : null;
}

export function resolveSyntheticReadSubjectFromRequest(request: Request): PermissionSubject | null {
  const sessionId = nonEmptyHeader(request, SYNTHETIC_SESSION_ID_HEADER);
  const workspaceId = nonEmptyHeader(request, SYNTHETIC_WORKSPACE_ID_HEADER);
  if (!sessionId || !workspaceId) return null;

  return {
    actorType: "user",
    workspaceId,
    userId: "synthetic-user",
    membershipId: `synthetic-membership:${sessionId}`,
    membershipStatus: MembershipStatus.ACTIVE,
    workspaceRole: WorkspaceRole.MEMBER,
    rolePresetKey: "synthetic-reader",
    policyVersion: "permission-policy/v1",
    auditSource: "session",
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

function buildSyntheticReadAuditReceipt(input: {
  request: Request;
  decision: PermissionDecision;
  allowedQueues: readonly SyntheticCaseQueue[];
  visibleRows: readonly SyntheticCaseRow[];
}): SyntheticPermissionReadAuditReceipt {
  const workspaceId = input.decision.actor?.workspaceId ?? input.decision.resource.workspaceId;
  const sessionId =
    nonEmptyHeader(input.request, SYNTHETIC_SESSION_ID_HEADER) ??
    "synthetic-session-unresolved";

  return {
    receiptKind: "helm.synthetic-permission-read.receipt/v1",
    traceId: input.decision.traceId,
    policyVersion: input.decision.policyVersion,
    dataMode: "public_safe_synthetic",
    steps: [
      { name: "session", status: "completed" },
      { name: "workspace", status: "completed" },
      { name: "permission_decision", status: "completed" },
      { name: "row_filter", status: "completed" },
      { name: "field_redaction", status: "completed" },
      { name: "audit_receipt", status: "completed" },
    ],
    session: {
      source: "session",
      sessionId,
      actorType: input.decision.actor?.actorType ?? "system",
    },
    workspace: {
      workspaceId,
    },
    permissionDecision: {
      effect: input.decision.effect,
      actionName: input.decision.action.name,
      source: input.decision.source,
      obligations: input.decision.obligations ?? [],
    },
    rowFilter: {
      workspaceId,
      allowedQueues: input.allowedQueues,
      returnedRowIds: input.visibleRows.map((row) => row.caseId),
      filteredOutRowCount: SYNTHETIC_CASE_ROWS.length - input.visibleRows.length,
    },
    fieldRedactions: SYNTHETIC_CASE_FIELD_REDACTIONS,
    sideEffects: {
      writebackExecuted: false,
      externalSend: false,
      customerMutation: false,
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
      const allowedQueueList = [...input.allowedQueues];
      const allowedQueues = new Set(allowedQueueList);
      const visibleRows = SYNTHETIC_CASE_ROWS.filter(
        (row) =>
          row.workspaceId === actorWorkspaceId && allowedQueues.has(row.queue),
      );
      const rows = visibleRows.map(serializeSyntheticCaseRow);

      return Response.json({
        decision: publicDecision(context.permissionDecision),
        auditReceipt: buildSyntheticReadAuditReceipt({
          request: _request,
          decision: context.permissionDecision,
          allowedQueues: allowedQueueList,
          visibleRows,
        }),
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
