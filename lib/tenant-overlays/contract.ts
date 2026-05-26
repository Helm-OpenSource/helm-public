import { supportedUiLocales, type UiLocale } from "@/lib/i18n/config";
import {
  findForbiddenAuthorityKeyFragment,
  FORBIDDEN_AUTHORITY_KEY_FRAGMENTS,
  isAuthorityGrantValue,
} from "@/lib/shared/forbidden-authority-keys";

export const tenantOverlaySources = [
  "open_core_example",
  "deployment_config",
  "private_tenant_repo",
] as const;

export type TenantOverlaySource = (typeof tenantOverlaySources)[number];

export const tenantOverlayCapabilities = [
  "brand_theme",
  "copy_override",
  "locale_default",
  "extension_enablement",
  "connector_config_reference",
] as const;

export type TenantOverlayCapability = (typeof tenantOverlayCapabilities)[number];

export const tenantOverlayPoweredByHelmModes = [
  "default_visible",
  "customized_by_user",
  "contracted_white_label",
] as const;

export type TenantOverlayPoweredByHelmMode =
  (typeof tenantOverlayPoweredByHelmModes)[number];

export const tenantOverlayTrademarkGrantModes = [
  "none",
  "enterprise_contract",
  "opc_contract",
] as const;

export type TenantOverlayTrademarkGrantMode =
  (typeof tenantOverlayTrademarkGrantModes)[number];

export const tenantOverlayRefPrefixes = [
  "env://",
  "private-file://",
  "tenant-asset://",
  "vault://",
] as const;

export type TenantOverlayRefPrefix = (typeof tenantOverlayRefPrefixes)[number];

export const tenantOverlayForbiddenAuthorityKeys = FORBIDDEN_AUTHORITY_KEY_FRAGMENTS;

export type TenantOverlayForbiddenAuthorityKey =
  (typeof tenantOverlayForbiddenAuthorityKeys)[number];

export type TenantOverlayBranding = {
  productName?: string;
  logoAssetRef?: string;
  themeTokenSet?: string;
  poweredByHelm: {
    mode: TenantOverlayPoweredByHelmMode;
    trademarkGrant: TenantOverlayTrademarkGrantMode;
  };
};

export type TenantOverlayCopyOverride = {
  scope: "ui" | "email" | "report";
  key: string;
  locale: UiLocale;
  valueRef: string;
};

export type TenantOverlayDefinition = {
  tenantKey: string;
  displayName: string;
  source: TenantOverlaySource;
  capabilities: readonly TenantOverlayCapability[];
  locale: {
    defaultLocale: UiLocale;
    supportedLocales: readonly UiLocale[];
  };
  branding?: TenantOverlayBranding;
  enabledExtensionKeys?: readonly string[];
  connectorConfigRefs?: readonly string[];
  privateAssetRefs?: readonly string[];
  copyOverrides?: readonly TenantOverlayCopyOverride[];
  notes?: readonly string[];
};

export type TenantOverlayValidationIssue = {
  code:
    | "duplicate_value"
    | "forbidden_authority"
    | "invalid_branding"
    | "invalid_locale"
    | "invalid_ref"
    | "invalid_shape"
    | "invalid_source"
    | "invalid_value";
  path: string;
  message: string;
};

export type TenantOverlayValidationResult = {
  ok: boolean;
  issues: TenantOverlayValidationIssue[];
};

export type TenantOverlayLocaleResolutionInput = {
  requestLocale?: string | null;
  userLocale?: string | null;
  workspaceDefaultLocale?: string | null;
};

const tenantKeyPattern = /^[a-z][a-z0-9-]{1,63}$/;
const extensionKeyPattern = /^[a-z][a-z0-9-]{1,96}$/;
const copyOverrideKeyPattern = /^[a-z][a-z0-9_.:-]{1,160}$/;
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isUiLocale(value: unknown): value is UiLocale {
  return typeof value === "string" && supportedUiLocales.includes(value as UiLocale);
}

