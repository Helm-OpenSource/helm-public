import { describe, expect, it } from "vitest";

import { resolveTenantOverlayForTenantKey } from "@/lib/tenant-overlays/resolver";
import type { TenantOverlayDefinition } from "@/lib/tenant-overlays/contract";

function validOverlay(
  overrides: Partial<TenantOverlayDefinition> = {},
): TenantOverlayDefinition {
  return {
    tenantKey: "acme",
    displayName: "Acme Operating Console",
    source: "deployment_config",
    capabilities: [
      "brand_theme",
      "copy_override",
      "locale_default",
      "extension_enablement",
      "connector_config_reference",
    ],
    locale: {
      defaultLocale: "en-US",
      supportedLocales: ["en-US"],
    },
    branding: {
      productName: "Acme Console",
      logoAssetRef: "tenant-asset://brand/logo.svg",
      poweredByHelm: {
        mode: "default_visible",
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
        locale: "en-US",
        valueRef: "tenant-asset://copy/shell.product-name.en-US.txt",
      },
    ],
    notes: ["deployment-side example"],
    ...overrides,
  };
}

describe("tenant overlay resolver", () => {
  it("returns a read-only runtime view for a valid matching tenant overlay", () => {
    const result = resolveTenantOverlayForTenantKey({
      tenantKey: "acme",
      overlays: [validOverlay()],
    });

    expect(result).toMatchObject({
      status: "matched",
      tenantKey: "acme",
      overlay: {
        tenantKey: "acme",
        displayName: "Acme Operating Console",
        source: "deployment_config",
        defaultLocale: "en-US",
        supportedLocales: ["en-US"],
        enabledExtensionKeys: ["acme-signal-board"],
        connectorConfigRefs: ["vault://acme/connectors/crm"],
        privateAssetRefs: ["private-file://acme/reports/template.md"],
      },
      issues: [],
    });
  });

  it("returns not_found without treating an absent overlay as an error", () => {
    expect(
      resolveTenantOverlayForTenantKey({
        tenantKey: "unknown",
        overlays: [validOverlay()],
      }),
    ).toEqual({
      status: "not_found",
      tenantKey: "unknown",
      overlay: null,
      issues: [],
    });
  });

  it("blocks blank lookup keys before scanning overlays", () => {
    const result = resolveTenantOverlayForTenantKey({
      tenantKey: " ",
      overlays: [validOverlay()],
    });

    expect(result.status).toBe("blocked");
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "invalid_lookup_key",
        path: "$.tenantKey",
      }),
    ]);
  });

  it("blocks an invalid matching overlay instead of falling back silently", () => {
    const result = resolveTenantOverlayForTenantKey({
      tenantKey: "acme",
      overlays: [
        validOverlay({
          locale: {
            defaultLocale: "en-US",
            supportedLocales: ["zh-CN"],
          },
        }),
      ],
    });

    expect(result.status).toBe("blocked");
    expect(result.overlay).toBeNull();
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "invalid_overlay",
        tenantKey: "acme",
        validationIssues: expect.arrayContaining([
          expect.objectContaining({
            code: "invalid_locale",
            path: "$.locale.defaultLocale",
          }),
        ]),
      }),
    ]);
  });

  it("blocks duplicate valid tenant overlays because the runtime choice would be ambiguous", () => {
    const result = resolveTenantOverlayForTenantKey({
      tenantKey: "acme",
      overlays: [
        validOverlay({ displayName: "Acme A" }),
        validOverlay({ displayName: "Acme B" }),
      ],
    });

    expect(result.status).toBe("blocked");
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "duplicate_tenant_key",
        tenantKey: "acme",
      }),
    ]);
  });

  it("does not let unrelated invalid overlays block a valid matched tenant", () => {
    const result = resolveTenantOverlayForTenantKey({
      tenantKey: "acme",
      overlays: [
        {
          tenantKey: "other",
          displayName: "Other",
          source: "deployment_config",
          capabilities: ["locale_default"],
          locale: {
            defaultLocale: "en-US",
            supportedLocales: ["zh-CN"],
          },
        },
        validOverlay(),
      ],
    });

    expect(result.status).toBe("matched");
    expect(result.overlay?.tenantKey).toBe("acme");
    expect(result.issues).toEqual([]);
  });
});
