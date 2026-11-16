// @vitest-environment jsdom
// features/seat-device/device-confirm-client.test.tsx
// The D1 verification page (design v0.3 §4.3): the required anti-phishing
// wording, the bound workspace and what the device can do, client-reported
// fields marked as such, the source shown only when the server has a trusted
// one, "拒绝" as the default button, the page refusing to be framed, its
// deployment switch, and a signed-out visitor coming back to it after login.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
const session = vi.hoisted(() => ({ getCurrentWorkspaceSession: vi.fn(async () => ({})) }));
vi.mock("next/navigation", () => navigation);
vi.mock("@/lib/auth/session", () => session);

import SeatDeviceVerificationPage from "@/app/(workspace)/device/page";
import SeatDevicesPage from "@/app/(workspace)/settings/seat-devices/page";
import { withLoginCallback } from "@/lib/auth/login-callback";
import { shouldRedirectMissingWorkspaceSession } from "@/lib/auth/workspace-route-guard";
import nextConfig from "@/next.config";
import {
  DeviceConfirmClient,
  SEAT_DEVICE_PHISHING_WARNING,
  SeatDeviceDecisionPanel,
  type SeatDeviceLookupView,
} from "@/features/seat-device/device-confirm-client";
import { SeatDeviceTable, type SeatDeviceListItem } from "@/features/seat-device/seat-devices-client";

const LOOKUP: SeatDeviceLookupView = {
  requestId: "req1",
  deviceName: "前台电脑",
  clientVersion: "1.0.0",
  requestedAt: "2031-01-01T00:00:00.000Z",
  source: "198.51.100.7",
  expiresInSeconds: 540,
  workspace: { id: "ws1", name: "示例机构" },
};

