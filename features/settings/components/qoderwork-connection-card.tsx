"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Copy, KeyRound, RefreshCcw, ShieldAlert, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Connection = {
  id: string;
  displayName: string;
  tokenPrefix: string;
  scopes: string[];
  allowedSourceIds: string[];
  maxDataClassification: string;
  observationProgramId: string;
  status: "active" | "expired" | "revoked";
  expiresAt: string;
  revokedAt: string | null;
  lastConnectedAt: string | null;
  lastClientName: string | null;
  lastClientVersion: string | null;
  lastFailureCode: string | null;
};

type Program = {
  id: string;
  purpose: string;
  expiresAt: string;
  retentionDays: number;
  sources: Array<{
    id: string;
    sourceKey: string;
    sourceKind: string;
    accessMode: string;
    sensitivity: string;
  }>;
};

type ConnectionData = {
  connections: Connection[];
  programs: Program[];
  runtimeEnabled: boolean;
  endpointPath: string;
};

const DEFAULT_SCOPES = [
  "context:read",
  "decision:read",
  "work-packet:read",
  "supervision:read",
  "evidence:propose",
  "draft:propose",
  "receipt:propose",
] as const;

const SCOPE_LABELS: Record<(typeof DEFAULT_SCOPES)[number], { zh: string; en: string }> = {
  "context:read": { zh: "读取经营上下文", en: "Read operating context" },
  "decision:read": { zh: "读取决策对象", en: "Read decision objects" },
  "work-packet:read": { zh: "读取已确认 Work Packet", en: "Read confirmed Work Packets" },
  "supervision:read": { zh: "读取督办摘要", en: "Read supervision summaries" },
  "evidence:propose": { zh: "提交证据候选", en: "Propose evidence candidates" },
  "draft:propose": { zh: "提交草稿候选", en: "Propose draft candidates" },
  "receipt:propose": { zh: "提交回执候选", en: "Propose receipt candidates" },
};

