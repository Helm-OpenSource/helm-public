import { AUTH_SESSION_PROVIDER_TYPES } from "./provider-seam";

/** Absent preserves legacy deployments. Explicit malformed configuration fails closed. */
export function isEmailEntryEnabled(environment: { HELM_AUTH_EMAIL_ENTRY_ENABLED?: string } = { HELM_AUTH_EMAIL_ENTRY_ENABLED: process.env.HELM_AUTH_EMAIL_ENTRY_ENABLED }) {
  const value = environment.HELM_AUTH_EMAIL_ENTRY_ENABLED;
  return value === undefined || value.trim().toLowerCase() === "true";
}

export function isSessionProviderAllowed(provider: string | null | undefined) {
  if (isEmailEntryEnabled()) return true;
  return typeof provider === "string" &&
    Object.values(AUTH_SESSION_PROVIDER_TYPES).some(value => value === provider && value !== AUTH_SESSION_PROVIDER_TYPES.EMAIL_ENTRY);
}
