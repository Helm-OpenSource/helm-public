import {
  validateTenantOverlayDefinition,
  type TenantOverlayBranding,
  type TenantOverlayCapability,
  type TenantOverlayCopyOverride,
  type TenantOverlayDefinition,
  type TenantOverlaySource,
  type TenantOverlayValidationIssue,
} from "@/lib/tenant-overlays/contract";
import type { UiLocale } from "@/lib/i18n/config";

export type TenantOverlayRuntimeView = {
  tenantKey: string;
  displayName: string;
  source: TenantOverlaySource;
  capabilities: readonly TenantOverlayCapability[];
  defaultLocale: UiLocale;
  supportedLocales: readonly UiLocale[];
  branding?: TenantOverlayBranding;
  enabledExtensionKeys: readonly string[];
  connectorConfigRefs: readonly string[];
  privateAssetRefs: readonly string[];
  copyOverrides: readonly TenantOverlayCopyOverride[];
  notes: readonly string[];
};

export type TenantOverlayResolutionIssue = {
  code: "duplicate_tenant_key" | "invalid_lookup_key" | "invalid_overlay";
  path: string;
  message: string;
  tenantKey?: string;
  validationIssues?: readonly TenantOverlayValidationIssue[];
};

export type TenantOverlayResolutionResult =
  | {
      status: "matched";
      tenantKey: string;
      overlay: TenantOverlayRuntimeView;
      issues: [];
    }
  | {
      status: "not_found";
      tenantKey: string;
      overlay: null;
      issues: [];
    }
  | {
      status: "blocked";
      tenantKey: string;
      overlay: null;
      issues: readonly TenantOverlayResolutionIssue[];
    };

export type TenantOverlayResolutionInput = {
  tenantKey: string | null | undefined;
  overlays: readonly unknown[];
};

function maybeTenantKey(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const tenantKey = (value as { tenantKey?: unknown }).tenantKey;
  return typeof tenantKey === "string" ? tenantKey : null;
}

function buildRuntimeView(overlay: TenantOverlayDefinition): TenantOverlayRuntimeView {
  return {
    tenantKey: overlay.tenantKey,
    displayName: overlay.displayName,
    source: overlay.source,
    capabilities: [...overlay.capabilities],
    defaultLocale: overlay.locale.defaultLocale,
    supportedLocales: [...overlay.locale.supportedLocales],
    branding: overlay.branding,
    enabledExtensionKeys: [...(overlay.enabledExtensionKeys ?? [])],
    connectorConfigRefs: [...(overlay.connectorConfigRefs ?? [])],
    privateAssetRefs: [...(overlay.privateAssetRefs ?? [])],
    copyOverrides: [...(overlay.copyOverrides ?? [])],
    notes: [...(overlay.notes ?? [])],
  };
}

export function resolveTenantOverlayForTenantKey(
  input: TenantOverlayResolutionInput,
): TenantOverlayResolutionResult {
  const tenantKey = input.tenantKey?.trim() ?? "";
  if (!tenantKey) {
    return {
      status: "blocked",
      tenantKey,
      overlay: null,
      issues: [
        {
          code: "invalid_lookup_key",
          path: "$.tenantKey",
          message: "tenantKey is required before resolving tenant overlay.",
        },
      ],
    };
  }

  const invalidMatchingOverlays: TenantOverlayResolutionIssue[] = [];
  const validMatches: TenantOverlayDefinition[] = [];

  input.overlays.forEach((overlay, index) => {
    const overlayTenantKey = maybeTenantKey(overlay);
    const validation = validateTenantOverlayDefinition(overlay);

    if (!validation.ok) {
      if (overlayTenantKey === tenantKey) {
        invalidMatchingOverlays.push({
          code: "invalid_overlay",
          path: `$.overlays[${index}]`,
          tenantKey,
          message: `Tenant overlay ${tenantKey} is invalid and was not applied.`,
          validationIssues: validation.issues,
        });
      }
      return;
    }

    const validOverlay = overlay as TenantOverlayDefinition;
    if (validOverlay.tenantKey === tenantKey) {
      validMatches.push(validOverlay);
    }
  });

  if (invalidMatchingOverlays.length > 0) {
    return {
      status: "blocked",
      tenantKey,
      overlay: null,
      issues: invalidMatchingOverlays,
    };
  }

  if (validMatches.length > 1) {
    return {
      status: "blocked",
      tenantKey,
      overlay: null,
      issues: [
        {
          code: "duplicate_tenant_key",
          path: "$.overlays",
          tenantKey,
          message: `Multiple tenant overlays matched ${tenantKey}; refusing to choose implicitly.`,
        },
      ],
    };
  }

  if (validMatches.length === 0) {
    return {
      status: "not_found",
      tenantKey,
      overlay: null,
      issues: [],
    };
  }

  return {
    status: "matched",
    tenantKey,
    overlay: buildRuntimeView(validMatches[0]),
    issues: [],
  };
}
