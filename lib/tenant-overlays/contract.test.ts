import { describe, expect, it } from "vitest";
import {
  resolveTenantOverlayLocale,
  validateTenantOverlayDefinition,
  type TenantOverlayDefinition,
} from "@/lib/tenant-overlays/contract";

function validOverlay(
  overrides: Partial<TenantOverlayDefinition> = {},
): TenantOverlayDefinition {
  return {
    tenantKey: "acme",
    displayName: "Acme Operating Console",
    source: "private_tenant_repo",
    capabilities: [
      "brand_theme",
      "copy_override",
      "locale_default",
      "extension_enablement",
      "connector_config_reference",
    ],
    locale: {
      defaultLocale: "zh-CN",
      supportedLocales: ["zh-CN", "en-US"],
    },
    branding: {
      productName: "Acme Console",
      logoAssetRef: "tenant-asset://brand/logo.svg",
      poweredByHelm: {
        mode: "customized_by_user",
        trademarkGrant: "none",
      },
    },
    enabledExtensionKeys: ["acme-signal-board"],
    connectorConfigRefs: ["vault://acme/connectors/crm"],
    privateAssetRefs: ["private-file://acme/reports/template.md"],
    copyOverrides: [
      {
        scope: "ui",
        key: "shell.product-name",
        locale: "zh-CN",
        valueRef: "tenant-asset://copy/shell.product-name.zh-CN.txt",
      },
    ],
    ...overrides,
  };
}

function issueCodes(input: unknown) {
  return validateTenantOverlayDefinition(input).issues.map((issue) => issue.code);
}

describe("tenant overlay contract", () => {
  it("accepts a private tenant overlay that only declares branding, locale, refs and extension enablement", () => {
    expect(validateTenantOverlayDefinition(validOverlay())).toEqual({
      ok: true,
      issues: [],
    });
  });

  it("requires defaultLocale to be explicitly supported", () => {
    const result = validateTenantOverlayDefinition(
      validOverlay({
        locale: {
          defaultLocale: "en-US",
          supportedLocales: ["zh-CN"],
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "invalid_locale",
        path: "$.locale.defaultLocale",
      }),
    );
  });

  it("rejects duplicate extension keys and unsupported capabilities", () => {
    const result = validateTenantOverlayDefinition(
      validOverlay({
        capabilities: ["brand_theme", "marketplace" as never],
        enabledExtensionKeys: ["acme-signal-board", "acme-signal-board"],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_value",
          path: "$.capabilities[1]",
        }),
        expect.objectContaining({
          code: "duplicate_value",
          path: "$.enabledExtensionKeys[1]",
        }),
      ]),
    );
  });

  it("rejects contracted white-label mode without an enterprise or OPC trademark grant", () => {
    const result = validateTenantOverlayDefinition(
      validOverlay({
        branding: {
          productName: "Acme Console",
          logoAssetRef: "tenant-asset://brand/logo.svg",
          poweredByHelm: {
            mode: "contracted_white_label",
            trademarkGrant: "none",
          },
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "invalid_branding",
        path: "$.branding.poweredByHelm.trademarkGrant",
      }),
    );
  });

  it("rejects authority grants hidden inside overlay-shaped objects", () => {
    const result = validateTenantOverlayDefinition({
      ...validOverlay(),
      authority: {
        autoSend: true,
        silentCrmWrite: "enabled",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "forbidden_authority",
          path: "$.authority",
        }),
        expect.objectContaining({
          code: "forbidden_authority",
          path: "$.authority.autoSend",
        }),
        expect.objectContaining({
          code: "forbidden_authority",
          path: "$.authority.silentCrmWrite",
        }),
      ]),
    );
  });

  it("rejects bare entitlement and approval authority fields", () => {
    const result = validateTenantOverlayDefinition({
      ...validOverlay(),
      entitlement: true,
      approval: {
        approveExternalSend: "enabled",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "forbidden_authority",
          path: "$.entitlement",
        }),
        expect.objectContaining({
          code: "forbidden_authority",
          path: "$.approval",
        }),
        expect.objectContaining({
          code: "forbidden_authority",
          path: "$.approval.approveExternalSend",
        }),
      ]),
    );
  });

  it("rejects raw URL or inline credential refs", () => {
    expect(
      issueCodes(
        validOverlay({
          connectorConfigRefs: ["https://example.invalid/callback"],
          privateAssetRefs: ["vault://tenant/item?token=inline"],
        }),
      ),
    ).toEqual(expect.arrayContaining(["invalid_ref", "invalid_ref"]));
  });

  it("resolves request, user, workspace and overlay locale without coercing unknown values", () => {
    const overlay = validOverlay({
      locale: {
        defaultLocale: "en-US",
        supportedLocales: ["en-US"],
      },
    });

    expect(
      resolveTenantOverlayLocale(overlay, {
        requestLocale: "zh-CN",
        userLocale: "fr-FR",
        workspaceDefaultLocale: "zh-CN",
      }),
    ).toBe("en-US");

    expect(
      resolveTenantOverlayLocale(validOverlay(), {
        requestLocale: "en-US",
        userLocale: "zh-CN",
        workspaceDefaultLocale: "zh-CN",
      }),
    ).toBe("en-US");
  });
});
