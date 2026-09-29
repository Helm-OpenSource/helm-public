"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MEMBER_MCP_CLIENT_LABELS, MEMBER_MCP_OVERSEAS_CLIENTS, type MemberMcpClientType } from "@/lib/member-mcp/client-types";

type Connection = {
  id: string;
  userId: string;
  clientType: string;
  deviceLabel: string;
  scopes: string[];
  status: string | null;
  requestedAt: string;
  decisionReason: string | null;
  claimDeadlineAt: string | null;
  tokenPrefix: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastClientName: string | null;
  lastFailureCode: string | null;
  memberName?: string | null;
  memberEmail?: string | null;
};

type Overview = {
  runtimeEnabled: boolean;
  approvedClients: MemberMcpClientType[];
  endpointPath: string;
  mine: Connection[];
  approvable: { scope: "none" | "group" | "workspace"; connections: Connection[] };
  canManageApprovers: boolean;
  grants: Array<{ id: string; approverName: string | null; approverEmail: string | null; groupTag: string; grantedAt: string }> | null;
  groupTags: Array<{ groupTag: string; members: number }> | null;
  members: Array<{ userId: string; name: string | null; email: string | null; title: string | null }> | null;
  needsHuman: {
    total: number;
    rows: Array<{
      inboxRef: string;
      memberName: string | null;
      promptRef: string;
      kind: string;
      status: string;
      outcomeCode: string | null;
      attempts: number;
      receivedAt: string;
      unverifiedReason: string | null;
    }>;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  requested: "待审批",
  approved: "已批准，待领取",
  claim_expired: "领取已过期",
  active: "使用中",
  expired: "已过期",
  rejected: "已驳回",
  revoked: "已吊销",
};

const ERROR_LABELS: Record<string, string> = {
  RUNTIME_DISABLED: "本工作区尚未开启 AI 工具接入。",
  CLIENT_NOT_APPROVED: "该客户端不在本工作区的许可名单内。",
  INVALID_INPUT: "输入不符合要求。",
  TOO_MANY_OPEN: "你的在用和待批接入已达上限（5 个），请先吊销不用的。",
  NOT_FOUND: "记录不存在。",
  FORBIDDEN: "你没有这项操作的权限。",
  STATE_CONFLICT: "状态已变化，请刷新后重试。",
};

const SCOPE_LABELS: Record<string, string> = {
  "member:brief:read": "读简报",
  "member:prompt:read": "读提问",
  "member:signal:write": "写工作信号",
  "member:report:write": "写现场报告",
  "member:prompt:respond": "回应提问",
  "member:task:read": "读派给我的任务",
  "member:task:receipt": "回报任务进展",
};

const RESPONSE_KIND_LABELS: Record<string, string> = {
  acknowledge: "已知悉",
  refuse: "拒绝",
  pause: "暂停",
  appeal: "申诉",
  progress_report: "进展汇报",
  free_text_answer: "回答",
};

const INBOX_STATUS_LABELS: Record<string, string> = {
  received: "已收到、待登记",
  held: "暂缓（待人工）",
  registered: "已登记",
  rejected: "未能登记",
};

function scopeSummary(scopes: string[]) {
  return scopes.map(scope => SCOPE_LABELS[scope] ?? scope).join("、");
}

function clientLabel(value: string) {
  const label = MEMBER_MCP_CLIENT_LABELS[value as MemberMcpClientType] ?? value;
  return MEMBER_MCP_OVERSEAS_CLIENTS.includes(value as MemberMcpClientType) ? `${label}（境外）` : label;
}

function time(value: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
}

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/settings/member-agent-connections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(ERROR_LABELS[data?.error] ?? "操作失败，请稍后重试。");
  return data;
}

