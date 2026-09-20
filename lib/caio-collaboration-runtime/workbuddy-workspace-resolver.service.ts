import "server-only";

type WorkspaceLookup = Readonly<{
  workspace: Readonly<{
    findUnique(input: {
      where: { systemKey: string };
      select: { id: true; status: true };
    }): Promise<Readonly<{
      id: string;
      status: string;
    }> | null>;
  }>;
}>;

export function createWorkBuddyWorkspaceIdResolver(input: {
  database: WorkspaceLookup;
}): (systemKey: string) => Promise<string | null> {
  return async (systemKey): Promise<string | null> => {
    if (!/^[a-z][a-z0-9_-]{0,99}$/.test(systemKey)) {
      throw new Error("workbuddy_workspace_system_key_invalid");
    }
    const workspace = await input.database.workspace.findUnique({
      where: { systemKey },
      select: { id: true, status: true },
    });
    if (!workspace || workspace.status !== "ACTIVE") {
      return null;
    }
    return workspace.id;
  };
}
