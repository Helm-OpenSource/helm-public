export type PublicHealthState = "healthy" | "degraded" | "manual";

export type PublicHealthRow = {
  readonly key: string;
  readonly state: PublicHealthState;
  readonly title: string;
  readonly body: string;
  readonly nextStep: string;
};

export type PublicHealthReadout = {
  readonly eyebrow: string;
  readonly title: string;
  readonly summary: string;
  readonly overallState: PublicHealthState;
  readonly overallLabel: string;
  readonly overallDescription: string;
  readonly boundaryLabel: string;
  readonly boundaryCopy: string;
  readonly rows: PublicHealthRow[];
  readonly footerNote: string;
};

export type PublicAuditWriteFailureSummary = {
  readonly totalCount: number;
};

type PublicHealthReadoutInput = {
  readonly english: boolean;
  readonly auditWriteFailureSummary: PublicAuditWriteFailureSummary;
};

function stateLabel(state: PublicHealthState, english: boolean): string {
  if (state === "healthy") {
    return english ? "Public-safe" : "可公开演示";
  }
  if (state === "degraded") {
    return english ? "Needs private review" : "需内部复核";
  }
  return english ? "Workspace-scoped" : "工作区内查看";
}

export function buildPublicHealthReadout(
  input: PublicHealthReadoutInput,
): PublicHealthReadout {
  const auditDropObserved = input.auditWriteFailureSummary.totalCount > 0;
  const overallState: PublicHealthState = auditDropObserved ? "degraded" : "healthy";
  const english = input.english;

  const rows: PublicHealthRow[] = [
    {
      key: "public-reachability",
      state: "healthy",
      title: english ? "Public page reachability" : "公开页可达",
      body: english
        ? "This page rendered without workspace login and without probing private runtime resources."
        : "本页无需工作区登录即可渲染，并且不探测私有运行资源。",
      nextStep: english
        ? "Use this page for external demos of degraded-mode posture only."
        : "对外演示时，只把本页作为降级姿态说明。",
    },
    {
      key: "workspace-boundary",
      state: "manual",
      title: english ? "Workspace-first boundary" : "工作区优先边界",
      body: english
        ? "Workspace diagnostics stay behind membership and policy checks. Tenant names, workspace IDs, raw errors, people, amounts and samples are not shown here."
        : "工作区诊断必须留在成员身份与策略检查之后；本页不展示租户名称、工作区 ID、原始错误、人员、金额或样本。",
      nextStep: english
        ? "Inspect workspace-scoped status only after login and with the right role."
        : "只有登录并具备对应角色后，才查看工作区级状态。",
    },
    {
      key: "no-hidden-adoption",
      state: "healthy",
      title: english ? "No hidden adoption claim" : "不暗示生产采用",
      body: english
        ? "Public health does not imply that any workspace has enabled external resources, intelligent enhancement, outbound messaging, approvals or official write-back."
        : "公开健康页不代表任何工作区已经启用外部资源、智能增强、对外消息、审批或正式写回。",
      nextStep: english
        ? "Treat adoption as a private, review-first workspace decision."
        : "任何采用都必须回到工作区内，按先复核再启用处理。",
    },
    {
      key: "review-first-authority",
      state: "healthy",
      title: english ? "Review-first authority" : "先复核权限",
      body: english
        ? "The page can show readiness posture, but it never grants authority to auto-send, auto-approve, auto-execute or create external commitments."
        : "本页可以展示就绪姿态，但不授权自动发送、自动审批、自动执行或生成外部承诺。",
      nextStep: english
        ? "Keep operational decisions inside the governed workspace flow."
        : "经营判断继续留在受治理的工作区流程内。",
    },
    {
      key: "audit-write-guard",
      state: auditDropObserved ? "degraded" : "healthy",
      title: english ? "Audit write guard" : "审计写入守卫",
      body: auditDropObserved
        ? english
          ? "The guarded audit path observed an internal write drop. This public page intentionally omits counts, action types, workspace IDs, raw errors and tenant details."
          : "受守卫的审计路径观察到内部写入丢失。本公开页刻意不展示数量、动作类型、工作区 ID、原始错误或租户细节。"
        : english
          ? "The guarded audit path has not observed an internal write drop. This public page still omits private counters and raw trace details."
          : "受守卫的审计路径未观察到内部写入丢失。本公开页仍不展示私有计数器或原始 trace 细节。",
      nextStep: auditDropObserved
        ? english
          ? "Review private operator logs before any demo that depends on write-trace proof."
          : "依赖写入 trace 证明的演示前，先复核内部 operator 日志。"
        : english
          ? "Continue with public demo posture; inspect private trace details only inside the workspace."
          : "可以继续公开演示姿态；私有 trace 细节只在工作区内查看。",
    },
  ];

  return {
    eyebrow: english ? "Production public health" : "生产公开健康面",
    title: english ? "Health is public-safe by default." : "健康面默认公开安全。",
    summary: english
      ? "This surface is intentionally narrow: it proves the public page is reachable and that Helm is not leaking workspace-scoped runtime details or claiming hidden adoption."
      : "这个页面刻意收窄：只证明公开页可达，并确认 Helm 没有泄露工作区级运行细节，也没有暗示隐藏采用。",
    overallState,
    overallLabel: stateLabel(overallState, english),
    overallDescription: auditDropObserved
      ? english
        ? "Public demo can continue only after private audit review."
        : "完成内部审计复核后，再继续对外演示。"
      : english
        ? "Safe for external demonstration as a boundary and degraded-mode posture."
        : "可作为边界与降级姿态对外演示。",
    boundaryLabel: english ? "Hard boundary" : "硬边界",
    boundaryCopy: english
      ? "No tenant data, workspace IDs, private runtime probes, raw errors, provider posture, hidden connector adoption or external commitment is exposed here."
      : "本页不暴露租户数据、工作区 ID、私有运行探测、原始错误、服务来源姿态、隐藏连接采用或外部承诺。",
    rows,
    footerNote: english
      ? "Workspace-specific health belongs in authenticated settings, diagnostics and operator review surfaces."
      : "工作区级健康状态应留在已认证的设置、诊断与 operator 复核面中。",
  };
}

export function collectPublicHealthVisibleText(readout: PublicHealthReadout) {
  return [
    readout.eyebrow,
    readout.title,
    readout.summary,
    readout.overallLabel,
    readout.overallDescription,
    readout.boundaryLabel,
    readout.boundaryCopy,
    readout.footerNote,
    ...readout.rows.flatMap((row) => [
      row.title,
      row.body,
      row.nextStep,
    ]),
  ].join("\n");
}
