/** Absence preserves existing deployments; malformed explicit configuration fails closed. */
export function canSelfCreateOrganization(mode = process.env.HELM_ORGANIZATION_CREATION_MODE) {
  return mode === undefined || mode === "self-service";
}
