import "server-only";

import { resolvePublicOperatingIdentity } from "@/lib/public-operating-identity";

export function getPublicOperatingIdentity() {
  return resolvePublicOperatingIdentity({
    HELM_PUBLIC_OPERATOR_DISPLAY_NAME: process.env.HELM_PUBLIC_OPERATOR_DISPLAY_NAME,
    HELM_PUBLIC_OPERATOR_LEGAL_NAME: process.env.HELM_PUBLIC_OPERATOR_LEGAL_NAME,
    HELM_PUBLIC_OPERATOR_REGISTRATION_VERIFIED:
      process.env.HELM_PUBLIC_OPERATOR_REGISTRATION_VERIFIED,
  });
}
