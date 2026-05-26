/**
 * Helm Agentic Governance — Connector Permission Summary
 *
 * Offline contract for admin-visible connector permission summaries. This is
 * not an IAM plane, connector runtime, settings UI, or credential store.
 */

export type ConnectorPermissionProvider =
  | "hubspot"
  | "salesforce"
  | "gmail"
  | "alimail"
  | "dingtalk"
  | "wecom";

export type ConnectorCredentialPosture =
  | "configured"
  | "missing"
  | "placeholder"
  | "expired"
  | "unknown";

export type ConnectorSyncPosture =
  | "ready"
  | "degraded"
  | "dry_run_only"
  | "blocked"
  | "unknown";

export interface ConnectorPermissionSummary {
  readonly providerId: ConnectorPermissionProvider;
  readonly displayName: string;
  readonly dataScopes: readonly string[];
  readonly autoAllowed: readonly string[];
  readonly reviewRequired: readonly string[];
  readonly neverAllowed: readonly string[];
  readonly credentialPosture: ConnectorCredentialPosture;
  readonly syncPosture: ConnectorSyncPosture;
  readonly boundaryNote: string;
}

export interface ConnectorPermissionSummaryIssue {
  readonly providerId: ConnectorPermissionProvider;
  readonly code:
    | "missing_data_scope"
    | "missing_review_lane"
    | "missing_never_lane"
    | "missing_boundary_note"
    | "high_risk_auto_allowed"
    | "customer_visible_not_review_required";
  readonly detail: string;
}

export interface ConnectorPermissionSummaryEval {
  readonly totalSummaries: number;
  readonly issueCount: number;
  readonly directSendAutoAllowed: number;
  readonly crmWriteAutoAllowed: number;
  readonly paymentAutoAllowed: number;
  readonly allSummariesHaveThreeLanes: boolean;
  readonly allCustomerVisibleActionsRequireReview: boolean;
  readonly issues: readonly ConnectorPermissionSummaryIssue[];
  readonly overallPassed: boolean;
}

export const REQUIRED_CONNECTOR_PERMISSION_PROVIDERS = [
  "hubspot",
  "salesforce",
  "gmail",
  "alimail",
  "dingtalk",
  "wecom",
] as const satisfies readonly ConnectorPermissionProvider[];

export const CONNECTOR_PERMISSION_SUMMARIES: readonly ConnectorPermissionSummary[] = [
  {
    providerId: "hubspot",
    displayName: "HubSpot",
    dataScopes: ["company", "deal", "contact", "activity"],
    autoAllowed: ["read source records", "prepare operating signals"],
    reviewRequired: ["CRM stage write", "customer-visible follow-up draft"],
    neverAllowed: ["send customer message automatically", "commit pricing", "approve contract"],
    credentialPosture: "configured",
    syncPosture: "ready",
    boundaryNote: "HubSpot remains read-first; official writes require operator review.",
  },
  {
    providerId: "salesforce",
    displayName: "Salesforce",
    dataScopes: ["account", "opportunity", "contact", "activity"],
    autoAllowed: ["read mock or configured source records", "prepare review packet evidence"],
    reviewRequired: ["CRM stage write", "account handoff draft"],
    neverAllowed: ["silent CRM write", "send customer message automatically", "commit discount"],
    credentialPosture: "placeholder",
    syncPosture: "dry_run_only",
    boundaryNote: "Salesforce output can shape evidence, not final commitment or silent write.",
  },
  {
    providerId: "gmail",
    displayName: "Gmail",
    dataScopes: ["thread", "sender", "timestamp", "message excerpt"],
    autoAllowed: ["read synced threads", "prepare reply draft"],
    reviewRequired: ["send email", "customer-visible reply", "commitment wording"],
    neverAllowed: ["auto-send email", "approve commercial terms", "delete mailbox content"],
    credentialPosture: "configured",
    syncPosture: "ready",
    boundaryNote: "Gmail drafts stay review-first; Helm never sends without explicit user action.",
  },
  {
    providerId: "alimail",
    displayName: "AliMail",
    dataScopes: ["thread", "sender", "timestamp", "message excerpt"],
    autoAllowed: ["read synced threads", "prepare reply draft"],
    reviewRequired: ["send email", "customer-visible reply", "commitment wording"],
    neverAllowed: ["auto-send email", "approve commercial terms", "delete mailbox content"],
    credentialPosture: "configured",
    syncPosture: "ready",
    boundaryNote: "AliMail drafts stay review-first; system SMTP still requires explicit send.",
  },
  {
    providerId: "dingtalk",
    displayName: "DingTalk",
    dataScopes: ["directory", "workspace membership", "meeting metadata"],
    autoAllowed: ["read directory", "prepare invitation or meeting context"],
    reviewRequired: ["send invite", "directory mutation", "customer-visible message"],
    neverAllowed: ["auto-invite member", "auto-send external message", "approve access escalation"],
    credentialPosture: "configured",
    syncPosture: "ready",
    boundaryNote: "DingTalk connector keeps invite and message authority behind review.",
  },
  {
    providerId: "wecom",
    displayName: "WeCom",
    dataScopes: ["OAuth profile", "meeting metadata", "workspace membership"],
    autoAllowed: ["read OAuth callback state", "prepare meeting evidence"],
    reviewRequired: ["send message", "directory mutation", "customer-visible message"],
    neverAllowed: ["auto-send message", "auto-approve member", "silent external write"],
    credentialPosture: "placeholder",
    syncPosture: "dry_run_only",
    boundaryNote: "WeCom remains alpha and review-first; message/send capability is not granted.",
  },
];