function setupSnippets(url: string, clientType: string) {
  if (clientType === "claude_code") {
    return `export HELM_MEMBER_TOKEN=<上面的令牌>\nclaude mcp add --transport http helm ${url} --header "Authorization: Bearer $HELM_MEMBER_TOKEN"`;
  }
  if (clientType === "codex") {
    return `# ~/.codex/config.toml（示例，字段以 Codex 当前版本文档为准）\n[mcp_servers.helm]\nurl = "${url}"\nbearer_token_env_var = "HELM_MEMBER_TOKEN"\n\n# 再在终端里：export HELM_MEMBER_TOKEN=<上面的令牌>`;
  }
  return `{\n  "mcpServers": {\n    "helm": {\n      "url": "${url}",\n      "headers": { "Authorization": "Bearer <上面的令牌>" }\n    }\n  }\n}`;
}

export function AiAccessClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [clientType, setClientType] = useState<string>("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [includeWrite, setIncludeWrite] = useState(false);
  const [includeTasks, setIncludeTasks] = useState(false);
  const [claimed, setClaimed] = useState<{ token: string; clientType: string } | null>(null);
  const [grantUser, setGrantUser] = useState("");
  const [grantTag, setGrantTag] = useState("");

  const fetchOverview = useCallback(async (): Promise<Overview | null> => {
    const response = await fetch("/api/settings/member-agent-connections", { cache: "no-store" });
    return response.ok ? ((await response.json()) as Overview) : null;
  }, []);
  const load = useCallback(async () => {
    const next = await fetchOverview();
    if (next) setOverview(next);
  }, [fetchOverview]);
  useEffect(() => {
    let cancelled = false;
    void fetchOverview().then(next => { if (!cancelled && next) setOverview(next); });
    return () => { cancelled = true; };
  }, [fetchOverview]);

  const run = (body: Record<string, unknown>, done?: (data: Record<string, unknown>) => void) =>
    startTransition(async () => {
      setMessage("");
      try {
        const data = await post(body);
        done?.(data);
        await load();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "操作失败");
      }
    });

  if (!overview) return <p>加载中…</p>;
  const endpoint = typeof window === "undefined" ? overview.endpointPath : `${window.location.origin}${overview.endpointPath}`;
  const approvers = overview.approvable.connections;

  return <div className="max-w-4xl space-y-8">
    <header className="space-y-2">
      <h1 className="text-xl font-semibold">AI 工具接入</h1>
      <p className="text-sm text-muted-foreground">用你自己的 Codex、QwenWork、Claude Code 或 WorkBuddy 连接 CAIO：读取你的简报和 CAIO 发给你的提问。当前阶段只读，不会替你做任何审批、发送或执行。一台设备一个令牌，由 owner 或你的主管批准后，由你本人领取，令牌只显示一次、30 天有效。</p>
      <p className="text-sm text-muted-foreground">标注“境外”的工具由境外厂商处理数据：使用时 CAIO 发给你的提问摘要会传到境外。批准前请确认该同事的岗位适合使用。</p>
      <p className="text-sm text-muted-foreground">派给你的任务也可以在网页上看：<a className="underline" href="/caio/my-work">我的 CAIO 任务</a>。</p>
      {!overview.runtimeEnabled && <p className="text-sm text-[color:var(--status-warning-text)]">本工作区尚未开启 AI 工具接入，可以查看记录，但暂时不能申请或使用。</p>}
    </header>

    <p role="status" className="text-sm">{message}</p>

    {claimed && <div className="space-y-2 rounded border border-[color:var(--status-warning-border)] p-4">
      <p className="font-medium">令牌只显示这一次。关闭后无法找回；不要贴到群聊、工单或日志里。</p>
      <textarea aria-label="接入令牌" readOnly value={claimed.token} className="w-full border p-2 font-mono text-xs" rows={2} />
      <p className="text-sm">接入方式（{clientLabel(claimed.clientType)}）：</p>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">{setupSnippets(endpoint, claimed.clientType)}</pre>
      <Button type="button" variant="outline" onClick={() => setClaimed(null)}>我已保存，清除显示</Button>
    </div>}

    <section className="space-y-3">
      <h2 className="text-lg font-medium">我的接入</h2>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault();
        run({ action: "request", clientType, deviceLabel, includeWrite, includeTasks }, () => { setDeviceLabel(""); setIncludeWrite(false); setIncludeTasks(false); setMessage("已提交申请，等待批准。"); });
      }}>
        <label className="text-sm">客户端<select className="block border p-2" value={clientType} onChange={event => setClientType(event.target.value)} required disabled={!overview.runtimeEnabled || pending}>
          <option value="">请选择</option>
          {overview.approvedClients.map(value => <option key={value} value={value}>{clientLabel(value)}</option>)}
        </select></label>
        <label className="text-sm">设备名称<Input value={deviceLabel} onChange={event => setDeviceLabel(event.target.value)} placeholder="例如：办公室 MacBook" minLength={2} maxLength={80} required disabled={!overview.runtimeEnabled || pending} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeWrite} onChange={event => setIncludeWrite(event.target.checked)} disabled={!overview.runtimeEnabled || pending} />同时申请写入（提交工作信号、现场报告与回应 CAIO 提问；信号与报告只作为待审阅的候选）</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeTasks} onChange={event => setIncludeTasks(event.target.checked)} disabled={!overview.runtimeEnabled || pending} />同时申请任务（查看一把手派给我的工作包并回报进展；回报只作为待审阅的候选，不会关闭任务）</label>
        <Button type="submit" disabled={!overview.runtimeEnabled || pending || !clientType}>申请接入</Button>
      </form>
      <ConnectionTable rows={overview.mine} actions={row => <>
        {row.status === "approved" && <Button size="sm" disabled={pending} onClick={() => run({ action: "claim", connectionId: row.id }, data => setClaimed({ token: String(data.token), clientType: row.clientType }))}>领取令牌</Button>}
        {["requested", "approved", "active"].includes(row.status ?? "") && <Button size="sm" variant="outline" disabled={pending} onClick={() => run({ action: "revoke", connectionId: row.id })}>吊销</Button>}
      </>} />
    </section>

    {overview.approvable.scope !== "none" && <section className="space-y-3">
      <h2 className="text-lg font-medium">审批{overview.approvable.scope === "group" ? "（本组同事）" : "（全体成员）"}</h2>
      <ConnectionTable showMember rows={approvers} actions={row => <>
        {row.status === "requested" && <>
          <Button size="sm" disabled={pending} onClick={() => run({ action: "approve", connectionId: row.id })}>批准</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run({ action: "reject", connectionId: row.id })}>驳回</Button>
        </>}
        {["approved", "active"].includes(row.status ?? "") && <Button size="sm" variant="outline" disabled={pending} onClick={() => run({ action: "revoke", connectionId: row.id })}>吊销</Button>}
      </>} />
    </section>}

    {overview.needsHuman && <section className="space-y-3">
      <h2 className="text-lg font-medium">待人工处理的回应（{overview.needsHuman.total}）</h2>
      <p className="text-sm text-muted-foreground">后台没能自动登记的回应。拒绝、暂停、申诉永远不会被丢弃，会一直保留到能够登记为止。</p>
      <p className="rounded border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] px-3 py-2 text-sm text-[color:var(--status-warning-text)]" data-member-taint="untrusted" data-evaluation-use-prohibited="true">不可信内容 · 禁止用于任何评价：理由由同事本人填写，未经核实。拒绝、暂停、申诉以及不回应，永远不作为对任何人的负面信号。</p>
      {overview.needsHuman.rows.length === 0 ? <p className="text-sm text-muted-foreground">暂无。</p> : <table className="w-full text-sm"><thead><tr className="text-left"><th>成员</th><th>提问</th><th>回应</th><th>状态</th><th>原因码</th><th>收到时间</th></tr></thead><tbody>
        {overview.needsHuman.rows.map(row => <tr key={row.inboxRef} className="border-t align-top">
          <td>{row.memberName ?? "—"}</td>
          <td className="font-mono text-xs">{row.promptRef}</td>
          <td>{RESPONSE_KIND_LABELS[row.kind] ?? row.kind}{row.unverifiedReason && <div className="mt-1 text-xs"><span className="mr-1 rounded border border-[color:var(--status-warning-border)] px-1 text-[color:var(--status-warning-text)]" data-member-taint="untrusted">不可信·禁止用于评价</span>{row.unverifiedReason}</div>}</td>
          <td>{INBOX_STATUS_LABELS[row.status] ?? row.status}</td>
          <td className="font-mono text-xs">{row.outcomeCode ?? "—"}（{row.attempts} 次）</td>
          <td>{time(row.receivedAt)}</td>
        </tr>)}
      </tbody></table>}
    </section>}

    {overview.canManageApprovers && <section className="space-y-3">
      <h2 className="text-lg font-medium">主管审批权</h2>
      <p className="text-sm text-muted-foreground">指定某位成员可以批准某个分组（groupTag）同事的接入申请。owner 与管理员本来就可以批准所有人。</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault();
        run({ action: "grant_approver", approverUserId: grantUser, groupTag: grantTag }, () => { setGrantUser(""); setMessage("已指定。"); });
      }}>
        <label className="text-sm">主管<select className="block border p-2" value={grantUser} onChange={event => setGrantUser(event.target.value)} required disabled={pending}>
          <option value="">请选择</option>
          {(overview.members ?? []).map(member => <option key={member.userId} value={member.userId}>{member.name ?? member.email ?? member.userId}{member.title ? ` · ${member.title}` : ""}</option>)}
        </select></label>
        <label className="text-sm">分组<select className="block border p-2" value={grantTag} onChange={event => setGrantTag(event.target.value)} required disabled={pending}>
          <option value="">请选择</option>
          {(overview.groupTags ?? []).map(tag => <option key={tag.groupTag} value={tag.groupTag}>{tag.groupTag}（{tag.members} 人）</option>)}
        </select></label>
        <Button type="submit" disabled={pending || !grantTag || !grantUser}>指定</Button>
      </form>
      <table className="w-full text-sm"><thead><tr className="text-left"><th>主管</th><th>分组</th><th>指定时间</th><th /></tr></thead><tbody>
        {(overview.grants ?? []).map(grant => <tr key={grant.id} className="border-t"><td>{grant.approverName ?? grant.approverEmail ?? "—"}</td><td>{grant.groupTag}</td><td>{time(grant.grantedAt)}</td>
          <td><Button size="sm" variant="outline" disabled={pending} onClick={() => run({ action: "revoke_approver", grantId: grant.id })}>撤销</Button></td></tr>)}
      </tbody></table>
    </section>}
  </div>;
}

