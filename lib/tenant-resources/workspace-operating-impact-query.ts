import "server-only";

import type { WorkspaceClass, WorkspaceRole } from "@prisma/client";
import { db } from "@/lib/db";
import { buildTenantExtensionResourceAdoptionReadouts } from "@/lib/tenant-resources/extension-adoption";
import { toTenantResourceExtensionManifestInput } from "@/lib/tenant-resources/extension-manifest";
import { listTenantResourceManualProofRecords } from "@/lib/tenant-resources/manual-proof-runtime";
import {
  buildTenantResourceOperatingImpactReadout,
  type TenantResourceOperatingImpactReadout,
} from "@/lib/tenant-resources/operating-impact";
import { buildTenantResourceReadiness } from "@/lib/tenant-resources/readiness";

export async function getWorkspaceTenantResourceOperatingImpactReadout(input: {
  workspaceId: string;
  actorUserId?: string | null;
  workspaceClass?: WorkspaceClass | null;
  membershipRole?: WorkspaceRole | null;
  english: boolean;
}): Promise<TenantResourceOperatingImpactReadout> {
  const [
    connectorRows,
    importSources,
    recentImportJobs,
    workspaceSolutionExtensions,
    recentCaptureSessions,
    manualProofRecords,
  ] = await Promise.all([
    db.connector.findMany({
      where: { workspaceId: input.workspaceId },
      select: {
        id: true,
        workspaceId: true,
        provider: true,
        status: true,
        externalAccountEmail: true,
        manualSendEnabled: true,
        lastSyncedAt: true,
        lastSyncStatus: true,
        lastSyncMessage: true,
        tokenExpiresAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 24,
    }),
    db.importSource.findMany({
      where: { workspaceId: input.workspaceId },
      select: {
        id: true,
        workspaceId: true,
        sourceType: true,
        sourceName: true,
        status: true,
        lastSyncedAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 24,
    }),
    db.importJob.findMany({
      where: { workspaceId: input.workspaceId },
      select: {
        id: true,
        sourceId: true,
        status: true,
        totalRecords: true,
        successRecords: true,
        failedRecords: true,
        warningRecords: true,
        finishedAt: true,
        errorSummary: true,
        startedAt: true,
      },
      orderBy: [{ startedAt: "desc" }],
      take: 24,
    }),
    db.workspaceSolutionExtension.findMany({
      where: { workspaceId: input.workspaceId },
      select: {
        id: true,
        workspaceId: true,
        extensionKey: true,
        kind: true,
        status: true,
        version: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 24,
    }),
    db.captureSession.findMany({
      where: { workspaceId: input.workspaceId },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        status: true,
        sourceType: true,
        transcriptStatus: true,
        processingStatus: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 12,
    }),
    listTenantResourceManualProofRecords(input.workspaceId),
  ]);
  const extensionManifestInputs = workspaceSolutionExtensions
    .map((extension) => toTenantResourceExtensionManifestInput(extension.extensionKey))
    .filter(isDefined);
  const readiness = buildTenantResourceReadiness({
    connectors: connectorRows,
    importSources,
    importJobs: recentImportJobs,
    extensions: workspaceSolutionExtensions,
    extensionManifests: extensionManifestInputs,
    captureSessions: recentCaptureSessions,
  });
  const extensionAdoptionReadouts = buildTenantExtensionResourceAdoptionReadouts({
    readiness,
    extensionManifests: extensionManifestInputs,
  });

  return buildTenantResourceOperatingImpactReadout({
    english: input.english,
    readiness,
    extensionAdoptionReadouts,
    manualProofRecords,
    actorUserId: input.actorUserId,
    activeWorkspaceId: input.workspaceId,
    workspaceClass: input.workspaceClass,
    membershipRole: input.membershipRole,
    now: new Date(readiness.generatedAt),
  });
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
