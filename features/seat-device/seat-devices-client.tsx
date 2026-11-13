"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export type SeatDeviceListItem = {
  deviceId: string;
  deviceName: string;
  clientVersion: string | null;
  status: string | null;
  memberName: string | null;
  own: boolean;
  approvedAt: string | null;
  approvalSource: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  approved: "已授权，待客户端领取",
  active: "使用中",
  expired: "已过期",
  revoked: "已撤销",
};

const REVOKE_REASON_LABELS: Record<string, string> = {
  self: "本人撤销",
  admin: "管理员撤销",
  device_logout: "客户端退出登录",
  client_cancelled: "客户端取消",
  client_rejected: "客户端拒收",
  refresh_reuse: "检测到凭据被重复使用",
  password_reset: "密码已修改",
  membership_inactive: "成员已停用",
  seat_inactive: "席位已停用",
  workspace_cancelled: "机构已注销",
};

const time = (value: string | null) => (value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—");

export function SeatDeviceTable(props: { devices: SeatDeviceListItem[]; showMember: boolean; pending: boolean; onRevoke: (device: SeatDeviceListItem) => void }) {
  if (props.devices.length === 0) return <p className="text-sm">暂无设备。</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left">
          {props.showMember ? <th>成员</th> : null}
          <th>设备（客户端自报）</th><th>状态</th><th>授权时间与来源</th><th>最近使用</th><th>到期</th><th />
        </tr>
      </thead>
      <tbody>
        {props.devices.map((device) => (
          <tr key={device.deviceId}>
            {props.showMember ? <td>{device.memberName ?? "—"}</td> : null}
            <td>{device.deviceName}（{device.clientVersion ?? "—"}）</td>
            <td>
              {STATUS_LABELS[device.status ?? ""] ?? "—"}
              {device.revokeReason ? `：${REVOKE_REASON_LABELS[device.revokeReason] ?? "其他原因"}` : null}
            </td>
            <td>{time(device.approvedAt)}{device.approvalSource ? `，${device.approvalSource}` : null}</td>
            <td>{time(device.lastUsedAt)}</td>
            <td>{time(device.expiresAt)}</td>
            <td>
              {device.status === "active" || device.status === "approved" ? (
                <Button type="button" size="sm" variant="danger" disabled={props.pending} onClick={() => props.onRevoke(device)}>撤销</Button>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type DeviceList = { mine: SeatDeviceListItem[]; workspace: SeatDeviceListItem[] | null };

async function fetchDevices(): Promise<DeviceList | null> {
  const response = await fetch("/api/settings/seat-devices", { cache: "no-store" }).catch(() => null);
  return response?.ok ? response.json() : null;
}

export function SeatDevicesClient() {
  const [list, setList] = useState<DeviceList | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const next = await fetchDevices();
    if (next) setList(next);
    else setMessage("设备列表读取失败，请稍后重试。");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchDevices().then((next) => {
      if (cancelled) return;
      if (next) setList(next);
      else setMessage("设备列表读取失败，请稍后重试。");
    });
    return () => { cancelled = true; };
  }, []);

  function revoke(device: SeatDeviceListItem) {
    if (!window.confirm(`撤销「${device.deviceName}」？撤销后这台设备立即失效，需要重新授权。`)) return;
    startTransition(async () => {
      const response = await fetch("/api/settings/seat-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", deviceId: device.deviceId }),
      });
      setMessage(response.ok ? "已撤销。" : "撤销失败：你没有这项操作的权限，或稍后重试。");
      await load();
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">坐席客户端设备</h1>
      <p className="text-sm">在坐席客户端上点“登录”后，到 <a className="underline" href="/device">授权页</a> 输入客户端上显示的配对码。不认识的设备请立即撤销。</p>
      {message ? <p className="text-sm">{message}</p> : null}
      <h2 className="font-semibold">我的设备</h2>
      {list ? <SeatDeviceTable devices={list.mine} showMember={false} pending={pending} onRevoke={revoke} /> : <p className="text-sm">读取中…</p>}
      {list?.workspace ? (
        <>
          <h2 className="font-semibold">本机构全部设备（管理员可见）</h2>
          <SeatDeviceTable devices={list.workspace} showMember pending={pending} onRevoke={revoke} />
        </>
      ) : null}
    </div>
  );
}