const HIGH_RISK_AUTO_PATTERNS = [
  /send/i,
  /auto-send/i,
  /crm stage write/i,
  /silent crm write/i,
  /approve/i,
  /settle/i,
  /payment/i,
  /commit/i,
  /external write/i,
];

export function validateConnectorPermissionSummary(
  summary: ConnectorPermissionSummary,
): readonly ConnectorPermissionSummaryIssue[] {
  const issues: ConnectorPermissionSummaryIssue[] = [];

  if (summary.dataScopes.length === 0) {
    issues.push({
      providerId: summary.providerId,
      code: "missing_data_scope",
      detail: "Connector summary must declare at least one readable data scope.",
    });
  }
  if (summary.reviewRequired.length === 0) {
    issues.push({
      providerId: summary.providerId,
      code: "missing_review_lane",
      detail: "Connector summary must declare the review_required lane.",
    });
  }
  if (summary.neverAllowed.length === 0) {
    issues.push({
      providerId: summary.providerId,
      code: "missing_never_lane",
      detail: "Connector summary must declare the never_allowed lane.",
    });
  }
  if (summary.boundaryNote.trim() === "") {
    issues.push({
      providerId: summary.providerId,
      code: "missing_boundary_note",
      detail: "Connector summary must include a boundary note.",
    });
  }

  for (const action of summary.autoAllowed) {
    if (HIGH_RISK_AUTO_PATTERNS.some((pattern) => pattern.test(action))) {
      issues.push({
        providerId: summary.providerId,
        code: "high_risk_auto_allowed",
        detail: `High-risk action appears in auto_allowed: ${action}.`,
      });
    }
  }

  const reviewLane = summary.reviewRequired.join("\n");
  if (!/customer-visible|send|reply|message|invite|crm stage write/i.test(reviewLane)) {
    issues.push({
      providerId: summary.providerId,
      code: "customer_visible_not_review_required",
      detail: "Connector summary must keep customer-visible or official-write actions in review_required.",
    });
  }

  return issues;
}

export function runConnectorPermissionSummaryEval(): ConnectorPermissionSummaryEval {
  const providerCoverageIssues = REQUIRED_CONNECTOR_PERMISSION_PROVIDERS.flatMap((providerId) =>
    CONNECTOR_PERMISSION_SUMMARIES.some((summary) => summary.providerId === providerId)
      ? []
      : [{
          providerId,
          code: "missing_data_scope" as const,
          detail: "Required connector provider is missing from permission summaries.",
        }],
  );
  const issues = [
    ...providerCoverageIssues,
    ...CONNECTOR_PERMISSION_SUMMARIES.flatMap(validateConnectorPermissionSummary),
  ];
  const directSendAutoAllowed = CONNECTOR_PERMISSION_SUMMARIES.some((summary) =>
    summary.autoAllowed.some((action) => /send/i.test(action)),
  )
    ? 1
    : 0;
  const crmWriteAutoAllowed = CONNECTOR_PERMISSION_SUMMARIES.some((summary) =>
    summary.autoAllowed.some((action) => /crm stage write|silent crm write/i.test(action)),
  )
    ? 1
    : 0;
  const paymentAutoAllowed = CONNECTOR_PERMISSION_SUMMARIES.some((summary) =>
    summary.autoAllowed.some((action) => /payment|settle/i.test(action)),
  )
    ? 1
    : 0;

  return {
    totalSummaries: CONNECTOR_PERMISSION_SUMMARIES.length,
    issueCount: issues.length,
    directSendAutoAllowed,
    crmWriteAutoAllowed,
    paymentAutoAllowed,
    allSummariesHaveThreeLanes: CONNECTOR_PERMISSION_SUMMARIES.every(
      (summary) =>
        summary.autoAllowed.length > 0 &&
        summary.reviewRequired.length > 0 &&
        summary.neverAllowed.length > 0,
    ),
    allCustomerVisibleActionsRequireReview: !issues.some(
      (issue) => issue.code === "customer_visible_not_review_required",
    ),
    issues,
    overallPassed:
      issues.length === 0 &&
      directSendAutoAllowed === 0 &&
      crmWriteAutoAllowed === 0 &&
      paymentAutoAllowed === 0,
  };
}
