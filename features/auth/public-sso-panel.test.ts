import { describe, expect, it } from "vitest";
import {
  buildDingTalkQrFlowCreateUrl,
  isIgnorableDingTalkQrFlowError,
  resolveActivePublicSsoQrUrl,
} from "@/features/auth/public-sso-panel";

describe("resolveActivePublicSsoQrUrl", () => {
  it("does not fallback to direct public start url for dingtalk before qr flow is ready", () => {
    const activeQrUrl = resolveActivePublicSsoQrUrl({
      activeOption: {
        provider: "dingtalk",
        ready: true,
        startUrl: "https://helm.example.com/api/public-auth/dingtalk/start",
      },
      dingtalkQrUrl: null,
    });

    expect(activeQrUrl).toBeNull();
  });

  it("uses qr flow url for dingtalk when flow is ready", () => {
    const activeQrUrl = resolveActivePublicSsoQrUrl({
      activeOption: {
        provider: "dingtalk",
        ready: true,
        startUrl: "https://helm.example.com/api/public-auth/dingtalk/start",
      },
      dingtalkQrUrl: "https://helm.example.com/api/public-auth/dingtalk/start?flowId=flow-1",
    });

    expect(activeQrUrl).toBe(
      "https://helm.example.com/api/public-auth/dingtalk/start?flowId=flow-1",
    );
  });

  it("keeps provider start url for wecom", () => {
    const activeQrUrl = resolveActivePublicSsoQrUrl({
      activeOption: {
        provider: "wecom",
        ready: true,
        startUrl: "https://helm.example.com/api/public-auth/wecom/start",
      },
      dingtalkQrUrl: null,
    });

    expect(activeQrUrl).toBe("https://helm.example.com/api/public-auth/wecom/start");
  });

  it("keeps provider start url for feishu", () => {
    const activeQrUrl = resolveActivePublicSsoQrUrl({
      activeOption: {
        provider: "feishu",
        ready: true,
        startUrl: "https://helm.example.com/api/public-auth/feishu/start",
      },
      dingtalkQrUrl: null,
    });

    expect(activeQrUrl).toBe("https://helm.example.com/api/public-auth/feishu/start");
  });
});

describe("isIgnorableDingTalkQrFlowError", () => {
  it("ignores aborted/disposed lifecycle errors", () => {
    expect(
      isIgnorableDingTalkQrFlowError({
        error: new Error("any"),
        disposed: true,
        aborted: false,
      }),
    ).toBe(true);
    expect(
      isIgnorableDingTalkQrFlowError({
        error: new Error("any"),
        disposed: false,
        aborted: true,
      }),
    ).toBe(true);
  });

  it("ignores fetch AbortError", () => {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    expect(
      isIgnorableDingTalkQrFlowError({
        error: abortError,
        disposed: false,
        aborted: false,
      }),
    ).toBe(true);
  });

  it("keeps real failures visible", () => {
    expect(
      isIgnorableDingTalkQrFlowError({
        error: new Error("network down"),
        disposed: false,
        aborted: false,
      }),
    ).toBe(false);
  });
});

describe("buildDingTalkQrFlowCreateUrl", () => {
  it("carries public auth workspace context into qr flow creation", () => {
    expect(
      buildDingTalkQrFlowCreateUrl(
        "/api/public-auth/dingtalk/start?ws=workspace-tenant-1&org=%E5%AE%A2%E6%88%B7%E5%85%AC%E5%8F%B8&title=%E7%BB%8F%E7%90%86",
      ),
    ).toBe(
      "/api/public-auth/dingtalk/qr-flow?org=%E5%AE%A2%E6%88%B7%E5%85%AC%E5%8F%B8&ws=workspace-tenant-1&title=%E7%BB%8F%E7%90%86",
    );
  });

  it("ignores unrelated start url params", () => {
    expect(
      buildDingTalkQrFlowCreateUrl(
        "/api/public-auth/dingtalk/start?flowId=flow-1&next=%2Fadmin&ws=workspace-1",
      ),
    ).toBe("/api/public-auth/dingtalk/qr-flow?ws=workspace-1");
  });
});
