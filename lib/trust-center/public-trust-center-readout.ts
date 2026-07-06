/**
 * Public Trust Center readout — pure builder over the synthetic contract
 * fixture (docs/product/fixtures/ai-shelf-trust-center-contract.fixture.json,
 * machine-checked by `npm run check:ai-shelf-trust-center-contract`).
 *
 * Fail-closed: if the fixture carries any forbidden or public-safety flag set
 * to true, the readout degrades to an explicit error state instead of
 * rendering a trust surface over unsafe content. This page is a public-safe
 * posture surface — it is NOT legal advice, certification, reseller
 * authorization, customer deployment, or a production compliance statement.
 */

export const PUBLIC_TRUST_CENTER_READOUT_RULE_VERSION =
  "public-trust-center-readout/v1" as const;

export interface TrustCenterFixtureLike {
  readonly fixtureKind: string;
  readonly fixtureVersion: string;
  readonly publicSafety: Record<string, unknown>;
  readonly trustCenterEvidenceMap: Record<string, string>;
  readonly grayDeviceRedlines: Record<string, string>;
  readonly forbiddenFlags: Record<string, boolean>;
}

export interface TrustCenterSection {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly evidenceRef: string;
}

export interface PublicTrustCenterReadout {
  readonly ok: true;
  readonly ruleVersion: typeof PUBLIC_TRUST_CENTER_READOUT_RULE_VERSION;
  readonly eyebrow: string;
  readonly title: string;
  readonly summary: string;
  readonly sections: readonly TrustCenterSection[];
  readonly grayDeviceRedlines: readonly string[];
  readonly neverList: readonly string[];
  readonly nonClaimNote: string;
  readonly fixtureVersion: string;
}

export interface PublicTrustCenterError {
  readonly ok: false;
  readonly errorCode: "TRUST_FIXTURE_UNSAFE";
  readonly offendingFlags: readonly string[];
}

export type PublicTrustCenterResult =
  | PublicTrustCenterReadout
  | PublicTrustCenterError;

const GRAY_DEVICE_LABELS: Record<string, { zh: string; en: string }> = {
  covertDevice: { zh: "隐蔽录音设备", en: "Covert recording devices" },
  disguisedDevice: { zh: "伪装设备", en: "Disguised devices" },
  modifiedDevice: { zh: "改装设备", en: "Modified devices" },
  remoteControlDevice: { zh: "远控设备", en: "Remote-control devices" },
  cheatingDevice: { zh: "作弊设备", en: "Cheating devices" },
  hiddenRecording: { zh: "隐藏录音", en: "Hidden recording" },
  hiddenCollection: { zh: "隐藏采集", en: "Hidden collection" },
  unauthorizedConnector: { zh: "未授权连接器", en: "Unauthorized connectors" },
};

export function buildPublicTrustCenterReadout(input: {
  english: boolean;
  fixture: TrustCenterFixtureLike;
}): PublicTrustCenterResult {
  const { english, fixture } = input;

  const offendingFlags = [
    ...Object.entries(fixture.forbiddenFlags),
    ...Object.entries(fixture.publicSafety).filter(
      ([key, value]) => key.startsWith("contains") && typeof value === "boolean",
    ),
  ]
    .filter(([, value]) => value === true)
    .map(([key]) => key);

  if (offendingFlags.length > 0) {
    return { ok: false, errorCode: "TRUST_FIXTURE_UNSAFE", offendingFlags };
  }

  const refs = fixture.trustCenterEvidenceMap;
  const sections: TrustCenterSection[] = [
    {
      key: "consent-and-notice",
      title: english ? "Authorization and notice" : "授权与告知",
      body: english
        ? "Capture starts only from authorized signal sources. In consent-required workspaces, recording cannot start until authorization and counterparty notice are confirmed; the confirmation is persisted with the session."
        : "采集只从授权信号来源开始。开启同意要求的工作区中，未确认授权与被录方告知无法开始录制；确认记录随会话落库。",
      evidenceRef: refs.consentRef ?? "",
    },
    {
      key: "retention-and-withdrawal",
      title: english ? "Retention and withdrawal" : "保留期与撤销",
      body: english
        ? "Every workspace carries a retention period (default 90 days). Expired sessions surface as a pending-delete review list; deletion is a human decision, and self-service export stays available before deletion."
        : "每个工作区都有保留期设置（默认 90 天）。到期会话进入待删复核清单；删除是人工决定，删除前自助导出始终可用。",
      evidenceRef: refs.retentionRef ?? "",
    },
    {
      key: "audit",
      title: english ? "Audit trail" : "审计",
      body: english
        ? "Key actions write audit records with trace ids. Public-release and boundary guards run machine checks before any public change lands."
        : "关键动作写入带 trace 的审计记录；公开发布与边界守卫在任何公开改动合入前跑机器检查。",
      evidenceRef: refs.auditRef ?? "",
    },
    {
      key: "certification-status",
      title: english ? "Certification status" : "认证状态",
      body: english
        ? "Partner, connector, and workflow-pack certification is a manual gate. There is no automatic certification and no public ranking."
        : "伙伴、连接器与工作流包的认证是人工门禁，没有自动认证，也没有公开排名。",
      evidenceRef: refs.certStatusRef ?? "",
    },
  ];

  const neverList = english
    ? [
        "No auto-send to customers",
        "No auto-approve",
        "No auto-settlement or auto-payment",
        "No auto-procurement or auto-deployment",
        "No covert recording or hidden collection",
        "No reselling and no marketplace",
      ]
    : [
        "不自动向客户发送",
        "不自动审批",
        "不自动结算 / 不自动付款",
        "不自动采购 / 不自动部署",
        "不隐蔽录音 / 不隐藏采集",
        "不做转售 / 不做 marketplace",
      ];

  return {
    ok: true,
    ruleVersion: PUBLIC_TRUST_CENTER_READOUT_RULE_VERSION,
    eyebrow: english ? "Trust Center · Public safe" : "Trust Center · 公开安全",
    title: english ? "How Helm handles trust" : "Helm 如何对待信任",
    summary: english
      ? "One place for the authorization, notice, retention, audit, withdrawal, certification, and forbidden-action posture that governs every Helm capture and recommendation."
      : "一个入口看清约束 Helm 每一次采集与建议的授权、告知、保留期、审计、撤销、认证与禁止项姿态。",
    sections,
    grayDeviceRedlines: Object.entries(fixture.grayDeviceRedlines)
      .filter(([, value]) => value === "blocked")
      .map(([key]) => {
        const label = GRAY_DEVICE_LABELS[key];
        return label ? (english ? label.en : label.zh) : key;
      }),
    neverList,
    nonClaimNote: english
      ? "This page renders a synthetic, machine-checked contract fixture. It is not legal advice, vendor certification, reseller authorization, customer deployment evidence, or a production compliance statement."
      : "本页渲染的是机器校验的合成契约 fixture。它不是法律意见、供应商认证、转售授权、客户部署证据或生产合规声明。",
    fixtureVersion: fixture.fixtureVersion,
  };
}