function isTenantOverlaySource(value: unknown): value is TenantOverlaySource {
  return (
    typeof value === "string" &&
    tenantOverlaySources.includes(value as TenantOverlaySource)
  );
}

function isTenantOverlayCapability(value: unknown): value is TenantOverlayCapability {
  return (
    typeof value === "string" &&
    tenantOverlayCapabilities.includes(value as TenantOverlayCapability)
  );
}

function isPoweredByHelmMode(value: unknown): value is TenantOverlayPoweredByHelmMode {
  return (
    typeof value === "string" &&
    tenantOverlayPoweredByHelmModes.includes(value as TenantOverlayPoweredByHelmMode)
  );
}

function isTrademarkGrantMode(value: unknown): value is TenantOverlayTrademarkGrantMode {
  return (
    typeof value === "string" &&
    tenantOverlayTrademarkGrantModes.includes(value as TenantOverlayTrademarkGrantMode)
  );
}

function addIssue(
  issues: TenantOverlayValidationIssue[],
  issue: TenantOverlayValidationIssue,
) {
  issues.push(issue);
}

function validateStringArray(
  issues: TenantOverlayValidationIssue[],
  value: unknown,
  path: string,
  options: {
    code?: TenantOverlayValidationIssue["code"];
    pattern?: RegExp;
    allowed?: readonly string[];
    allowEmpty?: boolean;
  } = {},
): string[] {
  if (!Array.isArray(value)) {
    addIssue(issues, {
      code: "invalid_shape",
      path,
      message: "Expected an array.",
    });
    return [];
  }

  const strings: string[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (typeof entry !== "string" || (!options.allowEmpty && !entry.trim())) {
      addIssue(issues, {
        code: options.code ?? "invalid_value",
        path: entryPath,
        message: "Expected a non-empty string.",
      });
      return;
    }

    if (options.pattern && !options.pattern.test(entry)) {
      addIssue(issues, {
        code: options.code ?? "invalid_value",
        path: entryPath,
        message: "String does not match the tenant overlay naming contract.",
      });
    }

    if (options.allowed && !options.allowed.includes(entry)) {
      addIssue(issues, {
        code: options.code ?? "invalid_value",
        path: entryPath,
        message: "String is not part of the allowed tenant overlay values.",
      });
    }

    if (seen.has(entry)) {
      addIssue(issues, {
        code: "duplicate_value",
        path: entryPath,
        message: `Duplicate value: ${entry}`,
      });
    }
    seen.add(entry);
    strings.push(entry);
  });
  return strings;
}

function validateRef(
  issues: TenantOverlayValidationIssue[],
  value: unknown,
  path: string,
) {
  if (!isNonEmptyString(value)) {
    addIssue(issues, {
      code: "invalid_ref",
      path,
      message: "Expected an opaque reference string.",
    });
    return;
  }

  const hasAllowedPrefix = tenantOverlayRefPrefixes.some((prefix) =>
    value.startsWith(prefix),
  );
  if (!hasAllowedPrefix) {
    addIssue(issues, {
      code: "invalid_ref",
      path,
      message:
        "Tenant overlay references must use env://, private-file://, tenant-asset:// or vault://.",
    });
  }

  if (/^https?:\/\//i.test(value) || /[?&](token|password|secret)=/i.test(value)) {
    addIssue(issues, {
      code: "invalid_ref",
      path,
      message: "Tenant overlay references must not inline URLs or credentials.",
    });
  }
}

function collectForbiddenAuthorityIssues(
  issues: TenantOverlayValidationIssue[],
  value: unknown,
  path: string,
) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      collectForbiddenAuthorityIssues(issues, entry, `${path}[${index}]`),
    );
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entryValue] of Object.entries(value)) {
    const matchedForbiddenKey = findForbiddenAuthorityKeyFragment(key);
    const entryPath = `${path}.${key}`;

    if (matchedForbiddenKey && isAuthorityGrantValue(entryValue)) {
      addIssue(issues, {
        code: "forbidden_authority",
        path: entryPath,
        message: `Tenant Overlay must not grant ${matchedForbiddenKey}.`,
      });
    }

    collectForbiddenAuthorityIssues(issues, entryValue, entryPath);
  }
}

