// features/seat-device/device-confirm-client.test.tsx
// The D1 verification page (design v0.3 §4.3): the required anti-phishing
// wording, the bound workspace and what the device can do, client-reported
// fields marked as such, the source shown only when the server has a trusted
// one, "拒绝" as the default button, and the page refusing to be framed.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";
import {
  DeviceConfirmClient,
  SEAT_DEVICE_PHISHING_WARNING,
  SeatDeviceDecisionPanel,
  type SeatDeviceLookupView,
} from "@/features/seat-device/device-confirm-client";

const LOOKUP: SeatDeviceLookupView = {
  requestId: "req1",
  deviceName: "前台电脑",
  clientVersion: "1.0.0",
  requestedAt: "2031-01-01T00:00:00.000Z",
  source: "198.51.100.7",
  expiresInSeconds: 540,
  workspace: { name: "示例机构" },
};

const panel = (lookup: SeatDeviceLookupView) =>
  renderToStaticMarkup(<SeatDeviceDecisionPanel lookup={lookup} pending={false} onReject={() => {}} onApprove={() => {}} />);

describe("seat device verification page", () => {
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

  it("refuses framing of /device", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const device = rules.find((rule) => rule.source === "/device");
    expect(device?.headers).toEqual(
      expect.arrayContaining([
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "Cache-Control", value: "no-store, private" },
      ]),
    );
  });
});