export function QoderWorkConnectionCard({
  canManage,
  english,
}: {
  canManage: boolean;
  english: boolean;
}) {
  const [data, setData] = useState<ConnectionData | null>(null);
  const [loading, setLoading] = useState(canManage);
  const [pending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState("QoderWork owner device");
  const [programId, setProgramId] = useState("");
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [scopes, setScopes] = useState<string[]>([...DEFAULT_SCOPES]);
  const [classification, setClassification] = useState("internal");
  const [shownToken, setShownToken] = useState<string | null>(null);

  const selectedProgram = useMemo(
    () => data?.programs.find((program) => program.id === programId) ?? null,
    [data, programId],
  );

  useEffect(() => {
    if (!canManage) return;
    void loadConnections();
    // loadConnections intentionally refreshes from the current component
    // state only when management access becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  async function loadConnections() {
    setLoading(true);
    try {
      const response = await fetch("/api/settings/external-agent-connections", { cache: "no-store" });
      if (!response.ok) throw new Error("load_failed");
      const next = (await response.json()) as ConnectionData;
      setData(next);
      if (!programId && next.programs[0]) {
        setProgramId(next.programs[0].id);
        setSourceIds(next.programs[0].sources.map((source) => source.id));
      }
    } catch {
      toast.error(english ? "Could not load QoderWork connection state" : "无法读取 QoderWork 连接状态");
    } finally {
      setLoading(false);
    }
  }

  function createConnection() {
    startTransition(async () => {
      const response = await fetch("/api/settings/external-agent-connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName,
          observationProgramId: programId,
          allowedSourceIds: sourceIds,
          allowedObjectTypes: ["opportunity"],
          scopes,
          maxDataClassification: classification,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.token !== "string") {
        toast.error(english ? "Connection creation was blocked" : "连接创建被治理规则阻断");
        return;
      }
      setShownToken(payload.token);
      toast.success(english ? "Device credential created" : "设备凭证已创建");
      await loadConnections();
    });
  }

  function mutateConnection(connectionId: string, action: "rotate" | "revoke") {
    startTransition(async () => {
      const response = await fetch("/api/settings/external-agent-connections", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId, action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(english ? "Connection change failed" : "连接变更失败");
        return;
      }
      if (action === "rotate" && typeof payload.token === "string") setShownToken(payload.token);
      toast.success(action === "rotate"
        ? english ? "Credential rotated; the old token is invalid" : "凭证已轮换，旧 Token 已立即失效"
        : english ? "Connection revoked" : "连接已撤销");
      await loadConnections();
    });
  }

  if (!canManage) {
    return (
      <Card className="workspace-panel-muted" data-testid="qoderwork-connection-card">
        <CardHeader>
          <CardTitle>{english ? "QoderWork operating resource assistant" : "QoderWork 经营资源助手"}</CardTitle>
          <CardDescription>
            {english
              ? "Only workspace owners and admins can view or manage device credentials."
              : "只有组织负责人和管理员可以查看或管理设备连接。"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="workspace-panel-muted" data-testid="qoderwork-connection-card">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" aria-hidden="true" />
              {english ? "QoderWork operating resource assistant" : "QoderWork 经营资源助手"}
            </CardTitle>
            <CardDescription className="mt-2 max-w-3xl">
              {english
                ? "Reads only registered sources and submits evidence, draft, or receipt candidates. It cannot approve, send, execute, write CRM, change policy, or promote memory."
                : "只读取已登记来源，并提交证据、草稿或回执候选；不能批准、外发、执行、写 CRM、改策略或晋升记忆。"}
            </CardDescription>
          </div>
          <Badge variant={data?.runtimeEnabled ? "default" : "neutral"}>
            {data?.runtimeEnabled
              ? english ? "Workspace runtime on" : "工作区入口已开启"
              : english ? "Runtime off by default" : "运行入口默认关闭"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!data?.runtimeEnabled ? (
          <div className="flex gap-3 border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-sm text-[color:var(--muted-foreground)]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              {english
                ? "Connection records can be prepared, but MCP calls remain unavailable until both the deployment flag and this workspace flag are owner-authorized."
                : "可以先准备连接记录；只有部署开关和本工作区开关都经 owner 授权后，MCP 调用才会生效。"}
            </p>
          </div>
        ) : null}

        {shownToken ? (
          <div className="border border-[color:var(--warning)] bg-[color:var(--surface)] p-4">
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              {english ? "Copy this token now — it is shown only once" : "请立即复制 Token——它只显示这一次"}
            </p>
            <div className="mt-3 flex gap-2">
              <Input aria-label={english ? "One-time bearer token" : "一次性 Bearer Token"} readOnly value={shownToken} className="font-mono" />
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(shownToken);
                  toast.success(english ? "Token copied" : "Token 已复制");
                }}
              >
                <Copy className="size-4" aria-hidden="true" />
                {english ? "Copy" : "复制"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
              {english
                ? `Streamable HTTP path: ${data?.endpointPath ?? "/api/mcp/qoderwork"}. Use Authorization: Bearer <token>.`
                : `Streamable HTTP 路径：${data?.endpointPath ?? "/api/mcp/qoderwork"}；Header 使用 Authorization: Bearer <token>。`}
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              {english ? "Create a device connection" : "创建设备连接"}
            </p>
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} aria-label={english ? "Device name" : "设备名称"} />
            <Select
              value={programId}
              onValueChange={(value) => {
                setProgramId(value);
                const program = data?.programs.find((item) => item.id === value);
                setSourceIds(program?.sources.map((source) => source.id) ?? []);
              }}
            >
              <SelectTrigger aria-label={english ? "Observation program" : "观察计划"}><SelectValue placeholder={english ? "Select an active observation program" : "选择有效观察计划"} /></SelectTrigger>
              <SelectContent>
                {data?.programs.map((program) => <SelectItem key={program.id} value={program.id}>{program.purpose}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedProgram ? (
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "Allowed sources" : "允许的数据来源"}</legend>
                {selectedProgram.sources.map((source) => (
                  <label key={source.id} className="flex items-start gap-2 text-sm text-[color:var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={sourceIds.includes(source.id)}
                      onChange={(event) => setSourceIds((current) => event.target.checked ? [...new Set([...current, source.id])] : current.filter((id) => id !== source.id))}
                      className="mt-1"
                    />
                    <span>{source.sourceKey}<small className="block text-[color:var(--muted-foreground)]">{source.sourceKind} · {source.sensitivity} · {source.accessMode}</small></span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "Tool permissions" : "工具权限"}</legend>
              <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
                {english ? "Pilot object scope is fixed to opportunity. Approval, send, execution, CRM write, policy change, automation, and memory promotion never appear here." : "试点对象范围固定为商机。批准、外发、执行、CRM 写入、策略变更、自动化和记忆晋升不会出现在这里。"}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {DEFAULT_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-start gap-2 text-sm text-[color:var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={(event) => setScopes((current) => event.target.checked ? [...new Set([...current, scope])] : current.filter((item) => item !== scope))}
                      className="mt-1"
                    />
                    <span>{english ? SCOPE_LABELS[scope].en : SCOPE_LABELS[scope].zh}<small className="block font-mono text-[color:var(--muted-foreground)]">{scope}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Select
              value={classification}
              onValueChange={(value) => {
                setClassification(value);
                if (value === "public") {
                  setScopes((current) => current.filter((scope) => scope.endsWith(":propose")));
                }
              }}
            >
              <SelectTrigger aria-label={english ? "Maximum data classification" : "最高数据等级"}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">public</SelectItem>
                <SelectItem value="internal">internal</SelectItem>
                <SelectItem value="confidential">confidential</SelectItem>
                <SelectItem value="restricted">restricted metadata-only</SelectItem>
              </SelectContent>
            </Select>
            {classification === "public" ? <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">{english ? "Public-only connections may propose candidates but cannot read Helm's internal operating projection." : "public-only 连接可提交候选，但不能读取 Helm 的 internal 经营投影。"}</p> : null}
            <Button type="button" disabled={pending || loading || !programId || sourceIds.length === 0 || scopes.length === 0} onClick={createConnection}>
              <Check className="size-4" aria-hidden="true" />
              {english ? "Create connection" : "创建连接"}
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[color:var(--foreground)]">{english ? "Registered devices" : "已登记设备"}</p>
              <Button type="button" size="sm" variant="ghost" onClick={() => void loadConnections()} disabled={loading}>
                <RefreshCcw className="size-4" aria-hidden="true" />
                {english ? "Refresh" : "刷新"}
              </Button>
            </div>
            {data?.connections.length ? data.connections.map((connection) => (
              <div key={connection.id} className="border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-sm font-medium text-[color:var(--foreground)]">{connection.displayName}</p><p className="mt-1 font-mono text-xs text-[color:var(--muted-foreground)]">{connection.tokenPrefix}••••</p></div>
                  <Badge variant={connection.status === "active" ? "default" : "neutral"}>{connection.status}</Badge>
                </div>
                <p className="mt-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
                  {english ? "Expires" : "到期"}: {new Date(connection.expiresAt).toLocaleString(english ? "en" : "zh-CN")} · {english ? "Last connected" : "最近连接"}: {connection.lastConnectedAt ? new Date(connection.lastConnectedAt).toLocaleString(english ? "en" : "zh-CN") : english ? "Never" : "从未"}
                </p>
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                  {english ? "Client" : "客户端"}: {connection.lastClientName && connection.lastClientVersion ? `${connection.lastClientName} ${connection.lastClientVersion}` : english ? "Not reported" : "尚未上报"}
                </p>
                <p className="mt-1 break-words font-mono text-xs text-[color:var(--muted-foreground)]">{connection.scopes.join(" · ")}</p>
                {connection.lastFailureCode ? <p className="mt-1 text-xs text-[color:var(--danger)]">{english ? "Latest failure" : "最近失败"}: {connection.lastFailureCode}</p> : null}
                {connection.status === "active" ? (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="secondary" disabled={pending} onClick={() => mutateConnection(connection.id, "rotate")}><RefreshCcw className="size-3.5" aria-hidden="true" />{english ? "Rotate" : "轮换"}</Button>
                    <Button size="sm" variant="danger" disabled={pending} onClick={() => mutateConnection(connection.id, "revoke")}><Unplug className="size-3.5" aria-hidden="true" />{english ? "Revoke" : "撤销"}</Button>
                  </div>
                ) : null}
              </div>
            )) : <p className="border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--muted-foreground)]">{loading ? english ? "Loading…" : "加载中…" : english ? "No device connections." : "尚无设备连接。"}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
