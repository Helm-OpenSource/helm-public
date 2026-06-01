import "server-only";

import { cookies } from "next/headers";
import {
  resolveWorkspaceUiLocale,
  type UiLocale,
  type WorkspaceUiLocaleResolutionInput,
  UI_LOCALE_COOKIE,
} from "@/lib/i18n/config";

type ServerWorkspaceUiLocaleInput = Omit<
  WorkspaceUiLocaleResolutionInput,
  "requestLocale" | "deploymentProfileDefaultLocale"
> & {
  deploymentProfileDefaultLocale?: string | null;
};

function isMissingRequestScopeError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("outside a request scope")
  );
}

export async function getRequestUiLocaleCandidate() {
  try {
    return (await cookies()).get(UI_LOCALE_COOKIE)?.value ?? null;
  } catch (error) {
    if (isMissingRequestScopeError(error)) {
      return null;
    }
    throw error;
  }
}

export function getDeploymentProfileDefaultLocaleCandidate() {
  return process.env.HELM_DEFAULT_LOCALE ?? null;
}

export async function resolveRequestUiLocale(): Promise<UiLocale> {
  const requestLocale = await getRequestUiLocaleCandidate();

  return resolveWorkspaceUiLocale({
    requestLocale,
    deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
  });
}

export async function resolveWorkspaceUiLocaleForRequest(
  input: ServerWorkspaceUiLocaleInput = {},
): Promise<UiLocale> {
  const requestLocale = await getRequestUiLocaleCandidate();

  return resolveWorkspaceUiLocale({
    ...input,
    requestLocale,
    deploymentProfileDefaultLocale:
      input.deploymentProfileDefaultLocale ??
      getDeploymentProfileDefaultLocaleCandidate(),
  });
}
