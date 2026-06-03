"use server";

import { revalidatePath } from "next/cache";
import { ActorType, ImportSourceStatus, ImportSourceType } from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import {
  canManageWorkspaceImports,
  getImportManagementDeniedMessage,
} from "@/lib/auth/import-governance";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { connectMockHubSpotSource } from "@/lib/connectors/hubspot";
import { connectMockSalesforceSource } from "@/lib/connectors/salesforce";
import { db } from "@/lib/db";

export async function connectMockCrmSourceAction(sourceType: "HUBSPOT" | "SALESFORCE") {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceImports(session.membership.role)) {
    return {
      ok: false,
      error: getImportManagementDeniedMessage(english),
    };
  }

  const source =
    sourceType === "HUBSPOT"
      ? await connectMockHubSpotSource({
          workspaceId: workspace.id,
          userId: user.id,
        })
      : await connectMockSalesforceSource({
          workspaceId: workspace.id,
          userId: user.id,
        });

  await logEvent({
    workspaceId: workspace.id,
    userId: user.id,
    eventName: "connector_connected",
    eventCategory: "connector",
    targetType: "ImportSource",
    targetId: source.id,
    metadata: {
      provider: source.sourceType,
      usedMock: true,
      externalAccountLabel: source.externalAccountLabel,
    },
    sourcePage: "/imports/crm",
  });
  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "IMPORT_SOURCE_CONNECTED",
    targetType: "ImportSource",
    targetId: source.id,
    summary: `Connected ${source.sourceType} import source ${source.externalAccountLabel ?? source.sourceName}`,
    payload: {
      sourceType: source.sourceType,
      usedMock: true,
      externalAccountLabel: source.externalAccountLabel,
    },
    sourcePage: "/imports/crm",
  });

  revalidatePath("/imports");
  revalidatePath("/imports/crm");
  revalidatePath("/settings");

  return {
    ok: true,
    sourceId: source.id,
  };
}

export async function disconnectCrmSourceAction(sourceId: string) {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceImports(session.membership.role)) {
    return {
      ok: false,
      error: getImportManagementDeniedMessage(english),
    };
  }

  const source = await db.importSource.findFirst({
    where: {
      id: sourceId,
      workspaceId: workspace.id,
      sourceType: {
        in: [ImportSourceType.HUBSPOT, ImportSourceType.SALESFORCE],
      },
    },
  });

  if (!source) {
    return {
      ok: false,
      error: "客户关系系统导入来源不存在",
    };
  }

  await db.importSource.update({
    where: { id: source.id },
    data: {
      status: ImportSourceStatus.DISCONNECTED,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    },
  });

  revalidatePath("/imports");
  revalidatePath("/imports/crm");
  revalidatePath("/settings");
  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "IMPORT_SOURCE_DISCONNECTED",
    targetType: "ImportSource",
    targetId: source.id,
    summary: `Disconnected ${source.sourceType} import source ${source.externalAccountLabel ?? source.sourceName}`,
    payload: {
      sourceType: source.sourceType,
      externalAccountLabel: source.externalAccountLabel,
    },
    sourcePage: "/imports/crm",
  });

  return {
    ok: true,
  };
}
