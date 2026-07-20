export type PublicOperatingIdentityEnv = {
  HELM_PUBLIC_OPERATOR_DISPLAY_NAME?: string;
  HELM_PUBLIC_OPERATOR_LEGAL_NAME?: string;
  HELM_PUBLIC_OPERATOR_REGISTRATION_VERIFIED?: string;
};

export type PublicOperatingIdentity = {
  productBrand: "Helm";
  operatorDisplayName: string;
  legalName: string | null;
  legalRegistrationVerified: boolean;
};

const DEFAULT_OPERATOR_DISPLAY_NAME = "Helm deployment operator";
const MAX_DISPLAY_NAME_LENGTH = 120;
const MAX_LEGAL_NAME_LENGTH = 200;

function optionalBoundedValue(
  name: keyof PublicOperatingIdentityEnv,
  value: string | undefined,
  maxLength: number,
) {
  const normalized = value?.trim() ?? "";
  if (normalized.length > maxLength) {
    throw new Error(`${name} exceeds ${maxLength} characters`);
  }
  if (/[\u0000-\u001F\u007F]/u.test(normalized)) {
    throw new Error(`${name} contains control characters`);
  }
  return normalized || null;
}

export function resolvePublicOperatingIdentity(
  env: PublicOperatingIdentityEnv,
): PublicOperatingIdentity {
  const operatorDisplayName =
    optionalBoundedValue(
      "HELM_PUBLIC_OPERATOR_DISPLAY_NAME",
      env.HELM_PUBLIC_OPERATOR_DISPLAY_NAME,
      MAX_DISPLAY_NAME_LENGTH,
    ) ?? DEFAULT_OPERATOR_DISPLAY_NAME;
  const configuredLegalName = optionalBoundedValue(
    "HELM_PUBLIC_OPERATOR_LEGAL_NAME",
    env.HELM_PUBLIC_OPERATOR_LEGAL_NAME,
    MAX_LEGAL_NAME_LENGTH,
  );
  const configuredVerification = env.HELM_PUBLIC_OPERATOR_REGISTRATION_VERIFIED;
  const verificationValue =
    configuredVerification === undefined || configuredVerification === ""
      ? "false"
      : configuredVerification;

  if (verificationValue !== "true" && verificationValue !== "false") {
    throw new Error("HELM_PUBLIC_OPERATOR_REGISTRATION_VERIFIED must be true or false");
  }

  const legalRegistrationVerified = verificationValue === "true";
  if (legalRegistrationVerified && !configuredLegalName) {
    throw new Error(
      "HELM_PUBLIC_OPERATOR_LEGAL_NAME is required when registration is verified",
    );
  }

  return {
    productBrand: "Helm",
    operatorDisplayName,
    legalName: legalRegistrationVerified ? configuredLegalName : null,
    legalRegistrationVerified,
  };
}