const panel = (lookup: SeatDeviceLookupView) =>
  renderToStaticMarkup(<SeatDeviceDecisionPanel lookup={lookup} pending={false} onReject={() => {}} onApprove={() => {}} />);

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("seat device verification page", () => {
  it("is absent while the deployment switch is off, and needs a workspace session when on", async () => {
    vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", "false");
    await expect(SeatDeviceVerificationPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(session.getCurrentWorkspaceSession).not.toHaveBeenCalled();
    vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", "true");
    expect(renderToStaticMarkup(await SeatDeviceVerificationPage())).toContain(SEAT_DEVICE_PHISHING_WARNING);
    expect(session.getCurrentWorkspaceSession).toHaveBeenCalledTimes(1);
  });

  it("keeps the device list page absent while the deployment switch is off", async () => {
    vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", "false");
    await expect(SeatDevicesPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(session.getCurrentWorkspaceSession).not.toHaveBeenCalled();
    vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", "true");
    expect(renderToStaticMarkup(await SeatDevicesPage())).toContain("坐席客户端设备");
    expect(session.getCurrentWorkspaceSession).toHaveBeenCalledTimes(1);
  });

  it("sends a signed-out visitor to login and back to /device", () => {
    expect(shouldRedirectMissingWorkspaceSession({ pathname: "/device", hasAuthSessionCookie: false })).toBe(true);
    expect(withLoginCallback("/login", "/device")).toBe("/login?callback=%2Fdevice");
  });

  it("shows the anti-phishing warning before any code is entered, and never takes the code from the URL", () => {
    expect(SEAT_DEVICE_PHISHING_WARNING).toContain("如果有人通过电话、短信或聊天让你输入这个码，那是诈骗，请点拒绝。");
    const html = renderToStaticMarkup(<DeviceConfirmClient />);
    expect(html).toContain(SEAT_DEVICE_PHISHING_WARNING);
    expect(html).toMatch(/<input[^>]*aria-label="配对码"[^>]*value=""/);
  });

  it("names the workspace and what the device can do, and marks client-reported fields", () => {
    const html = panel(LOOKUP);
    expect(html).toContain("将绑定到机构：<strong>示例机构</strong>");
    expect(html).toContain("看你名下的案件，包括客户个人信息；外呼；写催记");
    expect(html).toContain("设备名：前台电脑；客户端版本：1.0.0（客户端自报，仅供参考）");
    expect(html).toContain("请求来源：198.51.100.7（服务端记录）");
    expect(panel({ ...LOOKUP, source: null })).not.toContain("请求来源");
  });

  it("makes reject the default button and approve a plain button that needs the password", () => {
    const html = panel(LOOKUP);
    const buttons = [...html.matchAll(/<button[^>]*>[^<]*<\/button>/g)].map((match) => match[0]);
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toMatch(/type="submit"/);
    expect(buttons[0]).toMatch(/autofocus/i);
    expect(buttons[0]).toContain(">拒绝<");
    expect(buttons[1]).toMatch(/type="button"/);
    expect(buttons[1]).toContain(">授权这台设备<");
    // Disabled until a password is typed.
    expect(buttons[1]).toMatch(/disabled/);
    expect(html).toMatch(/<input[^>]*type="password"/);
  });

  it("rejects on Enter from the default focus, and Enter in the password field neither approves nor rejects", async () => {
    const onReject = vi.fn();
    const onApprove = vi.fn();
    render(<SeatDeviceDecisionPanel lookup={LOOKUP} pending={false} onReject={onReject} onApprove={onApprove} />);
    const user = userEvent.setup();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "拒绝" }));
    await user.keyboard("{Enter}");
    expect(onReject).toHaveBeenCalledTimes(1);
    await user.type(screen.getByLabelText("授权前请再次输入登录密码"), "typed password{Enter}");
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onApprove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "授权这台设备" }));
    expect(onApprove).toHaveBeenCalledWith("typed password");
  });

  it.each(["/device", "/settings/seat-devices"])("refuses framing of %s", async (source) => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const page = rules.find((rule) => rule.source === source);
    expect(page?.headers).toEqual(
      expect.arrayContaining([
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "Cache-Control", value: "no-store, private" },
      ]),
    );
  });

  it("offers revoke only on a live device in the device list", () => {
    const base: SeatDeviceListItem = {
      deviceId: "d1", deviceName: "前台电脑", clientVersion: "1.0.0", status: "active", memberName: "坐席", own: true,
      approvedAt: null, approvalSource: null, lastUsedAt: null, expiresAt: null, revokedAt: null, revokeReason: null,
    };
    const table = (devices: SeatDeviceListItem[]) =>
      renderToStaticMarkup(<SeatDeviceTable devices={devices} showMember={false} pending={false} onRevoke={() => {}} />);
    expect(table([base, { ...base, deviceId: "d2", status: "approved" }]).match(/>撤销</g)).toHaveLength(2);
    const revoked = table([{ ...base, status: "revoked", revokeReason: "admin" }, { ...base, deviceId: "d3", status: "expired" }]);
    expect(revoked).not.toContain(">撤销<");
    expect(revoked).toContain("已撤销：管理员撤销");
  });

  const WITH_OPTIONS: SeatDeviceLookupView = {
    ...LOOKUP,
    audienceOptions: [
      { value: "audience:a1", label: "对象甲" },
      { value: "audience:b2", label: "<b>对象乙</b>" },
    ],
  };

  it("shows no audience choice without options, and labels as text when options are offered", () => {
    expect(panel(LOOKUP)).not.toContain("授权对象");
    expect(panel(LOOKUP)).not.toMatch(/type="radio"/);
    const html = panel(WITH_OPTIONS);
    expect(html).toContain("选择这台设备的授权对象");
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).toContain("&lt;b&gt;对象乙&lt;/b&gt;");
    expect(html).not.toContain("<b>对象乙</b>");
    // Nothing preselected.
    expect(html).not.toMatch(/checked/);
  });

  it("approves with options only once one is chosen, and passes the chosen value", async () => {
    const onApprove = vi.fn();
    render(<SeatDeviceDecisionPanel lookup={WITH_OPTIONS} pending={false} onReject={() => {}} onApprove={onApprove} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("授权前请再次输入登录密码"), "typed password");
    const approve = screen.getByRole("button", { name: "授权这台设备" });
    expect(approve).toHaveProperty("disabled", true);
    await user.click(screen.getByLabelText("<b>对象乙</b>"));
    expect(approve).toHaveProperty("disabled", false);
    await user.click(approve);
    expect(onApprove).toHaveBeenCalledWith("typed password", "audience:b2");
  });

  async function approveThroughPage(lookup: SeatDeviceLookupView, choose?: string) {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      const answer = body.action === "lookup" ? lookup : { requestId: lookup.requestId, status: "approved" };
      return new Response(JSON.stringify(answer), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    try {
      render(<DeviceConfirmClient />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText("配对码"), "BCDF-GHJK");
      await user.click(screen.getByRole("button", { name: "查找" }));
      await user.type(await screen.findByLabelText("授权前请再次输入登录密码"), "typed password");
      if (choose) await user.click(screen.getByLabelText(choose));
      await user.click(screen.getByRole("button", { name: "授权这台设备" }));
      await screen.findByText(/已授权/);
    } finally {
      vi.unstubAllGlobals();
    }
    return bodies[1];
  }

  it("sends an audience only when the lookup offered options (a server without them refuses the field)", async () => {
    const plain = await approveThroughPage(LOOKUP);
    expect(plain).toEqual({ action: "approve", requestId: "req1", pairingCode: "BCDF-GHJK", workspaceId: "ws1", password: "typed password" });
    cleanup();
    const chosen = await approveThroughPage(WITH_OPTIONS, "对象甲");
    expect(chosen).toEqual({ action: "approve", requestId: "req1", pairingCode: "BCDF-GHJK", workspaceId: "ws1", password: "typed password", audience: "audience:a1" });
  });

  it("does not reject on Enter in an audience option", () => {
    const onReject = vi.fn();
    render(<SeatDeviceDecisionPanel lookup={WITH_OPTIONS} pending={false} onReject={onReject} onApprove={() => {}} />);
    const option = screen.getByLabelText("对象甲");
    // fireEvent answers false when the handler prevented the default (the implicit submission).
    expect(fireEvent.keyDown(option, { key: "Enter" })).toBe(false);
    expect(onReject).not.toHaveBeenCalled();
  });

  it.each(["audience_invalid", "workspace_mismatch"])("goes back to the code lookup after %s, keeping the code", async (code) => {
    const actions: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      actions.push(body.action);
      if (body.action === "lookup") return new Response(JSON.stringify(WITH_OPTIONS), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: { code } }), { status: 409, headers: { "Content-Type": "application/json" } });
    }));
    try {
      render(<DeviceConfirmClient />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText("配对码"), "BCDF-GHJK");
      await user.click(screen.getByRole("button", { name: "查找" }));
      await user.type(await screen.findByLabelText("授权前请再次输入登录密码"), "typed password");
      await user.click(screen.getByLabelText("对象甲"));
      await user.click(screen.getByRole("button", { name: "授权这台设备" }));
      await screen.findByText(/请重新输入配对码查找/);
      expect(screen.queryByRole("button", { name: "授权这台设备" })).toBeNull();
      expect(screen.getByLabelText("配对码")).toHaveProperty("value", "BCDF-GHJK");
      await user.click(screen.getByRole("button", { name: "查找" }));
      await screen.findByLabelText("授权前请再次输入登录密码");
      expect(actions).toEqual(["lookup", "approve", "lookup"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
