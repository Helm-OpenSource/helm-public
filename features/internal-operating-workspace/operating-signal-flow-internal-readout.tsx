import { AlertTriangle, CheckCircle2, LockKeyhole, PauseCircle, ShieldCheck } from "lucide-react";

import { isEnglishLocale, type UiLocale } from "@/lib/i18n/config";
import type {
  OperatingSignalFlowInternalShadowReadout,
  OperatingSignalFlowInternalShadowReadoutDecision,
  OperatingSignalFlowInternalShadowReadoutOwnerRole,
  OperatingSignalFlowInternalShadowReadoutState,
} from "@/lib/operating-signal-flow/internal-shadow-readout";

export function OperatingSignalFlowInternalReadoutPanel({
  locale,
  readout,
}: {
  readonly locale: UiLocale;
  readonly readout: OperatingSignalFlowInternalShadowReadout;
}) {
  const english = isEnglishLocale(locale);
  const copy = english ? en : zh;
  const state = copy.states[readout.state];
  const decision = copy.decisions[readout.reviewerDecision];
  const Icon = decisionIcon[readout.reviewerDecision];
  const safeFieldFamilies = readout.allowedFieldFamilies
    .map((family) => copy.fieldFamilies[family] ?? family)
    .join(" / ");
  const forbiddenFieldFamilies = readout.forbiddenFieldFamilies
    .slice(0, 4)
    .map((family) => copy.forbiddenFieldFamilies[family] ?? family)
    .join(" / ");
  const guardSummary = buildGuardSummary(readout, english);

  return (
    <section
      aria-label={copy.ariaLabel}
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-[color:var(--foreground)]"
      data-fixture-contract="internal-shadow-readout"
      data-internal-readout-only="true"
      data-production-truth="false"
      data-route-page-adoption="false"
      data-testid="operating-signal-flow-internal-readout"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 items-center rounded-full border border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border)_72%)] bg-[color:color-mix(in_oklab,var(--accent-soft)_58%,var(--surface)_42%)] px-3 text-xs font-semibold">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-[color:var(--accent)]" />
              {copy.badge}
            </span>
            <span
              className="inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-semibold"
              data-decision={readout.reviewerDecision}
              data-testid="internal-readout-decision"
            >
              <Icon className="mr-1.5 h-3.5 w-3.5" />
              {decision}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-semibold leading-7 md:text-2xl" data-testid="internal-readout-title">
            {state.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted-foreground)]">
            {state.detail}
          </p>
          <p className="mt-3 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-sm font-medium">
            <LockKeyhole className="mr-1.5 inline h-3.5 w-3.5 text-[color:var(--accent-warm)]" />
            {copy.boundary}
          </p>
        </div>

        <div className="grid content-start gap-2" data-testid="internal-readout-owner-routing">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
            {copy.ownerRouting}
          </p>
          <div className="flex flex-wrap gap-2">
            {readout.ownerRoles.map((role) => (
              <span
                className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold"
                key={role}
              >
                {copy.roles[role]}
              </span>
            ))}
          </div>
          <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
            {readout.requiredResponse}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4" data-testid="internal-readout-metrics">
        <Metric label={copy.metrics.scope} value={readout.scope.singleWorkspace ? "1" : formatNullable(readout.scope.workspaceCount)} />
        <Metric label={copy.metrics.events} value={formatNullable(readout.volume.eventCount)} />
        <Metric label={copy.metrics.boundary} value={formatNullable(readout.risk.boundaryCounter)} />
        <Metric label={copy.metrics.pending} value={formatNullable(readout.risk.pendingReviewCount)} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ReadoutBlock label={copy.safeFields} value={safeFieldFamilies} />
        <ReadoutBlock label={copy.forbiddenFields} value={forbiddenFieldFamilies} />
        <ReadoutBlock label={copy.adoptionGuards} value={guardSummary} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-lg font-semibold" data-testid="internal-readout-metric-value">
        {value}
      </p>
    </div>
  );
}

function ReadoutBlock({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6">{value}</p>
    </div>
  );
}

function buildGuardSummary(readout: OperatingSignalFlowInternalShadowReadout, english: boolean): string {
  const blocked = Object.entries(readout.adoptionGuards)
    .filter(([, allowed]) => allowed === false)
    .length;
  return english
    ? `${blocked} adoption paths blocked; fixture banner and route/page posture unchanged.`
    : `${blocked} 类接入路径保持阻断；fixture banner 与 route/page 姿态不变。`;
}

function formatNullable(value: number | null): string {
  return value === null ? "-" : String(value);
}

const decisionIcon: Record<OperatingSignalFlowInternalShadowReadoutDecision, typeof CheckCircle2> = {
  continue: CheckCircle2,
  revise: AlertTriangle,
  stop: PauseCircle,
};