export function validateTenantOverlayDefinition(
  input: unknown,
): TenantOverlayValidationResult {
  const issues: TenantOverlayValidationIssue[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid_shape",
          path: "$",
          message: "Tenant Overlay must be an object.",
        },
      ],
    };
  }

  collectForbiddenAuthorityIssues(issues, input, "$");

  if (!isNonEmptyString(input.tenantKey) || !tenantKeyPattern.test(input.tenantKey)) {
    addIssue(issues, {
      code: "invalid_value",
      path: "$.tenantKey",
      message: "tenantKey must be lowercase kebab-case and 2-64 characters.",
    });
  }

  if (!isNonEmptyString(input.displayName)) {
    addIssue(issues, {
      code: "invalid_value",
      path: "$.displayName",
      message: "displayName is required.",
    });
  }

  if (!isTenantOverlaySource(input.source)) {
    addIssue(issues, {
      code: "invalid_source",
      path: "$.source",
      message: "source must be open_core_example, deployment_config or private_tenant_repo.",
    });
  }

  const capabilities = validateStringArray(issues, input.capabilities, "$.capabilities", {
    allowed: tenantOverlayCapabilities,
  });

  if (capabilities.length === 0) {
    addIssue(issues, {
      code: "invalid_value",
      path: "$.capabilities",
      message: "Tenant Overlay must declare at least one capability.",
    });
  }

  if (!capabilities.every(isTenantOverlayCapability)) {
    addIssue(issues, {
      code: "invalid_value",
      path: "$.capabilities",
      message: "Tenant Overlay capabilities contain unsupported values.",
    });
  }

  validateLocaleBlock(issues, input.locale);
  validateBrandingBlock(issues, input.branding);

  if (input.enabledExtensionKeys !== undefined) {
    validateStringArray(
      issues,
      input.enabledExtensionKeys,
      "$.enabledExtensionKeys",
      {
        pattern: extensionKeyPattern,
      },
    );
  }

  validateRefArray(issues, input.connectorConfigRefs, "$.connectorConfigRefs");
  validateRefArray(issues, input.privateAssetRefs, "$.privateAssetRefs");
  validateCopyOverrides(issues, input.copyOverrides, input.locale);

  return {
    ok: issues.length === 0,
    issues,
  };
}

function validateLocaleBlock(
  issues: TenantOverlayValidationIssue[],
  value: unknown,
) {
  if (!isRecord(value)) {
    addIssue(issues, {
      code: "invalid_locale",
      path: "$.locale",
      message: "locale block is required.",
    });
    return;
  }

  if (!isUiLocale(value.defaultLocale)) {
    addIssue(issues, {
      code: "invalid_locale",
      path: "$.locale.defaultLocale",
      message: "defaultLocale must be one of the supported UI locales.",
    });
  }

  const supportedLocales = validateStringArray(
    issues,
    value.supportedLocales,
    "$.locale.supportedLocales",
    {
      allowed: supportedUiLocales,
    },
  );

  if (supportedLocales.length === 0) {
    addIssue(issues, {
      code: "invalid_locale",
      path: "$.locale.supportedLocales",
      message: "supportedLocales must include at least one locale.",
    });
  }

  if (
    isUiLocale(value.defaultLocale) &&
    !supportedLocales.includes(value.defaultLocale)
  ) {
    addIssue(issues, {
      code: "invalid_locale",
      path: "$.locale.defaultLocale",
      message: "defaultLocale must be included in supportedLocales.",
    });
  }
}

