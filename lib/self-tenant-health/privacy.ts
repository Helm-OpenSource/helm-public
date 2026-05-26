import { createHmac, randomBytes } from "node:crypto";
import { WorkspaceClass, WorkspaceStatus } from "@prisma/client";
import { canAccessTenantHealthWorkspace } from "@/lib/workspace-identity";

export const TENANT_HEALTH_TELEMETRY_DENYLIST = [
  "inputSummary",
  "outputSummary",
  "signalSummary",
  "normalizedPayload",
  "payload",
  "summary",
  "sourceQuery",
  "prompt",
  "rawOutput",
  "meetingTitle",
  "customerName",
  "companyName",
  "contactName",
  "opportunityName",
  "email",
  "phone",
] as const;

const processLocalAliasSalt =
  process.env.HELM_TENANT_HEALTH_ALIAS_SALT || randomBytes(32).toString("hex");

export type TenantHealthAccessWorkspace = {
  workspaceClass?: WorkspaceClass | null;
  slug?: string | null;
  systemKey?: string | null;
  status?: WorkspaceStatus | null;
};

export class TenantHealthAccessDeniedError extends Error {
  constructor() {
    super("Tenant health telemetry is restricted to approved internal operating workspaces.");
    this.name = "TenantHealthAccessDeniedError";
  }
}

export function assertHelmReservedTenantHealthAccess(
  workspace: TenantHealthAccessWorkspace | null | undefined,
) {
  if (!canAccessTenantHealthWorkspace(workspace) || workspace?.status === WorkspaceStatus.CANCELED) {
    throw new TenantHealthAccessDeniedError();
  }
}

export function assertTenantHealthAccess(workspace: TenantHealthAccessWorkspace | null | undefined) {
  assertHelmReservedTenantHealthAccess(workspace);
}

export function createTenantAliasHash(workspaceId: string, salt = processLocalAliasSalt) {
  return createHmac("sha256", salt)
    .update(`helm-tenant-health:${workspaceId}`)
    .digest("hex");
}

export function createTenantAlias(workspaceId: string, salt?: string) {
  return `tenant_${createTenantAliasHash(workspaceId, salt).slice(0, 8)}`;
}

export function assertTelemetryProjectionIsSafe(value: Record<string, unknown>) {
  const forbiddenKeys = TENANT_HEALTH_TELEMETRY_DENYLIST.filter((key) =>
    Object.prototype.hasOwnProperty.call(value, key),
  );
  if (forbiddenKeys.length > 0) {
    throw new Error(`Unsafe tenant health telemetry field(s): ${forbiddenKeys.join(", ")}`);
  }
}

export function suppressSmallCount(value: number, minimumVisibleCount = 5) {
  if (value <= 0) return "0";
  return value < minimumVisibleCount ? "<5" : String(value);
}

export function isSmallSample(value: number, minimumVisibleCount = 5) {
  return value > 0 && value < minimumVisibleCount;
}
