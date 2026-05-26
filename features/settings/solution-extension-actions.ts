"use server";

import {
  ActorType,
  WorkspaceSolutionExtensionStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import {
  canManageWorkspaceSetup,
  getWorkspaceGovernanceDeniedMessage,
} from "@/lib/auth/settings-governance";
import {
  getCurrentMembership,
  getCurrentWorkspace,
  requireCurrentUser,
} from "@/lib/auth/session";
import { db } from "@/lib/db";
import { SOLUTION_EXTENSION_CATALOG } from "@/lib/extensions/solution-extension-catalog";

const inputSchema = z.object({
  extensionKey: z.string().trim().min(1).max(120),
  enabled: z.boolean(),
});

export type SetWorkspaceSolutionExtensionStatusInput = z.infer<
  typeof inputSchema
>;

export type SetWorkspaceSolutionExtensionStatusResult =
  | {
      ok: true;
      extensionKey: string;
      status: WorkspaceSolutionExtensionStatus;
    }
  | {
      ok: false;
      error: string;
    };

export async function setWorkspaceSolutionExtensionStatusAction(
  input: SetWorkspaceSolutionExtensionStatusInput,
): Promise<SetWorkspaceSolutionExtensionStatusResult> {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Invalid extension toggle input" : "扩展启用参数错误",
    };
  }

  const catalogEntry = SOLUTION_EXTENSION_CATALOG.find(
    (entry) => entry.extensionKey === parsed.data.extensionKey,
  );
  if (!catalogEntry) {
    return {
      ok: false,
      error: english
        ? `Extension ${parsed.data.extensionKey} is not toggleable from settings`
        : `扩展 ${parsed.data.extensionKey} 不在可配置列表中`,
    };
  }

  if (!canManageWorkspaceSetup(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceGovernanceDeniedMessage(english),
    };
  }

  const before = await db.workspaceSolutionExtension.findUnique({
    where: {
      workspaceId_extensionKey: {
        workspaceId: workspace.id,
        extensionKey: catalogEntry.extensionKey,
      },
    },
    select: { status: true },
  });

  const nextStatus = parsed.data.enabled
    ? WorkspaceSolutionExtensionStatus.ACTIVE
    : WorkspaceSolutionExtensionStatus.DISABLED;

  await db.workspaceSolutionExtension.upsert({
    where: {
      workspaceId_extensionKey: {
        workspaceId: workspace.id,
        extensionKey: catalogEntry.extensionKey,
      },
    },
    update: {
      status: nextStatus,
      disabledAt:
        nextStatus === WorkspaceSolutionExtensionStatus.DISABLED
          ? new Date()
          : null,
    },
    create: {
      workspaceId: workspace.id,
      extensionKey: catalogEntry.extensionKey,
      kind: catalogEntry.kind,
      status: nextStatus,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "WORKSPACE_SOLUTION_EXTENSION_TOGGLED",
    targetType: "WorkspaceSolutionExtension",
    targetId: catalogEntry.extensionKey,
    summary: english
      ? `Set extension ${catalogEntry.extensionKey} to ${nextStatus}`
      : `已将扩展 ${catalogEntry.nameZh}（${catalogEntry.extensionKey}）状态设为 ${nextStatus}`,
    payload: {
      extensionKey: catalogEntry.extensionKey,
      kind: catalogEntry.kind,
      before: before?.status ?? null,
      after: nextStatus,
    },
    sourcePage: "/settings/extensions",
  });

  await logEvent({
    workspaceId: workspace.id,
    userId: user.id,
    eventName: "workspace_solution_extension_toggled",
    eventCategory: "settings",
    targetType: "WorkspaceSolutionExtension",
    targetId: catalogEntry.extensionKey,
    metadata: {
      extensionKey: catalogEntry.extensionKey,
      before: before?.status ?? null,
      after: nextStatus,
    },
    sourcePage: "/settings/extensions",
  });

  revalidatePath("/settings/extensions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/imports");

  return {
    ok: true,
    extensionKey: catalogEntry.extensionKey,
    status: nextStatus,
  };
}