function validateBrandingBlock(
  issues: TenantOverlayValidationIssue[],
  value: unknown,
) {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    addIssue(issues, {
      code: "invalid_branding",
      path: "$.branding",
      message: "branding must be an object when provided.",
    });
    return;
  }

  if (value.productName !== undefined && !isNonEmptyString(value.productName)) {
    addIssue(issues, {
      code: "invalid_branding",
      path: "$.branding.productName",
      message: "productName must be non-empty when provided.",
    });
  }

  if (value.logoAssetRef !== undefined) {
    validateRef(issues, value.logoAssetRef, "$.branding.logoAssetRef");
  }

  if (!isRecord(value.poweredByHelm)) {
    addIssue(issues, {
      code: "invalid_branding",
      path: "$.branding.poweredByHelm",
      message: "poweredByHelm contract is required for branding overlays.",
    });
    return;
  }

  const mode = value.poweredByHelm.mode;
  const trademarkGrant = value.poweredByHelm.trademarkGrant;

  if (!isPoweredByHelmMode(mode)) {
    addIssue(issues, {
      code: "invalid_branding",
      path: "$.branding.poweredByHelm.mode",
      message: "Invalid Powered by Helm mode.",
    });
  }

  if (!isTrademarkGrantMode(trademarkGrant)) {
    addIssue(issues, {
      code: "invalid_branding",
      path: "$.branding.poweredByHelm.trademarkGrant",
      message: "Invalid trademark grant mode.",
    });
  }

  if (mode === "contracted_white_label" && trademarkGrant === "none") {
    addIssue(issues, {
      code: "invalid_branding",
      path: "$.branding.poweredByHelm.trademarkGrant",
      message: "Contracted white-label mode requires enterprise or OPC trademark grant.",
    });
  }
}

function validateRefArray(
  issues: TenantOverlayValidationIssue[],
  value: unknown,
  path: string,
) {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    addIssue(issues, {
      code: "invalid_shape",
      path,
      message: "Expected an array of opaque references.",
    });
    return;
  }

  value.forEach((entry, index) => validateRef(issues, entry, `${path}[${index}]`));
}

function validateCopyOverrides(
  issues: TenantOverlayValidationIssue[],
  value: unknown,
  localeBlock: unknown,
) {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    addIssue(issues, {
      code: "invalid_shape",
      path: "$.copyOverrides",
      message: "copyOverrides must be an array when provided.",
    });
    return;
  }

  const supportedLocales =
    isRecord(localeBlock) && Array.isArray(localeBlock.supportedLocales)
      ? localeBlock.supportedLocales.filter(isUiLocale)
      : [];

  value.forEach((entry, index) => {
    const path = `$.copyOverrides[${index}]`;
    if (!isRecord(entry)) {
      addIssue(issues, {
        code: "invalid_shape",
        path,
        message: "copy override must be an object.",
      });
      return;
    }

    if (!["ui", "email", "report"].includes(String(entry.scope))) {
      addIssue(issues, {
        code: "invalid_value",
        path: `${path}.scope`,
        message: "copy override scope must be ui, email or report.",
      });
    }

    if (!isNonEmptyString(entry.key) || !copyOverrideKeyPattern.test(entry.key)) {
      addIssue(issues, {
        code: "invalid_value",
        path: `${path}.key`,
        message: "copy override key must be stable lowercase dot/kebab case.",
      });
    }

    if (!isUiLocale(entry.locale) || !supportedLocales.includes(entry.locale)) {
      addIssue(issues, {
        code: "invalid_locale",
        path: `${path}.locale`,
        message: "copy override locale must be supported by this overlay.",
      });
    }

    validateRef(issues, entry.valueRef, `${path}.valueRef`);
  });
}

function exactUiLocale(value?: string | null): UiLocale | null {
  if (isUiLocale(value)) {
    return value;
  }
  return null;
}

export function resolveTenantOverlayLocale(
  overlay: Pick<TenantOverlayDefinition, "locale">,
  input: TenantOverlayLocaleResolutionInput,
): UiLocale {
  const supported = new Set<UiLocale>(overlay.locale.supportedLocales);
  const candidates = [
    exactUiLocale(input.requestLocale),
    exactUiLocale(input.userLocale),
    exactUiLocale(input.workspaceDefaultLocale),
    overlay.locale.defaultLocale,
  ];

  for (const candidate of candidates) {
    if (candidate && supported.has(candidate)) {
      return candidate;
    }
  }

  return overlay.locale.defaultLocale;
}
