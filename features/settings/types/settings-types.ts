import type { IdentityMatchStatus } from "@prisma/client";

export type OrganizationGovernanceAuditMarker = {
  createdAt: Date;
  actionType: string;
  summary: string;
  actor: string;
  targetType: string;
  targetId: string;
  sourcePage: string | null;
} | null;

export type OrganizationWebhookCallbackMarker = {
  recordedAt: Date;
  governanceStatus: string;
  summary: string;
  provider: string;
  callbackMode: string;
  resolutionSource: string | null;
  hintSource: string | null;
  hintWorkspaceId: string | null;
  workspaceScoped: boolean;
} | null;

export type OrganizationIdentityMatchMarker = {
  recordedAt: Date;
  status: IdentityMatchStatus;
  reason: string | null;
  externalType: string;
  externalId: string;
  internalObjectType: string | null;
  internalObjectId: string | null;
  matchScore: number;
} | null;

export type FormalReviewChecklistState = {
  catalogPatchReady: boolean;
  testsReady: boolean;
  guardsReady: boolean;
  docsReady: boolean;
  boundaryConfirmed: boolean;
};

export type SettingsTab =
  | "account"
  | "billing"
  | "connectors"
  | "policies"
  | "budgets"
  | "permissions"
  | "pilot";

export function resolveInitialSettingsTab(value: string | null | undefined): SettingsTab {
  if (
    value === "account" ||
    value === "billing" ||
    value === "connectors" ||
    value === "policies" ||
    value === "budgets" ||
    value === "permissions" ||
    value === "pilot"
  ) {
    return value;
  }

  return "account";
}

export type SettingsConnectorCallbackStatus =
  | "SUCCESS"
  | "FAILURE"
  | "UNRESOLVED"
  | "MISMATCH";

export type SettingsConnectorFailurePosture =
  | "CLEAR"
  | "RETRYABLE"
  | "REVIEW_REQUIRED";

export type SettingsConnectorIngestStatus =
  | "SUCCESS"
  | "PARTIAL"
  | "FAILURE"
  | "UNRESOLVED";

export type SettingsConnectorIngestScope =
  | "MEETINGS"
  | "CALENDAR"
  | "BITABLE"
  | "TODO"
  | "PROJECTS"
  | "MANAGEMENT"
  | "WORK"
  | "MESSAGE_NOTIFICATIONS";

export type SettingsConnectorIngestScopeStatus =
  | "INGESTED"
  | "UNRESOLVED"
  | "FAILED";

export type SettingsConnectorValidationStatus =
  | "SUCCESS"
  | "PARTIAL"
  | "FAILURE"
  | "UNRESOLVED";

export type SettingsConnectorSummary = {
  lastCallbackResult?: {
    status: SettingsConnectorCallbackStatus;
    failurePosture: SettingsConnectorFailurePosture;
  } | null;
  lastIngestResult?: {
    status: SettingsConnectorIngestStatus;
    failurePosture: SettingsConnectorFailurePosture;
    scopeResults: Array<{
      scope: SettingsConnectorIngestScope;
      status: SettingsConnectorIngestScopeStatus;
    }>;
  } | null;
  calendarRegistry?: {
    boundCalendars: Array<{
      calendarId: string;
    }>;
    lastValidationResult: {
      status: SettingsConnectorValidationStatus;
    } | null;
  } | null;
} | null;

export type SettingsConnectorState = {
  tab?: string;
  connector?: string;
  status?: string;
  message?: string;
};
