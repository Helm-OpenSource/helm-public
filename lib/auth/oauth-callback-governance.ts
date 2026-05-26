import { WorkspaceRole } from "@prisma/client";
import {
  canManageWorkspaceConnectors,
  canManageWorkspaceImports,
  getConnectorManagementDeniedMessage,
  getImportManagementDeniedMessage,
  getWorkspaceRoleForUser,
} from "@/lib/auth/import-governance";

type CallbackCapability = "connectors" | "imports";

type OAuthCallbackState = {
  state: string;
  userId: string;
  workspaceId: string;
  provider?: string;
};

type OAuthCallbackUser = {
  id: string;
  name: string;
};

export type WorkspaceOauthCallbackContext =
  | {
      ok: false;
      status: "missing-state" | "invalid-state" | "forbidden";
      message?: string;
    }
  | {
      ok: true;
      workspaceId: string;
      userId: string;
      role: WorkspaceRole;
      user: OAuthCallbackUser;
    };

function parseCallbackState(rawState: string | null): OAuthCallbackState | null {
  if (!rawState) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawState) as OAuthCallbackState;

    if (
      typeof parsed.state !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.workspaceId !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function canManageWorkspaceCallback(capability: CallbackCapability, role: WorkspaceRole | null) {
  return capability === "connectors"
    ? canManageWorkspaceConnectors(role)
    : canManageWorkspaceImports(role);
}

function getDeniedMessage(capability: CallbackCapability, english: boolean) {
  return capability === "connectors"
    ? getConnectorManagementDeniedMessage(english)
    : getImportManagementDeniedMessage(english);
}

export async function resolveWorkspaceOauthCallbackContext(input: {
  rawState: string | null;
  stateParam: string | null;
  currentUser: OAuthCallbackUser | null;
  capability: CallbackCapability;
  english: boolean;
}): Promise<WorkspaceOauthCallbackContext> {
  if (!input.rawState || !input.stateParam) {
    return {
      ok: false,
      status: "missing-state",
    };
  }

  const parsedState = parseCallbackState(input.rawState);

  if (
    !parsedState ||
    !input.currentUser ||
    parsedState.state !== input.stateParam ||
    parsedState.userId !== input.currentUser.id
  ) {
    return {
      ok: false,
      status: "invalid-state",
    };
  }

  const role = await getWorkspaceRoleForUser({
    workspaceId: parsedState.workspaceId,
    userId: parsedState.userId,
  });

  if (!role || !canManageWorkspaceCallback(input.capability, role)) {
    return {
      ok: false,
      status: "forbidden",
      message: getDeniedMessage(input.capability, input.english),
    };
  }

  return {
    ok: true,
    workspaceId: parsedState.workspaceId,
    userId: parsedState.userId,
    role,
    user: input.currentUser,
  };
}
