import { describe, expect, it } from "vitest";
import {
  ENGINE_DEFAULT_UI_LOCALE,
  isSupportedUiLocale,
  resolveUiLocale,
  resolveWorkspaceUiLocale,
} from "@/lib/i18n/config";

describe("i18n config", () => {
  it("keeps the legacy public cookie resolver defaulting to the engine locale", () => {
    expect(resolveUiLocale("en-US")).toBe("en-US");
    expect(resolveUiLocale("fr-FR")).toBe(ENGINE_DEFAULT_UI_LOCALE);
    expect(resolveUiLocale(null)).toBe(ENGINE_DEFAULT_UI_LOCALE);
  });

  it("recognizes only exact supported UI locales", () => {
    expect(isSupportedUiLocale("zh-CN")).toBe(true);
    expect(isSupportedUiLocale("en-US")).toBe(true);
    expect(isSupportedUiLocale("en-us")).toBe(false);
    expect(isSupportedUiLocale("fr-FR")).toBe(false);
  });

  it("resolves workspace UI locale by request, user, workspace, tenant overlay, deployment profile and engine order", () => {
    expect(
      resolveWorkspaceUiLocale({
        requestLocale: "en-US",
        userLocale: "zh-CN",
        workspaceDefaultLocale: "zh-CN",
        tenantOverlayDefaultLocale: "zh-CN",
        deploymentProfileDefaultLocale: "zh-CN",
      }),
    ).toBe("en-US");

    expect(
      resolveWorkspaceUiLocale({
        requestLocale: "fr-FR",
        userLocale: "en-US",
        workspaceDefaultLocale: "zh-CN",
        tenantOverlayDefaultLocale: "zh-CN",
        deploymentProfileDefaultLocale: "zh-CN",
      }),
    ).toBe("en-US");

    expect(
      resolveWorkspaceUiLocale({
        requestLocale: null,
        userLocale: null,
        workspaceDefaultLocale: "en-US",
        tenantOverlayDefaultLocale: "zh-CN",
        deploymentProfileDefaultLocale: "zh-CN",
      }),
    ).toBe("en-US");
  });

  it("does not silently coerce unknown request or workspace locale before a valid deployment default", () => {
    expect(
      resolveWorkspaceUiLocale({
        requestLocale: "fr-FR",
        userLocale: "en-GB",
        workspaceDefaultLocale: "unknown",
        tenantOverlayDefaultLocale: null,
        deploymentProfileDefaultLocale: "en-US",
      }),
    ).toBe("en-US");
  });

  it("falls back to engine default when every source is unknown", () => {
    expect(
      resolveWorkspaceUiLocale({
        requestLocale: "fr-FR",
        userLocale: "en-GB",
        workspaceDefaultLocale: "unknown",
        tenantOverlayDefaultLocale: "ja-JP",
        deploymentProfileDefaultLocale: "de-DE",
      }),
    ).toBe(ENGINE_DEFAULT_UI_LOCALE);
  });
});