const zh: Copy = {
  ariaLabel: "内部影子读数复核",
  badge: "内部只读读数",
  boundary: "只展示已脱敏计数和复核路由；不代表生产真值，不授权页面接入、自动执行或外发。",
  ownerRouting: "负责人路由",
  safeFields: "允许展示",
  forbiddenFields: "禁止展示",
  adoptionGuards: "接入保护",
  metrics: {
    scope: "工作区",
    events: "事件数",
    boundary: "边界计数",
    pending: "待复核",
  },
  states: {
    shadow_disabled: {
      title: "Shadow 默认关闭",
      detail: "保持生产页面不变，继续使用 fixture-backed /operating。",
    },
    shadow_not_allowed: {
      title: "工作区未进入 allowlist",
      detail: "停止推进，先修正 allowlist 与复核边界。",
    },
    shadow_ready_clean: {
      title: "Shadow 读数可内部复核",
      detail: "单工作区、边界计数为 0，可作为内部只读 readout 继续评审。",
    },
    shadow_ready_drift_review: {
      title: "Shadow 读数出现计数漂移",
      detail: "漂移必须由 ActionItem / ApprovalTask / AuditLog receipt 解释后才能继续。",
    },
    shadow_boundary_blocked: {
      title: "Shadow 被边界阻断",
      detail: "停止接入路径，交由 Security 与 Data Protection 复核。",
    },
    shadow_degraded: {
      title: "Shadow 投影降级",
      detail: "作为 runtime readiness blocker 处理，先修 adapter 或输入。",
    },
    shadow_expired: {
      title: "Shadow 探测已过期",
      detail: "重新跑 process-local probe 后再作 founder decision。",
    },
  },
  decisions: {
    continue: "继续内部复核",
    revise: "修订后再看",
    stop: "停止推进",
  },
  roles: {
    engineering_reviewer: "工程复核",
    product_owner: "产品负责人",
    security_reviewer: "安全复核",
    operations_reviewer: "运营复核",
    data_protection_reviewer: "数据保护复核",
    founder_operator: "创始人经营者",
  },
  fieldFamilies: {
    state: "状态",
    scope: "范围",
    volume: "数量",
    risk: "风险",
    quality: "质量",
    drift: "漂移",
    decision: "决策",
  },
  forbiddenFieldFamilies: {
    "raw trace ids": "原始 trace id",
    "request ids": "request id",
    "parent event ids": "parent event id",
    "raw audit payloads": "原始审计 payload",
    "actor names or emails": "人员姓名或邮箱",
    "source pages": "来源页面",
    "object ids": "对象 ID",
    "rich action descriptions": "富文本行动描述",
    "rich approval content": "富文本审批内容",
    "external-send targets": "外发目标",
    "official-system payloads": "官方系统 payload",
  },
};

const en: Copy = {
  ariaLabel: "Internal shadow readout review",
  badge: "Internal readout only",
  boundary:
    "Shows sanitized counters and reviewer routing only; not production truth and not authority for page adoption, auto execution, or outbound send.",
  ownerRouting: "Owner routing",
  safeFields: "Allowed fields",
  forbiddenFields: "Forbidden fields",
  adoptionGuards: "Adoption guards",
  metrics: {
    scope: "Workspace",
    events: "Events",
    boundary: "Boundary",
    pending: "Pending",
  },
  states: {
    shadow_disabled: {
      title: "Shadow remains disabled",
      detail: "Keep the production page unchanged and keep /operating fixture-backed.",
    },
    shadow_not_allowed: {
      title: "Workspace is not allowlisted",
      detail: "Stop the path until allowlist and review boundaries are corrected.",
    },
    shadow_ready_clean: {
      title: "Shadow readout is ready for internal review",
      detail: "Single workspace and zero boundary counter; safe for internal readout review only.",
    },
    shadow_ready_drift_review: {
      title: "Shadow readout has count drift",
      detail: "Operations must explain drift from ActionItem / ApprovalTask / AuditLog receipts before continuing.",
    },
    shadow_boundary_blocked: {
      title: "Shadow is boundary-blocked",
      detail: "Stop adoption and route to Security plus Data Protection review.",
    },
    shadow_degraded: {
      title: "Shadow projection is degraded",
      detail: "Treat as a runtime readiness blocker and revise the adapter or input.",
    },
    shadow_expired: {
      title: "Shadow probe is expired",
      detail: "Rerun the process-local probe before a founder decision.",
    },
  },
  decisions: {
    continue: "Continue internal review",
    revise: "Revise first",
    stop: "Stop path",
  },
  roles: {
    engineering_reviewer: "Engineering",
    product_owner: "Product",
    security_reviewer: "Security",
    operations_reviewer: "Operations",
    data_protection_reviewer: "Data protection",
    founder_operator: "Founder",
  },
  fieldFamilies: {
    state: "state",
    scope: "scope",
    volume: "volume",
    risk: "risk",
    quality: "quality",
    drift: "drift",
    decision: "decision",
  },
  forbiddenFieldFamilies: {
    "raw trace ids": "raw trace IDs",
    "request ids": "request IDs",
    "parent event ids": "parent event IDs",
    "raw audit payloads": "raw audit payloads",
    "actor names or emails": "actor names or emails",
    "source pages": "source pages",
    "object ids": "object IDs",
    "rich action descriptions": "rich action descriptions",
    "rich approval content": "rich approval content",
    "external-send targets": "external-send targets",
    "official-system payloads": "official-system payloads",
  },
};

type Copy = {
  readonly ariaLabel: string;
  readonly badge: string;
  readonly boundary: string;
  readonly ownerRouting: string;
  readonly safeFields: string;
  readonly forbiddenFields: string;
  readonly adoptionGuards: string;
  readonly metrics: Record<"scope" | "events" | "boundary" | "pending", string>;
  readonly states: Record<OperatingSignalFlowInternalShadowReadoutState, { readonly title: string; readonly detail: string }>;
  readonly decisions: Record<OperatingSignalFlowInternalShadowReadoutDecision, string>;
  readonly roles: Record<OperatingSignalFlowInternalShadowReadoutOwnerRole, string>;
  readonly fieldFamilies: Record<string, string>;
  readonly forbiddenFieldFamilies: Record<string, string>;
};