function ConnectionTable({ rows, actions, showMember = false }: { rows: Connection[]; actions: (row: Connection) => React.ReactNode; showMember?: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">暂无记录。</p>;
  return <table className="w-full text-sm"><thead><tr className="text-left">
    {showMember && <th>成员</th>}<th>客户端</th><th>设备</th><th>状态</th><th>申请时间</th><th>到期</th><th>最近使用</th><th /></tr></thead>
    <tbody>{rows.map(row => <tr key={row.id} className="border-t align-top">
      {showMember && <td>{row.memberName ?? row.memberEmail ?? "—"}</td>}
      <td>{clientLabel(row.clientType)}</td>
      <td>{row.deviceLabel}{row.tokenPrefix && <div className="font-mono text-xs text-muted-foreground">{row.tokenPrefix}…</div>}<div className="text-xs text-muted-foreground">{scopeSummary(row.scopes)}</div></td>
      <td>{STATUS_LABELS[row.status ?? ""] ?? row.status ?? "未知"}{row.status === "approved" && <div className="text-xs text-muted-foreground">领取截止 {time(row.claimDeadlineAt)}</div>}</td>
      <td>{time(row.requestedAt)}</td>
      <td>{time(row.expiresAt)}</td>
      <td>{time(row.lastUsedAt)}{row.lastClientName && <div className="text-xs text-muted-foreground">{row.lastClientName}</div>}</td>
      <td className="space-x-2 whitespace-nowrap">{actions(row)}</td>
    </tr>)}</tbody></table>;
}
