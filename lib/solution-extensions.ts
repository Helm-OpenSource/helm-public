import { db } from "@/lib/db";

export async function getWorkspaceSolutionExtension(input: {
  workspaceId: string;
  extensionKey: string;
}) {
  try {
    return await db.workspaceSolutionExtension.findUnique({
      where: {
        workspaceId_extensionKey: {
          workspaceId: input.workspaceId,
          extensionKey: input.extensionKey,
        },
      },
      select: {
        workspaceId: true,
        extensionKey: true,
        status: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes(`relation "WorkspaceSolutionExtension" does not exist`) ||
      message.includes(`no such table: WorkspaceSolutionExtension`) ||
      (message.includes(`Table '`) && message.includes(`workspacesolutionextension' doesn't exist`))
    ) {
      return null;
    }
    throw error;
  }
}

export async function checkWorkspaceSolutionExtensionEnabled(input: {
  workspaceId: string;
  extensionKey: string;
}) {
  const workspace = await db.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { id: true },
  });

  if (!workspace) {
    return {
      ok: true as const,
      reason: "workspace_missing" as const,
    };
  }

  const checkedExtensionKeys = [input.extensionKey];
  const extension = await getWorkspaceSolutionExtension({
    workspaceId: input.workspaceId,
    extensionKey: input.extensionKey,
  });

  if (!extension) {
    return {
      ok: false as const,
      reason: "extension_not_enabled" as const,
      matchedExtensionKey: null,
      checkedExtensionKeys,
    };
  }

  if (extension.status !== "ACTIVE") {
    return {
      ok: false as const,
      reason: "extension_disabled" as const,
      matchedExtensionKey: input.extensionKey,
      checkedExtensionKeys,
    };
  }

  return {
    ok: true as const,
    reason: "enabled" as const,
    matchedExtensionKey: input.extensionKey,
    checkedExtensionKeys,
  };
}
