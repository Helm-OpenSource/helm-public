"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type SeatDeviceLookupView = {
  requestId: string;
  deviceName: string;
  clientVersion: string | null;
  requestedAt: string;
  source: string | null;
  expiresInSeconds: number;
  workspace: { id: string; name: string };
};

// Design v0.3 §4.3: required wording, shown before and with every decision.
export const SEAT_DEVICE_PHISHING_WARNING =
  "如果有人通过电话、短信或聊天让你输入这个码，那是诈骗，请点拒绝。只有你本人刚刚在自己电脑上的坐席客户端里点了“登录”，才应该授权。";

const ERROR_LABELS: Record<string, string> = {
  pairing_code_invalid: "配对码不正确或已失效，请核对坐席客户端上显示的码。",
  password_invalid: "密码不正确。连续输错会锁定登录 15 分钟。",
  rate_limited: "尝试次数过多，请稍后再试。",
  reauthentication_required: "请用密码登录后再授权：退出登录，再用密码登录并回到本页。",
  too_many_devices: "你已授权 3 台设备，请先在设备列表中撤销不用的设备。",
  workspace_not_enabled: "你所在的机构尚未开通坐席客户端。",
  // Also the answer when the browser did not mark the request as same-site
  // (an outdated browser, or the page opened from another address).
  forbidden: "无法完成：请确认你是本机构的在职成员，并用最新版浏览器直接打开本站的授权页再试。",
  workspace_mismatch: "你当前所在的机构已切换，与页面上显示的不一致。请重新输入配对码查找。",
  invalid_input: "输入不符合要求。",
};

async function post(body: Record<string, string>) {
  const response = await fetch("/api/settings/seat-devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(ERROR_LABELS[data?.error?.code] ?? "操作失败，请稍后重试。");
  return data;
}

// The decision step. "拒绝" is the default button: it holds the focus and
// Enter submits the form, which rejects. Enter in the password field does
// nothing, so neither a stray Enter nor a typed password approves: approving
// takes the secondary button.
export function SeatDeviceDecisionPanel(props: {
  lookup: SeatDeviceLookupView;
  pending: boolean;
  onReject: () => void;
  onApprove: (password: string) => void;
}) {
  const { lookup } = props;
  const [password, setPassword] = useState("");
  return (
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); props.onReject(); }}>
      <p>将绑定到机构：<strong>{lookup.workspace.name}</strong></p>
      <p>授权后，这台设备能：看你名下的案件，包括客户个人信息；外呼；写催记。</p>
      <ul className="text-sm">
        <li>请求时间：{new Date(lookup.requestedAt).toLocaleString("zh-CN", { hour12: false })}（服务端记录）</li>
        {lookup.source ? <li>请求来源：{lookup.source}（服务端记录）</li> : null}
        <li>设备名：{lookup.deviceName}；客户端版本：{lookup.clientVersion ?? "—"}（客户端自报，仅供参考）</li>
        <li>配对码约 {Math.max(1, Math.ceil(lookup.expiresInSeconds / 60))} 分钟内有效</li>
      </ul>
      <label className="block text-sm">
        授权前请再次输入登录密码
        <Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
      </label>
      <div className="flex gap-3">
        <Button type="submit" autoFocus disabled={props.pending}>拒绝</Button>
        <Button type="button" variant="secondary" disabled={props.pending || password === ""} onClick={() => props.onApprove(password)}>
          授权这台设备
        </Button>
      </div>
    </form>
  );
}

export function DeviceConfirmClient() {
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<SeatDeviceLookupView | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<string>) {
    startTransition(async () => {
      try {
        setMessage(await action());
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试。");
      }
    });
  }

  function decide(action: "approve" | "reject", password?: string) {
    if (!lookup) return;
    const body = {
      action,
      requestId: lookup.requestId,
      pairingCode: code,
      ...(action === "approve" ? { workspaceId: lookup.workspace.id, password } : {}),
    };
    run(async () => {
      await post(body);
      setLookup(null);
      setCode("");
      return action === "approve" ? "已授权。回到坐席客户端即可继续；如需撤销，请到设备列表。" : "已拒绝，这个配对码已作废。";
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">授权坐席客户端登录</h1>
      <p role="alert" className="rounded-xl border border-[color:var(--accent-danger)] p-3 font-semibold">{SEAT_DEVICE_PHISHING_WARNING}</p>
      {lookup ? (
        <SeatDeviceDecisionPanel lookup={lookup} pending={pending} onReject={() => decide("reject")} onApprove={(password) => decide("approve", password)} />
      ) : (
        <form
          className="flex gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              setLookup(await post({ action: "lookup", pairingCode: code }));
              return "";
            });
          }}
        >
          <Input aria-label="配对码" placeholder="坐席客户端上显示的 8 位配对码" maxLength={9} autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} />
          <Button type="submit" disabled={pending || code.trim() === ""}>查找</Button>
        </form>
      )}
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}
